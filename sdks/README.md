# @inflection/sdk

Payments SDK for AI agents. Wraps the Inflection policy engine and payment connectors (Stripe, Circle, x402, Square, Braintree, Razorpay) behind a single `execute()` call.

## Installation

```bash
bun add @inflection/sdk
# or
npm install @inflection/sdk
```

## Usage

```typescript
import { InflectionClient, isHold, isDeny } from "@inflection/sdk";

const inflection = new InflectionClient({
  apiKey: process.env.INFLECTION_API_KEY!, // infl_live_... or infl_test_...
  baseUrl: process.env.INFLECTION_BASE_URL ?? "http://localhost:3001",
});

const result = await inflection.stripe("conn_abc123").charges.create({
  amount: 5000,
  currency: "usd",
  source: "tok_visa",
  idempotencyKey: crypto.randomUUID(),
});

if (isHold(result)) {
  console.log("Held for approval:", result.approvalId);
} else if (isDeny(result)) {
  console.error("Denied:", result.reason);
} else {
  console.log("Processed:", result.providerTxId);
}
```

## Testing

```typescript
import { createMockClient } from "@inflection/sdk/testing";

const inflection = createMockClient({
  defaultOutcome: "ALLOW",
  overrides: [
    { connectorId: "conn_abc", action: "payouts.create", response: { outcome: "HOLD", approvalId: "appr_1", reason: "wait", durationMs: 0 } },
  ],
});
```

## License

MIT
