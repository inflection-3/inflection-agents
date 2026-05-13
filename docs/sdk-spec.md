# Inflection SDK Specification

**Package:** `@inflection/sdk`  
**Version:** 1.x  
**Language:** TypeScript (Bun / Node.js ≥ 18)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Initialization](#4-initialization)
5. [Executing Payments](#5-executing-payments)
6. [Handling Decisions](#6-handling-decisions)
7. [Per-Rail Action Reference](#7-per-rail-action-reference)
8. [TypeScript Types](#8-typescript-types)
9. [Per-Rail Helpers (Optional)](#9-per-rail-helpers-optional)
10. [Exported Constants](#10-exported-constants)
11. [Error Types](#11-error-types)
12. [Testing](#12-testing)

---

## 1. Overview

Inflection is a **financial policy enforcement layer for AI agents**. It sits between your agent code and the payment providers (Stripe, Circle, x402, Square, Braintree, Razorpay). Every payment action your agent attempts is evaluated against a developer-configured policy before the provider is called — and every decision is written to a tamper-evident audit log.

**What the SDK does:**

- Wraps `POST /v1/execute` — the single gateway endpoint that enforces policy and runs the connector
- Returns typed `ALLOW`, `DENY`, or `HOLD` responses
- Provides per-rail TypeScript helpers so you write `inflection.stripe.charges.create(...)` instead of constructing raw JSON
- Exports `ACTIONS_BY_RAIL` and `CURRENCIES_BY_RAIL` constants so agents can reason about what's permitted at build time

**What the SDK does NOT do:**

- Does not bundle or proxy native payment provider SDKs (Stripe, Circle, etc.)
- Does not store or transmit payment credentials — those are held encrypted on the backend
- Does not have any concept of policies — policies are configured in the Inflection dashboard by the developer and evaluated server-side

---

## 2. Architecture

```
Agent code
    │
    │  inflection.stripe.charges.create({ amount: 5000, currency: "usd", ... })
    │  (or inflection.execute({ connectorId, action: "charges.create", args, ... }))
    │
    ▼
InflectionClient  ─── POST /v1/execute ──────────────────────────────────►  Inflection Backend
Authorization: Bearer infl_live_...                                              │
Body: { connectorId, action, args, amount, currency, idempotencyKey }            │
                                                                            Policy Engine
                                                                                 │
                                                                   ┌─────────────┼─────────────┐
                                                                 ALLOW          DENY          HOLD
                                                                   │              │              │
                                                             Connector        Returns        Creates
                                                             executes        403 DENY        approval
                                                           (Stripe API,      response       record,
                                                            Circle, etc)                   returns 202
                                                                   │
                                                             Returns 200
                                                             { outcome: "ALLOW", providerTxId }
```

### Key concepts

**Agent API key** — issued per agent on the Inflection dashboard. Format: `infl_live_<random>` (production) or `infl_test_<random>` (test mode). This is the only credential the SDK holds. It identifies which agent is making the call and resolves to that agent's policy configuration and connectors.

**Connector** — a payment provider account (e.g., a specific Stripe account) linked to an agent in the dashboard. Connectors have a unique `connectorId`. Credentials are stored AES-256-GCM encrypted on the backend — the agent never sees them. The backend decrypts them at execution time to make the actual provider API call.

**Policy** — a versioned ruleset attached to an agent or to a specific connector. Policies are configured in the dashboard, not in the SDK. Every call to `/v1/execute` is evaluated against the latest policy version.

**Decision** — the policy engine returns one of three outcomes:
- `ALLOW` — policy passed, provider call was made, `providerTxId` is returned
- `DENY` — a policy rule blocked the call, provider was not called
- `HOLD` — a rule requires human approval, provider not called yet, `approvalId` is returned

---

## 3. Installation

```bash
bun add @inflection/sdk
# or
npm install @inflection/sdk
```

No peer dependencies. The SDK is a pure HTTP client — it does not import Stripe, Circle, or any provider SDK.

---

## 4. Initialization

```typescript
import { InflectionClient } from "@inflection/sdk"

const inflection = new InflectionClient({
  apiKey: process.env.INFLECTION_API_KEY!,
  // baseUrl defaults to "http://localhost:3001" for local dev
  // set to your deployed backend URL in production
  baseUrl: process.env.INFLECTION_BASE_URL ?? "http://localhost:3001",
})
```

### Constructor options

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | `string` | Yes | — | Agent API key from the dashboard. `infl_live_` or `infl_test_` prefix. |
| `baseUrl` | `string` | No | `"http://localhost:3001"` | Inflection backend base URL. |
| `timeout` | `number` | No | `10000` | Request timeout in milliseconds. |

---

## 5. Executing Payments

All payment execution goes through one method: `inflection.execute()`.

```typescript
const result = await inflection.execute({
  rail: "stripe",                    // which payment rail to use
  action: "charges.create",          // action name (must be in the connector's allowedActions policy)
  args: {                            // action arguments — passed to the provider
    amount: 5000,
    currency: "usd",
    source: "tok_visa",
    description: "Invoice #1042",
  },
  amount: "50.00",                   // normalized amount string (for policy evaluation)
  currency: "usd",                   // ISO 4217 currency code (for policy evaluation)
  idempotencyKey: crypto.randomUUID(), // caller-supplied idempotency key
  // optional metadata for policy evaluation
  recipientId: "cus_xyz",            // hashed recipient identifier
  recipientCountry: "US",            // ISO 3166-1 alpha-2
})
```

### Execute request

```typescript
interface ExecuteRequest {
  rail: Rail
  action: string
  args: Record<string, unknown>
  amount?: string               // required for monetary actions
  currency?: string             // required for monetary actions
  idempotencyKey: string
  recipientId?: string
  recipientCountry?: string
  recipientEntity?: string
  recipientDomain?: string
}
```

### Execute response

The response is a discriminated union on `outcome`:

```typescript
type ExecuteResponse =
  | AllowResponse
  | DenyResponse
  | HoldResponse

interface AllowResponse {
  outcome: "ALLOW"
  providerTxId?: string   // provider's transaction/object ID
  durationMs: number
}

interface DenyResponse {
  outcome: "DENY"
  reason: string          // human-readable deny message
  ruleId: string          // which policy rule triggered the deny
  durationMs: number
}

interface HoldResponse {
  outcome: "HOLD"
  approvalId: string      // use this to poll the approval status
  reason: string          // which policy rule triggered the hold
  durationMs: number
}
```

### Full example with decision handling

```typescript
import { InflectionClient, isHold, isDeny } from "@inflection/sdk"

const inflection = new InflectionClient({ apiKey: process.env.INFLECTION_API_KEY! })

const result = await inflection.execute({
  rail: "stripe",
  action: "charges.create",
  args: { amount: 5000, currency: "usd", source: "tok_visa" },
  amount: "50.00",
  currency: "usd",
  idempotencyKey: crypto.randomUUID(),
})

if (isHold(result)) {
  // Notify user or queue for retry after approval
  console.log("Payment held, awaiting approval:", result.approvalId)
  return { status: "pending", approvalId: result.approvalId }
}

if (isDeny(result)) {
  // Log the denial and surface to user
  console.error(`Payment denied by policy [${result.ruleId}]:`, result.reason)
  return { status: "denied", reason: result.reason }
}

// ALLOW — payment processed
console.log("Payment processed:", result.providerTxId)
```

### Idempotency

Calls with the same `idempotencyKey` within 24 hours return the cached response without re-evaluating policy or calling the provider. Always generate a unique idempotency key per logical operation. Never reuse keys across different payment operations.

---

## 6. Handling Decisions

### ALLOW

The policy passed and the provider call completed. `providerTxId` is the provider's returned transaction/object ID (e.g., Stripe charge ID, Circle transaction ID, on-chain tx hash for x402).

```typescript
if (result.outcome === "ALLOW") {
  // record result.providerTxId in your own database
}
```

### DENY

A policy rule blocked the call. The provider was never contacted. `ruleId` tells you exactly which rule fired.

```typescript
// Deny rule IDs returned by the backend
type DenyRuleId =
  | "allowedRails"              // this rail is not in the agent's allowedRails list
  | "blockedCountries"          // recipient country is blocked
  | "blocklist"                 // recipient entity or domain is blocklisted
  | "globalVelocityCheck"       // too many transactions in the time window
  | "globalDailyLimit"          // agent-level daily spend exceeded
  | "globalMonthlyLimit"        // agent-level monthly spend exceeded
  | "connectorPolicyExists"     // connector has no policy or no allowedActions
  | "allowedActions"            // this action is not in the connector's allowedActions
  | "actionLimits"              // this action's per-action limit exceeded
  | "maxPerTransaction"         // single transaction amount exceeded
  | "allowedCountries"          // recipient country not in allowedCountries list
  | "allowedCurrencies"         // currency not in allowedCurrencies list
  | "scheduleWindow"            // call is outside the allowed schedule window
  | "velocityCheck"             // connector-level velocity limit hit
  | "dailyLimit"                // connector-level daily spend exceeded
  | "weeklyLimit"               // connector-level weekly spend exceeded
  | "monthlyLimit"              // connector-level monthly spend exceeded
  | "recipientDailyLimit"       // recipient-level daily spend exceeded
  | "execution_error"           // connector threw an error during execution
```

### HOLD

A policy rule requires human approval before the provider is called. An approval record is created and the developer/user is notified (via Slack or email if configured).

```typescript
if (result.outcome === "HOLD") {
  const { approvalId } = result
  // Store approvalId — user approves/rejects via the Inflection dashboard
  // On approval, the backend re-executes the original call automatically
  // and updates the approval status to "executed" or "execution_failed"
}
```

**Approval lifecycle:**

```
pending  ──[user approves]──►  approved  ──[backend re-executes]──►  executed
         ──[user rejects]───►  rejected                          └──►  execution_failed
         ──[expiresAt past]──►  expired  (swept by background worker every 60s)
```

**Polling approval status** (if your agent needs to wait for the outcome):

```typescript
// Poll GET /v1/approvals/:approvalId
const approval = await inflection.getApproval(approvalId)

// approval.status: "pending" | "approved" | "rejected" | "expired" | "executed" | "execution_failed"
if (approval.status === "executed") {
  console.log("Approved and executed successfully")
}
```

---

## 7. Per-Rail Action Reference

Each connector has a rail. Only actions listed here are valid for that rail — submitting any other action string results in a policy DENY (`allowedActions` rule).

### Stripe (`rail: "stripe"`)

| Action | Description | Monetary |
|---|---|---|
| `charges.create` | Create a charge | Yes |
| `paymentIntents.create` | Create a payment intent | Yes |
| `paymentIntents.confirm` | Confirm a payment intent | No |
| `refunds.create` | Issue a refund | Yes |
| `customers.create` | Create a customer record | No |
| `payouts.create` | Send payout to bank account | Yes |
| `transfers.create` | Transfer to connected account | Yes |

**Supported currencies:** `usd`, `eur`, `gbp`, `aud`, `cad`, `sgd`, `jpy`, `nzd`, `chf`, `dkk`, `nok`, `sek`

**Example `args` shapes:**

```typescript
// charges.create
{ amount: 5000, currency: "usd", source: "tok_visa", description?: string, customer?: string }

// paymentIntents.create
{ amount: 5000, currency: "usd", payment_method?: string, confirm?: boolean, customer?: string }

// paymentIntents.confirm
{ id: "pi_xxx", payment_method?: string, return_url?: string }

// refunds.create
{ charge?: "ch_xxx", payment_intent?: "pi_xxx", amount?: number, reason?: string }

// customers.create
{ email?: string, name?: string, description?: string, metadata?: Record<string, string> }

// payouts.create
{ amount: 10000, currency: "usd", method?: "standard" | "instant" }

// transfers.create
{ amount: 5000, currency: "usd", destination: "acct_xxx", description?: string }
```

---

### Circle (`rail: "circle"`)

| Action | Description | Monetary |
|---|---|---|
| `transfers.create` | On-chain USDC transfer from a wallet | Yes |
| `wallets.create` | Create a user-controlled wallet | No |
| `walletSets.create` | Create a wallet set | No |
| `balance.get` | Get wallet token balance | No |

**Supported currencies:** `usdc`, `eurc`

**Example `args` shapes:**

```typescript
// transfers.create
{
  walletId: "1000216185",
  tokenId: "3837386f-8d...",
  destinationAddress: "0xabc...",
  amount: "100.00",
  fee?: { type: "level", config: { feeLevel: "MEDIUM" | "HIGH" | "LOW" } }
}

// wallets.create
{ blockchain: "ETH" | "SOL" | "MATIC" | "ARB", count?: number, walletSetId: string }

// walletSets.create
{ name: string }

// balance.get
{ walletId: string }
```

---

### x402 (`rail: "x402"`)

| Action | Description | Monetary |
|---|---|---|
| `transfer` | Send USDC on Base or Base Sepolia | Yes |
| `balanceOf` | Read USDC balance of an address | No |

**Supported currencies:** `usdc`

**Example `args` shapes:**

```typescript
// transfer
{ to: "0xabc...", amount: "10.00" }   // amount in USDC, not wei

// balanceOf
{ address?: "0xabc..." }   // defaults to the connector's own address
```

---

### Square (`rail: "square"`)

| Action | Description | Monetary |
|---|---|---|
| `payments.create` | Create a payment | Yes |
| `refunds.create` | Refund a payment | Yes |

**Supported currencies:** `usd`, `eur`, `gbp`, `aud`, `cad`, `jpy`

**Example `args` shapes:**

```typescript
// payments.create
{
  source_id: "cnon:card-nonce-ok",
  idempotency_key: "uuid",
  amount_money: { amount: 1500, currency: "USD" },
  customer_id?: string,
  note?: string
}
// Note: locationId is injected automatically from connector config

// refunds.create
{
  payment_id: "xxx",
  idempotency_key: "uuid",
  amount_money?: { amount: 500, currency: "USD" },
  reason?: string
}
```

---

### Braintree (`rail: "braintree"`)

| Action | Description | Monetary |
|---|---|---|
| `transactions.sale` | Create a sale transaction | Yes |
| `transactions.refund` | Refund a transaction | Yes |
| `transactions.void` | Void a transaction | No |

**Supported currencies:** `usd`, `eur`, `gbp`, `aud`, `cad`

**Example `args` shapes:**

```typescript
// transactions.sale
{
  amount: "47.00",
  paymentMethodNonce: "nonce-from-client",
  orderId?: string,
  options?: { submitForSettlement: true }
}

// transactions.refund
{ transactionId: "xxx", amount?: "20.00" }

// transactions.void
{ transactionId: "xxx" }
```

---

### Razorpay (`rail: "razorpay"`)

| Action | Description | Monetary |
|---|---|---|
| `orders.create` | Create an order | Yes |
| `payments.capture` | Capture an authorized payment | Yes |
| `refunds.create` | Refund a payment | Yes |

**Supported currencies:** `inr`, `usd`

**Example `args` shapes:**

```typescript
// orders.create
{ amount: 50000, currency: "INR", receipt?: string, notes?: Record<string, string> }
// amount is in paise (1 INR = 100 paise)

// payments.capture
{ paymentId: "pay_xxx", amount: 50000, currency: "INR" }

// refunds.create
{ paymentId: "pay_xxx", amount?: 25000, notes?: Record<string, string> }
```

---

## 8. TypeScript Types

### Core types

```typescript
export type Rail = "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay"

export interface ExecuteRequest {
  rail: Rail
  action: string
  args: Record<string, unknown>
  amount?: string
  currency?: string
  idempotencyKey: string
  recipientId?: string
  recipientCountry?: string
  recipientEntity?: string
  recipientDomain?: string
}

export type ExecuteResponse = AllowResponse | DenyResponse | HoldResponse

export interface AllowResponse {
  outcome: "ALLOW"
  providerTxId?: string
  durationMs: number
}

export interface DenyResponse {
  outcome: "DENY"
  reason: string
  ruleId: string
  durationMs: number
}

export interface HoldResponse {
  outcome: "HOLD"
  approvalId: string
  reason: string
  durationMs: number
}
```

### Resource types

```typescript
export interface Agent {
  id: string
  developerId: string
  name: string
  description: string | null
  webhookUrl: string | null
  status: "active" | "suspended" | "deleted"
  createdAt: string
  updatedAt: string
}

export interface Connector {
  id: string
  agentId: string
  userId: string
  rail: Rail
  authType: "oauth" | "api_key" | "wallet"
  maskedCredential: string
  status: "active" | "revoked" | "error"
  createdAt: string
  updatedAt: string
}

export interface AgentPolicy {
  id: string
  agentId: string
  userId: string
  version: number
  rules: AgentPolicyRules
  createdBy: string
  createdAt: string
}

export interface ConnectorPolicy {
  id: string
  connectorId: string
  userId: string
  version: number
  rules: ConnectorPolicyRules
  createdBy: string
  createdAt: string
}

export interface AuditLog {
  id: string
  agentId: string
  userId: string
  connectorId: string | null
  rail: string
  action: string
  outcome: "ALLOW" | "DENY" | "HOLD"
  denyRule: string | null
  amount: string | null
  currency: string | null
  recipientId: string | null
  policyId: string | null
  connectorPolicyId: string | null
  argsHash: string | null
  providerTxId: string | null
  approvalId: string | null
  durationMs: number | null
  prevHash: string
  rowHash: string
  createdAt: string
}

export interface Approval {
  id: string
  agentId: string
  userId: string
  auditLogId: string | null
  argsSnapshot: string          // JSON-encoded sanitized args
  amount: string | null
  currency: string | null
  status: "pending" | "approved" | "rejected" | "expired" | "executed" | "execution_failed"
  approvedBy: string | null
  rejectionReason: string | null
  expiresAt: string
  resolvedAt: string | null
  createdAt: string
}
```

### Policy rule shapes

```typescript
export interface AgentPolicyRules {
  allowedRails?: Rail[]
  blockedCountries?: string[]                   // ISO 3166-1 alpha-2
  blocklist?: {
    entities?: string[]
    domains?: string[]
  }
  globalVelocityCheck?: {
    maxTransactions: number
    windowSeconds: number
  }
  globalDailyLimit?: { amount: string; currency: string }
  globalMonthlyLimit?: { amount: string; currency: string }
}

export interface ActionLimit {
  action: string
  maxAmount: string
  currency: string
}

export interface ConnectorPolicyRules {
  allowedActions?: string[]                     // must be valid actions for the connector's rail
  actionLimits?: ActionLimit[]
  maxPerTransaction?: { amount: string; currency: string }
  blockedCountries?: string[]
  allowedCountries?: string[]
  allowedCurrencies?: string[]
  scheduleWindow?: {
    daysOfWeek: number[]                        // 0=Sun .. 6=Sat
    startHourUtc: number                        // 0–23
    endHourUtc: number                          // 0–23
  }
  velocityCheck?: { maxTransactions: number; windowSeconds: number }
  dailyLimit?: { amount: string; currency: string }
  weeklyLimit?: { amount: string; currency: string }
  monthlyLimit?: { amount: string; currency: string }
  recipientDailyLimit?: { amount: string; currency: string }
  requireHumanApproval?: { above: number; currency: string }
}
```

### Type guards

```typescript
export function isAllow(r: ExecuteResponse): r is AllowResponse
export function isDeny(r: ExecuteResponse): r is DenyResponse
export function isHold(r: ExecuteResponse): r is HoldResponse
```

---

## 9. Per-Rail Helpers (Optional)

The SDK exposes per-rail namespaces as thin wrappers over `execute()`. These are optional — they just pre-fill `action` and provide typed `args`, so you get autocomplete without writing raw JSON.

```typescript
// Instead of:
await inflection.execute({
  rail: "stripe",
  action: "charges.create",
  args: { amount: 5000, currency: "usd", source: "tok_visa" },
  amount: "50.00",
  currency: "usd",
  idempotencyKey: key,
})

// You can write:
await inflection.stripe.charges.create({
  amount: 5000,
  currency: "usd",
  source: "tok_visa",
  idempotencyKey: key,
})
```

Each per-rail helper extracts `amount` and `currency` from the args automatically, so you don't duplicate them. No connector ID needed — the backend resolves the active connector for the agent's configured rail.

### Stripe helper

```typescript
await inflection.stripe.charges.create({ amount, currency, source, description?, customer?, idempotencyKey })
await inflection.stripe.paymentIntents.create({ amount, currency, payment_method?, confirm?, idempotencyKey })
await inflection.stripe.paymentIntents.confirm({ id, payment_method?, idempotencyKey })
await inflection.stripe.refunds.create({ charge?, payment_intent?, amount?, reason?, idempotencyKey })
await inflection.stripe.customers.create({ email?, name?, description?, idempotencyKey })
await inflection.stripe.payouts.create({ amount, currency, method?, idempotencyKey })
await inflection.stripe.transfers.create({ amount, currency, destination, idempotencyKey })
```

### Circle helper

```typescript
await inflection.circle.transfers.create({ walletId, tokenId, destinationAddress, amount, fee?, idempotencyKey })
await inflection.circle.wallets.create({ blockchain, walletSetId, count?, idempotencyKey })
await inflection.circle.walletSets.create({ name, idempotencyKey })
await inflection.circle.balance.get({ walletId, idempotencyKey })
```

### x402 helper

```typescript
await inflection.x402.transfer({ to, amount, idempotencyKey })
await inflection.x402.balanceOf({ address?, idempotencyKey })
```

### Square helper

```typescript
await inflection.square.payments.create({ source_id, amount_money, customer_id?, note?, idempotencyKey })
await inflection.square.refunds.create({ payment_id, amount_money?, reason?, idempotencyKey })
```

### Braintree helper

```typescript
await inflection.braintree.transactions.sale({ amount, paymentMethodNonce, orderId?, options?, idempotencyKey })
await inflection.braintree.transactions.refund({ transactionId, amount?, idempotencyKey })
await inflection.braintree.transactions.void({ transactionId, idempotencyKey })
```

### Razorpay helper

```typescript
await inflection.razorpay.orders.create({ amount, currency, receipt?, notes?, idempotencyKey })
await inflection.razorpay.payments.capture({ paymentId, amount, currency, idempotencyKey })
await inflection.razorpay.refunds.create({ paymentId, amount?, notes?, idempotencyKey })
```

---

## 10. Exported Constants

```typescript
import { ACTIONS_BY_RAIL, CURRENCIES_BY_RAIL, MONETARY_ACTIONS_BY_RAIL } from "@inflection/sdk"

// All valid action strings per rail
ACTIONS_BY_RAIL["stripe"]
// ["charges.create", "paymentIntents.create", "paymentIntents.confirm",
//  "refunds.create", "customers.create", "payouts.create", "transfers.create"]

ACTIONS_BY_RAIL["circle"]     // ["transfers.create", "wallets.create", "walletSets.create", "balance.get"]
ACTIONS_BY_RAIL["x402"]       // ["transfer", "balanceOf"]
ACTIONS_BY_RAIL["square"]     // ["payments.create", "refunds.create"]
ACTIONS_BY_RAIL["braintree"]  // ["transactions.sale", "transactions.refund", "transactions.void"]
ACTIONS_BY_RAIL["razorpay"]   // ["orders.create", "payments.capture", "refunds.create"]

// Valid currencies per rail
CURRENCIES_BY_RAIL["stripe"]    // ["usd", "eur", "gbp", "aud", "cad", "sgd", "jpy", "nzd", "chf", "dkk", "nok", "sek"]
CURRENCIES_BY_RAIL["circle"]    // ["usdc", "eurc"]
CURRENCIES_BY_RAIL["x402"]      // ["usdc"]
CURRENCIES_BY_RAIL["square"]    // ["usd", "eur", "gbp", "aud", "cad", "jpy"]
CURRENCIES_BY_RAIL["braintree"] // ["usd", "eur", "gbp", "aud", "cad"]
CURRENCIES_BY_RAIL["razorpay"]  // ["inr", "usd"]

// Actions that carry a monetary amount (triggers spend counters and limits)
MONETARY_ACTIONS_BY_RAIL["stripe"]
// ["charges.create", "paymentIntents.create", "refunds.create", "payouts.create", "transfers.create"]
```

These constants are kept in sync with the backend's action registry (`src/connectors/action-registry.ts`). Use them in agents to validate actions at build time and in dashboards to render action selectors.

---

## 11. Error Types

```typescript
export class InflectionError extends Error {
  readonly requestId: string    // include in bug reports
}

// HTTP 4xx/5xx from the backend (not a policy decision)
export class InflectionHttpError extends InflectionError {
  readonly status: number
  readonly body: unknown
}

// Network failure — backend unreachable after timeout
export class InflectionNetworkError extends InflectionError {
  readonly cause?: Error
}
```

The SDK does **not** throw on DENY or HOLD — those are returned as normal response objects so you can handle them in your control flow. Only genuine HTTP errors and network failures throw.

---

## 12. Testing

### Test mode

Create a test-mode API key in the dashboard (`infl_test_...`). Test keys use a separate connector record that hits Stripe's test API (or other provider sandboxes), not production. Audit logs and approvals from test keys appear in a separate test view in the dashboard.

### Unit testing without network

The SDK exports a `createMockClient()` factory for unit tests:

```typescript
import { createMockClient } from "@inflection/sdk/testing"

const inflection = createMockClient({
  // Default all execute() calls to ALLOW
  defaultOutcome: "ALLOW",
  // Override specific action+connectorId combos
  overrides: [
    {
      rail: "stripe",
      action: "payouts.create",
      response: { outcome: "HOLD", approvalId: "appr_test_1", reason: "HOLD_HUMAN_APPROVAL_REQUIRED", durationMs: 12 },
    },
  ],
})

// inflection.execute() returns the configured mock response
// inflection.calls — array of all execute() calls made, for assertions
```

### Integration test pattern

```typescript
import { InflectionClient } from "@inflection/sdk"

const inflection = new InflectionClient({
  apiKey: process.env.INFLECTION_TEST_API_KEY!,   // infl_test_...
  baseUrl: "http://localhost:3001",
})

test("stripe charge returns ALLOW in test mode", async () => {
  const result = await inflection.execute({
    rail: "stripe",
    action: "charges.create",
    args: { amount: 100, currency: "usd", source: "tok_visa" },
    amount: "1.00",
    currency: "usd",
    idempotencyKey: crypto.randomUUID(),
  })
  expect(result.outcome).toBe("ALLOW")
})
```
