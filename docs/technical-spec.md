# Inflection — Technical Specification

**Version:** 1.0  
**Date:** 2026-05-11  
**Status:** Draft  

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [API Design](#2-api-design)
3. [Database Schema](#3-database-schema)
4. [Policy Engine Design](#4-policy-engine-design)
5. [Connector System](#5-connector-system)
6. [Audit Log Design](#6-audit-log-design)
7. [Approval Flow](#7-approval-flow)
8. [Security](#8-security)
9. [Scalability & Infrastructure](#9-scalability--infrastructure)
10. [Error Handling & Failure Modes](#10-error-handling--failure-modes)

---

## 1. System Architecture

### 1.1 ASCII Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Agent Runtime (any cloud)                       │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │  Agent Process                                                    │   │
│   │                                                                   │   │
│   │   Business Logic                                                  │   │
│   │        │                                                          │   │
│   │        ▼                                                          │   │
│   │   @inflection/sdk                                                 │   │
│   │   ┌──────────────────────────────────────────────────────────┐   │   │
│   │   │  InflectionClient                                         │   │   │
│   │   │  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌───────────────┐  │   │   │
│   │   │  │  stripe  │ │  circle  │ │  x402 │ │   braintree   │  │   │   │
│   │   │  │  client  │ │  client  │ │client │ │    client     │  │   │   │
│   │   │  └────┬─────┘ └────┬─────┘ └───┬───┘ └───────┬───────┘  │   │   │
│   │   │       └────────────┴───────────┴─────────────┘           │   │   │
│   │   │                           │                               │   │   │
│   │   │               Interceptor + Serializer                    │   │   │
│   │   └───────────────────────────┬───────────────────────────────┘   │   │
│   └───────────────────────────────┼───────────────────────────────────┘   │
│                                   │  HTTPS (TLS 1.3)                       │
│                                   │  Authorization: Bearer <sdk-api-key>   │
└───────────────────────────────────┼────────────────────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────┐
                    │         Inflection Gateway         │
                    │         (multi-region, A/A)        │
                    │                                    │
                    │  ┌─────────────────────────────┐  │
                    │  │      Auth Middleware          │  │
                    │  │  (API key → agentId lookup)   │  │
                    │  └──────────────┬────────────────┘  │
                    │                 │                    │
                    │  ┌──────────────▼────────────────┐  │
                    │  │       Policy Engine            │  │
                    │  │  (in-memory rules + Redis for  │  │
                    │  │   velocity / spend counters)   │  │
                    │  └──────────────┬────────────────┘  │
                    │                 │                    │
                    │         ALLOW / DENY / HOLD          │
                    │         ┌───────┴──────────┐        │
                    │         │                  │        │
                    │  ┌──────▼──────┐  ┌────────▼──────┐ │
                    │  │  Connector  │  │  Approval     │ │
                    │  │  Executor   │  │  Queue        │ │
                    │  └──────┬──────┘  └────────┬──────┘ │
                    │         │                  │        │
                    │  ┌──────▼──────────────────▼──────┐ │
                    │  │         Audit Log Writer        │ │
                    │  └─────────────────────────────────┘ │
                    └──┬──────────────┬──────────────┬──────┘
                       │              │              │
             ┌─────────▼──┐  ┌───────▼────┐  ┌─────▼────────────┐
             │  Payment   │  │ PostgreSQL  │  │     Redis        │
             │  Providers │  │ (RDS Multi- │  │  (ElastiCache    │
             │  (Stripe,  │  │  AZ)        │  │   Cluster)       │
             │  Circle,   │  │             │  │                  │
             │  x402...)  │  │  - agents   │  │  - velocity      │
             └────────────┘  │  - policies │  │    counters      │
                             │  - connectors│  │  - spend sums    │
                             │  - audit_log│  │  - approval cache│
                             │  - approvals│  └──────────────────┘
                             └────────────┘
                                    │
                    ┌───────────────▼──────────────────┐
                    │     Inflection Dashboard           │
                    │     (Next.js, Vercel)              │
                    │                                    │
                    │  - Connector management            │
                    │  - Policy editor                   │
                    │  - Audit log viewer                │
                    │  - Approvals queue                 │
                    │  - Notification config             │
                    └────────────────────────────────────┘
```

### 1.2 Component Inventory

| Component | Technology | Responsibility |
|---|---|---|
| **SDK** | TypeScript (Node.js) | Wraps payment rail clients; serializes calls; forwards to gateway |
| **Gateway** | Node.js (Fastify) on AWS ECS Fargate | Hot path: auth, policy eval, execute or hold, audit write |
| **Policy Engine** | In-process module within Gateway | Evaluates rules against call args; stateful rules via Redis |
| **Connector Executor** | Module within Gateway | Holds encrypted credentials; decrypts at call time; forwards to provider |
| **Approval Service** | Separate Node.js service | Manages hold queue, notification dispatch, approval state transitions |
| **Audit Log Writer** | Module within Gateway | Constructs hash-chained entries; writes to PostgreSQL |
| **Dashboard API** | Node.js (Fastify) | CRUD for agents, connectors, policies, notification configs; approval actions |
| **Dashboard Frontend** | Next.js (TypeScript) | React SPA; server-side rendered for initial load; JWT auth |
| **PostgreSQL (RDS)** | PostgreSQL 16, Multi-AZ | Primary store: agents, connectors, policies, audit_logs, approvals |
| **Redis (ElastiCache)** | Redis 7, Cluster mode | Velocity counters, spend accumulators, approval state cache |
| **KMS** | AWS KMS | Encryption key management for connector credentials |
| **Notification Worker** | Node.js, SQS consumer | Dispatches Slack/email/WhatsApp notifications asynchronously |

### 1.3 Request Flow — Hot Path

```
SDK call (e.g., stripe.charges.create({...}))
  │
  ▼
Interceptor serializes: { agentId, rail: "stripe", action: "charges.create", args: {...} }
  │
  ▼  POST /v1/execute  (TLS, Bearer <sdk-api-key>)
  │
Gateway receives request
  ├─ Auth middleware: lookup API key → resolve agentId, developerId, userId
  ├─ Resolve connector for (agentId, userId, rail) → connectorId
  ├─ Load agent policy + connector policy from cache (TTL 30s) or PostgreSQL
  ├─ Policy engine evaluation — TIER 1 (agent, stateless):
  │    ├─ Check allowedRails
  │    ├─ Check agent blockedCountries / blocklist
  ├─ Policy engine evaluation — TIER 1 (agent, stateful):
  │    ├─ Fetch Redis: global velocity counter, global daily/monthly spend
  ├─ Policy engine evaluation — TIER 2 (connector, stateless):
  │    ├─ Check allowedActions + actionLimits
  │    ├─ Check maxPerTransaction
  │    ├─ Check connector blockedCountries, allowedCountries, allowedCurrencies
  │    └─ Check scheduleWindow
  ├─ Policy engine evaluation — TIER 2 (connector, stateful) [single Redis pipeline]:
  │    ├─ connector velocity counter
  │    ├─ connector daily / weekly / monthly spend
  │    ├─ recipient daily spend cap
  │    └─ Check requireHumanApproval threshold
  │
  ├─ Decision: ALLOW
  │    ├─ Connector executor decrypts credentials for rail
  │    ├─ Forwards call to provider
  │    ├─ Receives provider response
  │    ├─ Increments Redis spend counters atomically
  │    ├─ Writes audit log entry (hash-chained)
  │    └─ Returns provider response to SDK
  │
  ├─ Decision: HOLD
  │    ├─ Writes approval record to PostgreSQL
  │    ├─ Publishes notification event to SQS
  │    ├─ Writes audit log entry (policyDecision: HOLD)
  │    └─ Returns 202 Accepted + approvalId to SDK
  │
  └─ Decision: DENY
       ├─ Writes audit log entry (policyDecision: DENY, reason)
       └─ Returns 403 + reason code to SDK
```

---

## 2. API Design

### 2.1 Authentication

**SDK → Gateway:** API key in `Authorization: Bearer <key>` header. Keys are hashed (Argon2id) before storage. On each request, the gateway hashes the incoming key and compares against stored hash. Lookups are cached in Redis (TTL 60s) to avoid per-request database hits.

**Dashboard → API:** JWT (RS256, asymmetric key pair). Issued at login, short-lived (15 min access token, 7-day refresh token). Refresh tokens are stored as hashed values in PostgreSQL with a revocation flag.

**API key scopes:**
- `sdk` — only permitted to call `POST /v1/execute`
- `dashboard` — full CRUD on agents, connectors, policies; restricted to resources owned by the authenticated user

---

### 2.2 POST /v1/execute

The hot path. Called by the SDK for every intercepted financial action.

**Auth:** SDK API key (Bearer token)

**Request:**
```json
POST /v1/execute
Authorization: Bearer sdk_live_abc123...
Content-Type: application/json

{
  "rail": "stripe",
  "action": "charges.create",
  "args": {
    "amount": 5000,
    "currency": "usd",
    "customer": "cus_abc123",
    "description": "Vendor invoice #1042"
  },
  "idempotencyKey": "agent-tx-uuid-1234"
}
```

**Fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `rail` | string | Yes | Payment rail identifier: `stripe`, `circle`, `x402`, `square`, `braintree`, `razorpay` |
| `action` | string | Yes | Provider action path (e.g., `charges.create`, `paymentIntents.create`) |
| `args` | object | Yes | Arguments to forward to the provider. Must not contain raw card data. |
| `idempotencyKey` | string | Yes | Client-generated UUID for idempotent retry safety |

**Response — ALLOW (200):**
```json
{
  "outcome": "ALLOW",
  "auditId": "aud_01j2k3l4m5n6",
  "providerResponse": {
    "id": "ch_1OqAbc2eZvKYlo2C",
    "amount": 5000,
    "status": "succeeded"
  }
}
```

**Response — HOLD (202):**
```json
{
  "outcome": "HOLD",
  "auditId": "aud_01j2k3l4m5n7",
  "approvalId": "apr_09x8y7z6w5v4",
  "message": "Transaction held pending human approval. Approval threshold: $50.00. Transaction amount: $50.00."
}
```

**Response — DENY (403):**
```json
{
  "outcome": "DENY",
  "auditId": "aud_01j2k3l4m5n8",
  "errorCode": "POLICY_DENY_DAILY_LIMIT_EXCEEDED",
  "message": "Daily spend limit of $1000.00 exceeded. Current spend: $1000.00."
}
```

**Error codes:**
| Code | Cause |
|---|---|
| `CONNECTOR_NOT_FOUND` | User has not connected the requested rail |
| `CONNECTOR_REVOKED` | Connector was revoked by the user |
| `POLICY_DENY_MAX_PER_TX` | Transaction amount exceeds maxPerTransaction |
| `POLICY_DENY_DAILY_LIMIT_EXCEEDED` | Daily limit reached |
| `POLICY_DENY_VELOCITY` | Transaction rate limit exceeded |
| `POLICY_DENY_RAIL_NOT_ALLOWED` | Rail is not in allowedRails |
| `POLICY_DENY_CURRENCY_NOT_ALLOWED` | Currency not in allowedCurrencies |
| `POLICY_DENY_COUNTRY_BLOCKED` | Recipient country in blockedCountries |
| `POLICY_DENY_BLOCKLIST` | Recipient entity/domain in agent or connector blocklist |
| `POLICY_DENY_NO_CONNECTOR_POLICY` | Connector exists but has no policy — default-deny |
| `POLICY_DENY_ACTION_NOT_ALLOWED` | Action not in connector's allowedActions list |
| `POLICY_DENY_ACTION_LIMIT_EXCEEDED` | Amount exceeds the per-action limit for this action |
| `POLICY_DENY_RECIPIENT_DAILY_LIMIT` | Cumulative spend to this recipient exceeds recipientDailyLimit |
| `POLICY_DENY_GLOBAL_VELOCITY` | Agent-level cross-rail transaction rate exceeded |
| `POLICY_DENY_GLOBAL_DAILY_LIMIT` | Agent-level cross-rail daily spend exceeded |
| `POLICY_DENY_OUTSIDE_SCHEDULE` | Call made outside the connector's scheduleWindow |
| `PROVIDER_ERROR` | Downstream provider returned an error |
| `RATE_LIMITED` | Inflection gateway rate limit exceeded |

---

### 2.3 Agents

**POST /v1/agents** — Register a new agent (developer action)

```json
POST /v1/agents
Authorization: Bearer <jwt>

{
  "name": "vendor-pay-agent",
  "displayName": "Vendor Payment Agent",
  "description": "Handles AP automation for enterprise deployments",
  "category": "accounts_payable",
  "developerName": "Acme AI Labs",
  "documentationUrl": "https://docs.acmeai.com/vendor-pay-agent",
  "webhookUrl": "https://my-agent.example.com/inflection-webhook",
  "registry": {
    "listed": true,
    "tagline": "Automates AP — pays invoices, handles approvals, reconciles spend.",
    "tags": ["accounts-payable", "invoices", "stripe", "circle"]
  }
}
```

Response — full keys shown only here:
```json
{
  "agentId": "agt_01abc123",
  "name": "vendor-pay-agent",
  "liveApiKey": "ak_live_7x2kp9mn_51abc...",   // shown only once; hash stored
  "testApiKey": "ak_test_7x2kp9mn_99xyz...",   // shown only once; hash stored
  "createdAt": "2026-05-11T12:00:00Z"
}
```

**POST /v1/agents/:agentId/manifest** — Set or update skills and capabilities (see `docs/agent-manifest.md`)

**GET /v1/agents/:agentId/manifest/policy-suggestions** — Get suggested connector policies derived from manifest actions and amount ranges

**GET /v1/agents** — List agents for the authenticated developer

**GET /v1/agents/:agentId** — Get agent with connectors, policies, and manifest

**GET /v1/registry/agents** — Public registry endpoint (no auth required)

Query params: `q` (search), `category`, `rail`, `riskTier`, `verified` (bool), `limit`, `cursor`

```json
GET /v1/registry/agents?category=accounts_payable&rail=stripe&limit=20

Response 200:
{
  "agents": [
    {
      "agentId": "agt_01abc123",
      "slug": "vendor-pay-agent",
      "displayName": "Vendor Payment Agent",
      "developerName": "Acme AI Labs",
      "tagline": "Automates AP — pays invoices, handles approvals, reconciles spend.",
      "category": "accounts_payable",
      "verified": true,
      "riskTier": "medium",
      "skills": [
        { "skillId": "vendor_payment", "name": "AP / Invoices" },
        { "skillId": "issue_refund", "name": "Refund Processing" }
      ],
      "requiredRails": ["stripe", "circle"],
      "deployerCount": 12,
      "logoUrl": null
    }
  ],
  "nextCursor": "cursor_xyz",
  "total": 24
}
```

**GET /v1/registry/agents/:slug** — Get full public agent profile by slug (used by `<AgentDetailSheet>`)

---

### 2.4 Connectors

**POST /v1/connectors** — Connect a payment provider to an agent

```json
POST /v1/connectors
Authorization: Bearer <jwt>

{
  "agentId": "agt_01abc123",
  "rail": "stripe",
  "authType": "oauth",
  "oauthCode": "ac_1Oq...",         // for OAuth flows
  "credentials": null               // for API key flows: { "apiKey": "sk_live_..." }
}
```

Response:
```json
{
  "connectorId": "con_9xyz456",
  "agentId": "agt_01abc123",
  "rail": "stripe",
  "status": "active",
  "maskedCredential": "sk_live_****abc1",
  "connectedAt": "2026-05-11T12:00:00Z"
}
```

**GET /v1/connectors?agentId=agt_01abc123** — List connectors for an agent

**DELETE /v1/connectors/:connectorId** — Revoke a connector (immediate effect; all subsequent gateway calls to that rail are blocked)

---

### 2.5 Policies

Policies operate at two independent tiers. Both are versioned and immutable after creation — a new POST creates a new version; prior versions are retained for audit linkage.

#### Agent-Level Policy (cross-rail guards)

**POST /v1/agents/:agentId/policy** — Create a new version of the agent-level policy

```json
POST /v1/agents/agt_01abc123/policy
Authorization: Bearer <jwt>

{
  "rules": {
    "allowedRails": ["stripe", "circle"],
    "globalVelocityCheck": { "maxTransactions": 200, "windowSeconds": 3600 },
    "globalDailyLimit": { "amount": 500000, "currency": "USD" },
    "blockedCountries": ["KP", "IR", "CU", "SY"],
    "blocklist": {
      "entities": ["Sanctioned Entity LLC"],
      "domains": ["fraud.example.com"]
    }
  }
}
```

Response:
```json
{
  "policyId": "apol_v3_abc123",
  "agentId": "agt_01abc123",
  "version": 3,
  "rules": { ... },
  "createdAt": "2026-05-11T12:00:00Z",
  "createdBy": "usr_9876"
}
```

**GET /v1/agents/:agentId/policy** — Get current agent policy (most recent version)

**GET /v1/agents/:agentId/policy/versions** — List all historical agent policy versions

#### Connector-Level Policy (per-rail, per-action rules)

**POST /v1/connectors/:connectorId/policy** — Create a new version of the policy for a specific connector

```json
POST /v1/connectors/con_stripe_001/policy
Authorization: Bearer <jwt>

{
  "rules": {
    "allowedActions": ["charges.create", "refunds.create", "customers.create"],
    "actionLimits": {
      "charges.create":  { "maxAmount": 10000, "currency": "USD" },
      "refunds.create":  { "maxAmount": 5000,  "currency": "USD" }
    },
    "maxPerTransaction":    { "amount": 10000, "currency": "USD" },
    "dailyLimit":           { "amount": 50000, "currency": "USD" },
    "weeklyLimit":          { "amount": 200000, "currency": "USD" },
    "requireHumanApproval": { "above": 5000, "currency": "USD" },
    "velocityCheck":        { "maxTransactions": 100, "windowSeconds": 3600 },
    "allowedCurrencies":    ["USD", "EUR", "GBP"],
    "allowedCountries":     ["US", "GB", "DE", "FR", "CA"],
    "recipientDailyLimit":  { "amount": 25000, "currency": "USD" }
  }
}
```

A different connector (Circle) for the same agent can have entirely different rules:

```json
POST /v1/connectors/con_circle_001/policy
Authorization: Bearer <jwt>

{
  "rules": {
    "allowedActions": ["transfers.create"],
    "actionLimits": {
      "transfers.create": { "maxAmount": 100000, "currency": "USD" }
    },
    "maxPerTransaction":    { "amount": 100000, "currency": "USD" },
    "dailyLimit":           { "amount": 500000, "currency": "USD" },
    "requireHumanApproval": { "above": 25000, "currency": "USD" },
    "velocityCheck":        { "maxTransactions": 20, "windowSeconds": 3600 },
    "allowedCurrencies":    ["USD", "USDC"],
    "recipientDailyLimit":  { "amount": 200000, "currency": "USD" }
  }
}
```

Response:
```json
{
  "policyId": "cpol_v1_stripe_001",
  "connectorId": "con_stripe_001",
  "rail": "stripe",
  "version": 1,
  "rules": { ... },
  "createdAt": "2026-05-11T12:00:00Z",
  "createdBy": "usr_9876"
}
```

**GET /v1/connectors/:connectorId/policy** — Get current connector policy

**GET /v1/connectors/:connectorId/policy/versions** — List all historical versions for this connector

A connector with no policy attached denies all calls (default-deny). The `allowedActions` field must be explicitly set to permit any actions.

---

### 2.6 Audit Logs

**GET /v1/audit**

Query parameters:
| Param | Type | Description |
|---|---|---|
| `agentId` | string | Filter by agent |
| `rail` | string | Filter by rail |
| `outcome` | `ALLOW` \| `DENY` \| `HOLD` | Filter by decision |
| `from` | ISO8601 | Start of time range |
| `to` | ISO8601 | End of time range |
| `limit` | integer | Max records (default 100, max 1000) |
| `cursor` | string | Pagination cursor |
| `format` | `json` \| `csv` | Response format (default `json`) |

Response:
```json
{
  "entries": [
    {
      "auditId": "aud_01j2k3l4m5n6",
      "timestamp": "2026-05-11T11:55:00.123Z",
      "agentId": "agt_01abc123",
      "rail": "stripe",
      "action": "charges.create",
      "argsSummary": { "amount": 5000, "currency": "usd" },
      "policyDecision": "ALLOW",
      "policyId": "pol_v3_abc123",
      "outcome": "ALLOW",
      "providerTxId": "ch_1OqAbc2eZvKYlo2C",
      "durationMs": 142,
      "entryHash": "sha256:a1b2c3...",
      "prevHash": "sha256:9z8y7x..."
    }
  ],
  "nextCursor": "cursor_opaque_xyz",
  "totalCount": 4821
}
```

---

### 2.7 Approvals

**GET /v1/approvals** — List pending (and historical) approvals

Query parameters: `agentId`, `status` (`pending` | `approved` | `rejected` | `expired`), `from`, `to`, `limit`, `cursor`

**GET /v1/approvals/:approvalId** — Get a single approval with full transaction details

**POST /v1/approvals/:approvalId/approve**

```json
POST /v1/approvals/apr_09x8y7z6w5v4/approve
Authorization: Bearer <jwt>

{
  "reason": "Verified with vendor; legitimate invoice."
}
```

Response:
```json
{
  "approvalId": "apr_09x8y7z6w5v4",
  "status": "approved",
  "approvedBy": "usr_9876",
  "approvedAt": "2026-05-11T12:01:00Z",
  "executionAuditId": "aud_01j2k3l4m5n9"
}
```

**POST /v1/approvals/:approvalId/reject**

```json
POST /v1/approvals/apr_09x8y7z6w5v4/reject
Authorization: Bearer <jwt>

{
  "reason": "Unrecognized vendor. Escalating to fraud team."
}
```

---

### 2.8 Notification Configs

**GET /POST /v1/notifications** — Get or set notification configuration per agent

```json
POST /v1/notifications
Authorization: Bearer <jwt>

{
  "agentId": "agt_01abc123",
  "channels": {
    "slack": {
      "webhookUrl": "https://hooks.slack.com/services/T00/B00/xxxx",
      "mentionUserIds": ["U01ABC123"]
    },
    "email": {
      "addresses": ["ops@company.com", "cfo@company.com"]
    }
  },
  "approvalTimeoutSeconds": 3600
}
```

---

## 3. Database Schema

All tables are in PostgreSQL 16. UUIDs use `gen_random_uuid()`. Timestamps are `TIMESTAMPTZ` stored in UTC.

### 3.1 agents

```sql
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  webhook_url     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_developer_id ON agents(developer_id);
```

### 3.2 agent_registry_listings

Public registry profile for an agent. Only agents with `listed = true` appear in `GET /v1/registry/agents`.

```sql
CREATE TABLE agent_registry_listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  slug                TEXT NOT NULL UNIQUE,               -- URL-safe, e.g. "vendor-pay-agent"
  tagline             TEXT NOT NULL CHECK (length(tagline) <= 80),
  logo_url            TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',       -- up to 5 tags
  listed              BOOLEAN NOT NULL DEFAULT false,
  verified_at         TIMESTAMPTZ,                        -- set by Inflection staff; null = unverified
  deployer_count      INTEGER NOT NULL DEFAULT 0,         -- maintained by trigger on agent_user_connections
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registry_listed ON agent_registry_listings(listed) WHERE listed = true;
CREATE INDEX idx_registry_tags ON agent_registry_listings USING GIN(tags);

-- Full-text search index over agent name + tagline + tags
CREATE INDEX idx_registry_fts ON agent_registry_listings
  USING GIN(to_tsvector('english', tagline || ' ' || array_to_string(tags, ' ')));
```

### 3.3 agent_api_keys

```sql
CREATE TABLE agent_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,    -- Argon2id hash of the raw key
  key_prefix      TEXT NOT NULL,           -- first 12 chars for display: "sdk_live_abc"
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_key_hash ON agent_api_keys(key_hash);
CREATE INDEX idx_api_keys_agent_id ON agent_api_keys(agent_id);
```

### 3.3 users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,           -- Argon2id
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('developer', 'user', 'admin')),
  mfa_secret      TEXT,                    -- encrypted TOTP secret
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.4 agent_user_connections

Links an agent (developer-owned) to a user (deployer-owned). A user connecting an agent to their account creates this record.

```sql
CREATE TABLE agent_user_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);
```

### 3.5 connectors

Encrypted credentials are stored in `credentials_encrypted`. The encryption key is a KMS-managed data key. The `credentials_key_id` stores the KMS key reference.

```sql
CREATE TABLE connectors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rail                    TEXT NOT NULL CHECK (rail IN ('stripe', 'circle', 'x402', 'square', 'braintree', 'razorpay')),
  auth_type               TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key', 'wallet_address')),
  credentials_encrypted   BYTEA NOT NULL,   -- AES-256-GCM encrypted JSON blob
  credentials_iv          BYTEA NOT NULL,   -- 12-byte GCM IV
  credentials_key_id      TEXT NOT NULL,    -- KMS key ARN or alias
  masked_credential       TEXT NOT NULL,    -- safe display string, e.g. "sk_live_****abc1"
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'error')),
  oauth_refresh_token_enc BYTEA,            -- encrypted refresh token for OAuth connectors
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at              TIMESTAMPTZ,
  last_used_at            TIMESTAMPTZ,
  UNIQUE(agent_id, user_id, rail)
);

CREATE INDEX idx_connectors_agent_user ON connectors(agent_id, user_id);
CREATE INDEX idx_connectors_rail ON connectors(rail);
```

### 3.6 agent_policies

Agent-level policy: cross-rail guards that apply to every call from this agent regardless of rail.

```sql
CREATE TABLE agent_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  rules           JSONB NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, user_id, version)
);

CREATE INDEX idx_agent_policies_lookup ON agent_policies(agent_id, user_id, version DESC);
```

**Agent policy JSONB rules (TypeScript):**
```typescript
interface AgentPolicyRules {
  allowedRails?:          string[];                        // if absent, all connected rails are permitted
  globalVelocityCheck?:   { maxTransactions: number; windowSeconds: number };
  globalDailyLimit?:      { amount: number; currency: string };
  globalMonthlyLimit?:    { amount: number; currency: string };
  blockedCountries?:      string[];                        // ISO 3166-1 alpha-2
  blocklist?:             { entities?: string[]; domains?: string[] };
}
```

### 3.7 connector_policies

Connector-level policy: per-rail, per-action rules scoped to a single connected account. Each connector has its own independently versioned policy.

```sql
CREATE TABLE connector_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id    UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  rules           JSONB NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connector_id, version)
);

CREATE INDEX idx_connector_policies_lookup ON connector_policies(connector_id, version DESC);
```

**Connector policy JSONB rules (TypeScript):**
```typescript
interface ConnectorPolicyRules {
  // Spend limits
  maxPerTransaction?:     { amount: number; currency: string };
  dailyLimit?:            { amount: number; currency: string };
  weeklyLimit?:           { amount: number; currency: string };
  monthlyLimit?:          { amount: number; currency: string };

  // Approval
  requireHumanApproval?:  { above: number; currency: string };

  // Rate limiting (scoped to this connector)
  velocityCheck?:         { maxTransactions: number; windowSeconds: number };

  // Action control
  // If present, ONLY the listed actions are allowed on this connector.
  // If absent, all actions are DENIED (default-deny at action level).
  allowedActions?:        string[];                        // e.g. ["charges.create", "refunds.create"]

  // Per-action amount overrides (independent of maxPerTransaction)
  actionLimits?:          Record<string, { maxAmount: number; currency: string }>;
  // e.g. { "refunds.create": { maxAmount: 5000, currency: "USD" },
  //        "payouts.create": { maxAmount: 100000, currency: "USD" } }

  // Geography
  allowedCurrencies?:     string[];                        // ISO 4217
  allowedCountries?:      string[];                        // recipient country whitelist
  blockedCountries?:      string[];                        // supplements agent-level blocked list

  // Recipient concentration limits
  recipientDailyLimit?:   { amount: number; currency: string };
  // Maximum cumulative spend to any single recipient per calendar day on this connector.

  // Time window restriction (P2)
  scheduleWindow?:        {
    daysOfWeek: number[];          // 0=Sun, 6=Sat
    startUtcHour: number;          // 0–23
    endUtcHour: number;            // 0–23
    timezone?: string;             // IANA tz string; if absent, UTC assumed
  };
}
```

### 3.7 audit_logs

This table is append-only at the application level (no UPDATE, no DELETE via any API or application code). The `prev_hash` column chains entries to the immediately preceding entry for this `(agent_id, user_id)` scope.

```sql
CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL,              -- denormalized; no FK to allow retention beyond agent deletion
  user_id             UUID NOT NULL,              -- denormalized
  developer_id        UUID NOT NULL,              -- denormalized
  rail                TEXT NOT NULL,
  action              TEXT NOT NULL,
  args_summary        JSONB,                      -- sanitized args (no secrets, no PAN data)
  policy_decision     TEXT NOT NULL CHECK (policy_decision IN ('ALLOW', 'DENY', 'HOLD')),
  agent_policy_id     UUID,                       -- references agent_policies.id at time of call (may be null if no agent policy)
  connector_policy_id UUID,                       -- references connector_policies.id at time of call
  deny_reason         TEXT,
  deny_rule           TEXT,                       -- which rule triggered the deny/hold: e.g. "connector.maxPerTransaction"
  outcome             TEXT NOT NULL CHECK (outcome IN ('ALLOW', 'DENY', 'HOLD', 'APPROVED', 'REJECTED', 'TIMED_OUT')),
  provider_tx_id      TEXT,                       -- returned by provider on ALLOW/APPROVED
  duration_ms         INTEGER,
  idempotency_key     TEXT,
  prev_hash           TEXT,                       -- SHA-256 of previous entry in this agent+user scope
  entry_hash          TEXT NOT NULL,              -- SHA-256 of this entry's canonical fields
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for query performance and retention management
-- In production: partition by RANGE(created_at)

CREATE INDEX idx_audit_agent_user_time ON audit_logs(agent_id, user_id, created_at DESC);
CREATE INDEX idx_audit_outcome ON audit_logs(outcome);
CREATE INDEX idx_audit_rail ON audit_logs(rail);

-- Enforce append-only at DB level via trigger (belt and suspenders)
CREATE OR REPLACE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

### 3.8 approvals

```sql
CREATE TABLE approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES agents(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  audit_log_id        UUID NOT NULL REFERENCES audit_logs(id),
  rail                TEXT NOT NULL,
  action              TEXT NOT NULL,
  args_snapshot       JSONB NOT NULL,     -- full args at time of hold (encrypted at field level if sensitive)
  amount              NUMERIC(18, 6),     -- extracted from args for display
  currency            TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by          UUID REFERENCES users(id),
  decided_at          TIMESTAMPTZ,
  decision_reason     TEXT,
  execution_audit_id  UUID REFERENCES audit_logs(id),  -- set after execution on approve
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_agent_user_status ON approvals(agent_id, user_id, status);
CREATE INDEX idx_approvals_expires ON approvals(expires_at) WHERE status = 'pending';
```

### 3.9 notification_configs

```sql
CREATE TABLE notification_configs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_webhook_url_enc       BYTEA,         -- encrypted
  slack_mention_user_ids      TEXT[],
  email_addresses             TEXT[],
  whatsapp_numbers            TEXT[],
  approval_timeout_seconds    INTEGER NOT NULL DEFAULT 3600,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);
```

---

## 4. Policy Engine Design

### 4.1 Overview

The policy engine is an **in-process module** within the gateway service. It evaluates two policy tiers in sequence against each call and returns a `PolicyDecision`.

**Tier 1 — Agent policy:** Cross-rail guards set by the deployer on the agent as a whole. Evaluated first. A DENY or HOLD here short-circuits Tier 2.

**Tier 2 — Connector policy:** Per-rail, per-action rules set on the specific connector being invoked. Evaluated only if Tier 1 passes.

All stateless rules are evaluated in-memory with no I/O. Stateful rules (spend accumulators, velocity counters, recipient caps) require a single Redis pipeline call. The entire evaluation including the Redis round-trip targets **< 5ms p99**.

### 4.2 Policy Decision Types

```typescript
type PolicyDecisionType = 'ALLOW' | 'DENY' | 'HOLD';

interface PolicyDecision {
  result: PolicyDecisionType;
  reason?: string;
  errorCode?: string;
  // Which tier and which rule triggered the decision:
  denyTier?: 'agent' | 'connector';
  denyRule?: string;   // e.g. "connector.maxPerTransaction", "agent.globalDailyLimit"
}
```

### 4.3 Rule Evaluation Order

The first DENY or HOLD short-circuits all further evaluation. ALLOW is returned only after every rule passes.

```
─── TIER 1: Agent-Level Rules (stateless) ──────────────────────────────────

1.  CONNECTOR_PRESENT       — Is an active connector for the requested rail attached
                              to this (agentId, userId) pair?
                              → DENY: CONNECTOR_NOT_FOUND

2.  AGENT_ALLOWED_RAILS     — Is this rail in agent.allowedRails (if set)?
                              → DENY: POLICY_DENY_RAIL_NOT_ALLOWED

3.  AGENT_BLOCKED_COUNTRIES — Is the recipient country in agent.blockedCountries?
                              → DENY: POLICY_DENY_COUNTRY_BLOCKED

4.  AGENT_BLOCKLIST         — Is the recipient entity/domain in agent.blocklist?
                              → DENY: POLICY_DENY_BLOCKLIST

─── TIER 1: Agent-Level Rules (stateful, Redis) ────────────────────────────

5.  GLOBAL_VELOCITY         — Does this call exceed agent.globalVelocityCheck
                              (counts all rails combined)?
                              → DENY: POLICY_DENY_GLOBAL_VELOCITY

6.  GLOBAL_DAILY_LIMIT      — Would this exceed agent.globalDailyLimit?
                              → DENY: POLICY_DENY_GLOBAL_DAILY_LIMIT

7.  GLOBAL_MONTHLY_LIMIT    — Would this exceed agent.globalMonthlyLimit?
                              → DENY: POLICY_DENY_GLOBAL_MONTHLY_LIMIT

─── TIER 2: Connector-Level Rules (stateless) ──────────────────────────────

8.  CONNECTOR_POLICY_EXISTS — Does the connector have a policy with allowedActions set?
                              If no policy exists → DENY: POLICY_DENY_NO_CONNECTOR_POLICY
                              If policy exists but allowedActions is absent → DENY: POLICY_DENY_ACTION_NOT_ALLOWED

9.  ALLOWED_ACTIONS         — Is this action in connector.allowedActions?
                              → DENY: POLICY_DENY_ACTION_NOT_ALLOWED

10. ACTION_LIMIT            — Does the amount exceed connector.actionLimits[action].maxAmount?
                              → DENY: POLICY_DENY_ACTION_LIMIT_EXCEEDED

11. MAX_PER_TRANSACTION     — Does the amount exceed connector.maxPerTransaction?
                              → DENY: POLICY_DENY_MAX_PER_TX

12. CONNECTOR_BLOCKED_COUNTRIES — Is recipient country in connector.blockedCountries?
                              → DENY: POLICY_DENY_COUNTRY_BLOCKED

13. ALLOWED_COUNTRIES       — Is recipient country in connector.allowedCountries (if set)?
                              → DENY: POLICY_DENY_COUNTRY_NOT_ALLOWED

14. ALLOWED_CURRENCIES      — Is currency in connector.allowedCurrencies (if set)?
                              → DENY: POLICY_DENY_CURRENCY_NOT_ALLOWED

15. SCHEDULE_WINDOW         — Is the current time within connector.scheduleWindow (if set)?
                              → DENY: POLICY_DENY_OUTSIDE_SCHEDULE

─── TIER 2: Connector-Level Rules (stateful, Redis) ────────────────────────

16. CONNECTOR_VELOCITY      — Does this call exceed connector.velocityCheck?
                              → DENY: POLICY_DENY_VELOCITY

17. CONNECTOR_DAILY_LIMIT   — Would this exceed connector.dailyLimit?
                              → DENY: POLICY_DENY_DAILY_LIMIT_EXCEEDED

18. CONNECTOR_WEEKLY_LIMIT  — Would this exceed connector.weeklyLimit?
                              → DENY: POLICY_DENY_WEEKLY_LIMIT_EXCEEDED

19. CONNECTOR_MONTHLY_LIMIT — Would this exceed connector.monthlyLimit?
                              → DENY: POLICY_DENY_MONTHLY_LIMIT_EXCEEDED

20. RECIPIENT_DAILY_LIMIT   — Would this exceed connector.recipientDailyLimit
                              for the specific recipient in args?
                              → DENY: POLICY_DENY_RECIPIENT_DAILY_LIMIT

─── Final Check ────────────────────────────────────────────────────────────

21. REQUIRE_HUMAN_APPROVAL  — Does the amount exceed connector.requireHumanApproval.above?
                              → HOLD: HELD_FOR_APPROVAL

22. → ALLOW
```

Rules 1–4, 8–15 are stateless (in-memory, sub-millisecond). Rules 5–7, 16–20 require Redis; they are batched into a **single pipeline call** after stateless checks pass, to minimize round-trips.

### 4.4 Redis Key Namespacing

All stateful counters are scoped to the entity being measured to prevent cross-contamination.

**Agent-level (cross-rail) keys:**
```
vel:agent:{agentId}:{userId}:{windowStart}              — global velocity sorted set
spend:agent:daily:{agentId}:{userId}:{YYYY-MM-DD}       — global daily spend
spend:agent:monthly:{agentId}:{userId}:{YYYY-MM}        — global monthly spend
```

**Connector-level keys:**
```
vel:con:{connectorId}:{windowStart}                     — connector velocity sorted set
spend:con:daily:{connectorId}:{YYYY-MM-DD}              — connector daily spend
spend:con:weekly:{connectorId}:{YYYY-Www}               — connector weekly spend
spend:con:monthly:{connectorId}:{YYYY-MM}               — connector monthly spend
spend:con:rcpt:{connectorId}:{recipientId}:{YYYY-MM-DD} — recipient daily spend cap
```

All keys use `EXPIREAT` set to the end of their window plus a 1-hour buffer.

**Atomic check-and-increment Lua script (velocity):**
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_start = now - window_seconds

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)

