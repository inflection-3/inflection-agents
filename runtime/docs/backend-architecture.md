# Backend Architecture

---

## Overview

The Inflection runtime is a single TypeScript monorepo structured as a multi-package workspace. It contains:

```
runtime/
  packages/
    api/           — Hono HTTP server (REST + SSE)
    engine/        — Flow execution engine (pure, no HTTP)
    embed/         — @inflection/embed widget (React + Vite)
    sdk/           — @inflection/node SDK for server-side API access
  apps/
    dashboard/     — React dashboard (Vite + TanStack Router)
    worker/        — BullMQ worker process
  docs/
    ...
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 LTS | Stable, fast startup, BullMQ native |
| Language | TypeScript 5.x | Type safety across engine + API |
| HTTP framework | Hono | Ultra-fast, edge-compatible, first-class SSE, minimal overhead |
| ORM | Drizzle ORM | Type-safe SQL, no magic, migrations tracked in code |
| Database | PostgreSQL 16 | JSONB for flow graphs, row-level security, pgvector-ready |
| Queue | BullMQ + Redis 7 | Reliable job processing, repeatable jobs for scheduler |
| Credential vault | Vault (dev) / AWS Secrets Manager (prod) | Credential encryption, rotation, audit trail |
| Auth | JWT (RS256) | Workspace auth + end-user passthrough in one model |
| Embed | React 19 + Vite | Fast build, small bundle, web components wrapper |
| Canvas | React Flow 12 | Battle-tested node graph UI, performant at scale |
| Dashboard | React 19 + TanStack Router + TanStack Query | File-based routing, type-safe data fetching |
| Testing | Vitest + Supertest | Fast unit + integration tests |
| Container | Docker + docker-compose (dev), ECS Fargate (prod) | Stateless workers scale horizontally |

---

## Directory Structure

```
packages/api/
  src/
    index.ts              — Hono app factory, mounts all route groups
    routes/
      auth.ts             — POST /auth/login, POST /auth/register, POST /auth/refresh
      flows.ts            — CRUD for flows, flow versions, publish
      connectors.ts       — CRUD for connectors, test connector
      executions.ts              — POST trigger, GET status, SSE stream
      approvals.ts               — GET list, POST approve/reject
      audit.ts                   — GET audit log, GET verify chain
      end-users.ts               — GET end user list, GET end user agents
      personal-agents.ts         — CRUD for personal agents, versions, schedules
      guardrails.ts              — GET/PUT workspace guardrails
      analytics.ts               — GET stats, GET charts
      embed-auth.ts              — POST verify JWT (called by embed widget on load)
      custom-connectors.ts       — CRUD for custom connectors + actions
      custom-connectors/
        import-openapi.ts        — Parse OpenAPI spec → extract actions
        import-manual.ts         — Manual action builder save
        import-mcp.ts            — MCP server import (Phase 2)
        sync.ts                  — Re-sync from OpenAPI URL, diff detection
        test-action.ts           — Run a single custom connector action with sample data
      knowledge-bases.ts         — CRUD for knowledge bases (Phase 2)
    middleware/
      auth.ts             — Workspace JWT verification
      embed-auth.ts       — End-user JWT passthrough verification
      rate-limit.ts       — Per-workspace API rate limiting
    lib/
      db.ts               — Drizzle client + connection pool
      queue.ts            — BullMQ producer (enqueue jobs)
      vault.ts            — Credentials encrypt/decrypt
      sse.ts              — SSE helper (write events to response stream)
      pii.ts              — PII redaction pipeline
      openapi-parser.ts   — OpenAPI 3.x spec parsing → CustomConnectorAction[]
    schema/               — Zod schemas for request validation (mirrors data model)

