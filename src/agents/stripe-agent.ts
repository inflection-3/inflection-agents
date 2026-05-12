/**
 * NeuralAPI — SaaS Usage Billing Agent
 *
 * Business context: NeuralAPI sells AI inference API access on a metered plan.
 * Customers get 10,000 calls/month free, then pay $0.002/call for overages.
 * This agent monitors usage, bills overages, handles plan upgrades, and issues
 * prorated refunds when customers downgrade mid-cycle.
 *
 * Test environment: Stripe test mode (sk_test_...)
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import Stripe from "stripe";
import { model, logStep } from "../config.js";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

const PLANS = {
  starter:    { name: "Starter",    monthly_cents: 0,      included_calls: 10_000, overage_per_call: 0.002 },
  growth:     { name: "Growth",     monthly_cents: 4900,   included_calls: 100_000, overage_per_call: 0.001 },
  enterprise: { name: "Enterprise", monthly_cents: 19900,  included_calls: 1_000_000, overage_per_call: 0.0005 },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupTestCustomer() {
  const customer = await stripe.customers.create({
    name: "Acme Corp",
    email: "billing@acme.com",
    metadata: {
      plan: "starter",
      company: "Acme Corp",
      api_calls_this_month: "15432",   // simulated usage — over the 10k limit
    },
  });

  const pmId = "pm_card_visa";

  const attachedPm = await stripe.paymentMethods.attach(pmId, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: attachedPm.id },
  });

  return { customerId: customer.id, paymentMethodId: attachedPm.id };
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string, customerId: string, paymentMethodId: string) {
  console.log(`\n[neuralapi-billing-agent] ${task}\n`);

  const result = await generateText({
    model,
    maxSteps: 15,
    system: `You are BillingBot, the autonomous billing agent for NeuralAPI — an AI inference API platform.

Your job:
- Monitor customer API usage and bill overages automatically
- Handle plan upgrades and calculate prorated charges
- Issue refunds for mid-cycle downgrades
- Detect anomalous usage and flag it

Plans:
- Starter: $0/mo, 10,000 calls included, $0.002/call overage
- Growth: $49/mo, 100,000 calls included, $0.001/call overage
- Enterprise: $199/mo, 1,000,000 calls included, $0.0005/call overage

Always explain your reasoning before charging. Be precise with amounts.`,
    prompt: task,
    tools: {
      getCustomerUsage: tool({
        description: "Get a customer's API usage and plan details for the current billing cycle",
        parameters: z.object({
          customer_id: z.string(),
        }),
        execute: async ({ customer_id }) => {
          const customer = await stripe.customers.retrieve(customer_id) as Stripe.Customer;
          const plan = customer.metadata?.plan || "starter";
          const calls = parseInt(customer.metadata?.api_calls_this_month || "0");
          const planDetails = PLANS[plan as keyof typeof PLANS];
          const overage = Math.max(0, calls - planDetails.included_calls);

          logStep("tool", "getCustomerUsage", { customer_id }, { calls, plan, overage });
          return {
            customer_name: customer.name,
            email: customer.email,
            plan,
            plan_details: planDetails,
            api_calls_this_month: calls,
            included_calls: planDetails.included_calls,
            overage_calls: overage,
            overage_amount_due: overage > 0 ? `$${(overage * planDetails.overage_per_call).toFixed(2)}` : "$0.00",
          };
        },
      }),

      billOverage: tool({
        description: "Charge a customer for API call overages beyond their plan limit",
        parameters: z.object({
          customer_id: z.string(),
          overage_calls: z.number(),
          per_call_rate: z.number(),
          billing_period: z.string().describe("e.g. 'May 2026'"),
        }),
        execute: async ({ customer_id, overage_calls, per_call_rate, billing_period }) => {
          const amount_cents = Math.round(overage_calls * per_call_rate * 100);

          const intent = await stripe.paymentIntents.create({
            amount: amount_cents,
            currency: "usd",
            customer: customer_id,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: `NeuralAPI overage — ${overage_calls.toLocaleString()} calls @ $${per_call_rate}/call (${billing_period})`,
            metadata: {
              type: "overage_billing",
              overage_calls: String(overage_calls),
              billing_period,
              agent: "neuralapi-billing",
            },
          });

          logStep("tool", "billOverage", { overage_calls, amount_cents }, { id: intent.id, status: intent.status });
          return {
            payment_intent_id: intent.id,
            amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
            status: intent.status,
            description: intent.description,
          };
        },
      }),

      upgradePlan: tool({
        description: "Upgrade a customer to a higher plan and charge the prorated difference for the current month",
        parameters: z.object({
          customer_id: z.string(),
          new_plan: z.enum(["growth", "enterprise"]),
          days_remaining_in_cycle: z.number().describe("Days left in billing cycle, used for proration"),
        }),
        execute: async ({ customer_id, new_plan, days_remaining_in_cycle }) => {
          const newPlanDetails = PLANS[new_plan];
          const prorated_amount_cents = Math.round(
            (newPlanDetails.monthly_cents / 30) * days_remaining_in_cycle
          );

          const intent = await stripe.paymentIntents.create({
            amount: prorated_amount_cents,
            currency: "usd",
            customer: customer_id,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: `NeuralAPI plan upgrade to ${newPlanDetails.name} — prorated ${days_remaining_in_cycle} days`,
            metadata: {
              type: "plan_upgrade",
              new_plan,
              days_prorated: String(days_remaining_in_cycle),
            },
          });

          await stripe.customers.update(customer_id, {
            metadata: { plan: new_plan },
          });

          logStep("tool", "upgradePlan", { new_plan, prorated_amount_cents }, { id: intent.id });
          return {
            payment_intent_id: intent.id,
            new_plan: newPlanDetails.name,
            amount_charged: `$${(prorated_amount_cents / 100).toFixed(2)}`,
            included_calls_now: newPlanDetails.included_calls.toLocaleString(),
            status: intent.status,
          };
        },
      }),

      issueRefund: tool({
        description: "Issue a full or partial refund to a customer",
        parameters: z.object({
          payment_intent_id: z.string(),
          amount_cents: z.number().optional().describe("Omit for full refund"),
          reason: z.string(),
        }),
        execute: async ({ payment_intent_id, amount_cents, reason }) => {
          const refund = await stripe.refunds.create({
            payment_intent: payment_intent_id,
            ...(amount_cents ? { amount: amount_cents } : {}),
            reason: "requested_by_customer",
            metadata: { agent_reason: reason },
          });

          logStep("tool", "issueRefund", { payment_intent_id, amount_cents }, { id: refund.id });
          return { refund_id: refund.id, status: refund.status };
        },
      }),

      getBillingHistory: tool({
        description: "Get billing history for a customer",
        parameters: z.object({
          customer_id: z.string(),
          limit: z.number().default(5),
        }),
        execute: async ({ customer_id, limit }) => {
          const charges = await stripe.charges.list({ customer: customer_id, limit });
          return charges.data.map((c) => ({
            id: c.id,
            amount: `$${(c.amount / 100).toFixed(2)}`,
            status: c.status,
            description: c.description,
            date: new Date(c.created * 1000).toLocaleDateString(),
          }));
        },
      }),
    },
    onStepFinish({ text }) {
      if (text) console.log("\n[agent]", text);
    },
  });

  console.log("\n[done]", result.text);
  return result;
}

// ── Demo ──────────────────────────────────────────────────────────────────────

const { customerId, paymentMethodId } = await setupTestCustomer();

await run(
  `Review customer ${customerId}'s usage for May 2026.
   They're on the Starter plan. Bill any overages automatically.
   If their overage bill exceeds $10, proactively suggest and execute an upgrade to Growth
   (assuming 18 days remaining in the billing cycle) since it would be cheaper for them.
   Show me a billing summary at the end.`,
  customerId,
  paymentMethodId
);
