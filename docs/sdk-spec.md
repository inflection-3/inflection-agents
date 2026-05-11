# Inflection SDK Specification

**Package:** `@inflection/sdk`  
**Version:** 1.x  
**Language:** TypeScript (Node.js ≥ 18)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Initialization](#3-initialization)
4. [Rail Clients](#4-rail-clients)
   - [Stripe](#41-stripe)
   - [Circle](#42-circle)
   - [x402](#43-x402)
   - [Square](#44-square)
   - [Braintree](#45-braintree)
   - [Razorpay](#46-razorpay)
5. [Execution Flow](#5-execution-flow)
6. [Handling Decisions](#6-handling-decisions)
7. [Error Types](#7-error-types)
8. [TypeScript Types](#8-typescript-types)
9. [Configuration Reference](#9-configuration-reference)
10. [Testing and Sandbox Mode](#10-testing-and-sandbox-mode)
11. [Security Considerations](#11-security-considerations)

---

## 1. Overview

Inflection is a **financial policy enforcement and compliance layer for AI agents**. The SDK sits between your agent's code and the underlying payment provider SDKs. Every financial operation your agent initiates is intercepted, forwarded to the Inflection gateway for a policy decision, and either allowed, denied, or held for human approval — before the actual API call reaches the payment provider.

### What the SDK does

- Provides **pre-authorized, policy-aware clients** for all major payment rails (Stripe, Circle, x402, Square, Braintree, Razorpay)
- **Intercepts every outbound financial call** and sends metadata to the Inflection gateway for policy evaluation
- Surfaces **ALLOW / DENY / HOLD** decisions to your agent code with structured error types and approval objects
- Maintains a **tamper-evident audit log** of every financial action attempted by your agent
- Handles **approval polling and webhook callbacks** for HOLD decisions without requiring you to build that infrastructure

### What the SDK does NOT do

- **Does not store or proxy payment credentials.** Users connect their own Stripe, Circle, Square, etc. accounts in the Inflection dashboard. The SDK never sees raw API keys for payment providers.
- **Does not host or run agents.** Inflection has no awareness of your agent's runtime, orchestration, or LLM calls.
- **Does not modify provider responses.** When a call is allowed, the response you get back is exactly the native provider response — same shape, same types.
- **Does not replace the underlying SDKs' full feature set.** The rail clients expose the intercepted subset of methods relevant to financial operations. For non-financial operations, use the provider SDK directly.

### Architecture at a glance

```
Your agent code
     │
     ▼
inflection.rails.stripe.charges.create(...)
     │
     ▼
Inflection SDK (intercepts call, extracts metadata)
     │
     ▼  [HTTPS]
Inflection Gateway  ──► Policy engine (user's rules)
     │                        │
     │         ┌──────────────┼──────────────┐
     │       ALLOW           DENY           HOLD
     │         │               │               │
     ▼         ▼               ▼               ▼
Stripe API  Returns        Throws         Returns
 (real call) result    InflectionDenyError  PendingApproval
```

---

## 2. Installation

```bash
# npm
npm install @inflection/sdk

# yarn
yarn add @inflection/sdk

# bun
bun add @inflection/sdk
```

The SDK ships with TypeScript declarations. No `@types/` package needed.

**Peer dependencies** are the native provider SDKs, installed only for the rails you use:

```bash
# Install only what you need
npm install stripe                    # for inflection.rails.stripe
npm install @circle-fin/circle-sdk   # for inflection.rails.circle
npm install square                    # for inflection.rails.square
npm install braintree                 # for inflection.rails.braintree
npm install razorpay                  # for inflection.rails.razorpay
# x402 has no additional peer dependency
```

---

## 3. Initialization

```typescript
import { Inflection } from "@inflection/sdk"

const inflection = new Inflection({
  agentKey: "ak_live_51abc...",
})
```

The `agentKey` is issued when you register an agent on the Inflection dashboard. Users who deploy your agent connect their own payment provider accounts and configure policies against that `agentKey`. The key identifies which agent is making calls and resolves to the deploying user's policy config at the gateway.

### Full initialization with options

```typescript
import { Inflection } from "@inflection/sdk"

const inflection = new Inflection({
  agentKey: process.env.INFLECTION_AGENT_KEY!,
  options: {
    timeout: 8000,                   // ms, default: 10000
    retryConfig: {
      maxRetries: 3,                 // default: 2
      initialDelayMs: 200,           // default: 100
      backoffMultiplier: 2,          // default: 2
      retryableStatuses: [429, 502, 503, 504],
    },
    baseUrl: "https://gateway.inflection.dev", // default; override for self-hosted
    logLevel: "warn",                // "debug" | "info" | "warn" | "error" | "silent"
  },
})
```

### Destructuring rail clients

```typescript
const { stripe, circle, x402, square, braintree, razorpay } = inflection.rails
```

Rail clients are lazily instantiated — no network call is made until you use a client. If the corresponding peer dependency is not installed, accessing that rail throws an `InflectionConfigError` at runtime.

---

## 4. Rail Clients

Each rail client is a **proxy wrapper** around the native provider SDK client. The wrapper:

1. Intercepts the call before it reaches the provider
2. Serializes call metadata (method, amount, currency, recipient, etc.) and sends it to the Inflection gateway
3. Waits for a policy decision
4. If ALLOW: forwards the original call to the provider and returns the response
5. If DENY: throws `InflectionDenyError` — the provider is never called
6. If HOLD: returns a `PendingApproval` object — the provider is never called until the user approves

### 4.1 Stripe

The Stripe rail wraps `stripe` (npm: `stripe`). It intercepts all methods that move money or create financial obligations.

**Intercepted namespaces and methods:**

| Namespace | Intercepted Methods |
|---|---|
| `charges` | `create` |
| `paymentIntents` | `create`, `confirm`, `capture` |
| `refunds` | `create` |
| `transfers` | `create` |
| `payouts` | `create` |
| `subscriptions` | `create`, `update` |
| `invoices` | `pay`, `sendInvoice` |

Non-intercepted methods (e.g., `customers.retrieve`, `paymentMethods.list`) pass through directly to Stripe without going through the gateway.

**Usage:**

```typescript
import { Inflection, InflectionDenyError, PendingApproval } from "@inflection/sdk"

const inflection = new Inflection({ agentKey: process.env.INFLECTION_AGENT_KEY! })
const { stripe } = inflection.rails

// Create a charge — intercepted
const charge = await stripe.charges.create({
  amount: 5000,           // cents
  currency: "usd",
  source: "tok_visa",
  description: "Invoice #1042",
})
// charge is a native Stripe.Charge object

// Create a payout — intercepted
const payout = await stripe.payouts.create({
  amount: 100000,
  currency: "usd",
})

// List customers — NOT intercepted, passes through
const customers = await stripe.customers.list({ limit: 10 })
```

**Type signature for intercepted calls:**

```typescript
// The rail client's intercepted methods return:
// - The native provider type on ALLOW
// - Never (throws) on DENY
// - PendingApproval<T> on HOLD (where T is the native return type)
//
// Because HOLD is possible, the return type is:
type InterceptedResult<T> = T | PendingApproval<T>
```

In practice, if you want to handle HOLD explicitly:

```typescript
import { isPendingApproval } from "@inflection/sdk"

const result = await stripe.paymentIntents.create({
  amount: 250000,
  currency: "usd",
  payment_method: "pm_card_visa",
  confirm: true,
})

if (isPendingApproval(result)) {
  // Policy put this on hold — handle approval flow
  const approved = await result.wait()
  // approved is the native Stripe.PaymentIntent
} else {
  // Was allowed immediately — result is Stripe.PaymentIntent
  console.log("Payment intent:", result.id)
}
```

### 4.2 Circle

The Circle rail wraps `@circle-fin/circle-sdk`. It intercepts USDC and cross-chain transfer operations.

**Intercepted methods:**

| Namespace | Intercepted Methods |
|---|---|
| `transfers` | `createTransfer` |
| `payouts` | `createPayout` |
| `payments` | `createPayment` |
| `businessAccount.transfers` | `createBusinessTransfer` |

**Usage:**

```typescript
const { circle } = inflection.rails

const transfer = await circle.transfers.createTransfer({
  idempotencyKey: crypto.randomUUID(),
  source: {
    type: "wallet",
    id: "1000216185",
  },
  destination: {
    type: "blockchain",
    address: "0xabc...",
    chain: "ETH",
  },
  amount: {
    amount: "100.00",
    currency: "USD",
  },
})
```

### 4.3 x402

The x402 rail intercepts HTTP 402 Payment Required micropayment flows. No additional peer dependency needed — the x402 client is bundled with the SDK.

**Intercepted methods:**

| Method | Description |
|---|---|
| `pay` | Pay an x402-gated resource |
| `fetch` | Fetch a resource, paying automatically if 402 is returned |

**Usage:**

```typescript
const { x402 } = inflection.rails

// Explicit payment
const receipt = await x402.pay({
  url: "https://api.example.com/premium-endpoint",
  amount: "0.001",
  currency: "USDC",
  network: "base",
})

// Auto-pay fetch (pays if 402 encountered)
const response = await x402.fetch("https://api.example.com/data", {
  method: "POST",
  body: JSON.stringify({ query: "..." }),
})
```

### 4.4 Square

The Square rail wraps `square` (npm: `square`). It intercepts payment and payout operations.

**Intercepted methods:**

| Namespace | Intercepted Methods |
|---|---|
| `paymentsApi` | `createPayment` |
| `refundsApi` | `refundPayment` |
| `payoutsApi` | `createPayout` |
| `invoicesApi` | `payInvoice` |

**Usage:**

```typescript
const { square } = inflection.rails

const { result } = await square.paymentsApi.createPayment({
  idempotencyKey: crypto.randomUUID(),
  sourceId: "cnon:card-nonce-ok",
  amountMoney: {
    amount: BigInt(1500),
    currency: "USD",
  },
})
```

### 4.5 Braintree

The Braintree rail wraps `braintree` (npm: `braintree`). It intercepts transaction and payout creation.

**Intercepted methods:**

| Namespace | Intercepted Methods |
|---|---|
| `transaction` | `sale`, `submitForSettlement`, `refund` |
| `transfer` | `create` (marketplace payouts) |

**Usage:**

```typescript
const { braintree } = inflection.rails

const result = await braintree.transaction.sale({
  amount: "47.00",
  paymentMethodNonce: "nonce-from-the-client",
  options: {
    submitForSettlement: true,
  },
})
```

### 4.6 Razorpay

The Razorpay rail wraps `razorpay` (npm: `razorpay`). It intercepts order creation, payouts, and refunds.

**Intercepted methods:**

| Namespace | Intercepted Methods |
|---|---|
| `orders` | `create` |
| `payments` | `capture`, `refund` |
| `payouts` | `create` |
| `transfers` | `create` |

**Usage:**

```typescript
const { razorpay } = inflection.rails

const order = await razorpay.orders.create({
  amount: 50000,      // paise
  currency: "INR",
  receipt: "order_rcptid_11",
})
```

---

## 5. Execution Flow

Every intercepted call follows this sequence:

```
1. Your code calls an intercepted method
       │
2. SDK extracts financial metadata:
   - provider (stripe / circle / x402 / ...)
   - method (charges.create / transfers.createTransfer / ...)
   - amount + currency
   - recipient identifier (if present)
   - idempotency key (generated if not provided)
   - agentKey
   - timestamp (ISO 8601)
       │
3. SDK sends PolicyCheckRequest to Inflection gateway
   POST https://gateway.inflection.dev/v1/check
   Authorization: Bearer <agentKey>
   Body: { provider, method, amount, currency, recipient, metadata, requestId }
       │
4. Gateway evaluates against user's policy config:
   - Is this rail connected by the user?              → InflectionConnectorError if not
   - Does amount exceed maxPerTransaction?            → DENY or HOLD
   - Does amount push daily/weekly/monthly totals?   → DENY or HOLD
   - Is the recipient blocklisted?                   → DENY
   - Is this currency/country allowed?               → DENY
   - Does velocity check trigger?                    → DENY or HOLD
   - Is requireHumanApproval threshold exceeded?     → HOLD
   - Does everything pass?                           → ALLOW
       │
5. Gateway returns PolicyDecision:
   { decision: "ALLOW" | "DENY" | "HOLD", reason?, approvalId?, auditId }
       │
6. SDK handles decision:
   ALLOW → forwards original call to provider SDK → returns native result
   DENY  → throws InflectionDenyError (provider never called)
   HOLD  → returns PendingApproval object (provider never called yet)
```

The gateway round-trip is the only added latency. In production, median gateway latency is under 50ms. The full call (gateway check + provider call) completes in gateway latency + normal provider latency.

**What is sent to the gateway:**

The SDK sends only financial metadata — never the full call arguments. Sensitive fields like card numbers, bank account numbers, or PII in descriptions are stripped before sending. Specifically, the gateway receives:

- `provider`: the rail name
- `method`: the method path (e.g., `charges.create`)
- `amount`: numeric amount in the call's currency
- `currency`: ISO 4217 currency code
- `recipient`: hashed identifier of the recipient (if present in the call)
- `agentKey`: your agent's key
- `requestId`: a UUID generated per call for idempotency and audit correlation

---

## 6. Handling Decisions

### 6.1 ALLOW

The call proceeds to the provider. The return value is the native provider response, unchanged.

```typescript
const charge = await stripe.charges.create({
  amount: 1000,
  currency: "usd",
  source: "tok_visa",
})
// charge is Stripe.Charge — same as calling stripe.charges.create directly
console.log(charge.id) // ch_3abc...
```

### 6.2 DENY

The provider is never called. The SDK throws `InflectionDenyError`.

```typescript
import { InflectionDenyError } from "@inflection/sdk"

try {
  const charge = await stripe.charges.create({
    amount: 1000000,   // $10,000 — exceeds user's policy limit
    currency: "usd",
    source: "tok_visa",
  })
} catch (err) {
  if (err instanceof InflectionDenyError) {
    console.error("Blocked by policy:", err.message)
    console.error("Reason code:", err.code)
    // err.code: "EXCEEDS_TRANSACTION_LIMIT" | "DAILY_LIMIT_EXCEEDED" |
    //           "BLOCKLISTED_RECIPIENT" | "DISALLOWED_CURRENCY" |
    //           "DISALLOWED_COUNTRY" | "VELOCITY_EXCEEDED" | "RAIL_DISABLED"
    console.error("Audit ID:", err.auditId)
    // auditId links this denial to the immutable audit log entry
  }
}
```

### 6.3 HOLD

The provider is not called. The SDK returns a `PendingApproval<T>` object instead of the normal return type. The user is notified via their configured notification channel (Slack, email, or WhatsApp).

You can resolve the hold in two ways:

**Option A: Polling with `.wait()`**

```typescript
import { isPendingApproval, InflectionDenyError } from "@inflection/sdk"

const result = await stripe.payouts.create({
  amount: 500000,   // $5,000 — exceeds user's requireHumanApproval threshold
  currency: "usd",
})

if (isPendingApproval(result)) {
  console.log("Payout is pending approval:", result.approvalId)
  console.log("Notified via:", result.notificationChannel) // "slack" | "email" | "whatsapp"

  try {
    // Polls until approved or rejected (default timeout: 24h)
    const payout = await result.wait({
      timeoutMs: 30 * 60 * 1000,   // 30 minutes
      pollIntervalMs: 5000,         // check every 5s (default: 3000)
    })
    // payout is Stripe.Payout — the actual provider call completed
    console.log("Approved! Payout ID:", payout.id)
  } catch (err) {
    if (err instanceof InflectionDenyError) {
      console.log("Rejected by user:", err.message)
    }
  }
}
```

**Option B: Webhook callback with `.onApproved()`**

Use this in long-running agents or serverless environments where blocking on `.wait()` is impractical.

```typescript
if (isPendingApproval(result)) {
  // Register a webhook URL to receive the approval result
  await result.onApproved({
    webhookUrl: "https://your-agent.example.com/inflection/callback",
    // Inflection will POST the result to this URL
    // Payload: { approvalId, decision: "APPROVED" | "REJECTED", providerResult? }
  })

  // Return the approvalId to your system so you can correlate the webhook
  return { status: "pending", approvalId: result.approvalId }
}
```

**Webhook payload shape:**

```typescript
interface ApprovalWebhookPayload<T = unknown> {
  approvalId: string
  agentKey: string
  decision: "APPROVED" | "REJECTED"
  decidedAt: string          // ISO 8601
  decidedBy: string          // user identifier (email)
  providerResult?: T         // present only on APPROVED — the native provider response
  rejectionReason?: string   // present only on REJECTED
  auditId: string
}
```

**Webhook verification:**

```typescript
import { verifyWebhookSignature } from "@inflection/sdk"

// In your webhook handler (Express example):
app.post("/inflection/callback", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["inflection-signature"] as string

  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature,
    secret: process.env.INFLECTION_WEBHOOK_SECRET!,
  })

  if (!isValid) {
    return res.status(401).send("Invalid signature")
  }

  const payload = JSON.parse(req.body.toString()) as ApprovalWebhookPayload
  // Handle payload.decision ...
  res.status(200).send("ok")
})
```

---

## 7. Error Types

All Inflection errors extend the base `InflectionError` class.

### `InflectionDenyError`

Thrown when the gateway explicitly denies a call based on policy.

```typescript
class InflectionDenyError extends InflectionError {
  readonly name = "InflectionDenyError"
  readonly code: DenyCode
  readonly auditId: string       // link to immutable audit log entry
  readonly provider: RailName
  readonly method: string
  readonly attemptedAmount?: number
  readonly attemptedCurrency?: string
}

type DenyCode =
  | "EXCEEDS_TRANSACTION_LIMIT"
  | "DAILY_LIMIT_EXCEEDED"
  | "WEEKLY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "VELOCITY_EXCEEDED"
  | "BLOCKLISTED_RECIPIENT"
  | "DISALLOWED_CURRENCY"
  | "DISALLOWED_COUNTRY"
  | "RAIL_DISABLED"
  | "AGENT_SUSPENDED"
```

### `InflectionPolicyError`

Thrown when the policy configuration itself is invalid or the agentKey does not map to a valid policy. This is a configuration issue, not a runtime denial.

```typescript
class InflectionPolicyError extends InflectionError {
  readonly name = "InflectionPolicyError"
  readonly code: "INVALID_AGENT_KEY" | "POLICY_NOT_FOUND" | "POLICY_MISCONFIGURED"
}
```

### `InflectionConnectorError`

Thrown when the user has not connected the relevant payment provider to their Inflection account. The agent is configured correctly, but the user hasn't set up their Stripe (or Circle, Square, etc.) credentials in the Inflection dashboard.

```typescript
class InflectionConnectorError extends InflectionError {
  readonly name = "InflectionConnectorError"
  readonly code: "RAIL_NOT_CONNECTED" | "CONNECTOR_REVOKED" | "CONNECTOR_EXPIRED"
  readonly rail: RailName
  // The message will include the dashboard URL where the user can connect their account.
}
```

This error is the recommended signal to surface to your agent's user with a message like: "Please connect your Stripe account in the Inflection dashboard before using payment features."

### `InflectionNetworkError`

Thrown when the SDK cannot reach the Inflection gateway after all retries are exhausted.

```typescript
class InflectionNetworkError extends InflectionError {
  readonly name = "InflectionNetworkError"
  readonly code: "GATEWAY_UNREACHABLE" | "GATEWAY_TIMEOUT" | "GATEWAY_ERROR"
  readonly statusCode?: number   // HTTP status from gateway, if received
  readonly requestId: string     // for support correlation
}
```

**Important:** When a `InflectionNetworkError` is thrown, the provider call has NOT been made. The error means the policy check could not complete — the SDK does not fall through to the provider on gateway failure. This is intentional: failing open would defeat the compliance guarantee.

### `InflectionApprovalTimeoutError`

Thrown by `PendingApproval.wait()` when the timeout expires before the user approves or rejects.

```typescript
class InflectionApprovalTimeoutError extends InflectionError {
  readonly name = "InflectionApprovalTimeoutError"
  readonly approvalId: string
  // The approval is still pending — not cancelled.
  // You can resume polling with a new .wait() call using the same approvalId.
}
```

### Base class

```typescript
class InflectionError extends Error {
  readonly name: string
  readonly message: string
  readonly requestId: string    // UUID for support — include in bug reports
  readonly timestamp: string    // ISO 8601
}
```

---

## 8. TypeScript Types

### Core types

```typescript
// Rail names
type RailName = "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay"

// The main SDK class
interface InflectionOptions {
  agentKey: string
  options?: {
    timeout?: number
    retryConfig?: RetryConfig
    baseUrl?: string
    logLevel?: "debug" | "info" | "warn" | "error" | "silent"
  }
}

interface RetryConfig {
  maxRetries?: number           // default: 2
  initialDelayMs?: number       // default: 100
  backoffMultiplier?: number    // default: 2
  retryableStatuses?: number[]  // default: [429, 502, 503, 504]
}

// Rail client accessor
interface InflectionRails {
  stripe: InflectionStripeClient
  circle: InflectionCircleClient
  x402: InflectionX402Client
  square: InflectionSquareClient
  braintree: InflectionBraintreeClient
  razorpay: InflectionRazorpayClient
}
```

### PendingApproval

```typescript
interface PendingApproval<T> {
  /** Unique ID for this approval request */
  readonly approvalId: string

  /** How the user was notified */
  readonly notificationChannel: "slack" | "email" | "whatsapp"

  /** When the hold was created */
  readonly createdAt: string   // ISO 8601

  /** Audit log ID for this held action */
  readonly auditId: string

  /**
   * Poll until the user approves or rejects.
   * Returns the native provider result on approval.
   * Throws InflectionDenyError if rejected.
   * Throws InflectionApprovalTimeoutError if timeoutMs is exceeded.
   */
  wait(options?: WaitOptions): Promise<T>

  /**
   * Register a webhook to receive the approval decision.
   * The provider call is made by Inflection on approval.
   */
  onApproved(options: OnApprovedOptions): Promise<void>
}

interface WaitOptions {
  timeoutMs?: number         // default: 86_400_000 (24h)
  pollIntervalMs?: number    // default: 3000
}

interface OnApprovedOptions {
  webhookUrl: string
}

// Type guard
function isPendingApproval<T>(value: T | PendingApproval<T>): value is PendingApproval<T>
```

### Policy decision (internal, exposed for advanced use)

```typescript
type PolicyDecision =
  | { decision: "ALLOW"; auditId: string }
  | { decision: "DENY"; reason: string; code: DenyCode; auditId: string }
  | { decision: "HOLD"; approvalId: string; notificationChannel: string; auditId: string }
```

### Webhook verification

```typescript
interface VerifyWebhookSignatureOptions {
  payload: Buffer | string
  signature: string
  secret: string
}

function verifyWebhookSignature(options: VerifyWebhookSignatureOptions): boolean
```

### Stripe rail client (illustrative — mirrors native Stripe SDK types)

```typescript
interface InflectionStripeClient {
  charges: {
    create(params: Stripe.ChargeCreateParams): Promise<Stripe.Charge | PendingApproval<Stripe.Charge>>
  }
  paymentIntents: {
    create(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent | PendingApproval<Stripe.PaymentIntent>>
    confirm(id: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent | PendingApproval<Stripe.PaymentIntent>>
    capture(id: string, params?: Stripe.PaymentIntentCaptureParams): Promise<Stripe.PaymentIntent | PendingApproval<Stripe.PaymentIntent>>
  }
  refunds: {
    create(params: Stripe.RefundCreateParams): Promise<Stripe.Refund | PendingApproval<Stripe.Refund>>
  }
  transfers: {
    create(params: Stripe.TransferCreateParams): Promise<Stripe.Transfer | PendingApproval<Stripe.Transfer>>
  }
  payouts: {
    create(params: Stripe.PayoutCreateParams): Promise<Stripe.Payout | PendingApproval<Stripe.Payout>>
  }
  // Non-intercepted methods delegate to native Stripe client
  customers: Stripe["customers"]
  paymentMethods: Stripe["paymentMethods"]
  // ... (all other non-financial namespaces pass through)
}
```

---

## 9. Configuration Reference

### `InflectionOptions`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `agentKey` | `string` | Yes | — | Agent key from the Inflection dashboard. Use `ak_live_` prefix in production, `ak_test_` in sandbox. |
| `options.timeout` | `number` | No | `10000` | Gateway request timeout in milliseconds. |
| `options.retryConfig.maxRetries` | `number` | No | `2` | Maximum retry attempts on retriable gateway errors. |
| `options.retryConfig.initialDelayMs` | `number` | No | `100` | Initial retry backoff delay. |
| `options.retryConfig.backoffMultiplier` | `number` | No | `2` | Exponential backoff multiplier. |
| `options.retryConfig.retryableStatuses` | `number[]` | No | `[429,502,503,504]` | HTTP status codes that trigger a retry. |
| `options.baseUrl` | `string` | No | `https://gateway.inflection.dev` | Override for self-hosted Inflection deployments. |
| `options.logLevel` | `string` | No | `"warn"` | SDK internal log verbosity. Set to `"debug"` during development. |

### Environment variable support

The SDK reads the following environment variables if the corresponding option is not passed:

| Variable | Maps to |
|---|---|
| `INFLECTION_AGENT_KEY` | `agentKey` |
| `INFLECTION_BASE_URL` | `options.baseUrl` |
| `INFLECTION_LOG_LEVEL` | `options.logLevel` |

```typescript
// These are equivalent:
const inflection = new Inflection({ agentKey: "ak_live_..." })

// If INFLECTION_AGENT_KEY env var is set:
const inflection = new Inflection({})
```

---

## 10. Testing and Sandbox Mode

Use a test agent key (`ak_test_...`) to run in sandbox mode. In sandbox mode:

- The Inflection gateway runs against a shadow policy (not the user's live policy)
- No actual calls are made to payment providers — all provider responses are mocked
- Audit logs go to a separate sandbox log view in the dashboard
- HOLD decisions can be approved/rejected via the dashboard sandbox approvals queue

### Getting a test key

Every agent on the Inflection dashboard has both a live key (`ak_live_...`) and a test key (`ak_test_...`). Use the test key in your CI and local development.

```typescript
const inflection = new Inflection({
  agentKey: process.env.INFLECTION_AGENT_KEY!,
  // In test environments, INFLECTION_AGENT_KEY should be set to ak_test_...
})
```

### Simulating decisions in tests

In sandbox mode, specific amount values trigger specific gateway responses, letting you test all code paths without setting up complex policies:

| Amount (any currency) | Simulated decision |
|---|---|
| `1.00` | ALLOW |
| `2.00` | DENY (EXCEEDS_TRANSACTION_LIMIT) |
| `3.00` | HOLD |
| `4.00` | DENY (BLOCKLISTED_RECIPIENT) |
| `5.00` | InflectionConnectorError (RAIL_NOT_CONNECTED) |
| Any other | ALLOW |

```typescript
// Jest example
import { Inflection, InflectionDenyError, isPendingApproval } from "@inflection/sdk"

const inflection = new Inflection({ agentKey: "ak_test_sandbox" })
const { stripe } = inflection.rails

test("handles DENY correctly", async () => {
  await expect(
    stripe.charges.create({ amount: 200, currency: "usd", source: "tok_visa" })
    // amount: 200 cents = $2.00 → triggers simulated DENY
  ).rejects.toThrow(InflectionDenyError)
})

test("handles HOLD correctly", async () => {
  const result = await stripe.charges.create({
    amount: 300,    // $3.00 → triggers simulated HOLD
    currency: "usd",
    source: "tok_visa",
  })
  expect(isPendingApproval(result)).toBe(true)
})
```

### Unit testing without network

Use the `MockInflection` test helper to avoid any network calls in unit tests:

```typescript
import { MockInflection } from "@inflection/sdk/testing"

const mock = new MockInflection()

// Configure per-method responses
mock.stripe.charges.create.mockResolvedValue({
  id: "ch_test_123",
  amount: 5000,
  currency: "usd",
  status: "succeeded",
  // ... rest of Stripe.Charge shape
} as Stripe.Charge)

// Use mock in your agent under test
const agent = new BillingAgent({ inflection: mock })
await agent.chargeCustomer({ customerId: "cus_test", amountCents: 5000 })
expect(mock.stripe.charges.create).toHaveBeenCalledWith(
  expect.objectContaining({ amount: 5000 })
)
```

---

## 11. Security Considerations

### Agent key handling

- **Never log your agentKey.** The SDK will warn (at `logLevel: "warn"`) if it detects the agentKey appears in any string you pass to it (e.g., accidentally in a description field).
- **Never expose agentKey to client-side code.** The agentKey is a server-side credential. It should always be read from an environment variable, never hardcoded.
- **Rotate keys immediately if compromised.** The Inflection dashboard allows key rotation. Rotating a key invalidates the old key within seconds.
- The agentKey does not grant access to the user's payment provider credentials — it only grants the ability to request policy checks. Even a leaked agentKey cannot move money without the user's policies allowing it.

### What data is sent to the Inflection gateway

The SDK sends only structured financial metadata to the gateway. It does NOT send:

- Full call arguments (no card numbers, bank accounts, or raw PII)
- The provider's API key or credentials
- IP addresses of your users
- Any data not directly needed for policy evaluation

Specifically, the gateway receives for each call:

```json
{
  "agentKey": "ak_live_...",
  "provider": "stripe",
  "method": "charges.create",
  "amount": 5000,
  "currency": "usd",
  "recipient": "sha256:<hashed-recipient-id>",
  "requestId": "req_9abc...",
  "timestamp": "2026-05-11T10:32:00.000Z"
}
```

### Tamper-evident audit log

Every intercepted call — allowed, denied, or held — is recorded in the audit log with a cryptographic hash chain. Entries cannot be deleted or modified. The `auditId` returned on every decision can be used to look up the exact record.

### Gateway failure behavior

The SDK does **not** fail open. If the gateway is unreachable after all retries, the call is blocked and `InflectionNetworkError` is thrown. This guarantees that financial calls cannot bypass policy enforcement due to a transient network issue.

If your use case requires fail-open behavior (not recommended for financial operations), you can catch `InflectionNetworkError` explicitly and make the provider call using the native SDK directly — but this will not be logged in the Inflection audit trail.

### TLS and request integrity

All gateway communication uses TLS 1.3. Requests are signed with HMAC-SHA256 using a derived key so the gateway can verify they originated from the SDK and not a replay attack.
