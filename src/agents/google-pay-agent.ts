/**
 * StreamAI — Frictionless Plan Upgrade Agent
 *
 * Business context: StreamAI is an AI writing and content tool (think Notion AI
 * or Jasper). Users on the free tier get 10,000 words/month. When they hit 80%
 * of their limit, this agent proactively upgrades them to Pro using their stored
 * Google Pay card — no checkout flow, no interruption. The user just gets a
 * notification: "You've been upgraded to Pro. Your Google Pay card was charged $19."
 *
 * This is the "natural.co" style agentic payment — invisible, intent-driven,
 * frictionless. The agent decides WHEN to charge and for WHAT, based on behavior.
 *
 * Test environment: Stripe test mode (Google Pay tokenizes to Stripe)
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import Stripe from "stripe";
import { model, logStep } from "../config.js";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

const PLANS = {
  free:       { name: "Free",       price_cents: 0,    words_limit: 10_000,  features: ["Basic templates"] },
  pro:        { name: "Pro",        price_cents: 1900, words_limit: 100_000, features: ["All templates", "Brand voice", "SEO tools"] },
  team:       { name: "Team",       price_cents: 4900, words_limit: 500_000, features: ["Everything in Pro", "Team workspace", "Analytics"] },
  enterprise: { name: "Enterprise", price_cents: 19900, words_limit: -1,     features: ["Unlimited words", "Custom models", "SLA"] },
};

// Simulated user database — in production from your users table
const USERS = [
  { id: "usr_001", name: "Sarah K.",      email: "sarah@startup.io",   plan: "free", words_used: 8820,  words_limit: 10_000 },
  { id: "usr_002", name: "Marcus T.",     email: "marcus@agency.com",  plan: "free", words_used: 9950,  words_limit: 10_000 },
  { id: "usr_003", name: "Priya M.",      email: "priya@blog.com",     plan: "pro",  words_used: 87000, words_limit: 100_000 },
  { id: "usr_004", name: "Chen Wei",      email: "chen@techco.com",    plan: "free", words_used: 3100,  words_limit: 10_000 },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupUsersWithGooglePay() {
  const results = await Promise.all(
    USERS.map(async (user) => {
      const customer = await stripe.customers.create({
        name: user.name,
        email: user.email,
        metadata: {
          streamai_user_id: user.id,
          plan: user.plan,
          payment_source: "google_pay",
        },
      });

      const pm = await stripe.paymentMethods.create({
        type: "card",
        // In production: token comes from Google Pay JS API in browser
        card: { number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" },
        metadata: { wallet_type: "google_pay" },
      });

      await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: pm.id },
      });

      return { ...user, stripeCustomerId: customer.id, paymentMethodId: pm.id };
    })
  );

  return results;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string, usersWithPayment: typeof USERS & { stripeCustomerId: string; paymentMethodId: string }[]) {
  console.log(`\n[streamai-upgrade-agent] ${task}\n`);

  const result = await generateText({
    model,
    maxSteps: 20,
    system: `You are UpgradeBot, StreamAI's autonomous user growth and monetization agent.

Your job: monitor user activity and trigger frictionless plan upgrades at the right moment.

Upgrade triggers (act on these automatically):
- User at ≥80% of word limit → upgrade to next tier
- User has been at 100% for 24h+ → upgrade immediately + apologize for the wait
- Pro user at ≥85% of limit → suggest Team upgrade

Plans:
- Free: $0/mo — 10,000 words
- Pro: $19/mo — 100,000 words
- Team: $49/mo — 500,000 words
- Enterprise: $199/mo — unlimited

The user's Google Pay card is already authorized. Charge it directly — no checkout needed.
After upgrading, compose a friendly in-app notification message for each upgraded user.`,
    prompt: task,
    tools: {
      getUserActivity: tool({
        description: "Get all users and their current usage levels",
        parameters: z.object({}),
        execute: async () => {
          logStep("tool", "getUserActivity", null, { users: USERS.length });
          return usersWithPayment.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            plan: u.plan,
            words_used: u.words_used.toLocaleString(),
            words_limit: u.words_limit.toLocaleString(),
            usage_pct: Math.round((u.words_used / u.words_limit) * 100),
            action_needed: u.words_used / u.words_limit >= 0.8,
          }));
        },
      }),

      upgradePlan: tool({
        description: "Charge the user's Google Pay card and upgrade their plan — no user action needed",
        parameters: z.object({
          user_id: z.string(),
          user_name: z.string(),
          from_plan: z.string(),
          to_plan: z.enum(["pro", "team", "enterprise"]),
          reason: z.string().describe("Why this upgrade is being triggered"),
        }),
        execute: async ({ user_id, user_name, from_plan, to_plan, reason }) => {
          const user = usersWithPayment.find((u) => u.id === user_id);
          if (!user) return { error: `User ${user_id} not found` };

          const plan = PLANS[to_plan];

          const intent = await stripe.paymentIntents.create({
            amount: plan.price_cents,
            currency: "usd",
            customer: user.stripeCustomerId,
            payment_method: user.paymentMethodId,
            confirm: true,
            off_session: true,
            description: `StreamAI ${plan.name} plan — auto-upgrade from ${from_plan}`,
            metadata: {
              payment_source: "google_pay",
              user_id,
              upgrade_reason: reason,
              agent: "streamai-upgrade",
            },
          });

          logStep("tool", "upgradePlan", { user_id, to_plan, amount: plan.price_cents }, { id: intent.id, status: intent.status });
          return {
            user_id,
            user_name,
            upgraded_to: plan.name,
            amount_charged: `$${(plan.price_cents / 100).toFixed(2)}`,
            payment_source: "Google Pay",
            payment_intent_id: intent.id,
            status: intent.status,
            new_word_limit: plan.words_limit === -1 ? "Unlimited" : plan.words_limit.toLocaleString(),
            new_features: plan.features,
          };
        },
      }),

      composeNotification: tool({
        description: "Write a friendly in-app notification to send to the upgraded user",
        parameters: z.object({
          user_name: z.string(),
          new_plan: z.string(),
          amount_charged: z.string(),
          new_word_limit: z.string(),
        }),
        execute: async ({ user_name, new_plan, amount_charged, new_word_limit }) => {
          return {
            notification: `Hi ${user_name.split(" ")[0]}! 🎉 You've been upgraded to StreamAI ${new_plan}. Your Google Pay card was charged ${amount_charged}. You now have ${new_word_limit} words/month — keep creating! Manage your plan anytime in Settings.`,
            channel: "in-app + email",
          };
        },
      }),

      getUpgradeSummary: tool({
        description: "Get a summary of all upgrades processed in this run",
        parameters: z.object({}),
        execute: async () => {
          const charges = await stripe.charges.list({ limit: 20 });
          const upgrades = charges.data.filter(
            (c) => c.metadata?.agent === "streamai-upgrade" && c.paid
          );
          const total = upgrades.reduce((sum, c) => sum + c.amount, 0);
          return {
            users_upgraded: upgrades.length,
            total_revenue_generated: `$${(total / 100).toFixed(2)}`,
            upgrades: upgrades.map((c) => ({
              user_id: c.metadata?.user_id,
              plan: c.description,
              amount: `$${(c.amount / 100).toFixed(2)}`,
            })),
          };
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

const usersWithPayment = await setupUsersWithGooglePay();

await run(
  `Run the StreamAI upgrade sweep for today.
   Check all users' usage. Identify anyone at 80%+ of their word limit and upgrade them automatically.
   Charge their Google Pay card, give them more capacity, and write a notification for each.
   At the end, tell me how much new MRR this sweep generated.`,
  usersWithPayment as any
);