packages/engine/
  src/
    index.ts              — executeFlow(context, graph) — main entry point
    executor.ts           — Topological sort + sequential node execution
    nodes/
      -- MVP (10 nodes)
      input.ts
      output.ts
      llm.ts
      ifelse.ts
      memory.ts
      variable.ts
      hitl.ts
      send-email.ts
      http-request.ts
      connector.ts        — dispatches to native connector handlers by rail
      custom-connector.ts — executes custom connector actions (HTTP call with stored auth)
      -- Phase 2
      loop.ts
      ai-routing.ts
      merge.ts
      delay.ts
      knowledge-base.ts
      send-slack.ts
      send-sms.ts
      send-notification.ts
      transform.ts
      aggregate.ts
      spreadsheet-read.ts
      spreadsheet-write.ts
      pdf-generate.ts
      webhook-send.ts
    connectors/           — native connector implementations
      -- MVP
      plaid.ts            — Plaid API client + 8 actions
      stripe.ts           — Stripe API client + 13 actions
      -- Phase 2 — payments
      circle.ts
      square.ts
      -- Phase 2 — financial data
      polygon.ts
      sec-edgar.ts
      sp-global.ts
      fred.ts
      -- Phase 2 — ERP/accounting
      netsuite.ts
      workday.ts
      quickbooks.ts
      xero.ts
      -- Phase 2 — calendar
      google-calendar.ts
      outlook-calendar.ts
      calendly.ts
      meeting-scheduler.ts
      -- Phase 2 — communication
      slack.ts
      twilio.ts
      -- Phase 2 — data
      google-sheets.ts
      excel-online.ts
      -- Phase 2 — automation
      zapier.ts
    action-registry.ts    — maps "plaid.getBalance" → PlaidConnector.getBalance
    custom-connector-runner.ts  — executes custom connector HTTP actions with vault-stored auth
    guardrail.ts          — Policy check before any connector/custom-connector execution
    audit-writer.ts       — Append ExecutionStep + AuditEvent
    memory-client.ts      — Read/write agent_memory table
    streaming.ts          — Emit SSE events during execution

apps/worker/
  src/
    index.ts              — BullMQ worker, connects to Redis, processes jobs
    processors/
      execution.ts        — Main execution processor — calls engine.executeFlow
      scheduler.ts        — Fires scheduled executions, creates agent_execution records
      expiry-sweeper.ts   — Cleans expired approvals and memory TTLs

packages/embed/
  src/
    widget.tsx            — Main React component
    components/
      chat-panel.tsx
      message-thread.tsx
      mode-b-flow.tsx     — Personal agent creation UX
      agent-list.tsx
      agent-detail.tsx
    hooks/
      use-execution.ts    — SSE subscription + execution state
      use-personal-agents.ts
    lib/
      api.ts              — Type-safe fetch wrapper for Inflection API
      jwt.ts              — Token handling
    index.ts              — Web component wrapper (CustomElement) + InflectionEmbed.init()
  dist/
    widget.js             — Built bundle served from embed.inflection.ai
```

---

## Authentication

### Two auth contexts

**1. Workspace auth (company → dashboard/API)**
- JWT, RS256, signed by Inflection
- Claims: `{ workspaceId, userId, role, version }`
- Issued at login, expires 1h, refresh token (7d, rotating)
- Stored in memory (not localStorage) in dashboard client

**2. End-user passthrough auth (company → embed → Inflection)**
- JWT, RS256, signed by the embedding company using their private key
- Inflection holds the company's public key (stored on `workspaces.publicKey`)
- Claims: `{ externalId, workspaceId, metadata: { accountId, tier, ... } }`
- Company generates this token server-side and injects it into their product page
- Inflection verifies signature on every embed API call

```
Company backend
  → signs JWT with private key
  → injects into product page as window.InflectionConfig.token
  → embed widget sends it on every API call (Authorization: Bearer <token>)
  → Inflection API: verify signature with workspace public key
  → if valid: create/lookup EndUser record, proceed