if count >= limit then
  return {0, count}  -- DENY
end

redis.call('ZADD', key, now, now .. ':' .. math.random())
redis.call('EXPIRE', key, window_seconds + 3600)
return {1, count + 1}  -- ALLOW
```

**Spend check Lua script (used for all spend limit rules):**
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local amount = tonumber(ARGV[2])
local expiry = tonumber(ARGV[3])

local current = tonumber(redis.call('GET', key) or '0')
if current + amount > limit then
  return {0, current}  -- DENY
end
-- Increment only after provider confirms execution (caller responsibility)
return {1, current}    -- ALLOW
```

Spend counters are incremented **after** the provider confirms success, not before. This prevents a failed provider call from consuming budget.

### 4.5 Recipient Extraction

For the `recipientDailyLimit` rule, the engine extracts a canonical recipient identifier from the call args. Each connector implementation provides a `extractRecipientId(action, args)` function:

```typescript
// Stripe connector
function extractRecipientId(action: string, args: Record<string, unknown>): string | null {
  if (action === 'charges.create' || action === 'paymentIntents.create') {
    return (args.customer as string) ?? null;
  }
  if (action === 'payouts.create') {
    return (args.destination as string) ?? null;
  }
  return null;
}

// Circle connector
function extractRecipientId(action: string, args: Record<string, unknown>): string | null {
  return (args.destination?.address as string) ?? (args.destinationId as string) ?? null;
}
```

