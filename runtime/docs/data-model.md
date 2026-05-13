# Data Model

Full schema for the Inflection runtime. Written in TypeScript interface notation for clarity; the actual implementation uses Drizzle ORM with PostgreSQL.

---

## Entity Map

```
Workspace
  ├── Users[]                  (company team members)
  ├── ApiKeys[]                (workspace-level API keys)
  ├── Flows[]
  │     └── FlowVersions[]     (ADLC snapshots)
  │           └── Nodes[]      (typed, serialized graph)
  ├── Connectors[]             (native authenticated API clients — Plaid, Stripe, etc.)
  ├── CustomConnectors[]       (company-defined API connectors — OpenAPI import or manual)
  │     └── CustomConnectorActions[]  (each endpoint = one action = one canvas node)
  ├── Guardrails               (one per workspace — company policy config)
  ├── DeployedSurfaces[]       (chat widget, API endpoint, etc.)
  └── KnowledgeBases[]         (Phase 2 — RAG document stores)

EndUser                        (identified by JWT from embedding company)
  ├── PersonalAgents[]         (Mode B — user-owned agent instances)
  │     ├── PersonalAgentVersions[]
  │     └── Schedule?
  └── Sessions[]

AgentExecution                 (one run of any flow — Mode A or B)
  ├── ExecutionSteps[]         (one per node)
  ├── ApprovalRequests[]       (HITL pauses)
  └── AuditEvents[]

AgentMemory                    (persistent key-value, scoped to user/agent/workspace)
```

---

## Tables

### `workspaces`

```ts
{
  id: uuid PK
  name: string
  slug: string UNIQUE           // used in API paths: /api/ws/{slug}/...
  plan: "free" | "growth" | "enterprise"
  ownerUserId: uuid FK → users
  publicKey: text               // company's public key for JWT verification
  embedOrigins: text[]          // allowed origins for embed (CORS)
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `users`

Company team members who use the dashboard.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  email: string UNIQUE
  passwordHash: string
  role: "admin" | "editor" | "viewer" | "approver"
  mfaSecret: string?
  jwtRevocationVersion: int DEFAULT 0
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `workspace_api_keys`

Keys used to call the Inflection API from the company's backend.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  name: string                  // human label, e.g. "Production API Key"
  keyHash: string UNIQUE        // SHA-256 of the raw key
  keyPrefix: string             // first 8 chars, shown in UI
  scopes: text[]                // ["flows:run", "executions:read", "users:write"]
  status: "active" | "revoked"
  lastUsedAt: timestamp?
  expiresAt: timestamp?
  createdAt: timestamp
}
```

---

### `flows`

A flow is a named, versioned node graph. Lives in a workspace.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  name: string
  description: string?
  status: "active" | "archived"
  isTemplate: boolean DEFAULT false   // if true, available in Mode B palette
  templateDescription: string?        // plain English description shown to end users
  createdBy: uuid FK → users
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `flow_versions`

Immutable snapshot of a flow at a point in time. ADLC stage gate.

```ts
{
  id: uuid PK
  flowId: uuid FK → flows
  version: int                  // monotonically increasing
  stage: "draft" | "production"
  graph: jsonb                  // { nodes: Node[], edges: Edge[] }
  commitMessage: string?
  publishedBy: uuid FK → users?
  publishedAt: timestamp?
  createdAt: timestamp

  -- Indexes: (flowId, stage) for "get current production version"
  -- Indexes: (flowId, version) UNIQUE
}
```

The `graph` JSONB contains the full node + edge definitions per `nodes.md`.

---

### `connectors`

Authenticated connections to **native** external services (Plaid, Stripe, etc.). Credentials stored encrypted.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  name: string
  // Native rails — Phase 2 additions noted
  rail: "plaid" | "stripe" | "http_request"        // MVP
      | "circle" | "square" | "braintree"           // Phase 2 — payments
      | "polygon" | "sec_edgar" | "sp_global" | "fred"  // Phase 2 — financial data
      | "netsuite" | "workday" | "quickbooks" | "xero"  // Phase 2 — ERP/accounting
      | "google_calendar" | "outlook_calendar" | "calendly"  // Phase 2 — calendar
      | "sendgrid" | "twilio" | "slack"             // Phase 2 — communication
      | "google_sheets" | "excel_online"            // Phase 2 — data
      | "zapier"                                    // Phase 2 — automation
  authType: "api_key" | "oauth2_cc" | "oauth2_authcode" | "basic" | "bearer" | "custom_header" | "wallet"
  credentialsEncrypted: bytea
  credentialsIv: string
  credentialsKeyId: string
  maskedCredential: string
  status: "active" | "revoked" | "error"
  lastTestedAt: timestamp?
  createdBy: uuid FK → users
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `custom_connectors`

