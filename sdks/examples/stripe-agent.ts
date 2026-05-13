#!/usr/bin/env bun
/**
 * NeuralAPI — SaaS Usage Billing Agent (Inflection SDK version)
 *
 * Same business logic as src/agents/stripe-agent.ts, but all financial
 * mutations (charges, payment intents, refunds) are routed through the
 * Inflection policy engine instead of calling Stripe directly.
 *
 * The agent never holds Stripe credentials — those are stored encrypted
 * on the Inflection backend, resolved automatically from the agent key.
 *
 * Usage:
 *   INFLECTION_API_KEY=infl_test_... \
 *   bun run examples/stripe-agent.ts
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { InflectionClient, isDeny, isHold } from "../src";
import { model, logStep } from "../../src/config.js";

const inflection = new InflectionClient({
	apiKey: process.env.INFLECTION_API_KEY!,
	baseUrl: process.env.INFLECTION_BASE_URL ?? "http://localhost:3001",
});



const PLANS = {
	starter:    { name: "Starter",    monthly_cents: 0,     included_calls: 10_000,    overage_per_call: 0.002 },
	growth:     { name: "Growth",     monthly_cents: 4900,  included_calls: 100_000,   overage_per_call: 0.001 },
	enterprise: { name: "Enterprise", monthly_cents: 19900, included_calls: 1_000_000, overage_per_call: 0.0005 },
};

// ─── Simulated customer store (in real usage this comes from your DB) ─────────

const customerStore: Record<string, { name: string; email: string; plan: string; api_calls: number; source: string }> = {
	"cus_acme": {
		name: "Acme Corp",
		email: "billing@acme.com",
		plan: "starter",
		api_calls: 15_432, // over the 10k starter limit
		source: "tok_visa", // Stripe test card token — works directly without a real customer
	},
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function run(task: string) {
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

All payments go through the Inflection policy engine. A HOLD means human approval is required.
Always explain your reasoning before charging. Be precise with amounts.`,
		prompt: task,
		tools: {
			getCustomerUsage: tool({
				description: "Get a customer's API usage and plan details for the current billing cycle",
				parameters: z.object({ customer_id: z.string() }),
				execute: async ({ customer_id }) => {
					const customer = customerStore[customer_id];
					if (!customer) throw new Error(`Customer ${customer_id} not found`);

					const plan = customer.plan as keyof typeof PLANS;
					const planDetails = PLANS[plan];
					const overage = Math.max(0, customer.api_calls - planDetails.included_calls);

					logStep("tool", "getCustomerUsage", { customer_id }, { calls: customer.api_calls, plan, overage });
					return {
						customer_name: customer.name,
						email: customer.email,
						plan,
						plan_details: planDetails,
						api_calls_this_month: customer.api_calls,
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
					billing_period: z.string(),
				}),
				execute: async ({ customer_id, overage_calls, per_call_rate, billing_period }) => {
					const customer = customerStore[customer_id];
					if (!customer) throw new Error(`Customer ${customer_id} not found`);

					const amount_cents = Math.round(overage_calls * per_call_rate * 100);
					const idempotencyKey = crypto.randomUUID();

					// Financial mutation goes through Inflection — no Stripe SDK needed here
					const result = await inflection.stripe.charges.create({
						amount: amount_cents,
						currency: "usd",
						source: customer.source,
						description: `NeuralAPI overage — ${overage_calls.toLocaleString()} calls @ $${per_call_rate}/call (${billing_period})`,
						idempotencyKey,
					});

					logStep("tool", "billOverage", { overage_calls, amount_cents }, { outcome: result.outcome });

					if (isHold(result)) {
						return { status: "pending_approval", approvalId: result.approvalId, reason: result.reason };
					}
					if (isDeny(result)) {
						return { status: "denied", reason: result.reason, rule: result.ruleId };
					}
					return {
						status: "charged",
						providerTxId: result.providerTxId,
						amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
						description: `NeuralAPI overage — ${overage_calls.toLocaleString()} calls @ $${per_call_rate}/call (${billing_period})`,
					};
				},
			}),

			upgradePlan: tool({
				description: "Upgrade a customer to a higher plan and charge the prorated difference",
				parameters: z.object({
					customer_id: z.string(),
					new_plan: z.enum(["growth", "enterprise"]),
					days_remaining_in_cycle: z.number(),
				}),
				execute: async ({ customer_id, new_plan, days_remaining_in_cycle }) => {
					const customer = customerStore[customer_id];
					if (!customer) throw new Error(`Customer ${customer_id} not found`);

					const newPlanDetails = PLANS[new_plan];
					const prorated_amount_cents = Math.round(
						(newPlanDetails.monthly_cents / 30) * days_remaining_in_cycle
					);
					const idempotencyKey = crypto.randomUUID();

					const result = await inflection.stripe.charges.create({
						amount: prorated_amount_cents,
						currency: "usd",
						source: customer.source,
						description: `NeuralAPI plan upgrade to ${newPlanDetails.name} — prorated ${days_remaining_in_cycle} days`,
						idempotencyKey,
					});

					logStep("tool", "upgradePlan", { new_plan, prorated_amount_cents }, { outcome: result.outcome });

					if (isHold(result)) {
						return { status: "pending_approval", approvalId: result.approvalId };
					}
					if (isDeny(result)) {
						return { status: "denied", reason: result.reason };
					}

					// Update local store on success
					customerStore[customer_id].plan = new_plan;

					return {
						status: "upgraded",
						providerTxId: result.providerTxId,
						new_plan: newPlanDetails.name,
						amount_charged: `$${(prorated_amount_cents / 100).toFixed(2)}`,
						included_calls_now: newPlanDetails.included_calls.toLocaleString(),
					};
				},
			}),

			issueRefund: tool({
				description: "Issue a full or partial refund to a customer",
				parameters: z.object({
					charge_id: z.string().describe("Stripe charge ID from a previous billOverage or upgradePlan call"),
					amount_cents: z.number().optional(),
					reason: z.string(),
				}),
				execute: async ({ charge_id, amount_cents, reason }) => {
					const idempotencyKey = crypto.randomUUID();

					const result = await inflection.stripe.refunds.create({
						charge: charge_id,
						...(amount_cents ? { amount: amount_cents } : {}),
						reason: "Customer request",
						idempotencyKey,
					});

					logStep("tool", "issueRefund", { charge_id, amount_cents }, { outcome: result.outcome });

					if (isHold(result)) return { status: "pending_approval", approvalId: result.approvalId };
					if (isDeny(result)) return { status: "denied", reason: result.reason };
					return { status: "refunded", providerTxId: result.providerTxId, agent_reason: reason };
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

// ─── Demo ─────────────────────────────────────────────────────────────────────

await run(
	`Review customer cus_acme's usage for May 2026.
   They're on the Starter plan. Bill any overages automatically.
   If their overage bill exceeds $10, proactively suggest and execute an upgrade to Growth
   (assuming 18 days remaining in the billing cycle) since it would be cheaper for them.
   Show me a billing summary at the end.`
);