If `extractRecipientId` returns `null` for a given call, the `recipientDailyLimit` rule is skipped (not applied).

### 4.6 Policy Cache

The gateway maintains two separate in-process LRU caches (max 10,000 entries each, TTL 30 seconds):

- **Agent policy cache:** keyed by `(agentId, userId)` → latest `AgentPolicyRules`
- **Connector policy cache:** keyed by `connectorId` → latest `ConnectorPolicyRules`

When a policy is updated via the dashboard API, the API publishes an invalidation event to a Redis pub/sub channel (`policy_invalidate`). All gateway instances subscribe and flush the relevant cache entry within ~100ms of a policy change taking effect.

---

## 5. Connector System

### 5.1 Connector Interface

All connectors implement the following interface:

```typescript
interface Connector {
  rail: SupportedRail;
  authType: 'oauth' | 'api_key' | 'wallet_address';

  // Called at request time. Credentials are decrypted here, used, and not retained in memory beyond the call.
  execute(action: string, args: Record<string, unknown>, credentials: DecryptedCredentials): Promise<ProviderResponse>;

  // Validate that credentials work (called during connector setup)
  validate(credentials: DecryptedCredentials): Promise<ConnectorValidationResult>;
}

interface DecryptedCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  walletAddress?: string;
  [key: string]: string | undefined;
}
```