Company-defined API connectors. Each one becomes a named section in the canvas sidebar with its own draggable action nodes.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  name: string                        // e.g. "LoanStar Core Banking"
  description: string                 // shown in sidebar tooltip
  iconUrl: string?                    // 40x40 company-uploaded icon
  iconColor: string?                  // hex fallback if no icon
  baseUrl: string                     // e.g. "https://api.company.com/v2"
  importMethod: "openapi_url" | "openapi_file" | "manual" | "mcp"
  openApiSpecUrl: string?             // stored for re-sync
  openApiSpecSnapshot: jsonb?         // cached parsed spec at import time
  authConfig: jsonb                   // encrypted auth config (type + credentials ref)
  authCredentialRef: string           // references vault key for the auth credentials
  status: "active" | "error" | "syncing"
  lastSyncedAt: timestamp?
  lastTestedAt: timestamp?
  createdBy: uuid FK → users
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `custom_connector_actions`

Each action in a custom connector. One action = one draggable node type in the canvas.

```ts
{
  id: uuid PK
  customConnectorId: uuid FK → custom_connectors
  workspaceId: uuid FK → workspaces   // denormalized for query efficiency
  name: string                        // e.g. "Get Loan Status"
  description: string                 // LLM-readable; used in Mode B intent parsing
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  urlTemplate: string                 // supports {pathParam} and {{variable}}
  parameters: jsonb                   // array of param definitions (name, in, type, required, description)
  requestBodySchema: jsonb?           // JSON Schema for request body
  responseSchema: jsonb?              // JSON Schema for response — drives typed output ports
  headers: jsonb?                     // static headers to include
  testPayload: jsonb?                 // sample data for the test button
  enabled: boolean DEFAULT true       // can be toggled off without deleting
  exposedToEndUsers: boolean DEFAULT false  // included in Mode B palette
  requireApproval: boolean DEFAULT false    // force HITL before this action runs
  tags: text[]                        // grouping within the connector node list
  sortOrder: int                      // display order in sidebar
  deprecated: boolean DEFAULT false   // set when re-sync removes an endpoint
  createdAt: timestamp
  updatedAt: timestamp

  -- Index: (customConnectorId, enabled)
  -- Index: (workspaceId, exposedToEndUsers) — for Mode B palette queries
}
```

---

### `knowledge_bases` (Phase 2)

RAG document stores attached to a workspace. Used by the Knowledge Base node.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  name: string
  description: string?
  embeddingModel: string              // e.g. "text-embedding-3-large"
  chunkSize: int DEFAULT 1000
  chunkOverlap: int DEFAULT 200
  status: "indexing" | "ready" | "error"
  documentCount: int DEFAULT 0
  vectorCount: int DEFAULT 0
  createdBy: uuid FK → users
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `guardrails`

One per workspace. Company-wide policy enforced at every execution.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces UNIQUE  // one guardrail config per workspace
  actionAllowlist: text[]?      // null = all actions allowed; array = only these
  actionDenylist: text[]        // always blocked regardless of allowlist
  requireApprovalFor: text[]    // actions that always trigger HITL
  rateLimitPerUser: {           // per end-user limits
    maxExecutionsPerDay: int?
    maxExecutionsPerHour: int?
  }
  budgetCapPerExecution: {
    maxUsdCents: int?           // max LLM cost per execution
    onExceed: "cancel" | "warn"
  }
  killSwitch: boolean DEFAULT false  // if true, all executions blocked immediately
  updatedBy: uuid FK → users
  updatedAt: timestamp
}
```

---

### `deployed_surfaces`

Each deployed surface is a live endpoint for a workspace's flows.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  type: "chat_widget" | "api_endpoint" | "slack_bot" | "whatsapp" | "form"
  name: string
  flowId: uuid FK → flows?       // null = all flows available (Mode B)
  mode: "a" | "b" | "both"
  config: jsonb                  // surface-specific config (see below)
  status: "active" | "paused"
  createdAt: timestamp
  updatedAt: timestamp
}
```

