# Agent Registration — End-to-End Guide

**Version:** 1.0  
**Date:** 2026-05-11  

This document covers everything involved in registering an agent with Inflection: the developer-side registration flow, the file structure needed, how the SDK replaces native payment clients, and how the dashboard's agent management UI maps to these concepts.

---

## Table of Contents

1. [What Is an Agent in Inflection's Model?](#1-what-is-an-agent-in-inflections-model)
2. [Two Roles, Two Registration Steps](#2-two-roles-two-registration-steps)
3. [Developer Registration Flow](#3-developer-registration-flow)
4. [Required Files and Project Structure](#4-required-files-and-project-structure)
5. [Converting an Existing Agent to Use Inflection](#5-converting-an-existing-agent-to-use-inflection)
6. [Deployer Onboarding Flow](#6-deployer-onboarding-flow)
7. [How the Dashboard Agent Page Maps to This](#7-how-the-dashboard-agent-page-maps-to-this)
8. [Agent Lifecycle States](#8-agent-lifecycle-states)
9. [Multi-Deployment Architecture](#9-multi-deployment-architecture)
10. [End-to-End Registration Checklist](#10-end-to-end-registration-checklist)

---

## 1. What Is an Agent in Inflection's Model?

An **agent** in Inflection is a registered software identity — specifically, the combination of:

- A stable **Agent ID** (`agt_7x2kp9mn`) — identifies _which agent_ is making calls
- An **Agent Key** (`ak_live_...`) — the credential the SDK uses to authenticate calls to the gateway
- An **Agent Name** — a human-readable label for the dashboard

An agent is registered once by the **developer** who builds it. It is then deployed to many **users** (deployers) who each connect their own payment accounts and configure their own policies against it.

The crucial separation:

```
Developer owns:        the code, the agent registration, the Agent Key
Deployer owns:         the payment credentials, the connector config, the policy
Inflection enforces:   the policy at call time, using the deployer's connectors
```

This means a single agent binary (e.g., `vendor-pay-agent`) can be deployed by hundreds of different businesses, each with completely different Stripe accounts and policies, without any code changes. The Agent Key is the only credential the agent process needs at runtime — it carries no payment access itself.

---

## 2. Two Roles, Two Registration Steps

### Step 1 — Developer Registers the Agent (Dashboard)

The developer (the engineer building the agent) logs into `dashboard.inflection.dev`, navigates to **Agents**, and clicks **Register New Agent**. This takes under 2 minutes.

Output:
- `agentId`: `agt_7x2kp9mn` (stable, public)
- `agentKey`: `ak_live_7x2kp9mn_...` (secret, shown once, stored as env var)
- `testAgentKey`: `ak_test_7x2kp9mn_...` (for sandbox/CI use)

The developer embeds the `agentKey` in their agent's environment and replaces native payment SDK calls with Inflection SDK calls. That's the entire developer integration.

### Step 2 — Deployer Onboards (Dashboard)

The deployer (the business deploying the agent) logs into `dashboard.inflection.dev`. They:

1. Connect their payment accounts (Stripe OAuth, Circle API key, x402 wallet)
2. Assign those connectors to the agent (by `agentId`, which the developer provides)
3. Set connector policies (allowedActions, limits, approval thresholds)
4. Configure notification channels (Slack webhook for approvals)

Once the deployer completes this, the agent's calls start flowing through Inflection for that deployer. No code deployment required.

---

## 3. Developer Registration Flow

### 3.1 In the Dashboard

```
Agents page → [+ Register New Agent]
  │
  ▼
Dialog: Agent Name + optional Description
  e.g. "vendor-pay-agent", "NeuralAPI Billing Bot"
  │
  ▼
POST /v1/agents
{
  "name": "vendor-pay-agent",
  "description": "Autonomous AP payment agent for enterprise deployments",
  "webhookUrl": "https://your-agent.example.com/inflection/callback"  // optional
}
  │
  ▼
Response (shown ONCE — save both keys immediately):
{
  "agentId":     "agt_7x2kp9mn",
  "agentKey":    "ak_live_7x2kp9mn_51abc...xxxx",   ← live, production key
  "testAgentKey": "ak_test_7x2kp9mn_99xyz...yyyy",  ← sandbox/test key
  "createdAt":   "2026-05-11T10:00:00Z"
}
```

**The full agentKey is only shown once.** After this dialog is closed, only the prefix (`ak_live_7x2k••••`) is stored and displayed. The developer must copy it immediately and store it in their secrets manager or `.env`.

### 3.2 Key Management

The developer will typically have two keys per agent:

| Key | Prefix | Use |
|-----|--------|-----|
| Live key | `ak_live_...` | Production traffic; real money moves |
| Test key | `ak_test_...` | Sandbox/CI; all provider calls are mocked |

Both keys are set as environment variables. The agent code selects the key based on environment:

```bash
# .env.production
INFLECTION_AGENT_KEY=ak_live_7x2kp9mn_51abc...

# .env.test / .env.ci
INFLECTION_AGENT_KEY=ak_test_7x2kp9mn_99xyz...
```

### 3.3 What the Agent Key Resolves To at the Gateway

When the SDK sends `Authorization: Bearer ak_live_7x2kp9mn_...` to the gateway:

```
Gateway auth middleware:
  1. Hash the received key (Argon2id)
  2. Look up matching hash in agent_api_keys table
  3. Resolve → agentId: "agt_7x2kp9mn"
  4. Look up agent record → developerId, status
  5. Identify the calling user context:
     - The deployer's connectors are matched by agentId + userId
     - userId comes from the deployer's Inflection account linked to this agent
  6. Load connector + policies for (agentId, userId)
```

The key itself carries no permissions — it is only an identity token. The permissions are entirely in the deployer's connector and policy configuration.

---

## 4. Required Files and Project Structure

### 4.1 Minimum files to run an agent with Inflection

```
your-agent/
├── src/
│   └── agents/
│       └── vendor-pay-agent.ts     ← your agent code (uses Inflection SDK)
├── .env                            ← INFLECTION_AGENT_KEY + other secrets
├── package.json                    ← includes @inflection/sdk
└── tsconfig.json
```

### 4.2 `.env` file

```bash
# Inflection
INFLECTION_AGENT_KEY=ak_live_7x2kp9mn_51abc...

# No payment provider keys needed here — those live in the Inflection dashboard
# under the deployer's connector config.

# Your agent's own LLM / business logic keys
ANTHROPIC_API_KEY=sk-ant-...
```

Note: With Inflection, the agent process itself does not need `STRIPE_SECRET_KEY`, `CIRCLE_API_KEY`, or any payment provider credential. Those are stored encrypted in Inflection under the deployer's account. This is one of the core security benefits.

### 4.3 `package.json` dependencies

```json
{
  "dependencies": {
    "@inflection/sdk": "^1.0.0",
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0"
  }
}
```

The native payment SDKs (`stripe`, `@circle-fin/circle-sdk`, etc.) are **peer dependencies** of `@inflection/sdk`. Install only the ones your agent uses:

```bash
# For an agent that uses Stripe and Circle:
npm install @inflection/sdk stripe @circle-fin/circle-sdk
```

### 4.4 Full project structure (multi-agent monorepo, like this repo)

```
inflection-agents/
├── src/
│   ├── agents/
│   │   ├── stripe-agent.ts        ← NeuralAPI billing agent
│   │   ├── circle-agent.ts        ← RemoteFirst payroll agent
│   │   ├── x402-agent.ts          ← DataForge micropayment agent
│   │   ├── braintree-agent.ts     ← CloudStack subscription agent
│   │   ├── square-agent.ts        ← FreshMart restocking agent
│   │   ├── razorpay-agent.ts      ← QuickKart delivery agent
│   │   └── coinbase-agent.ts      ← FlowDAO payroll agent
│   ├── config.ts                  ← shared LLM model + logging utilities
│   └── index.ts                   ← CLI runner to invoke agents by name
├── .env                           ← all agent keys + API keys
├── .env.example                   ← checked into git, no secrets
├── package.json
└── tsconfig.json
```

### 4.5 `.env.example` (what to check into git)

```bash
# Inflection agent keys — one per agent registered in the dashboard
# Get these from dashboard.inflection.dev → Agents → your agent → API Key
INFLECTION_AGENT_KEY_STRIPE=ak_live_...
INFLECTION_AGENT_KEY_CIRCLE=ak_live_...
INFLECTION_AGENT_KEY_X402=ak_live_...
INFLECTION_AGENT_KEY_BRAINTREE=ak_live_...
INFLECTION_AGENT_KEY_SQUARE=ak_live_...
INFLECTION_AGENT_KEY_RAZORPAY=ak_live_...
INFLECTION_AGENT_KEY_COINBASE=ak_live_...

# LLM
ANTHROPIC_API_KEY=

# NOTE: No payment provider keys here.
# Stripe, Circle, x402, Square, Braintree, Razorpay, Coinbase credentials
# are stored in the Inflection dashboard by each deploying user.
# The agents below do not need them.
```

---

## 5. Converting an Existing Agent to Use Inflection

The current agents in `src/agents/` use native payment SDKs directly (no Inflection SDK). Here is how `stripe-agent.ts` transforms from the current pattern to the Inflection-wrapped pattern.

### 5.1 Current pattern (no Inflection)

```typescript
// src/agents/stripe-agent.ts — CURRENT (pre-Inflection)

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);
//                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                         Agent holds the secret key directly.
//                         No policy enforcement. No audit log.
//                         Credentials must be in every deployment env.

export async function run(task: string, customerId: string, paymentMethodId: string) {
  // ...
  const intent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: "usd",
    customer: customer_id,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,
    description: `NeuralAPI overage — ${overage_calls} calls`,
  });
  // ^^^^ Goes directly to Stripe. No limits. No approval. No audit.
}
```

### 5.2 Inflection pattern (with SDK)

```typescript
// src/agents/stripe-agent.ts — WITH INFLECTION

import { Inflection, InflectionDenyError, isPendingApproval } from "@inflection/sdk";
import { generateText, tool } from "ai";
import { z } from "zod";
import { model, logStep } from "../config.js";

// One initialization. No Stripe key in this process.
const inflection = new Inflection({
  agentKey: process.env.INFLECTION_AGENT_KEY_STRIPE!,
  //        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //        Set in .env. No STRIPE_SECRET_KEY needed.
  //        The deployer's Stripe credentials live in Inflection's vault,
  //        encrypted at rest, decrypted only at call time in the gateway.
});

const { stripe } = inflection.rails;
//      ^^^^^^
//      Exact same interface as native Stripe SDK for intercepted methods.
//      Non-financial methods (customers.retrieve, etc.) pass through unchanged.

export async function run(task: string, customerId: string, paymentMethodId: string) {
  const result = await generateText({
    model,
    maxSteps: 15,
    system: `You are BillingBot...`,
    prompt: task,
    tools: {
      billOverage: tool({
        description: "Charge a customer for API call overages",
        parameters: z.object({
          customer_id: z.string(),
          overage_calls: z.number(),
          per_call_rate: z.number(),
          billing_period: z.string(),
        }),
        execute: async ({ customer_id, overage_calls, per_call_rate, billing_period }) => {
          const amount_cents = Math.round(overage_calls * per_call_rate * 100);

          // This call is intercepted by Inflection:
          // 1. Agent policy checked (globalDailyLimit, allowedRails, etc.)
          // 2. Stripe connector policy checked:
          //    - allowedActions includes "paymentIntents.create"? ✓
          //    - amount_cents within maxPerTransaction? ✓ or DENY
          //    - amount_cents > requireHumanApproval threshold? → HOLD
          //    - dailyLimit not exceeded? ✓ or DENY
          // 3. If ALLOW → forwarded to Stripe using deployer's credentials
          // 4. Audit log entry written regardless of outcome
          const result = await stripe.paymentIntents.create({
            amount: amount_cents,
            currency: "usd",
            customer: customer_id,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: `NeuralAPI overage — ${overage_calls.toLocaleString()} calls (${billing_period})`,
            metadata: {
              type: "overage_billing",
              overage_calls: String(overage_calls),
              billing_period,
              agent: "neuralapi-billing",
            },
          });

          // Handle the three possible outcomes:
          if (isPendingApproval(result)) {
            // Policy held this for human approval (e.g., amount > requireHumanApproval threshold)
            logStep("tool", "billOverage:HELD", { amount_cents }, { approvalId: result.approvalId });
            // Option A: block and wait (suitable for synchronous agents)
            const approved = await result.wait({ timeoutMs: 30 * 60 * 1000 });
            return {
              payment_intent_id: approved.id,
              amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
              status: approved.status,
              approval_required: true,
            };
          }

          // Normal path: result is a native Stripe.PaymentIntent
          logStep("tool", "billOverage", { amount_cents }, { id: result.id, status: result.status });
          return {
            payment_intent_id: result.id,
            amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
            status: result.status,
            description: result.description,
          };
        },
      }),

      // ... other tools (upgradePlan, issueRefund, etc.) follow the same pattern
    },
  });

  return result;
}
```

### 5.3 Error handling pattern for agent tools

Every Inflection-wrapped tool should handle three outcomes:

```typescript
import {
  InflectionDenyError,
  InflectionConnectorError,
  InflectionNetworkError,
  isPendingApproval,
} from "@inflection/sdk";

execute: async ({ ... }) => {
  try {
    const result = await stripe.paymentIntents.create({ ... });

    if (isPendingApproval(result)) {
      // HOLD — give the LLM agent enough context to explain the situation
      return {
        status: "held_for_approval",
        approvalId: result.approvalId,
        message: "This transaction requires human approval. The deployer has been notified via Slack.",
        auditId: result.auditId,
      };
    }

    // ALLOW — normal Stripe.PaymentIntent
    return { status: "success", paymentIntentId: result.id };

  } catch (err) {
    if (err instanceof InflectionDenyError) {
      // DENY — policy blocked this call
      return {
        status: "denied",
        reason: err.message,
        code: err.code,
        // e.g. "DAILY_LIMIT_EXCEEDED" — let the LLM agent explain why to the user
        auditId: err.auditId,
      };
    }
    if (err instanceof InflectionConnectorError) {
      // Deployer hasn't connected Stripe to this agent yet
      return {
        status: "connector_not_configured",
        message: `${err.rail} is not connected. Deployer must connect their ${err.rail} account in the Inflection dashboard.`,
      };
    }
    if (err instanceof InflectionNetworkError) {
      // Gateway unreachable — call was NOT forwarded to Stripe
      // Do NOT fall through to native Stripe — that would bypass policy enforcement
      throw new Error(`Payment gateway unavailable. Please retry. (requestId: ${err.requestId})`);
    }
    throw err; // Re-throw unexpected errors
  }
}
```

### 5.4 Handling `setupTestCustomer` — what changes

The `setupTestCustomer` function in the current agents creates test Stripe resources using the native SDK. This function is **not** intercepted by Inflection — it runs before the agent and just creates test data. In the Inflection pattern, setup code that is purely administrative (creating test customers, attaching payment methods) can continue to use a minimal Stripe SDK instance scoped to test setup only.

```typescript
// Test setup can still use Stripe directly (non-financial, setup-only calls)
// This is NOT the live agent — it's scaffolding for the test environment
import Stripe from "stripe";
const stripeSetup = new Stripe(process.env.STRIPE_TEST_SETUP_KEY!);
// This key is only used in test setup, not in the agent's payment logic.
// Use a restricted Stripe key with only customers:write, paymentMethods:write.

export async function setupTestCustomer() {
  const customer = await stripeSetup.customers.create({ ... });
  // ...
}
```

In production (non-test) deployments, setup infrastructure is handled through the Inflection dashboard's connector OAuth flow, not through the agent code.

---

## 6. Deployer Onboarding Flow

Once the developer has registered the agent and shared the `agentId`, the deployer follows this sequence in the Inflection dashboard:

```
1. Sign up / log in to dashboard.inflection.dev

2. Connectors page → [+ Connect Account]
   └─ Choose rail (Stripe, Circle, x402)
   └─ Authenticate:
      Stripe: OAuth popup → authorize → Inflection stores encrypted access_token
      Circle: Paste API key → validated → stored encrypted
      x402: Paste wallet address → format validated → stored

3. Assign connector to agent:
   After connecting Stripe account, dialog asks: "Which agents should use this?"
   └─ Check "vendor-pay-agent" (agt_7x2kp9mn)
   └─ Save

4. Policies page → Select "vendor-pay-agent"
   └─ Set Agent Policy (Tier 1):
      allowedRails: stripe, circle
      globalDailyLimit: $100,000
   └─ Set Stripe Connector Policy (Tier 2):
      allowedActions: paymentIntents.create, refunds.create
      maxPerTransaction: $10,000
      requireHumanApproval: above $5,000
      dailyLimit: $50,000

5. Notifications page → Select "vendor-pay-agent"
   └─ Add Slack webhook: https://hooks.slack.com/services/T.../B.../...
   └─ Channel: #payments-approvals
   └─ [Test] to verify

6. ✅ Agent is live — calls from the agent now flow through Inflection
```

From this point, every `stripe.paymentIntents.create` call made by the agent with the deployer's user context is intercepted, policy-checked, logged, and (if above $5,000) sent to Slack for approval.

---

## 7. How the Dashboard Agent Page Maps to This

The `/agents` page in the dashboard (`dashboard/src/routes/agents.tsx`) serves the **developer** view of their registered agents. Each card corresponds to one registration in the `agents` table and one or more rows in `agent_api_keys`.

**What each field maps to:**

| UI Element | Database / System |
|------------|-------------------|
| Agent Name | `agents.name` |
| Agent ID (`agt_7x2kp9mn`) | `agents.id` |
| API Key display (`ak_live_7x2k••••`) | `agent_api_keys.key_prefix` |
| Copy key button | reads `agent_api_keys.key_prefix` (prefix only; full key never re-displayed) |
| Regenerate key | creates new `agent_api_keys` row, marks old row `status: revoked` |
| Status chip (active/inactive) | `agents.status` |
| "Last call: 2 min ago" | `agent_api_keys.last_used_at` |
| "3 Connectors" | COUNT of `connectors` WHERE `agent_id = this.id` |
| "1 Policy" | COUNT of `agent_policies` WHERE `agent_id = this.id AND version = latest` |
| "1,204 Tx" | COUNT of `audit_logs` WHERE `agent_id = this.id` |

**Key operations:**

- **Register:** `POST /v1/agents` → inserts into `agents` + `agent_api_keys`, returns full key once
- **Regenerate key:** `POST /v1/agents/:id/keys` → inserts new `agent_api_keys`, optionally sets grace period on old key
- **Deactivate:** `PATCH /v1/agents/:id` `{ status: "suspended" }` → all gateway calls using this agent's key return `AGENT_SUSPENDED`
- **Delete:** `DELETE /v1/agents/:id` → soft delete; audit logs retained (denormalized, no FK dependency)

### Dashboard UI flow for "Register New Agent"

```
[+ Register New Agent] button
         │
         ▼
Dialog opens (shadcn Dialog):
  ┌───────────────────────────────────────┐
  │ Register New Agent                    │
  │                                       │
  │ Agent Name *                          │
  │ [vendor-pay-agent               ]     │
  │                                       │
  │ Description (optional)                │
  │ [Autonomous AP payment agent...  ]    │
  │                                       │
  │ Webhook URL (optional)                │
  │ [https://your-agent.com/inflect...]   │
  │                                       │
  │            [Cancel]  [Register Agent] │
  └───────────────────────────────────────┘
         │
         ▼
POST /v1/agents → success
         │
         ▼
Success state (same dialog, can't be closed without copying):
  ┌────────────────────────────────────────────────────┐
  │ ✓ Agent registered                                 │
  │                                                    │
  │ Agent ID                                           │
  │ agt_7x2kp9mn              [Copy]                   │
  │                                                    │
  │ Live API Key — save this now, it won't be shown    │
  │ again                                              │
  │ ak_live_7x2kp9mn_51abc...xxxx   [Copy]             │
  │                                                    │
  │ Test API Key (for sandbox/CI)                      │
  │ ak_test_7x2kp9mn_99xyz...yyyy   [Copy]             │
  │                                                    │
  │ ⚠ This is the only time the full keys are shown.  │
  │   Store them in your secrets manager now.          │
  │                                                    │
  │                        [I've saved both keys ✓]   │
  └────────────────────────────────────────────────────┘
```

The "I've saved both keys" button is the only way to close the dialog. This prevents accidental dismissal before copying.

---

## 8. Agent Lifecycle States

```
         Register
            │
            ▼
        ┌───────┐
        │ACTIVE │  ← Default on creation
        └───┬───┘
            │                          │
      Deactivate                   Reactivate
            │                          │
            ▼                          │
       ┌──────────┐                    │
       │SUSPENDED │────────────────────┘
       └────┬─────┘
            │
          Delete
            │
            ▼
        ┌─────────┐
        │ DELETED │  (soft delete; audit logs retained)
        └─────────┘
```

| State | Gateway behavior | Dashboard |
|-------|-----------------|-----------|
| `active` | All calls evaluated normally | Green status chip |
| `suspended` | All calls return `AGENT_SUSPENDED` (403) | Yellow "Suspended" chip |
| `deleted` | All calls return `AGENT_NOT_FOUND` (404) | Not shown in UI |

When an agent is **suspended**, all connectors attached to it stop working immediately. This is the emergency "kill switch" for a misbehaving agent — faster than revoking individual connectors.

---

## 9. Multi-Deployment Architecture

A single agent registration serves multiple deployers simultaneously. The gateway uses the `(agentId, userId)` pair — where `userId` is the deployer who owns the connector making the request — to resolve the correct policy and credentials.

```
                    agt_7x2kp9mn (vendor-pay-agent)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
      user: Acme Corp  user: BetaCo   user: GammaCorp
           │               │               │
      Stripe: acct_001  Stripe: acct_002  Circle: wallet_003
      Policy: $10k max  Policy: $5k max  Policy: $100k max
           │               │               │
    Acme's tx spend    BetaCo's spend   Gamma's spend
    (separate Redis    (isolated)       (isolated)
     counters)
```

Spend counters, velocity limits, and audit logs are all scoped to `(agentId, userId)`. Acme hitting their daily limit doesn't affect BetaCo. The same agent binary serves all three deployers because the `agentKey` resolves to the agent identity, and the gateway looks up which deployer's context applies based on the connector the agent's call resolves to.

**How the gateway identifies the deployer's context:**

When a call arrives at `POST /v1/execute` with `Authorization: Bearer ak_live_7x2kp9mn...`:

1. Resolve `agentId = agt_7x2kp9mn` from the key hash
2. Look up `connectors WHERE agent_id = 'agt_7x2kp9mn' AND rail = 'stripe' AND status = 'active'`
3. If exactly one result → that connector's `user_id` is the deployer context
4. If zero results → `CONNECTOR_NOT_FOUND`
5. If multiple results → this is a configuration error (prevented by unique constraint on `(agent_id, user_id, rail)`)

This means each deployer must connect their own account, not share a connector with another deployer.

---

## 10. End-to-End Registration Checklist

### Developer side

- [ ] Create Inflection account at `dashboard.inflection.dev`
- [ ] Navigate to Agents → Register New Agent
- [ ] Copy and store `agentKey` (live) in production secrets manager
- [ ] Copy and store `testAgentKey` in CI/CD secrets as `INFLECTION_AGENT_KEY`
- [ ] Install `@inflection/sdk` and relevant peer deps (`stripe`, etc.)
- [ ] Replace `new Stripe(process.env.STRIPE_SECRET_KEY!)` with `new Inflection({ agentKey: ... })` and `inflection.rails.stripe`
- [ ] Wrap all intercepted tool calls with `isPendingApproval` check and `InflectionDenyError` catch
- [ ] Remove `STRIPE_SECRET_KEY` / `CIRCLE_API_KEY` etc. from `.env` (no longer needed in agent process)
- [ ] Set `INFLECTION_AGENT_KEY` in `.env` (live) and CI/CD (test)
- [ ] Test against test key — verify ALLOW, DENY, and HOLD code paths work
- [ ] Share `agentId` with deployers who want to use the agent

### Deployer side

- [ ] Create Inflection account at `dashboard.inflection.dev`
- [ ] Connectors page → Connect Account for each payment rail needed
- [ ] Assign each connector to the agent (`agentId` provided by developer)
- [ ] Policies page → set connector-level policies (allowedActions, limits, requireHumanApproval)
- [ ] Optionally: set agent-level policy (globalDailyLimit, allowedRails)
- [ ] Notifications page → add Slack webhook or email for approval notifications
- [ ] Send a test transaction to verify the end-to-end flow
- [ ] Verify the first audit log entry appears in the Audit Logs page

### Shared verification

- [ ] Audit log shows entries for the test transaction
- [ ] Policy version is referenced in the audit entry
- [ ] Hash chain integrity shows "✓ Valid" in the audit log expanded view
- [ ] If `requireHumanApproval` is configured: trigger a transaction above the threshold, verify Slack notification arrives, approve from dashboard or Slack, verify the follow-up audit entry shows `outcome: APPROVED`