### 5.2 Credential Storage

Credentials are encrypted before writing to the database and decrypted at call time only.

**Encryption scheme:**
1. For each connector, generate a 32-byte random data key.
2. Encrypt the data key with an AWS KMS Customer Managed Key (CMK). Store the encrypted data key as `credentials_key_id`.
3. Encrypt the credentials JSON blob with AES-256-GCM using the data key. Store the ciphertext as `credentials_encrypted` and the 12-byte IV as `credentials_iv`.
4. Zero out the plaintext data key and credentials in memory immediately after encryption.

**Decryption at call time:**
1. Load `credentials_encrypted`, `credentials_iv`, and `credentials_key_id` from the database (or Redis cache).
2. Call KMS `Decrypt` to retrieve the plaintext data key (cached in a short-lived in-process cache, TTL 5 min, to reduce KMS API calls).
3. Decrypt the credentials blob with AES-256-GCM.
4. Use plaintext credentials for the provider call.
5. Zero out plaintext credentials immediately after the call.

This is the **envelope encryption** pattern used by AWS, GCP, and Azure for credential management.

### 5.3 OAuth Flow (Stripe, Square)

```
User clicks "Connect Stripe" in dashboard
   │
   ▼
Dashboard redirects to Stripe OAuth authorization URL:
  https://connect.stripe.com/oauth/authorize
  ?response_type=code
  &client_id=<inflection_stripe_client_id>
  &scope=read_write
  &state=<csrf_token_for_this_session>
   │
Stripe redirects back to:
  https://dashboard.inflection.dev/connectors/stripe/callback
  ?code=ac_1Oq...
  &state=<csrf_token>
   │
Dashboard API exchanges code for access token:
  POST https://connect.stripe.com/oauth/token
  grant_type=authorization_code&code=ac_1Oq...
   │
Stripe returns:
  { access_token: "sk_live_...", stripe_user_id: "acct_...", refresh_token: "..." }
   │
Dashboard API:
  1. Encrypts access_token + refresh_token using envelope encryption
  2. Stores connector record in PostgreSQL
  3. Calls connector.validate() to confirm credentials work
  4. Returns connector record to frontend
```