Chat widget config shape:
```ts
{
  allowedOrigins: string[]
  theme: {
    primaryColor: string
    borderRadius: string
    fontFamily: string
    logoUrl: string?
    agentName: string
    poweredBy: boolean
  }
  position: "bottom-right" | "bottom-left" | "inline"
  containerId: string?
}
```

---

### `end_users`

End users are identified by the JWT the embedding company passes. No password — they authenticate via their company's product.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  externalId: string            // company's user ID from JWT
  metadata: jsonb               // injected context from JWT (accountId, tier, etc.)
  firstSeenAt: timestamp
  lastSeenAt: timestamp
  -- Unique: (workspaceId, externalId)
}
```

---

### `personal_agents`

Mode B. Each end user can create multiple personal agents.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  endUserId: uuid FK → end_users
  name: string                  // user-chosen name, e.g. "My Balance Watcher"
  description: string?
  status: "active" | "paused" | "deleted"
  currentVersionId: uuid FK → personal_agent_versions?
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `personal_agent_versions`

Immutable snapshot of a personal agent's config at a point in time. Enables rollback.

```ts
{
  id: uuid PK
  personalAgentId: uuid FK → personal_agents
  version: int
  graph: jsonb                  // same structure as flow_versions.graph
  naturalLanguageIntent: string // original user request that created this version
  createdAt: timestamp
  -- Unique: (personalAgentId, version)
}
```

---

### `schedules`

Cron schedule for a personal agent (or a Mode A flow trigger).

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  targetType: "personal_agent" | "flow"
  targetId: uuid               // personalAgentId or flowId
  endUserId: uuid FK → end_users?
  cronExpression: string       // standard 5-field cron, e.g. "0 9 * * *"
  timezone: string DEFAULT "UTC"
  status: "active" | "paused"
  lastRunAt: timestamp?
  nextRunAt: timestamp?
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### `agent_executions`

One complete run of any flow (Mode A or B, any trigger type).

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  flowId: uuid FK → flows?
  flowVersionId: uuid FK → flow_versions?
  personalAgentId: uuid FK → personal_agents?
  personalAgentVersionId: uuid FK → personal_agent_versions?
  endUserId: uuid FK → end_users?
  triggerType: "user_message" | "scheduled" | "api_call" | "webhook"
  triggerPayload: jsonb         // the raw input that started this execution
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "waiting_approval"
  durationMs: int?
  tokenUsage: {
    inputTokens: int
    outputTokens: int
    estimatedCostUsdCents: int
  }?
  outputValue: jsonb?           // the final output of the flow
  errorMessage: string?
  startedAt: timestamp?
  completedAt: timestamp?
  createdAt: timestamp

  -- Indexes: (workspaceId, endUserId, createdAt)
  -- Indexes: (personalAgentId, createdAt)
  -- Indexes: (status) partial index on "queued" and "running"
}
```

---

### `execution_steps`

One row per node executed within an `agent_execution`. Append-only.

```ts
{
  id: uuid PK
  executionId: uuid FK → agent_executions
  nodeId: string                // references node.id within the flow graph
  nodeType: NodeType
  stepIndex: int                // order of execution
  status: "running" | "completed" | "failed" | "skipped" | "waiting_approval"
  inputSnapshot: jsonb          // what the node received (PII-redacted)
  outputSnapshot: jsonb?        // what the node returned (PII-redacted)
  errorMessage: string?
  durationMs: int?
  tokenUsage: { input: int; output: int }?
  startedAt: timestamp
  completedAt: timestamp?
}
```

---

### `approval_requests`

Created when a HITL node pauses an execution.

