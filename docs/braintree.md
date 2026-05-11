# Braintree — Agentic Payments (PayPal)

## Overview

Braintree is PayPal's developer-focused payment SDK. It supports vaulted payment methods — store a card or PayPal account once, then charge it autonomously without the user being present. The sandbox is a full real environment mirroring production.

---

## Prerequisites

- Braintree sandbox account — free at [sandbox.braintreegateway.com](https://sandbox.braintreegateway.com)
- Node.js 18+
- Anthropic API key

---

## SDK Installation

```bash
npm install braintree @anthropic-ai/sdk dotenv
npm install -D @types/braintree
```

---

## Enable Test Environment

### Step 1 — Create Sandbox Account

1. Go to [sandbox.braintreegateway.com/merchants/register](https://sandbox.braintreegateway.com/merchants/register)
2. Sign up for a free account
3. Log in and go to **Account → My User → API Keys**
4. Click **Generate New API Key**
5. Copy **Merchant ID**, **Public Key**, and **Private Key**

```env
# .env
BT_MERCHANT_ID=your_merchant_id
BT_PUBLIC_KEY=your_public_key
BT_PRIVATE_KEY=your_private_key
ANTHROPIC_API_KEY=sk-ant-...
```

### Test Payment Methods

Braintree provides test nonces — strings that represent payment methods in sandbox.

| Nonce | Represents |
|---|---|
| `fake-valid-nonce` | Valid Visa card |
| `fake-valid-debit-nonce` | Valid debit card |
| `fake-paypal-billing-agreement-nonce` | PayPal billing agreement |
| `fake-processor-declined-visa-nonce` | Declined card |
| `fake-gateway-rejected-fraud-nonce` | Fraud rejected |

---

## SDK Setup

```typescript
// src/braintree-client.ts
import braintree from "braintree";
import dotenv from "dotenv";

dotenv.config();

export const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BT_MERCHANT_ID!,
  publicKey: process.env.BT_PUBLIC_KEY!,
  privateKey: process.env.BT_PRIVATE_KEY!,
});
```

---

## Creating a Test Customer with a Vaulted Payment Method

```typescript
// src/setup-customer.ts
import { gateway } from "./braintree-client";

export async function createTestCustomer() {
  // 1. Create customer
  const customerResult = await gateway.customer.create({
    firstName: "Agent",
    lastName: "Test",
    email: "agent@test.com",
  });

  if (!customerResult.success) {
    throw new Error(`Customer creation failed: ${customerResult.message}`);
  }

  const customerId = customerResult.customer.id;

  // 2. Create payment method using test nonce and vault it
  const pmResult = await gateway.paymentMethod.create({
    customerId,
    paymentMethodNonce: "fake-valid-nonce",  // test card nonce
    options: { makeDefault: true },
  });

  if (!pmResult.success) {
    throw new Error(`Payment method creation failed: ${pmResult.message}`);
  }

  const paymentMethodToken = pmResult.paymentMethod.token;

  console.log("Customer ID:", customerId);
  console.log("Payment Method Token:", paymentMethodToken);

  return { customerId, paymentMethodToken };
}
```

---

## Building the Agent

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { gateway } from "./braintree-client";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "charge_customer",
    description: "Charge the customer a specific amount",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "string",
          description: "Amount as string with two decimals, e.g. '10.00'",
        },
        description: {
          type: "string",
          description: "What this charge is for",
        },
      },
      required: ["amount", "description"],
    },
  },
  {
    name: "refund_transaction",
    description: "Refund a previous transaction",
    input_schema: {
      type: "object" as const,
      properties: {
        transaction_id: {
          type: "string",
          description: "The Braintree transaction ID to refund",
        },
        amount: {
          type: "string",
          description: "Amount to refund (can be partial), e.g. '5.00'",
        },
      },
      required: ["transaction_id"],
    },
  },
  {
    name: "list_transactions",
    description: "List recent transactions for the customer",
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
  paymentMethodToken: string
): Promise<string> {
  if (toolName === "charge_customer") {
    const { amount, description } = toolInput as {
      amount: string;
      description: string;
    };

    const result = await gateway.transaction.sale({
      amount,
      paymentMethodToken,    // vaulted token — no user present needed
      orderId: `agent-${Date.now()}`,
      options: {
        submitForSettlement: true,
      },
      customFields: {
        description,
        agent: "true",
      },
    });

    if (result.success) {
      return JSON.stringify({
        success: true,
        transaction_id: result.transaction.id,
        amount_charged: `$${result.transaction.amount}`,
        status: result.transaction.status,
      });
    } else {
      return JSON.stringify({
        success: false,
        error: result.message,
      });
    }
  }

  if (toolName === "refund_transaction") {
    const { transaction_id, amount } = toolInput as {
      transaction_id: string;
      amount?: string;
    };

    const result = amount
      ? await gateway.transaction.refund(transaction_id, amount)
      : await gateway.transaction.refund(transaction_id);

    if (result.success) {
      return JSON.stringify({
        success: true,
        refund_id: result.transaction.id,
        amount_refunded: `$${result.transaction.amount}`,
      });
    } else {
      return JSON.stringify({ success: false, error: result.message });
    }
  }

  if (toolName === "list_transactions") {
    const stream = gateway.transaction.search((search) => {
      search.paymentMethodToken().is(paymentMethodToken);
    });

    const transactions: object[] = [];
    for await (const tx of stream) {
      transactions.push({
        id: tx.id,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
      });
      if (transactions.length >= 5) break;
    }

    return JSON.stringify({ transactions });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runBraintreeAgent(
  task: string,
  paymentMethodToken: string
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
            paymentMethodToken
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
import { runBraintreeAgent } from "./agent";

async function main() {
  const { paymentMethodToken } = await createTestCustomer();

  await runBraintreeAgent(
    "Charge me $15 for a data analysis service. Then list my recent transactions.",
    paymentMethodToken
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Verifying Tests

1. Log in to [sandbox.braintreegateway.com](https://sandbox.braintreegateway.com)
2. Go to **Transactions** — all agent charges appear here
3. Click any transaction to see full details including custom fields
4. Go to **Customers** to see the test customer and vaulted payment method

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Authentication` error | Wrong API keys | Double-check merchant ID, public, private keys |
| `Token not found` | Invalid payment method token | Recreate customer and vault the token |
| `Settlement failed` | Needs `submitForSettlement: true` | Add the options flag |
| `Processor declined` | Used declined test nonce | Switch to `fake-valid-nonce` |