Stripe access tokens obtained via OAuth do not expire, but the connection can be deauthorized. The `refresh_token` is stored encrypted for re-authorization if needed.

### 5.4 API Key Flow (Circle, Braintree, Razorpay)

```
User inputs API key in dashboard form
   │
Dashboard API:
  1. Calls connector.validate() with the submitted key
  2. On success: encrypts key using envelope encryption
  3. Stores connector record with masked_credential = "sk_live_****abc1"
  4. Returns connector record (masked only; key never returned to client after this point)
```

### 5.5 x402 Wallet Address Flow

```
User inputs wallet address (e.g., "0xAbCd...1234" on Base mainnet)
   │
Dashboard API:
  1. Validates format (checksummed EVM address)
  2. Optionally verifies balance > 0 on-chain
  3. Stores address as the "credential" (no encryption required; address is public)
  4. Returns connector record
```

At call time, the x402 connector uses the stored wallet address and the gateway's operator private key (stored in AWS Secrets Manager, not in the database) to sign x402 payment headers.

### 5.6 Connector Executor

The connector executor is responsible for:
1. Loading the encrypted connector record for the requested `(agentId, userId, rail)` tuple
2. Decrypting credentials using KMS
3. Instantiating the appropriate connector implementation
4. Calling `connector.execute(action, args, credentials)`
5. Handling provider errors and normalizing them into `ProviderResponse`
6. Zeroing credentials in memory