```

No end user ever authenticates directly with Inflection. No account creation, no passwords.

---

## API Design

### Base URL
```
https://api.inflection.ai/v1
```

### Auth headers
```
Authorization: Bearer <workspace_jwt>         — workspace/dashboard calls
X-Inflection-Token: <end_user_jwt>            — embed calls
X-Workspace-Id: <workspaceId>                 — all calls
```

### Core routes

**Flows**
```
GET    /flows                          List flows
POST   /flows                          Create flow
GET    /flows/:id                      Get flow with latest draft
PUT    /flows/:id                      Update flow metadata
DELETE /flows/:id                      Archive flow
GET    /flows/:id/versions             List versions (history)
POST   /flows/:id/publish              Publish draft → production
GET    /flows/:id/versions/:vid        Get specific version
POST   /flows/:id/versions/:vid/rollback  Rollback to version
```

**Executions**
```
POST   /executions                     Trigger a flow execution
GET    /executions/:id                 Get execution status + steps
GET    /executions/:id/stream          SSE stream (text/event-stream)
POST   /executions/:id/cancel          Cancel running execution
GET    /executions                     List executions (paginated, filterable)
```

**Personal agents (end-user calls, require X-Inflection-Token)**
```
GET    /me/agents                      List my personal agents
POST   /me/agents                      Create personal agent (Mode B)
GET    /me/agents/:id                  Get agent + versions
PUT    /me/agents/:id                  Update agent (name, schedule)
DELETE /me/agents/:id                  Delete agent
GET    /me/agents/:id/executions       Agent run history
POST   /me/agents/:id/pause            Pause agent
POST   /me/agents/:id/resume           Resume agent
POST   /me/agents/intent               Parse intent → propose agent config (pre-creation)
```

**Approvals**
```
GET    /approvals                      List approvals (workspace admins)
GET    /approvals/:id                  Get approval detail
POST   /approvals/:id/approve          Approve
POST   /approvals/:id/reject           Reject
```

**Native Connectors**
```
GET    /connectors                     List native connectors
POST   /connectors                     Add native connector
POST   /connectors/:id/test            Test connectivity
DELETE /connectors/:id                 Revoke connector
```

**Custom Connectors**
```
GET    /custom-connectors                           List custom connectors
POST   /custom-connectors                           Create (manual action builder)
POST   /custom-connectors/import/openapi            Import from OpenAPI spec URL or body
POST   /custom-connectors/import/mcp                Import from MCP server (Phase 2)
GET    /custom-connectors/:id                       Get connector + all actions
PUT    /custom-connectors/:id                       Update metadata (name, description, icon)
DELETE /custom-connectors/:id                       Delete connector + all actions
POST   /custom-connectors/:id/sync                  Re-sync from OpenAPI URL (returns diff)
POST   /custom-connectors/:id/test                  Test connector auth
GET    /custom-connectors/:id/actions               List actions
POST   /custom-connectors/:id/actions               Add action (manual)
PUT    /custom-connectors/:id/actions/:actionId     Update action (rename, description, toggles)
DELETE /custom-connectors/:id/actions/:actionId     Remove action
POST   /custom-connectors/:id/actions/:actionId/test  Test action with sample payload
```

### Pagination
All list endpoints use cursor-based pagination:
```
GET /executions?after=exec_abc&limit=25
→ { data: [...], nextCursor: "exec_xyz", hasMore: true }
```

### Error format
```json
{
  "error": {
    "code": "GUARDRAIL_DENIED",
    "message": "This action is not allowed by your workspace policy.",
    "details": { "action": "stripe.createRefund", "reason": "denylist" }
  }
}
```

### SSE event format
```
event: node.completed
data: {"nodeId":"node-123","type":"llm","status":"completed","durationMs":1240,"outputPreview":"Balance is $1,243.50"}

event: execution.completed
data: {"executionId":"exec-abc","status":"completed","durationMs":3100,"output":"Your balance is $1,243.50."}
```

---

## Execution Engine

### Flow execution algorithm

```ts
async function executeFlow(ctx: ExecutionContext, graph: FlowGraph): Promise<ExecutionResult> {
  const sorted = topologicalSort(graph.nodes, graph.edges);
  const values = new Map<string, Record<string, unknown>>(); // nodeId → output values

  for (const node of sorted) {
    const inputs = resolveInputs(node, graph.edges, values);
    const handler = getHandler(node.type);

    const stepId = await ctx.audit.stepStarted(node);
    try {
      const output = await handler.execute(ctx, node.config, inputs);
      values.set(node.id, output);
      await ctx.audit.stepCompleted(stepId, output);
      ctx.emit({ event: 'node.completed', nodeId: node.id, ...output });
    } catch (err) {
      if (isRetryable(err)) {
        // retry with backoff — handled by BullMQ job retry config
        throw err;
      }
      await ctx.audit.stepFailed(stepId, err);
      ctx.emit({ event: 'node.failed', nodeId: node.id, error: err.message });
      throw new ExecutionError(node.id, err);
    }
  }

  return { output: values.get(outputNodeId) };
}
```

### HITL pause/resume

When a HITL node executes, it throws a `HitlPauseSignal` instead of returning. The worker catches this signal:
1. Creates `ApprovalRequest` record
2. Updates `AgentExecution` status to `waiting_approval`
3. Does NOT mark the BullMQ job as failed — stores `approvalId` in job data and delays it
4. On approval: re-enqueue job with `resumeFromNodeId` in payload
5. Engine skips all nodes before `resumeFromNodeId`, injects approval context, continues

This means the execution process is exactly the same — the engine is not aware of being paused; it just restarts from a checkpoint.

---

## Queue Architecture

### Queues (Redis/BullMQ)

```
executions          — execution jobs (one per triggered execution)
  concurrency: 10 per workspace
  retry: 3x with exponential backoff
  timeout: 5 minutes per job

scheduler           — fires scheduled executions
  runs every minute (internal cron)
  reads all active schedules with nextRunAt <= now
  creates execution jobs for each

expiry-sweeper      — cleans expired records
  runs every hour
  expires: pending approvals past expiresAt
  expires: agent_memory past ttl
  expires: sessions past expiry

