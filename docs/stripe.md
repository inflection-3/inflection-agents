# Stripe — Agentic Payments

## Overview

Stripe is the easiest provider for fiat agentic payments. The key feature is `off_session: true` — it tells Stripe the customer isn't present and the agent is charging autonomously. Test mode is a full real environment with no real money.

---

## Prerequisites

- Stripe account: [dashboard.stripe.com](https://dashboard.stripe.com)
- Node.js 18+ or Python 3.9+
- Anthropic API key for the agent

---

## SDK Installation

```bash
# Node.js
npm install stripe @anthropic-ai/sdk dotenv

# Python
pip install stripe anthropic python-dotenv
```

---

## Enable Test Environment

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle **"Test mode"** in the top-right of the dashboard
3. Go to **Developers → API keys**
4. Copy your **Secret key** — it starts with `sk_test_`

```env
# .env
STRIPE_TEST_SECRET_KEY=sk_test_51...
ANTHROPIC_API_KEY=sk-ant-...
```

### Test Cards

Use these card numbers for any test transaction. No real card needed.

| Scenario | Card Number | Expiry | CVV |
|---|---|---|---|
| Success | `4242 4242 4242 4242` | Any future | Any |
| Declined | `4000 0000 0000 0002` | Any future | Any |
| Insufficient funds | `4000 0000 0000 9995` | Any future | Any |
| Requires auth | `4000 0025 0000 3155` | Any future | Any |

---

## SDK Setup

```typescript
// src/stripe-client.ts
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});
```

---

## Creating a Test Customer with a Vaulted Payment Method

The agent needs a stored payment method to charge autonomously. Do this once per user.

```typescript
// src/setup-customer.ts
import { stripe } from "./stripe-client";

export async function createTestCustomer() {
  // 1. Create customer
  const customer = await stripe.customers.create({
    email: "agent-test@example.com",
    name: "Test Agent User",
  });

  // 2. Create a payment method using test card
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: "4242424242424242",
      exp_month: 12,
      exp_year: 2030,
      cvc: "123",
    },
  });

  // 3. Attach to customer
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customer.id,
  });

  // 4. Set as default
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  console.log("Customer ID:", customer.id);
  console.log("Payment Method ID:", paymentMethod.id);

  return { customerId: customer.id, paymentMethodId: paymentMethod.id };
}
```

---

## Building the Agent

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { stripe } from "./stripe-client";

const client = new Anthropic();

// Payment tool the agent can call autonomously
const tools: Anthropic.Tool[] = [
  {
    name: "charge_customer",
    description: "Charge the customer a specific amount for a service or product",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_cents: {
          type: "number",
          description: "Amount in cents (e.g. 1000 = $10.00)",
        },
        description: {
          type: "string",
          description: "What this charge is for",
        },
      },
      required: ["amount_cents", "description"],
    },
  },
  {
    name: "check_balance",
    description: "Check how much the customer has been charged in total this session",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  customerId: string,
  paymentMethodId: string
): Promise<string> {
  if (toolName === "charge_customer") {
    const { amount_cents, description } = toolInput as {
      amount_cents: number;
      description: string;
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,       // agent is acting autonomously
      description,
      metadata: { agent: "true", timestamp: Date.now().toString() },
    });

    return JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
      status: paymentIntent.status,
    });
  }

  if (toolName === "check_balance") {
    const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
    const total = charges.data
      .filter((c) => c.paid)
      .reduce((sum, c) => sum + c.amount, 0);

    return JSON.stringify({
      total_charged: `$${(total / 100).toFixed(2)}`,
      transaction_count: charges.data.length,
    });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runStripeAgent(
  task: string,
  customerId: string,
  paymentMethodId: string
) {
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

    // Collect text output
    for (const block of response.content) {
      if (block.type === "text") {
        console.log("Agent:", block.text);
      }
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\nCalling tool: ${block.name}`, block.input);

          const result = await handleToolCall(
            block.name,
            block.input as Record<string, unknown>,
            customerId,
            paymentMethodId
          );

          console.log(`Tool result:`, JSON.parse(result));

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
import { createTestCustomer } from "./setup-customer";
import { runStripeAgent } from "./agent";

async function main() {
  // Step 1: Set up a test customer (do once, save IDs for reuse)
  const { customerId, paymentMethodId } = await createTestCustomer();

  // Step 2: Run the agent
  await runStripeAgent(
    "I need you to charge me $5 for a report generation service, then check my total balance.",
    customerId,
    paymentMethodId
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Verifying Tests

1. Open [dashboard.stripe.com](https://dashboard.stripe.com) in **Test mode**
2. Go to **Payments** — your agent's charges appear here in real time
3. Go to **Customers** — the test customer and their payment history
4. Each charge shows `off_session: true` in metadata confirming it was agent-driven

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `card_declined` | Test card declined scenario | Use `4242...` card |
| `payment_method_not_attached` | PM not linked to customer | Run `attach()` step |
| `authentication_required` | Card needs 3DS | Use a non-3DS test card |
| `off_session` error | Customer not set up for off-session | Set as default payment method first |