Connector records are cached in Redis for 5 minutes (`con:{connectorId}` → encrypted blob) to reduce database reads. Revocation invalidates the cache key immediately via a Redis `DEL` call from the dashboard API.

---

## 6. Audit Log Design

### 6.1 Hash-Chaining Mechanism

Each audit log entry contains two hash fields:

- `entry_hash`: SHA-256 of the canonical serialization of this entry's immutable fields
- `prev_hash`: SHA-256 of the previous entry's `entry_hash` for this `(agentId, userId)` scope

The canonical serialization is a deterministic JSON string (keys sorted, no whitespace) of:
```
{ id, agent_id, user_id, rail, action, args_summary, policy_decision, policy_id,
  deny_reason, outcome, provider_tx_id, duration_ms, idempotency_key, prev_hash, created_at }
```

**Verification algorithm:**
```typescript
async function verifyChainIntegrity(
  agentId: string,
  userId: string,
  from: Date,
  to: Date
): Promise<{ valid: boolean; firstBrokenAt?: string }> {
  const entries = await db.query(
    `SELECT * FROM audit_logs
     WHERE agent_id = $1 AND user_id = $2 AND created_at BETWEEN $3 AND $4
     ORDER BY created_at ASC`,
    [agentId, userId, from, to]
  );

  for (let i = 1; i < entries.length; i++) {
    const expectedPrevHash = entries[i - 1].entry_hash;
    if (entries[i].prev_hash !== expectedPrevHash) {
      return { valid: false, firstBrokenAt: entries[i].id };
    }
    const recomputed = computeEntryHash(entries[i]);
    if (recomputed !== entries[i].entry_hash) {
      return { valid: false, firstBrokenAt: entries[i].id };
    }
  }
  return { valid: true };
}
```

The `prev_hash` for the **first entry** of a new `(agentId, userId)` scope is the SHA-256 of the string `"INFLECTION_GENESIS:{agentId}:{userId}"`.

### 6.2 Append-Only Enforcement

Three layers of enforcement:

1. **Application layer:** No code path in the gateway or dashboard API calls `UPDATE` or `DELETE` on `audit_logs`. The audit writer module only executes `INSERT`.

2. **Database layer:** PostgreSQL rules `no_update_audit` and `no_delete_audit` (defined in schema above) silently discard any UPDATE or DELETE statements, providing defense-in-depth even if application code is compromised.

3. **IAM layer:** The application database user has `INSERT, SELECT` grants on `audit_logs` only. The `UPDATE` and `DELETE` privileges are held only by a separate DBA role that requires MFA and generates its own audit trail.

```sql
-- Application role grants
GRANT INSERT, SELECT ON audit_logs TO inflection_app;
-- No UPDATE, DELETE granted to inflection_app on audit_logs
```

