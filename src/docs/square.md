# Square — Agentic Payments

## Overview

Square provides a clean REST API and SDK for payments. It supports customer cards on file — store a card once, charge it autonomously forever after. The sandbox is a full real environment with a dashboard to inspect transactions.

---

## Prerequisites

- Square developer account — free at [developer.squareup.com](https://developer.squareup.com)
- Node.js 18+
- Anthropic API key

---

## SDK Installation

```bash
npm install squareup @anthropic-ai/sdk dotenv
```

---

## Enable Test Environment

### Step 1 — Create Developer Account

1. Go to [developer.squareup.com](https://developer.squareup.com)
2. Sign up and log in
3. Click **Create an Application**
4. In your app, go to **Credentials**
5. Toggle to **Sandbox** tab
6. Copy **Sandbox Access Token**

```env
# .env
SQUARE_SANDBOX_TOKEN=EAAAl...
SQUARE_LOCATION_ID=LOCATION_ID_FROM_DASHBOARD
ANTHROPIC_API_KEY=sk-ant-...
```

Get your location ID from the sandbox dashboard under **Locations**.

### Test Card Nonces

| Nonce | Result |
|---|---|
| `cnon:card-nonce-ok` | Success |
| `cnon:card-nonce-declined` | Declined |
| `cnon:card-nonce-avs-failure` | AVS failure |
| `cnon:card-nonce-cvv-failure` | CVV failure |

---

## SDK Setup

```typescript
// src/square-client.ts
import { Client, Environment } from "squareup";
import dotenv from "dotenv";

dotenv.config();

export const squareClient = new Client({
  environment: Environment.Sandbox,
  accessToken: process.env.SQUARE_SANDBOX_TOKEN!,
});
```

---

## Creating a Test Customer with a Card on File

```typescript
// src/setup-customer.ts
import { squareClient } from "./square-client";
import crypto from "crypto";

export async function createTestCustomer() {
  // 1. Create customer
  const { result: customerResult } = await squareClient.customersApi.createCustomer({
    idempotencyKey: crypto.randomUUID(),
    emailAddress: "agent-test@example.com",
    givenName: "Agent",
    familyName: "Test",
  });

  const customerId = customerResult.customer!.id!;

  // 2. Create card on file using test nonce
  const { result: cardResult } = await squareClient.cardsApi.createCard({
    idempotencyKey: crypto.randomUUID(),
    sourceId: "cnon:card-nonce-ok",    // test nonce
    card: {
      customerId,
      billingAddress: {
        postalCode: "94103",
        country: "US",
      },
    },
  });

  const cardId = cardResult.card!.id!;

  console.log("Customer ID:", customerId);
  console.log("Card ID:", cardId);

  return { customerId, cardId };
}
```

---

## Building the Agent

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { squareClient } from "./square-client";
import crypto from "crypto";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "charge_customer",
    description: "Charge the customer a specific amount in USD cents",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_cents: {
          type: "number",
          description: "Amount in cents (e.g. 1000 = $10.00)",
        },
        note: {
          type: "string",
          description: "Description of what this charge is for",
        },
      },
      required: ["amount_cents", "note"],
    },
  },
  {
    name: "refund_payment",
    description: "Refund a previous payment",
    input_schema: {
      type: "object" as const,
      properties: {
        payment_id: {
          type: "string",
          description: "The Square payment ID to refund",
        },
        amount_cents: {
          type: "number",
          description: "Amount to refund in cents",
        },
        reason: {
          type: "string",
          description: "Reason for the refund",
        },
      },
      required: ["payment_id", "amount_cents"],
    },
  },
  {
    name: "list_payments",
    description: "List recent payments",
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
  cardId: string
): Promise<string> {
  if (toolName === "charge_customer") {
    const { amount_cents, note } = toolInput as {
      amount_cents: number;
      note: string;
    };

    const { result } = await squareClient.paymentsApi.createPayment({
      sourceId: cardId,              // stored card — no user present
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amount_cents),
        currency: "USD",
      },
      note,
      autocomplete: true,
    });

    return JSON.stringify({
      success: true,
      payment_id: result.payment!.id,
      amount_charged: `$${(amount_cents / 100).toFixed(2)}`,
      status: result.payment!.status,
    });
  }

  if (toolName === "refund_payment") {
    const { payment_id, amount_cents, reason } = toolInput as {
      payment_id: string;
      amount_cents: number;
      reason?: string;
    };

    const { result } = await squareClient.refundsApi.refundPayment({
      idempotencyKey: crypto.randomUUID(),
      paymentId: payment_id,
      amountMoney: {
        amount: BigInt(amount_cents),
        currency: "USD",
      },
      reason: reason || "Agent-initiated refund",
    });

    return JSON.stringify({
      success: true,
      refund_id: result.refund!.id,
      status: result.refund!.status,
    });
  }

  if (toolName === "list_payments") {
    const { result } = await squareClient.paymentsApi.listPayments(
      undefined, undefined, undefined, undefined, "5"
    );

    const payments = (result.payments || []).map((p) => ({
      id: p.id,
      amount: p.amountMoney,
      status: p.status,
      createdAt: p.createdAt,
      note: p.note,
    }));

    return JSON.stringify({ payments });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runSquareAgent(
  task: string,
  cardId: string
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
            block.input as Record<string, unknown>,
            cardId
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
import { createTestCustomer } from "./setup-customer";
import { runSquareAgent } from "./agent";

async function main() {
  const { cardId } = await createTestCustomer();

  await runSquareAgent(
    "Charge me $20 for a consulting service. Then show me my recent payments.",
    cardId
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Verifying Tests

1. Go to [developer.squareup.com/apps](https://developer.squareup.com/apps)
2. Click your app → **Sandbox Test Account → Open**
3. This opens the sandbox dashboard — go to **Transactions** to see all agent charges
4. Go to **Customers** to inspect the test customer and card on file

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `UNAUTHORIZED` | Wrong token | Ensure using sandbox token, not production |
| `NOT_FOUND` for location | Missing location ID | Get from sandbox dashboard Locations tab |
| `CARD_TOKEN_EXPIRED` | Nonce was already used | Nonces are single-use; use stored card ID after first use |
| `GENERIC_DECLINE` | Test decline nonce | Use `cnon:card-nonce-ok` |
