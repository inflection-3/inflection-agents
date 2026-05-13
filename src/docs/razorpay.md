# Razorpay — Agentic Payments (India / INR)

## Overview

Razorpay is the leading payment gateway in India. For agentic payments, it uses **recurring payment mandates** — the user authorizes a mandate once (e-NACH, UPI AutoPay, or card), and the agent can charge them autonomously after that. Test mode mirrors production with test credentials and test UPI/card details.

---

## Prerequisites

- Razorpay test account — free at [dashboard.razorpay.com](https://dashboard.razorpay.com)
- Node.js 18+
- Anthropic API key

---

## SDK Installation

```bash
npm install razorpay @anthropic-ai/sdk dotenv
npm install -D @types/razorpay
```

---

## Enable Test Environment

### Step 1 — Get Test API Keys

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Sign up for a free account
3. Toggle **"Test Mode"** in the top-left
4. Go to **Settings → API Keys → Generate Key**
5. Copy **Key ID** (starts with `rzp_test_`) and **Key Secret**

```env
# .env
RAZORPAY_TEST_KEY_ID=rzp_test_...
RAZORPAY_TEST_KEY_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...
```

### Test Credentials

**Test UPI IDs:**
| UPI ID | Result |
|---|---|
| `success@razorpay` | Payment success |
| `failure@razorpay` | Payment failure |

**Test Cards:**
| Card Number | Type | Result |
|---|---|---|
| `4111 1111 1111 1111` | Visa | Success |
| `5267 3181 8797 5449` | Mastercard | Success |
| `4000 0000 0000 0002` | Visa | Decline |

**Test Bank (Netbanking):** Select any bank, use these credentials:
- Customer ID: `success`
- Password: `success`

---

## SDK Setup

```typescript
// src/razorpay-client.ts
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_TEST_KEY_ID!,
  key_secret: process.env.RAZORPAY_TEST_KEY_SECRET!,
});
```

---

## Creating a Test Customer and Recurring Mandate

Razorpay recurring payments require a customer + mandate setup. The mandate is the one-time user authorization.

```typescript
// src/setup-customer.ts
import { razorpay } from "./razorpay-client";

export async function createTestCustomer() {
  // 1. Create customer
  const customer = await razorpay.customers.create({
    name: "Agent Test User",
    email: "agent@test.com",
    contact: "+919999999999",
    fail_existing: "0",    // don't fail if customer already exists
  });

  console.log("Customer ID:", customer.id);
  return { customerId: customer.id };
}

// Recurring mandate requires a frontend flow (user present).
// In test mode, simulate it by creating a subscription or using
// the test token approach below.

export async function createTestSubscriptionPlan() {
  // Create a plan for recurring billing
  const plan = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: "Agent Service Plan",
      amount: 100000,    // ₹1000 in paise (1 paise = 0.01 rupee)
      currency: "INR",
      description: "Monthly agent service",
    },
  });

  console.log("Plan ID:", plan.id);
  return { planId: plan.id };
}

export async function createTestSubscription(
  planId: string,
  customerId: string
) {
  const subscription = await (razorpay as any).subscriptions.create({
    plan_id: planId,
    customer_id: customerId,
    total_count: 12,       // 12 billing cycles
    quantity: 1,
    notify_info: {
      notify_phone: "+919999999999",
      notify_email: "agent@test.com",
    },
  });

  console.log("Subscription ID:", subscription.id);
  console.log("Short URL (open to authorize mandate):", subscription.short_url);
  return { subscriptionId: subscription.id };
}
```

---

## Building the Agent

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { razorpay } from "./razorpay-client";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "create_order",
    description: "Create a payment order for the customer",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_paise: {
          type: "number",
          description: "Amount in paise (100 paise = ₹1). E.g. 50000 = ₹500",
        },
        description: {
          type: "string",
          description: "What this order is for",
        },
      },
      required: ["amount_paise", "description"],
    },
  },
  {
    name: "charge_subscription",
    description: "Trigger a charge on an active subscription (autonomous billing)",
    input_schema: {
      type: "object" as const,
      properties: {
        subscription_id: {
          type: "string",
          description: "The Razorpay subscription ID",
        },
      },
      required: ["subscription_id"],
    },
  },
  {
    name: "get_subscription_details",
    description: "Get details and status of a subscription",
    input_schema: {
      type: "object" as const,
      properties: {
        subscription_id: {
          type: "string",
          description: "The Razorpay subscription ID",
        },
      },
      required: ["subscription_id"],
    },
  },
  {
    name: "list_payments",
    description: "List recent payments",
    input_schema: {
      type: "object" as const,
      properties: {
        count: {
          type: "number",
          description: "Number of payments to fetch (max 100)",
        },
      },
      required: [],
    },
  },
];

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === "create_order") {
    const { amount_paise, description } = toolInput as {
      amount_paise: number;
      description: string;
    };

    const order = await razorpay.orders.create({
      amount: amount_paise,
      currency: "INR",
      notes: { description, agent: "true" },
    });

    return JSON.stringify({
      success: true,
      order_id: order.id,
      amount: `₹${amount_paise / 100}`,
      status: order.status,
    });
  }

  if (toolName === "charge_subscription") {
    const { subscription_id } = toolInput as { subscription_id: string };

    // In test mode, get subscription details to verify it's active
    const subscription = await (razorpay as any).subscriptions.fetch(
      subscription_id
    );

    return JSON.stringify({
      subscription_id,
      status: subscription.status,
      paid_count: subscription.paid_count,
      remaining_count: subscription.remaining_count,
      current_end: new Date(subscription.current_end * 1000).toISOString(),
      message: "Subscription is active — next charge happens automatically on billing date",
    });
  }

  if (toolName === "get_subscription_details") {
    const { subscription_id } = toolInput as { subscription_id: string };

    const subscription = await (razorpay as any).subscriptions.fetch(
      subscription_id
    );

    return JSON.stringify({
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      paid_count: subscription.paid_count,
      remaining_count: subscription.remaining_count,
    });
  }

  if (toolName === "list_payments") {
    const { count = 5 } = toolInput as { count?: number };

    const payments = await razorpay.payments.all({ count });

    return JSON.stringify({
      payments: payments.items?.map((p: any) => ({
        id: p.id,
        amount: `₹${p.amount / 100}`,
        status: p.status,
        method: p.method,
        created_at: new Date(p.created_at * 1000).toISOString(),
      })),
    });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runRazorpayAgent(task: string) {
  console.log(`\nAgent task: ${task}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") console.log("Agent:", block.text);
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\nCalling tool: ${block.name}`, block.input);

          const result = await handleToolCall(
            block.name,
            block.input as Record<string, unknown>
          );

          console.log("Tool result:", JSON.parse(result));
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }
}
```

---

## Running and Testing

```typescript
// src/index.ts
import { createTestCustomer, createTestSubscriptionPlan, createTestSubscription } from "./setup-customer";
import { runRazorpayAgent } from "./agent";

async function main() {
  // Step 1: Setup
  const { customerId } = await createTestCustomer();
  const { planId } = await createTestSubscriptionPlan();
  const { subscriptionId } = await createTestSubscription(planId, customerId);

  // Step 2: Run agent
  await runRazorpayAgent(
    `Check subscription ${subscriptionId} status, then create a ₹500 order for a data service.`
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Verifying Tests

1. Log in to [dashboard.razorpay.com](https://dashboard.razorpay.com) in **Test Mode**
2. Go to **Orders** — all agent-created orders appear here
3. Go to **Subscriptions** — see the test subscription and billing cycles
4. Go to **Payments** — completed payments with test card/UPI details

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Authentication failed` | Wrong key pair | Use `rzp_test_` key ID with matching secret |
| `Amount must be integer` | Decimal amount | Always pass paise as integer (₹10 = `1000`) |
| `Customer not found` | Wrong customer ID | Re-run customer creation |
| `Plan not found` | Deleted plan | Re-create the plan |
