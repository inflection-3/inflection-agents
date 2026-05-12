# Policy Engine — Execution Plan

**Version:** 1.0
**Date:** 2026-05-13
**Status:** Active

Build order: Backend → Dashboard → SDK → Agents

---

## Part 1 — Policy Engine Feature List

### Tier 1: Agent-Level Rules (stateless)

| # | Feature | Rule ID | Priority | Error Code |
|---|---|---|---|---|
| 1 | Rail whitelist | `allowedRails` | P0 | `POLICY_DENY_RAIL_NOT_ALLOWED` |
| 2 | Agent country blocklist | `blockedCountries` | P1 | `POLICY_DENY_COUNTRY_BLOCKED` |
| 3 | Agent entity/domain blocklist | `blocklist` | P1 | `POLICY_DENY_BLOCKLIST` |

### Tier 1: Agent-Level Rules (stateful — Redis)

| # | Feature | Rule ID | Priority | Error Code |
|---|---|---|---|---|
| 4 | Global velocity check (cross-rail tx rate) | `globalVelocityCheck` | P0 | `POLICY_DENY_GLOBAL_VELOCITY` |
| 5 | Global daily spend limit (cross-rail) | `globalDailyLimit` | P0 | `POLICY_DENY_GLOBAL_DAILY_LIMIT` |
| 6 | Global monthly spend limit (cross-rail) | `globalMonthlyLimit` | P1 | `POLICY_DENY_GLOBAL_MONTHLY_LIMIT` |

### Tier 2: Connector-Level Rules (stateless)

| # | Feature | Rule ID | Priority | Error Code |
|---|---|---|---|---|
| 7 | Default-deny (no policy or no allowedActions) | `connectorPolicyExists` | P0 | `POLICY_DENY_NO_CONNECTOR_POLICY` / `POLICY_DENY_ACTION_NOT_ALLOWED` |
| 8 | Allowed actions whitelist | `allowedActions` | P0 | `POLICY_DENY_ACTION_NOT_ALLOWED` |
| 9 | Per-action amount caps | `actionLimits` | P1 | `POLICY_DENY_ACTION_LIMIT_EXCEEDED` |
| 10 | Max per transaction | `maxPerTransaction` | P0 | `POLICY_DENY_MAX_PER_TX` |
| 11 | Connector country blocklist | `blockedCountries` (connector) | P1 | `POLICY_DENY_COUNTRY_BLOCKED` |
| 12 | Allowed countries whitelist | `allowedCountries` | P1 | `POLICY_DENY_COUNTRY_NOT_ALLOWED` |
| 13 | Allowed currencies whitelist | `allowedCurrencies` | P1 | `POLICY_DENY_CURRENCY_NOT_ALLOWED` |
| 14 | Schedule window restriction | `scheduleWindow` | P2 | `POLICY_DENY_OUTSIDE_SCHEDULE` |

### Tier 2: Connector-Level Rules (stateful — Redis)

| # | Feature | Rule ID | Priority | Error Code |
|---|---|---|---|---|
| 15 | Connector velocity check | `velocityCheck` | P0 | `POLICY_DENY_VELOCITY` |
| 16 | Connector daily spend limit | `dailyLimit` | P0 | `POLICY_DENY_DAILY_LIMIT_EXCEEDED` |
| 17 | Connector weekly spend limit | `weeklyLimit` | P1 | `POLICY_DENY_WEEKLY_LIMIT_EXCEEDED` |
| 18 | Connector monthly spend limit | `monthlyLimit` | P1 | `POLICY_DENY_MONTHLY_LIMIT_EXCEEDED` |
| 19 | Recipient daily spend cap | `recipientDailyLimit` | P1 | `POLICY_DENY_RECIPIENT_DAILY_LIMIT` |

### Final Check

| # | Feature | Rule ID | Priority | Outcome |
|---|---|---|---|---|
| 20 | Human approval threshold | `requireHumanApproval` | P0 | `HOLD` → approval queue |
| 21 | All rules pass | — | — | `ALLOW` → execute |

### Rule Evaluation Order (short-circuits on first DENY or HOLD)