### 6.3 Args Sanitization

The `args_summary` field stored in the audit log is a **sanitized** subset of the original `args`:

- `amount` and `currency` are always included (for spend tracking and display)
- `description` is included if present
- All fields that could contain PAN data, CVV, or bearer tokens are stripped
- The sanitization function is applied before storage and cannot be disabled

```typescript
function sanitizeArgs(rail: string, action: string, args: Record<string, unknown>): Record<string, unknown> {
  const ALWAYS_STRIP = ['card', 'card_number', 'cvv', 'cvc', 'exp_month', 'exp_year',
                        'api_key', 'secret', 'token', 'password', 'private_key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (ALWAYS_STRIP.some(s => key.toLowerCase().includes(s))) continue;
    sanitized[key] = value;
  }
  return sanitized;
}
```

### 6.4 Retention and Export

- Default retention: 7 years (configurable up to 10 years; minimum 1 year)
- Partitioning by month allows dropping old partitions for expired retention without disabling rules
- Partition drop for expired data: drops the PostgreSQL partition table entirely (physically removes rows while preserving the append-only rule on active partitions)
- Export format: JSON (default) or CSV, streamed for large ranges to avoid memory pressure
- Export endpoint streams directly from database to HTTP response using cursor-based pagination; no intermediary buffer

---

## 7. Approval Flow

### 7.1 State Machine

```
                        ┌───────────────┐
                        │               │
              ┌─────────►   PENDING     │
              │         │               │
              │         └───┬───────┬───┘
              │             │       │
          Gateway holds  Approve  Reject
          transaction    action   action
              │             │       │
              │         ┌───▼──┐  ┌─▼────────┐
              │         │      │  │          │
              │         │APPR- │  │ REJECTED │◄── Timer expires
              │         │OVED  │  │          │
              │         │      │  └──────────┘
              │         └───┬──┘
              │             │
              │       Execute via
              │       Connector Executor
              │             │
              │         ┌───▼──────────┐
              │         │  EXECUTED    │
              │         │  (terminal)  │
              │         └──────────────┘
              │
              │  If execution fails after approval:
              └──► EXECUTION_FAILED (terminal; audit logged; user notified)
```

### 7.2 State Transitions

| From | Event | To | Side Effects |
|---|---|---|---|
| (none) | Policy engine returns HOLD | `PENDING` | Insert `approvals` row; write audit log (HOLD); publish SQS event |
| `PENDING` | User calls `POST /approvals/:id/approve` | `APPROVED` | Update row; trigger async execution job |
| `APPROVED` | Execution succeeds | `EXECUTED` | Write second audit log entry (APPROVED/executed); increment Redis spend counter |
| `APPROVED` | Execution fails | `EXECUTION_FAILED` | Write audit log entry; notify user of failure |
| `PENDING` | User calls `POST /approvals/:id/reject` | `REJECTED` | Update row; write audit log (REJECTED); notify SDK via webhook |
| `PENDING` | `expires_at` is reached | `EXPIRED` | Background job transitions state; write audit log (TIMED_OUT); notify SDK via webhook |

### 7.3 SDK Behavior During Hold

When the gateway returns a 202 HOLD response, the SDK has two modes (configurable by developer):

**Blocking mode (default):** The SDK polls `GET /v1/approvals/:id` every 5 seconds until the status transitions out of `PENDING` (up to a configurable SDK timeout, default 24 hours). When `EXECUTED`, the SDK returns the provider response. When `REJECTED` or `EXPIRED`, the SDK throws a structured error.

**Non-blocking mode:** The SDK returns the 202 response immediately with the `approvalId`. The developer is responsible for polling or using the agent's webhook endpoint to receive the outcome.

### 7.4 Notification Dispatch

Notifications are dispatched **asynchronously** via SQS to avoid blocking the hot path.

```
Gateway writes HOLD audit entry
  │
  ▼
Gateway publishes to SQS: {
  approvalId, agentId, userId, rail, action, argsSummary, amount, currency,
  approvalUrl: "https://dashboard.inflection.dev/approvals/apr_09x...",
  approveUrl:  "https://api.inflection.dev/v1/approvals/apr_09x.../approve?token=<signed_jwt>",
  rejectUrl:   "https://api.inflection.dev/v1/approvals/apr_09x.../reject?token=<signed_jwt>"
}
  │
  ▼
Notification Worker (SQS consumer):
  ├─ Load notification_configs for (agentId, userId)
  ├─ For each configured channel:
  │    ├─ Slack: POST to webhook URL with Block Kit message
  │    ├─ Email: Send via SES with HTML template
  │    └─ WhatsApp: POST to WhatsApp Business API
  └─ Record delivery status in approvals.notification_sent_at
```

The `approveUrl` and `rejectUrl` contain a short-lived signed JWT (15 minutes) that allows one-click approval/rejection without requiring dashboard login. After the JWT expires, the user must log in to the dashboard to take action.

---

## 8. Security

### 8.1 Encryption at Rest

| Data | Encryption |
|---|---|
| Connector credentials | AES-256-GCM, envelope-encrypted with AWS KMS CMK |
| Password hashes | Argon2id, cost factor: time=2, memory=65536, parallelism=2 |
| API key hashes | Argon2id (same params) |
| MFA TOTP secrets | AES-256-GCM, KMS-managed key |
| Slack webhook URLs | AES-256-GCM, KMS-managed key |
| WhatsApp numbers | AES-256-GCM, KMS-managed key |
| RDS storage | AES-256, AWS-managed key (RDS encryption at rest) |
| S3 (export files) | AES-256, SSE-S3 |

### 8.2 Encryption in Transit

- All public endpoints: TLS 1.3 (TLS 1.2 as fallback with approved cipher suites only)
- Internal service-to-service: mTLS using certificates managed by AWS ACM Private CA
- Database connections: TLS enforced via `sslmode=require` in PostgreSQL connection strings
- Redis connections: TLS enabled (ElastiCache in-transit encryption)
- KMS API calls: HTTPS (enforced by AWS SDK)

### 8.3 Key Management

- All encryption keys are AWS KMS Customer Managed Keys (CMKs)
- CMK rotation: automatic annual rotation enabled
- IAM policies follow least-privilege: each service has a dedicated IAM role with only the KMS actions it needs
- KMS key policies deny access to the AWS root account (separate break-glass CMK for emergencies)
- No encryption keys are stored in environment variables or configuration files

### 8.4 RBAC

| Role | Permissions |
|---|---|
| `developer` | Create/read/delete own agents; read aggregate audit log for own agents; create/revoke API keys |
| `user` | Connect/revoke connectors for their account; set policies; approve/reject transactions; read own audit log; configure notifications |
| `admin` | All user + developer permissions; manage organization members; access billing |
| `read_only` | Read-only access to audit log, approvals, and dashboard (no write actions) |
| `approver` | Approve/reject held transactions only; read-only audit log |

RBAC is enforced at the API layer. Every API handler checks the authenticated user's role before performing any operation. Roles are stored in the `users` table and checked on every request (no caching to ensure revocation is immediate).

### 8.5 API Key Security

- API keys are generated using `crypto.randomBytes(32)` encoded as URL-safe base64 (256 bits of entropy)
- The full key is shown only once at creation time; the Argon2id hash is stored
- Key rotation: developers can generate a new key and set a rotation grace period during which both old and new keys are valid
- Keys can be revoked instantly from the dashboard; revocation is reflected within 60 seconds (Redis cache TTL)

### 8.6 Signed Approval URLs

One-click approval/rejection URLs embedded in Slack/email notifications use signed JWTs:

```typescript
// Signing
const token = jwt.sign(
  { approvalId, action: 'approve', userId, exp: Math.floor(Date.now() / 1000) + 900 },
  APPROVAL_JWT_SECRET,  // RS256 private key, stored in Secrets Manager
  { algorithm: 'RS256' }
);

// Verification
const payload = jwt.verify(token, APPROVAL_JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
// After use: mark token as consumed in Redis to prevent replay
await redis.set(`used_approval_token:${payload.jti}`, '1', 'EX', 900);
```