audit-log-writer    — async audit writes (optional — can be synchronous in MVP)
  fire-and-forget; if dropped, execution continues
```

### Job data shape

```ts
interface ExecutionJob {
  type: "flow" | "personal_agent";
  workspaceId: string;
  executionId: string;
  flowVersionId?: string;
  personalAgentVersionId?: string;
  endUserId?: string;
  triggerType: TriggerType;
  triggerPayload: unknown;
  resumeFromNodeId?: string;   // set on HITL resume
  approvalContext?: unknown;   // set on HITL resume
}
```

---

## Credential Management

### Dev environment
- AES-256-GCM, key stored in `.env`
- Key ID = "local"

### Production
- AWS Secrets Manager (or HashiCorp Vault)
- Key rotation: new credentials encrypted with new key ID; old key kept for decryption of existing records
- Credentials never leave the API server — never returned to dashboard after initial save
- Vault access audited (every decrypt operation logged)

### Credential encryption flow

```ts
// On connector save:
const { ciphertext, iv, keyId } = await vault.encrypt(JSON.stringify(rawCreds));
// Store: credentialsEncrypted, credentialsIv, credentialsKeyId

// On connector use:
const rawCreds = JSON.parse(await vault.decrypt(enc, iv, keyId));
const client = buildClient(connector.rail, rawCreds);
```

---

## PII Redaction

Runs before any data is written to `execution_steps.inputSnapshot` / `outputSnapshot` or `audit_events.payload`.

```ts
const REDACT_PATTERNS = [
  { pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/, name: 'visa_card', replace: (m) => m.slice(0,6) + '****' + m.slice(-4) },
  { pattern: /\b3[47][0-9]{13}\b/, name: 'amex_card', replace: (m) => m.slice(0,6) + '****' + m.slice(-4) },
  { pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/, name: 'ssn', replace: () => '***-**-****' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, name: 'email', replace: (m) => redactEmail(m) },
  { pattern: /\b\d{10,17}\b/, name: 'account_number', replace: (m) => '****' + m.slice(-4) },
];

function redact(obj: unknown): unknown {
  const str = JSON.stringify(obj);
  let redacted = str;
  for (const { pattern, replace } of REDACT_PATTERNS) {
    redacted = redacted.replace(new RegExp(pattern, 'g'), replace);
  }
  return JSON.parse(redacted);
}
```

---

## Database Migrations

- Drizzle Kit for migration generation and application
- Migrations run on startup (in dev) or via CI step (in prod)
- Every migration file committed to repo
- Migration table (`drizzle_migrations`) tracks applied migrations

```
packages/api/
  drizzle/
    migrations/
      0001_workspaces.sql
      0002_users.sql
      0003_flows.sql
      ...
    schema.ts     — source of truth for Drizzle schema definitions
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/inflection

# Redis
REDIS_URL=redis://localhost:6379

# Vault / encryption
ENCRYPTION_KEY=base64-encoded-32-byte-key     # dev only
VAULT_ADDR=https://vault.internal              # prod
VAULT_TOKEN=...                                # prod

# Auth
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY...  # signs workspace JWTs
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY...

# LLM (for Mode B intent parsing)
ANTHROPIC_API_KEY=sk-ant-...

# Email (HITL notifications)
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@inflection.ai

# App
API_URL=https://api.inflection.ai
EMBED_URL=https://embed.inflection.ai
NODE_ENV=production
```

---

## Deployment Architecture (Production)

```
                          ┌─────────────────────┐
                          │   Cloudflare CDN     │
                          │  embed.inflection.ai │
                          │  (widget.js served)  │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼──────┐    ┌──────────▼──────┐   ┌──────────▼──────┐
    │  API (Hono)    │    │  Dashboard      │   │  Worker         │
    │  ECS Fargate   │    │  (static S3)    │   │  ECS Fargate    │
    │  2 tasks min   │    │                 │   │  auto-scaling   │
    └─────────┬──────┘    └─────────────────┘   └──────────┬──────┘
              │                                             │
    ┌─────────▼─────────────────────────────────────────────▼──────┐
    │                     PostgreSQL (RDS)                          │
    │                     Redis (ElastiCache)                       │
    │                     AWS Secrets Manager                       │
    └───────────────────────────────────────────────────────────────┘
```

- API and Worker are stateless — scale horizontally
- Worker auto-scales based on BullMQ queue depth (target: <5s queue latency)
- RDS Multi-AZ, automated backups, 7-year retention for audit tables
- Redis Cluster mode for queue HA
- All traffic HTTPS/TLS 1.3
