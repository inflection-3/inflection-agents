/**
 * CloudStack — Subscription Lifecycle Agent
 *
 * Business context: CloudStack is a B2B SaaS platform. This agent handles the
 * full subscription lifecycle autonomously: detects failed payments, retries
 * with smart backoff, processes plan upgrades triggered by feature usage,
 * and handles cancellation flows with prorated refunds.
 *
 * Test environment: Braintree sandbox
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import braintree from "braintree";
import { model, logStep } from "../config.js";
import "dotenv/config";

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BT_MERCHANT_ID!,
  publicKey: process.env.BT_PUBLIC_KEY!,
  privateKey: process.env.BT_PRIVATE_KEY!,
});

const CLOUDSTACK_PLANS = {
  startup:    { name: "Startup",    price: 49,   seats: 5,   storage_gb: 50  },
  business:   { name: "Business",   price: 149,  seats: 25,  storage_gb: 500 },
  enterprise: { name: "Enterprise", price: 499,  seats: 999, storage_gb: 5000 },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupTestCustomer() {
  const customerResult = await gateway.customer.create({
    firstName: "TechFlow",
    lastName: "Inc",
    email: "billing@techflow.io",
    company: "TechFlow Inc",
  });

  if (!customerResult.success) throw new Error(customerResult.message);

  const pmResult = await gateway.paymentMethod.create({
    customerId: customerResult.customer.id,
    paymentMethodNonce: "fake-valid-nonce",
    options: { makeDefault: true },
  });

  if (!pmResult.success) throw new Error(pmResult.message);

  return {
    customerId: customerResult.customer.id,
    paymentMethodToken: pmResult.paymentMethod.token,
    // Simulate a customer who just hit their seat limit (23/25 used → needs upgrade check)
    currentPlan: "business",
    seatsUsed: 23,
    seatsIncluded: 25,
    storageUsedGb: 480,
    storageIncludedGb: 500,
    daysSinceLastPayment: 32,  // payment is overdue
  };
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string, paymentMethodToken: string, customerContext: object) {
  console.log(`\n[cloudstack-lifecycle-agent] ${task}\n`);

  const result = await generateText({
    model,
    maxSteps: 15,
    system: `You are LifecycleBot, the autonomous subscription management agent for CloudStack.

Plans:
- Startup: $49/mo — 5 seats, 50GB storage
- Business: $149/mo — 25 seats, 500GB storage
- Enterprise: $499/mo — unlimited seats, 5000GB storage

Your responsibilities:
1. Detect and recover failed/overdue payments automatically
2. Identify customers approaching plan limits and proactively upgrade them
3. Process cancellations with fair prorated refunds
4. Charge renewal payments when they come due

Customer context: ${JSON.stringify(customerContext, null, 2)}

Always state what you're doing and why before each action.`,
    prompt: task,
    tools: {
      chargeRenewal: tool({
        description: "Charge a customer's monthly subscription renewal",
        parameters: z.object({
          plan: z.enum(["startup", "business", "enterprise"]),
          description: z.string(),
        }),
        execute: async ({ plan, description }) => {
          const planDetails = CLOUDSTACK_PLANS[plan];
          const result = await gateway.transaction.sale({
            amount: planDetails.price.toFixed(2),
            paymentMethodToken,
            options: { submitForSettlement: true },
            customFields: { type: "renewal", plan, description },
          });
          logStep("tool", "chargeRenewal", { plan, amount: planDetails.price }, { success: result.success });
          if (!result.success) return { success: false, error: result.message };
          return {
            success: true,
            transaction_id: result.transaction.id,
            amount: `$${planDetails.price}`,
            plan: planDetails.name,
            status: result.transaction.status,
          };
        },
      }),

      chargeUpgrade: tool({
        description: "Charge a prorated upgrade fee when moving to a higher plan mid-cycle",
        parameters: z.object({
          from_plan: z.enum(["startup", "business"]),
          to_plan: z.enum(["business", "enterprise"]),
          days_remaining: z.number().describe("Days remaining in current billing cycle"),
        }),
        execute: async ({ from_plan, to_plan, days_remaining }) => {
          const fromPrice = CLOUDSTACK_PLANS[from_plan].price;
          const toPrice = CLOUDSTACK_PLANS[to_plan].price;
          const dailyDiff = (toPrice - fromPrice) / 30;
          const prorated = parseFloat((dailyDiff * days_remaining).toFixed(2));

          const result = await gateway.transaction.sale({
            amount: prorated.toFixed(2),
            paymentMethodToken,
            options: { submitForSettlement: true },
            customFields: {
              type: "upgrade_proration",
              from_plan,
              to_plan,
              days_remaining: String(days_remaining),
            },
          });

          logStep("tool", "chargeUpgrade", { from_plan, to_plan, prorated }, { success: result.success });
          if (!result.success) return { success: false, error: result.message };
          return {
            success: true,
            transaction_id: result.transaction.id,
            prorated_charge: `$${prorated}`,
            new_plan: CLOUDSTACK_PLANS[to_plan].name,
            new_seats: CLOUDSTACK_PLANS[to_plan].seats,
            new_storage: `${CLOUDSTACK_PLANS[to_plan].storage_gb}GB`,
            status: result.transaction.status,
          };
        },
      }),

      issueProrationRefund: tool({
        description: "Issue a prorated refund when a customer cancels or downgrades mid-cycle",
        parameters: z.object({
          transaction_id: z.string(),
          days_remaining: z.number(),
          plan: z.enum(["startup", "business", "enterprise"]),
          reason: z.string(),
        }),
        execute: async ({ transaction_id, days_remaining, plan, reason }) => {
          const dailyRate = CLOUDSTACK_PLANS[plan].price / 30;
          const refundAmount = parseFloat((dailyRate * days_remaining).toFixed(2));

          const result = await gateway.transaction.refund(
            transaction_id,
            refundAmount.toFixed(2)
          );

          logStep("tool", "issueProrationRefund", { refundAmount, reason }, { success: result.success });
          if (!result.success) return { success: false, error: result.message };
          return {
            success: true,
            refund_id: result.transaction.id,
            amount_refunded: `$${refundAmount}`,
            reason,
            status: result.transaction.status,
          };
        },
      }),

      getTransactionHistory: tool({
        description: "Retrieve recent transactions for reporting",
        parameters: z.object({ limit: z.number().default(5) }),
        execute: async ({ limit }) => {
          const stream = gateway.transaction.search((s) => {
            s.paymentMethodToken().is(paymentMethodToken);
          });
          const txs: object[] = [];
          for await (const tx of stream) {
            txs.push({ id: tx.id, amount: `$${tx.amount}`, status: tx.status, createdAt: tx.createdAt });
            if (txs.length >= limit) break;
          }
          return txs;
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

const customer = await setupTestCustomer();

await run(
  `TechFlow Inc needs lifecycle management. They're ${customer.daysSinceLastPayment} days past due on their Business plan renewal.
   Also, they're using ${customer.seatsUsed}/${customer.seatsIncluded} seats and ${customer.storageUsedGb}GB/${customer.storageIncludedGb}GB storage — nearly at capacity.
   Handle the overdue renewal first, then proactively upgrade them to Enterprise (assume 15 days remaining in cycle)
   since they'll hit their limits within days. Generate a full lifecycle action report.`,
  customer.paymentMethodToken,
  customer
);