```
1  CONNECTOR_PRESENT          (agent stateless)
2  AGENT_ALLOWED_RAILS        (agent stateless)
3  AGENT_BLOCKED_COUNTRIES    (agent stateless)
4  AGENT_BLOCKLIST            (agent stateless)
5  GLOBAL_VELOCITY            (agent stateful — Redis)
6  GLOBAL_DAILY_LIMIT         (agent stateful — Redis)
7  GLOBAL_MONTHLY_LIMIT       (agent stateful — Redis)
8  CONNECTOR_POLICY_EXISTS    (connector stateless)
9  ALLOWED_ACTIONS            (connector stateless)
10 ACTION_LIMIT               (connector stateless)
11 MAX_PER_TRANSACTION        (connector stateless)
12 CONNECTOR_BLOCKED_COUNTRIES(connector stateless)
13 ALLOWED_COUNTRIES          (connector stateless)
14 ALLOWED_CURRENCIES         (connector stateless)
15 SCHEDULE_WINDOW            (connector stateless)
16 CONNECTOR_VELOCITY         (connector stateful — Redis)
17 CONNECTOR_DAILY_LIMIT      (connector stateful — Redis)
18 CONNECTOR_WEEKLY_LIMIT     (connector stateful — Redis)
19 CONNECTOR_MONTHLY_LIMIT    (connector stateful — Redis)
20 RECIPIENT_DAILY_LIMIT      (connector stateful — Redis)
21 REQUIRE_HUMAN_APPROVAL     → HOLD
22 → ALLOW
```

---

## Part 2 — Backend Build Plan

Stack: **Bun** runtime, **bun:sqlite** (SQLite), **Bun.redis**, **Drizzle ORM** (SQLite dialect), **Hono** (API routing), **Bun.serve()** HTTP server.

> **Auth:** Email + password (Argon2id). Users register/login with email and password. Sessions issued as JWT RS256 (access token 15 min, refresh token 7 days).
> **API routing:** Hono on top of Bun.serve() — typed routes, middleware chain, built-in validator.

### Phase 1 — Database Schema & Migrations

**Files:** `backend/src/db/schema.ts`, `backend/drizzle.config.ts`

- [ ] 1.1 `users` table — id, email, password_hash (Argon2id), role, mfa_secret, timestamps
- [ ] 1.2 `agents` table — id, developer_id, name, description, webhook_url, status, timestamps
- [ ] 1.3 `agent_api_keys` table — id, agent_id, key_hash (Argon2id), key_prefix, status, last_used_at
- [ ] 1.4 `agent_registry_listings` table — slug, tagline, tags (text[]), listed, verified_at, deployer_count
- [ ] 1.5 `agent_user_connections` table — agent_id, user_id, status, connected_at
- [ ] 1.6 `connectors` table — agent_id, user_id, rail, auth_type, credentials_encrypted (BLOB), credentials_iv, credentials_key_id, masked_credential, status
  - `auth_type` CHECK: `('oauth', 'api_key', 'wallet')` — use `'wallet'` not `'wallet_address'` since private key is stored for x402
- [ ] 1.7 `agent_policies` table — agent_id, user_id, version, rules (TEXT/JSON), created_by
- [ ] 1.8 `connector_policies` table — connector_id, user_id, version, rules (TEXT/JSON), created_by
- [ ] 1.9 `audit_logs` table — append-only, hash-chained fields
  - SQLite has no row-level rules; enforce append-only via SQLite triggers `BEFORE UPDATE` / `BEFORE DELETE` that raise an error
- [ ] 1.10 `approvals` table — agent_id, user_id, audit_log_id, args_snapshot, amount, currency, status, expires_at
- [ ] 1.11 `notification_configs` table — slack_webhook_url_enc, email_addresses, approval_timeout_seconds
- [ ] 1.12 All indexes per spec
- [ ] 1.13 Drizzle migration baseline (SQLite dialect — `drizzle-orm/bun-sqlite`)

---

### Phase 2 — Auth & API Foundation

**Files:** `backend/src/lib/auth.ts`, `backend/src/server.ts`, `backend/src/routes.ts`