### 8.7 Threat Model Considerations

| Threat | Mitigation |
|---|---|
| Compromised SDK API key | Key rotation + revocation; gateway rate limiting per key; keys scoped to `sdk` only (cannot read audit logs or modify policy) |
| Compromised developer account | MFA required for dashboard login; API keys are separate credentials; developer cannot access user connector credentials |
| Compromised gateway process | Credentials decrypted per-call and immediately zeroed; no persistent plaintext in memory; gateway has no write access to its own audit logs |
| Forged audit log entries | Hash-chaining detects any insertion, modification, or deletion; gateway is the only writer; DB rules block any other writes |
| Approval URL replay | JWT `jti` consumed on first use and stored in Redis; 15-minute expiry on approval JWTs |
| Runaway agent (exceeds limits) | Policy engine enforces limits before forwarding; spending limits are checked atomically in Redis; agent cannot modify its own policy |

---

## 9. Scalability & Infrastructure

### 9.1 Gateway Scaling

The gateway is **stateless** (all state in Redis and PostgreSQL). It runs on AWS ECS Fargate behind an Application Load Balancer with target tracking autoscaling.

**Scaling configuration:**
- Min tasks: 2 per region (for AZ redundancy)
- Max tasks: 200 per region
- Scale-out trigger: ALB `RequestCountPerTarget` > 1000 requests/minute per task
- Scale-in cooldown: 300 seconds (to avoid thrashing)
- Target CPU for steady state: < 60%

**Multi-region:**
- Active-active: us-east-1 (primary), eu-west-1, ap-southeast-1
- Route 53 latency-based routing with health checks
- Each region has independent RDS instances; audit log replication uses PostgreSQL logical replication to a cross-region read replica
- Redis clusters are regional; spend counters are regional (acceptable for v1; cross-region counter aggregation in v2 if needed)

### 9.2 Database Scaling

**PostgreSQL (RDS):**
- Instance: db.r7g.2xlarge (Multi-AZ)
- Read replicas: 1 per region for read-heavy workloads (audit log queries, dashboard)
- Connection pooling: PgBouncer in transaction mode, max 1000 connections to RDS
- Audit log table: partitioned by month (`PARTITION BY RANGE (created_at)`)

**Redis (ElastiCache):**
- Cluster mode: 3 shards × 2 replicas (primary + 1 replica per shard)
- Instance: cache.r7g.large per node
- Persistence: AOF (Append Only File) with `appendfsync everysec`
- Failover: automatic (under 60 seconds for replica promotion)

### 9.3 Audit Log Ingestion Scaling

At 10,000 gateway requests/second, the audit log writer is the highest-volume PostgreSQL writer. To prevent write bottlenecks:

1. **Batching:** The audit log writer buffers entries in-memory (max 100 entries or 50ms, whichever comes first) and flushes as a single `INSERT ... VALUES (...)` batch. This reduces write IOPS by ~50-100x.
2. **Partitioning:** Monthly partitions mean autovacuum runs per-partition rather than on the full table.
3. **Write-optimized indexes:** The audit log has minimal indexes (only what's needed for queries); full-text search offloaded to Elasticsearch for the dashboard search feature (v2).

### 9.4 Infrastructure as Code

All infrastructure is defined in Terraform. Repository structure:

```
infra/
  modules/
    gateway/       # ECS task definition, ALB, security groups
    database/      # RDS, PgBouncer, parameter groups
    redis/         # ElastiCache cluster
    kms/           # CMKs and key policies
    iam/           # Service roles, policies
  environments/
    production/
    staging/
    development/
```

### 9.5 Deployment

- Container images built via GitHub Actions CI/CD pipeline on merge to `main`
- Zero-downtime deployments: ECS rolling updates with minimum healthy percent = 50%
- Database migrations: run as a separate ECS task before new application containers start; tracked with a migrations table
- Feature flags: LaunchDarkly for percentage-based rollouts of new policy rules or connector integrations

---

## 10. Error Handling & Failure Modes

### 10.1 Gateway Failure Modes

| Failure | Detection | Behavior |
|---|---|---|
| **Redis unreachable** | Health check fails; `ECONNREFUSED` on Redis client | Stateful rules (velocity, spend limits) are **skipped** and logged as `REDIS_UNAVAILABLE`. Stateless rules still enforced. Alert fires. |
| **PostgreSQL unreachable** | Connection pool exhausted; query timeout | Gateway returns 503 to SDK. No transactions executed. Alert fires. |
| **KMS unreachable** | KMS `Decrypt` call fails | Connector executor cannot decrypt credentials. Call returns `PROVIDER_ERROR` with internal `KMS_UNAVAILABLE` reason. Alert fires. |
| **Provider unreachable** | HTTP timeout / 5xx from provider | Returns `PROVIDER_ERROR` to SDK with provider-specific error. Audit log entry written with `outcome: PROVIDER_ERROR`. Not retried automatically (developer's SDK handles retry with idempotency key). |
| **Policy cache miss** | Redis unavailable or key expired | Falls back to PostgreSQL policy read. Adds ~5-10ms to latency. |
| **Audit log write failure** | PostgreSQL `INSERT` fails | **Transaction is not rolled back.** Provider execution already completed; money may have moved. Audit entry is written to a dead-letter queue (SQS) for async retry. Alert fires. This is the accepted tradeoff: availability of financial execution > completeness of audit log in extreme failure scenarios. |

### 10.2 Approval Flow Failure Modes

| Failure | Behavior |
|---|---|
| **Notification dispatch fails** (Slack/email unreachable) | SQS message is retried with exponential backoff (up to 5 attempts over 30 minutes). After all retries exhausted, approval remains `PENDING` until `expires_at`; user can check dashboard. Dead-letter queue for investigation. |
| **Approval execution fails** | State transitions to `EXECUTION_FAILED`. Audit log entry written. User notified. SDK receives error if in blocking mode. |
| **Approval timeout** | Background job (runs every minute) finds `PENDING` approvals past `expires_at`, transitions to `EXPIRED`, writes audit log, notifies SDK. |

### 10.3 Idempotency

Every `POST /v1/execute` call includes an `idempotencyKey`. The gateway stores `(idempotencyKey, agentId)` in Redis with a TTL of 24 hours. If a duplicate key is received within the TTL window, the gateway returns the cached response without re-executing or re-writing the audit log.

```typescript
const cacheKey = `idempotency:${agentId}:${idempotencyKey}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);  // Return original response
}
// ... execute ...
await redis.set(cacheKey, JSON.stringify(response), 'EX', 86400);
```

If Redis is unavailable during idempotency check, the gateway **proceeds without idempotency protection** (logs a warning). This is acceptable since the provider itself handles idempotency for the underlying API call (Stripe's `Idempotency-Key` header, etc.).

### 10.4 SDK Error Handling Contract

The SDK surfaces three error types to the developer:

```typescript
class InflectionPolicyDeniedError extends Error {
  errorCode: string;      // e.g., "POLICY_DENY_DAILY_LIMIT_EXCEEDED"
  auditId: string;
}

class InflectionHeldError extends Error {
  approvalId: string;     // use to poll for approval outcome
  auditId: string;
}

class InflectionProviderError extends Error {
  rail: string;
  providerError: unknown; // raw provider error
  auditId: string;
}
```

Developers wrap financial calls in try/catch and handle each case according to their agent's business logic. The `auditId` on every error allows developers to cross-reference the Inflection audit log for debugging.

### 10.5 Circuit Breaker

The connector executor implements a per-rail circuit breaker (using the `opossum` library):

- **Closed:** Normal operation
- **Open:** If error rate for a rail exceeds 50% over a 10-second window, circuit opens; all calls to that rail return `PROVIDER_CIRCUIT_OPEN` immediately without attempting the provider call
- **Half-open:** After 30 seconds, one request is allowed through; if successful, circuit closes; if not, stays open

This prevents a degraded payment provider from consuming gateway threads and amplifying latency for all users.
