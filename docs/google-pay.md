# Google Pay — Agentic Payments

## Overview

Google Pay is a tokenization layer, not a payment processor. It handles the user-facing card authentication step — the user taps "Pay with Google Pay" once, Google returns a payment token, and you pass that token to your processor (Stripe, Braintree, Adyen). After that, the processor holds the vaulted token and the agent can charge it autonomously.

**Architecture:**
```
User (one time) → Google Pay → Payment Token → Processor (Stripe/Braintree)
                                                      ↓
Agent → Processor SDK → off_session charge ← stored token
```

---

## Prerequisites

- Google Pay developer access — free at [pay.google.com/business/console](https://pay.google.com/business/console)
- A processor account (Stripe or Braintree) for the backend
- Node.js 18+ (for backend agent)
- Anthropic API key

This doc uses **Stripe** as the processor. See [stripe.md](./stripe.md) for full Stripe agent setup.

---

## Enable Test Environment

### Step 1 — Join Google Pay Test Card Suite

1. Join this Google Group with the Google account linked to your device:
   [groups.google.com/g/googlepay-test-mode-autofill-audience](https://groups.google.com/g/googlepay-test-mode-autofill-audience)

2. Once joined, test cards automatically appear in your Google Pay when you're in a test environment — no real card needed.

### Step 2 — Get Stripe Test Keys

Follow [stripe.md](./stripe.md) to get `sk_test_` and `pk_test_` keys.

```env
# .env
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## SDK Installation

```bash
# Backend (agent)
npm install stripe @anthropic-ai/sdk dotenv

# Frontend (one-time setup page)
# Google Pay uses a JS library loaded from Google's CDN — no npm package
```

---

## Step 1 — Frontend: Capture Google Pay Token

This is the **one-time user-present step**. Build a simple setup page where the user taps Google Pay. After this, the agent never needs the user again.

```html
<!-- setup.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Authorize Agent Payments</title>
</head>
<body>
  <h2>Authorize Agent to Charge Your Card</h2>
  <div id="google-pay-button"></div>

  <script src="https://pay.google.com/gp/p/js/pay.js"></script>
  <script>
    const STRIPE_PUBLISHABLE_KEY = "pk_test_...";

    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: "TEST",   // Use "PRODUCTION" for live
    });

    const paymentRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [{
        type: "CARD",
        parameters: {
          allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
          allowedCardNetworks: ["AMEX", "DISCOVER", "MASTERCARD", "VISA"],
        },
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: {
            gateway: "stripe",
            "stripe:version": "2018-10-31",
            "stripe:publishableKey": STRIPE_PUBLISHABLE_KEY,
          },
        },
      }],
      merchantInfo: {
        merchantId: "TEST",    // Use real merchant ID in production
        merchantName: "Your App",
      },
      transactionInfo: {
        totalPrice: "0.00",    // $0 authorization — just vaulting the card
        totalPriceStatus: "FINAL",
        currencyCode: "USD",
        countryCode: "US",
      },
    };

    // Render the button
    const button = paymentsClient.createButton({
      onClick: async () => {
        const paymentData = await paymentsClient.loadPaymentData(paymentRequest);
        const token = paymentData.paymentMethodData.tokenizationData.token;

        // Send token to your backend to vault it
        await fetch("/api/vault-google-pay-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, userId: "user_123" }),
        });

        alert("Payment method saved! The agent can now charge you autonomously.");
      },
    });

    document.getElementById("google-pay-button").appendChild(button);
  </script>
</body>
</html>
```

---

## Step 2 — Backend: Vault the Token

```typescript
// src/vault.ts
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

export async function vaultGooglePayToken(googlePayToken: string, userId: string) {
  // 1. Create or get customer
  const customer = await stripe.customers.create({
    metadata: { userId },
  });

  // 2. Create payment method from Google Pay token
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: googlePayToken },
  });

  // 3. Attach to customer
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customer.id,
  });

  // 4. Set as default
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  // Save customer.id and paymentMethod.id in your database
  console.log("Vaulted successfully:");
  console.log("  Customer ID:", customer.id);
  console.log("  Payment Method ID:", paymentMethod.id);
  console.log("  Card brand:", paymentMethod.card?.brand);

  return {
    customerId: customer.id,
    paymentMethodId: paymentMethod.id,
  };
}
```

---

## Step 3 — Building the Agent

The agent uses Stripe to charge the vaulted Google Pay token — it never interacts with Google Pay directly.

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic();
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

const tools: Anthropic.Tool[] = [
  {
    name: "charge_google_pay_card",
    description: "Charge the customer's Google Pay card autonomously",
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
    name: "get_payment_method_info",
    description: "Get info about the stored Google Pay payment method",
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
  if (toolName === "charge_google_pay_card") {
    const { amount_cents, description } = toolInput as {
      amount_cents: number;
      description: string;
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,   // vaulted Google Pay token
      confirm: true,
      off_session: true,                 // no user present — agent charging
      description,
      metadata: {
        payment_source: "google_pay",
        agent: "true",
      },
    });

    return JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      amount: `$${(amount_cents / 100).toFixed(2)}`,
      status: paymentIntent.status,
      payment_source: "google_pay",
    });
  }

  if (toolName === "get_payment_method_info") {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    return JSON.stringify({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year,
        wallet: pm.card?.wallet?.type,   // will show "google_pay"
      },
    });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runGooglePayAgent(
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
            customerId,
            paymentMethodId
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

Since Google Pay requires a real browser for the frontend step, simulate it in tests by creating a Stripe token directly (skipping Google Pay) — the agent behavior is identical.

```typescript
// src/index.ts
import Stripe from "stripe";
import { runGooglePayAgent } from "./agent";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!);

async function simulateGooglePaySetup() {
  // In real usage, this token comes from the Google Pay frontend flow.
  // In testing, create a Stripe test token directly — agent behavior is the same.
  const customer = await stripe.customers.create({
    email: "gpay-agent-test@example.com",
  });

  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: "4242424242424242",
      exp_month: 12,
      exp_year: 2030,
      cvc: "123",
    },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  return { customerId: customer.id, paymentMethodId: paymentMethod.id };
}

async function main() {
  const { customerId, paymentMethodId } = await simulateGooglePaySetup();

  await runGooglePayAgent(
    "Show me the payment method details, then charge $8 for a premium report.",
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
2. Go to **Payments** — charges show `payment_source: google_pay` in metadata
3. Go to **Payment Methods** — shows `wallet: google_pay` on card details
4. All charges are `off_session: true` confirming autonomous agent behavior

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| Google Pay button not showing | Not in test card group | Join the Google Groups link above |
| `Token expired` | Google Pay token used twice | Tokens are single-use — vault immediately |
| `authentication_required` | Card needs user confirmation | Use non-3DS test card `4242...` |
| Google Pay unavailable | Browser/device not supported | Test in Chrome on Android or Chrome desktop |