- [ ] 2.1 Argon2id password hashing util (`bun:crypto` or `@node-rs/argon2`)
- [ ] 2.2 Email + password registration — validate email format, hash password, insert `users` row
- [ ] 2.3 Email + password login — lookup user by email, verify Argon2id hash, issue JWT pair
- [ ] 2.4 JWT RS256 utils — sign/verify access token (15 min), refresh token (7 days), revocation flag in DB
- [ ] 2.5 API key generation for agents — `crypto.randomBytes(32)` URL-safe base64, Argon2id hash for storage
- [ ] 2.6 Hono auth middleware:
  - `bearerAuth` — verify JWT for dashboard routes
  - `apiKeyAuth` — hash incoming key, Redis cache (TTL 60s) → resolve agentId/userId for `/v1/execute`
- [ ] 2.7 RBAC middleware — role check per route (developer / user / admin / approver / read_only)
- [ ] 2.8 `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- [ ] 2.9 Hono app setup — `new Hono()`, register middleware, mount route groups, `Bun.serve({ fetch: app.fetch })`

---

### Phase 3 — Policy Engine Module

**File:** `backend/src/policy-engine.ts`

This is the core — an in-process module, no I/O for stateless rules, single Redis pipeline for stateful rules.

- [ ] 3.1 Types: `AgentPolicyRules`, `ConnectorPolicyRules`, `PolicyDecision`, `PolicyDecisionType`
- [ ] 3.2 Policy cache — in-process LRU (max 10k entries, TTL 30s) for both agent and connector policies
  - Redis pub/sub channel `policy_invalidate` → flush relevant cache entry
- [ ] 3.3 Stateless rule evaluators (pure functions, no I/O):
  - [ ] `evalAllowedRails(rail, rules)` → DENY or null
  - [ ] `evalAgentBlockedCountries(recipientCountry, rules)` → DENY or null
  - [ ] `evalAgentBlocklist(recipientEntity, recipientDomain, rules)` → DENY or null
  - [ ] `evalConnectorPolicyExists(policy)` → DENY or null
  - [ ] `evalAllowedActions(action, rules)` → DENY or null
  - [ ] `evalActionLimits(action, amount, rules)` → DENY or null
  - [ ] `evalMaxPerTransaction(amount, rules)` → DENY or null
  - [ ] `evalConnectorBlockedCountries(recipientCountry, rules)` → DENY or null
  - [ ] `evalAllowedCountries(recipientCountry, rules)` → DENY or null
  - [ ] `evalAllowedCurrencies(currency, rules)` → DENY or null
  - [ ] `evalScheduleWindow(now, rules)` → DENY or null
- [ ] 3.4 Redis key namespace constants (all patterns from spec section 4.4)
- [ ] 3.5 Lua scripts:
  - [ ] `velocityCheckAndIncrement.lua` — ZREMRANGEBYSCORE + ZCARD + ZADD atomic
  - [ ] `spendCheckOnly.lua` — GET + compare (increment happens after provider success)
  - [ ] `spendIncrement.lua` — INCRBYFLOAT + EXPIREAT (called after ALLOW)
- [ ] 3.6 Stateful rule evaluators (all batched in one Redis pipeline):
  - [ ] `evalGlobalVelocity(agentId, userId, windowSeconds, maxTx)` → DENY or null
  - [ ] `evalGlobalDailyLimit(agentId, userId, amount, limit)` → DENY or null
  - [ ] `evalGlobalMonthlyLimit(agentId, userId, amount, limit)` → DENY or null
  - [ ] `evalConnectorVelocity(connectorId, windowSeconds, maxTx)` → DENY or null
  - [ ] `evalConnectorDailyLimit(connectorId, amount, limit)` → DENY or null
  - [ ] `evalConnectorWeeklyLimit(connectorId, amount, limit)` → DENY or null
  - [ ] `evalConnectorMonthlyLimit(connectorId, amount, limit)` → DENY or null
  - [ ] `evalRecipientDailyLimit(connectorId, recipientId, amount, limit)` → DENY or null
- [ ] 3.7 `evalRequireHumanApproval(amount, rules)` → HOLD or null
- [ ] 3.8 `evaluate(context)` — orchestrates the full 22-step chain, returns `PolicyDecision`
- [ ] 3.9 `incrementSpendCounters(context)` — called after provider success; atomically increments all relevant Redis spend keys

---

### Phase 4 — Connector System

**Files:** `backend/src/connectors/interface.ts`, `backend/src/connectors/stripe.ts`, `backend/src/connectors/circle.ts`, `backend/src/connectors/x402.ts`, `backend/src/connectors/executor.ts`

- [ ] 4.1 `Connector` interface — `rail`, `authType`, `execute()`, `validate()`, `extractRecipientId()`
- [ ] 4.2 Envelope encryption utils — AES-256-GCM encrypt/decrypt with KMS-managed data key
  - Dev mode: skip KMS, use local 32-byte key from env

#### Credential shapes per rail (JSON blob encrypted in `credentials_encrypted`)

| Rail | `auth_type` | Encrypted JSON fields | Masked display |
|---|---|---|---|
| **Stripe** | `oauth` | `{ accessToken, refreshToken }` | `sk_live_****abc1` |
| **Square** | `oauth` | `{ accessToken, refreshToken, locationId }` | `EAAAl****xyz · Location: L3XXXX` |
| **Circle** | `api_key` | `{ apiKey, entitySecret }` | `TEST_API_KEY:****xyz` |
| **Braintree** | `api_key` | `{ merchantId, publicKey, privateKey }` | `Merchant: xxxxx · PK: ****xyz` |
| **Razorpay** | `api_key` | `{ keyId, keySecret }` | `rzp_live_****xyz` |
| **x402** | `wallet` | `{ privateKey, address, chain }` | `0xAbCd...1234 (Base)` |

> **x402 note:** Private key is stored encrypted (not just the wallet address). The address is derived from it and stored plaintext in `masked_credential` for display. Chain is `base` (mainnet) or `base-sepolia` (testnet).

#### Dashboard form fields per rail

| Rail | Connection method | Form fields |
|---|---|---|
| **Stripe** | OAuth redirect | Just "Connect Stripe" button — no manual input |
| **Square** | OAuth redirect + one field | Post-OAuth: Location ID input (copy from Square dashboard → Locations) |
| **Circle** | API key form | API Key + Entity Secret |
| **Braintree** | API key form | Merchant ID + Public Key + Private Key |
| **Razorpay** | API key form | Key ID + Key Secret |
| **x402** | Wallet form | Private Key input (0x...) + Chain selector (Base / Base Sepolia). Address auto-derived and shown for confirmation before saving. |

- [ ] 4.3 Stripe connector — `new Stripe(creds.accessToken)` for execute, validate(), extractRecipientId()
- [ ] 4.4 Circle connector — `initiateUserControlledWalletsClient({ apiKey: creds.apiKey })` + `creds.entitySecret` per call, validate(), extractRecipientId()
- [ ] 4.5 x402 connector — `privateKeyToAccount(creds.privateKey)` → sign payment headers per call, validate() checks balance > 0
- [ ] 4.6 Square connector (P1) — `new Client({ accessToken: creds.accessToken })` + `creds.locationId` per call
- [ ] 4.7 Braintree connector (P1) — `new BraintreeGateway({ merchantId, publicKey, privateKey })`
- [ ] 4.8 Razorpay connector (P1) — `new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret })`
- [ ] 4.9 `ConnectorExecutor` — load encrypted record, decrypt via KMS, instantiate connector, call execute(), zero credentials
  - Redis cache for encrypted connector records (TTL 5 min, invalidated on revoke)
- [ ] 4.10 Per-rail circuit breaker — 50% error rate in 10s → open; half-open after 30s

---

### Phase 5 — Execute Route (Hot Path)

**File:** `backend/src/handler.ts`

This is the critical path. Target: < 10ms gateway overhead p99.

- [ ] 5.1 `POST /v1/execute` handler
  - Auth middleware: resolve agentId/developerId/userId from SDK API key
  - Idempotency check: `idempotency:{agentId}:{idempotencyKey}` in Redis (TTL 24h)
  - Load agent policy + connector policy from cache (TTL 30s) or Postgres
  - Run `policyEngine.evaluate(context)`
  - On **ALLOW**: ConnectorExecutor.execute() → incrementSpendCounters() → writeAuditLog() → return 200
  - On **HOLD**: insert `approvals` row → publish SQS/queue event → writeAuditLog() → return 202 + approvalId
  - On **DENY**: writeAuditLog() → return 403 + errorCode
- [ ] 5.2 Audit log writer — hash-chained INSERT; batched (max 100 entries or 50ms flush)
  - Genesis hash for first entry per (agentId, userId): `SHA256("INFLECTION_GENESIS:{agentId}:{userId}")`
  - Dead-letter queue (in-memory or file) for failed audit writes
- [ ] 5.3 Args sanitizer — strip `card`, `cvv`, `api_key`, `secret`, `token`, `password`, `private_key` fields before audit storage

---

### Phase 6 — CRUD API Routes

**File:** `backend/src/routes.ts` (Hono route groups mounted on the main app)

#### Agents
- [ ] 6.1 `POST /v1/agents` — register agent, generate live + test API keys (shown once)
- [ ] 6.2 `GET /v1/agents` — list by developer
- [ ] 6.3 `GET /v1/agents/:agentId` — get with connectors, policies, manifest
- [ ] 6.4 `GET /v1/registry/agents` — public registry, filterable
- [ ] 6.5 `GET /v1/registry/agents/:slug` — public agent profile

#### Connectors
- [ ] 6.6 `POST /v1/connectors` — connect a rail (OAuth code or API key); encrypt + store credentials; call validate()
- [ ] 6.7 `GET /v1/connectors?agentId=` — list connectors for agent
- [ ] 6.8 `DELETE /v1/connectors/:connectorId` — revoke; invalidate Redis cache immediately

#### Policies
- [ ] 6.9 `POST /v1/agents/:agentId/policy` — create new version of agent policy; publish `policy_invalidate`
- [ ] 6.10 `GET /v1/agents/:agentId/policy` — current version
- [ ] 6.11 `GET /v1/agents/:agentId/policy/versions` — all versions
- [ ] 6.12 `POST /v1/connectors/:connectorId/policy` — create new connector policy version; publish `policy_invalidate`
- [ ] 6.13 `GET /v1/connectors/:connectorId/policy` — current version
- [ ] 6.14 `GET /v1/connectors/:connectorId/policy/versions` — all versions

#### Audit Logs
- [ ] 6.15 `GET /v1/audit` — filterable by agentId, rail, outcome, from/to, cursor pagination; JSON + CSV export

#### Approvals
- [ ] 6.16 `GET /v1/approvals` — list with status filter
- [ ] 6.17 `GET /v1/approvals/:approvalId` — single approval detail
- [ ] 6.18 `POST /v1/approvals/:approvalId/approve` — trigger async execution job
- [ ] 6.19 `POST /v1/approvals/:approvalId/reject` — reject + notify SDK via webhook

#### Notifications
- [ ] 6.20 `GET /POST /v1/notifications` — get or set notification config per agent

---

### Phase 7 — Approval Service & Notification Worker

**Files:** `backend/src/approval-service.ts`, `backend/src/notification-worker.ts`

- [ ] 7.1 Approval state machine: PENDING → APPROVED → EXECUTED | EXECUTION_FAILED; PENDING → REJECTED | EXPIRED
- [ ] 7.2 `POST /approve` handler triggers async execution job — ConnectorExecutor.execute() → writeAuditLog() → incrementSpendCounters()
- [ ] 7.3 Signed one-click approve/reject JWT URLs (RS256, 15 min expiry, jti consumed on use)
- [ ] 7.4 Background job — check expired approvals every minute; transition PENDING → EXPIRED past `expires_at`
- [ ] 7.5 Notification worker (SQS consumer or Bun queue):
  - [ ] Slack: POST to webhook URL with Block Kit (amount, action, approve/reject buttons)
  - [ ] Email: SES template with approve/reject links
  - [ ] Retry with exponential backoff (5 attempts over 30 min); dead-letter queue after exhaustion

---

## Part 3 — Dashboard (Frontend) Integration Plan

Stack: **Next.js** (TypeScript), JWT auth, calls Dashboard API.

### Phase 8 — Auth & Shell

- [ ] 8.1 Login / register pages (email + password)
- [ ] 8.2 JWT token management (access + refresh in httpOnly cookie)
- [ ] 8.3 Protected route wrapper
- [ ] 8.4 Navigation shell — sidebar with: Agents, Connectors, Policies, Approvals, Audit Log, Settings

### Phase 9 — Connector Management UI

- [ ] 9.1 Connector list page — status badge (active / revoked / error), last used
- [ ] 9.2 "Connect Stripe" — OAuth redirect flow
- [ ] 9.3 "Connect Circle / Braintree / Razorpay" — API key input form
- [ ] 9.4 "Connect x402" — wallet address input + format validation
- [ ] 9.5 Revoke connector button — confirmation modal

### Phase 10 — Policy Editor UI

Agent-level policy form:
- [ ] 10.1 `allowedRails` — multi-select checkboxes (stripe, circle, x402, square, braintree, razorpay)
- [ ] 10.2 `globalVelocityCheck` — max transactions + window seconds inputs
- [ ] 10.3 `globalDailyLimit` / `globalMonthlyLimit` — amount + currency inputs
- [ ] 10.4 `blockedCountries` — country multi-select (ISO 3166-1 alpha-2)
- [ ] 10.5 `blocklist` — entities and domains text inputs (comma-separated)

Connector-level policy form (per connector):
- [ ] 10.6 `allowedActions` — action multi-select per rail (e.g., charges.create, refunds.create)
- [ ] 10.7 `actionLimits` — per-action max amount inputs (shown for each selected action)
- [ ] 10.8 `maxPerTransaction` — amount + currency
- [ ] 10.9 `dailyLimit` / `weeklyLimit` / `monthlyLimit` — amount + currency
- [ ] 10.10 `requireHumanApproval` — toggle + threshold amount + currency
- [ ] 10.11 `velocityCheck` — max transactions + window seconds
- [ ] 10.12 `allowedCurrencies` — currency multi-select
- [ ] 10.13 `allowedCountries` / `blockedCountries` — country multi-select
- [ ] 10.14 `recipientDailyLimit` — amount + currency
- [ ] 10.15 `scheduleWindow` — day-of-week checkboxes + start/end UTC hour + timezone
- [ ] 10.16 Raw JSON toggle — advanced users can edit policy JSONB directly
- [ ] 10.17 Policy version history panel — read-only list of past versions

### Phase 11 — Approvals Queue UI

- [ ] 11.1 Pending approvals list — agent, rail, action, amount, currency, time held, countdown to expiry
- [ ] 11.2 Approval detail modal — full args snapshot, policy that triggered hold, approve/reject with reason field
- [ ] 11.3 Historical approvals tab — filter by status (approved / rejected / expired)

### Phase 12 — Audit Log UI

- [ ] 12.1 Paginated log table — timestamp, agent, rail, action, amount, outcome badge (ALLOW/DENY/HOLD)
- [ ] 12.2 Filter bar — agentId, rail, outcome, date range
- [ ] 12.3 Log entry detail drawer — full fields including policyId, denyRule, providerTxId, durationMs
- [ ] 12.4 Export button — JSON or CSV for current filter

### Phase 13 — Notification Config UI

- [ ] 13.1 Slack webhook URL input + mention user IDs
- [ ] 13.2 Email addresses list input
- [ ] 13.3 Approval timeout seconds input
- [ ] 13.4 Test notification button

---

## Part 4 — SDK Build Plan

Package: `@inflection/sdk` (TypeScript, Node.js + Bun compatible)

**File:** `sdks/src/index.ts`

### Phase 14 — SDK Core

- [ ] 14.1 `InflectionClient` class — accepts `{ apiKey, gatewayUrl?, mode? }`
  - `mode: 'live' | 'test' | 'local'` — local mode logs + bypasses gateway
- [ ] 14.2 Interceptor — wraps provider client calls; serializes to `{ rail, action, args, idempotencyKey }`; POST to `/v1/execute`
- [ ] 14.3 Response handler — map gateway response to:
  - ALLOW → return `providerResponse` transparently
  - HOLD (blocking mode) — poll `GET /v1/approvals/:id` every 5s until resolved
  - HOLD (non-blocking mode) — throw `InflectionHeldError` immediately with approvalId
  - DENY → throw `InflectionPolicyDeniedError`
  - Provider error → throw `InflectionProviderError`
- [ ] 14.4 Error types:
  - `InflectionPolicyDeniedError` — `errorCode`, `auditId`
  - `InflectionHeldError` — `approvalId`, `auditId`
  - `InflectionProviderError` — `rail`, `providerError`, `auditId`
- [ ] 14.5 Idempotency key — auto-generated UUID per call (overridable by developer)

### Phase 15 — Rail Clients

Each rail client is a thin proxy that maps provider SDK method signatures to the interceptor.

- [ ] 15.1 `stripe` client — maps `charges.create`, `paymentIntents.create`, `refunds.create`, `customers.create`, `payouts.create` etc.
- [ ] 15.2 `circle` client — maps `transfers.create`, `payouts.create`
- [ ] 15.3 `x402` client — maps x402 payment header generation
- [ ] 15.4 `square` client (P1) — maps Square Payments API actions
- [ ] 15.5 `braintree` client (P1) — maps Braintree transaction actions
- [ ] 15.6 `razorpay` client (P1) — maps Razorpay payment actions
- [ ] 15.7 TypeScript types: `ExecuteRequest`, `ExecuteResponse`, `AllowResponse`, `HoldResponse`, `DenyResponse`

### Phase 16 — SDK Package Setup

- [ ] 16.1 `package.json` — name `@inflection/sdk`, exports, types
- [ ] 16.2 Build output — ESM + CJS dual build
- [ ] 16.3 README with quickstart (install → init → first call in < 10 lines)
- [ ] 16.4 Unit tests for interceptor, error types, local mode

---

## Part 5 — Agent Integration Plan

Update all agents in `src/agents/` to use `@inflection/sdk` instead of direct provider SDKs.

### Phase 17 — Migrate Agents

For each agent: replace direct provider client import with the corresponding `@inflection/sdk` rail client. No business logic changes — only the import and client initialization change.

- [ ] 17.1 `stripe-agent.ts` — replace `stripe` with `inflection.stripe`
- [ ] 17.2 `circle-agent.ts` — replace Circle SDK with `inflection.circle`
- [ ] 17.3 `x402-agent.ts` — replace x402 client with `inflection.x402`
- [ ] 17.4 `square-agent.ts` — replace Square SDK with `inflection.square`
- [ ] 17.5 `braintree-agent.ts` — replace Braintree SDK with `inflection.braintree`
- [ ] 17.6 `razorpay-agent.ts` — replace Razorpay SDK with `inflection.razorpay`
- [ ] 17.7 `coinbase-agent.ts` — evaluate against x402/circle connector pattern
- [ ] 17.8 `google-pay-agent.ts` — evaluate tokenization layer mapping

For each agent, wrap financial calls in try/catch handling `InflectionPolicyDeniedError`, `InflectionHeldError`, and `InflectionProviderError`.

- [ ] 17.9 Update `src/config.ts` — add `INFLECTION_API_KEY`, `INFLECTION_GATEWAY_URL`
- [ ] 17.10 Update root `src/index.ts` — initialize `InflectionClient` once and pass to all agents

---

## Build Order Summary

```
Phase 1  → DB Schema & Migrations
Phase 2  → Auth & API Foundation
Phase 3  → Policy Engine Module          ← most critical
Phase 4  → Connector System
Phase 5  → Execute Route (hot path)      ← integrates 3 + 4
Phase 6  → CRUD API Routes
Phase 7  → Approval Service & Notifications
Phase 8  → Dashboard Auth & Shell
Phase 9  → Connector Management UI
Phase 10 → Policy Editor UI
Phase 11 → Approvals Queue UI
Phase 12 → Audit Log UI
Phase 13 → Notification Config UI
Phase 14 → SDK Core
Phase 15 → Rail Clients
Phase 16 → SDK Package Setup
Phase 17 → Migrate All Agents
```

---

## P0 Scope (Minimum Shippable)

The following features constitute the minimum working product:

**Backend:** Phases 1–7, policy rules 1, 4, 5, 7, 8, 10, 15, 16, 20, 21
**Dashboard:** Phases 8–12 (without P1/P2 features in each)
**SDK:** Phases 14–16 with stripe + circle + x402 clients only
**Agents:** Phase 17 for stripe-agent, circle-agent, x402-agent

**P0 policy rules:** `allowedRails`, `globalVelocityCheck`, `globalDailyLimit`, `allowedActions`, `maxPerTransaction`, `velocityCheck`, `dailyLimit`, `requireHumanApproval`, default-deny (no policy)

Everything else is P1/P2 — additive, no breaking changes required.