```ts
{
  id: uuid PK
  executionId: uuid FK → agent_executions
  stepId: uuid FK → execution_steps
  workspaceId: uuid FK → workspaces
  requestedFor: uuid FK → end_users?
  reviewers: uuid[]             // workspace user IDs to notify
  contextSnapshot: jsonb        // sanitized data shown to reviewer
  message: string               // rendered message template
  status: "pending" | "approved" | "rejected" | "expired" | "executed" | "execution_failed"
  approvedBy: uuid FK → users?
  rejectionReason: string?
  expiresAt: timestamp
  resolvedAt: timestamp?
  createdAt: timestamp

  -- Indexes: (status, expiresAt) for expiry sweeper
}
```

---

### `audit_events`

Append-only. Every state change in every execution is recorded here. Hash-chained for tamper evidence.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  executionId: uuid FK → agent_executions
  stepId: uuid FK → execution_steps?
  approvalId: uuid FK → approval_requests?
  endUserId: uuid FK → end_users?
  eventType: string             // e.g. "execution.started", "node.completed", "approval.requested"
  outcome: "ALLOW" | "DENY" | "HOLD" | "INFO"
  payload: jsonb                // PII-redacted event data
  argsHash: string?             // SHA-256 of sanitized args
  prevHash: string              // hash of previous row (genesis block for first)
  rowHash: string               // SHA-256(id|workspaceId|executionId|eventType|outcome|prevHash)
  createdAt: timestamp

  -- Append-only: no UPDATE or DELETE permitted (enforced via trigger)
  -- Indexes: (workspaceId, createdAt)
  -- Indexes: (executionId)
}
```

---

### `agent_memory`

Persistent key-value store. Scoped to user, agent, or workspace.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces
  scope: "user" | "agent" | "workspace"
  scopeId: uuid                 // endUserId | personalAgentId | workspaceId
  key: string
  value: jsonb
  ttl: timestamp?               // null = permanent
  updatedAt: timestamp
  -- Unique: (workspaceId, scope, scopeId, key)
}
```

---

### `notification_configs`

Per-workspace notification settings for HITL approvals and execution failures.

```ts
{
  id: uuid PK
  workspaceId: uuid FK → workspaces UNIQUE
  slackWebhookEncrypted: bytea?
  slackWebhookIv: string?
  emailAddresses: text[]        // approval request recipients
  approvalTimeoutSeconds: int DEFAULT 3600
  notifyOnFailure: boolean DEFAULT true
  updatedAt: timestamp
}
```

---

## JSONB Schemas

### `flow_versions.graph` / `personal_agent_versions.graph`

```json
{
  "nodes": [
    {
      "id": "node-uuid",
      "type": "llm",
      "label": "Analyze balance",
      "position": { "x": 400, "y": 200 },
      "config": { ... },
      "inputs": [{ "name": "userMessage", "dataType": "string", "required": true }],
      "outputs": [{ "name": "response", "dataType": "string", "required": false }]
    }
  ],
  "edges": [
    {
      "id": "edge-uuid",
      "sourceNodeId": "node-uuid-1",
      "sourcePort": "response",
      "targetNodeId": "node-uuid-2",
      "targetPort": "userMessage"
    }
  ]
}
```

### `guardrails.rateLimitPerUser` / `budgetCapPerExecution`

Stored as JSONB columns directly on the guardrails row.

---

## Key Design Decisions

**Why PostgreSQL instead of SQLite?**
The existing backend uses SQLite. For the runtime, we migrate to Postgres because:
- JSONB (native JSON querying on node graphs)
- Row-level security (workspace isolation)
- Concurrent writes from multiple workers
- pgvector for future Knowledge Base nodes (no second DB needed)

**Why JSONB for flow graphs?**
Flow graphs evolve rapidly during MVP. JSONB avoids a migration for every new node type. Once the node schema stabilizes (post-MVP), we can normalize hot fields into columns.

**Why hash-chained audit events?**
Financial compliance requires tamper evidence. Hash chaining means any deletion or modification of a row breaks the chain, which can be detected programmatically. Matches what the existing backend already implements.

**Why separate `end_users` from `users`?**
Company team members (`users`) log in to the dashboard with passwords. End users (`end_users`) are authenticated via the embedding company's JWT — they have no Inflection account. Keeping them separate avoids conflating two completely different auth models.

**Why `personal_agent_versions` instead of mutable personal agents?**
End users expect rollback ("undo the last change to my agent"). Immutable versions make this trivial — just point `currentVersionId` at any previous version.
