# Execution Plan

Solo/2-engineer sprint. 8 weeks. One feature at a time — ship it, test it, move on.

Each feature is a vertical slice: backend schema + API + UI + test. Nothing is "done" until it works end-to-end.

---

## Guiding Principles

- **No half-finished features.** If it's not wired end-to-end, it doesn't count.
- **Database-first.** Every feature starts with schema + migration. Never build on undefined data.
- **Engine before UI.** The execution engine is the product. Canvas is paint.
- **Test the critical path manually** after each feature — not just unit tests.
- **One PR per feature.** Keep diffs reviewable.

---

## Weeks 1–2: Foundation

### Feature 1: Monorepo Setup + Database
**What:** Project scaffold, Postgres connection, base schema.

Steps:
1. Init `runtime/` as a pnpm workspace
2. Create `packages/api` — Hono app, bare hello-world route, health check
3. Create `apps/worker` — BullMQ worker shell, connects to Redis
4. Create `packages/engine` — empty module, exports `executeFlow` stub
5. Create `packages/embed` — Vite + React, empty widget component
6. Add Drizzle, write schema for: `workspaces`, `users`, `flows`, `flow_versions`
7. First migration: run `drizzle-kit push`, verify tables in Postgres
8. Write workspace + user seed script for local dev
9. Docker Compose: Postgres + Redis + API + Worker running with one command

**Done when:** `docker compose up` → API health check returns 200, seed data in DB.

---

### Feature 2: Workspace Auth
**What:** JWT login/register for company dashboard users.

Steps:
1. `POST /auth/register` — create workspace + owner user, return JWT
2. `POST /auth/login` — verify password, return JWT + refresh token
3. `POST /auth/refresh` — rotate refresh token, return new JWT
4. Auth middleware — verify JWT on protected routes, attach `workspace` + `user` to request context
5. JWT claims: `{ workspaceId, userId, role, version }`
6. Refresh token stored in `refresh_tokens` table (or signed JWT with longer TTL)
7. Login page in dashboard — form, submit, store JWT in memory, redirect to `/flows`

**Done when:** Can register, log in, and hit a protected route from the dashboard.

---

### Feature 3: Flow CRUD
**What:** Create, read, update, delete flows. No canvas yet — just the data layer.

Steps:
1. Add `flows` + `flow_versions` schema, migration
2. `GET /flows` — list workspace flows
3. `POST /flows` — create flow with name + description
4. `GET /flows/:id` — get flow with latest draft version
5. `PUT /flows/:id` — update name/description
6. `DELETE /flows/:id` — archive
7. `POST /flows/:id/versions` — save draft (saves graph JSON to `flow_versions`)
8. `POST /flows/:id/publish` — promote draft → production (creates new version, stage=production)
9. Dashboard: `/flows` route — table of flows, "New Flow" button, basic detail page

**Done when:** Can create a flow and save a graph JSON blob to it via the API. Canvas comes next.

---

## Weeks 2–3: Canvas

### Feature 4: Visual Canvas (Core)
**What:** Drag-and-drop canvas using React Flow. Can place, configure, and wire all 10 MVP node types. Sidebar includes "Your Connectors" section for custom connectors.

Steps:
1. Add React Flow to `apps/dashboard`
2. Create canvas route: `/flows/:id/canvas`
3. Left sidebar with two sections:
   - **Your Connectors** (top) — custom connectors grouped by connector name; each action is a draggable node
   - **Node Library** — grouped: Flow Control (Input, Output, If/Else), AI (LLM), Memory (Memory, Variable), HITL, Native Connectors (Plaid, Stripe, HTTP Request), Communication (Send Email)
4. Drag node from sidebar → drops on canvas with default config
5. Right inspector panel: config form for each node type
   - Input: field builder (add/remove fields, set name + type + description)
   - LLM: provider select, model select, system prompt textarea, temp + max tokens, tool refs
   - Connector (native): connector select, action select, param mapping
   - Custom Connector: connector select → action select → param mapping (same UX as native)
   - IfElse: condition type, operator, operands
   - Memory: operation select, scope, key input, TTL
   - Variable: operation select, variable name
   - HITL: reviewer select, message template, timeout, channels
   - Output: response type select, template input
   - Send Email: provider, to/from/subject/body fields
   - HTTP Request: method, URL, auth config, headers, body
6. Ports rendered on nodes (left = inputs, right = outputs), color-coded by type
7. Drag output port → input port → edge created; incompatible type shows warning
8. Delete selected edge/node with Backspace key
9. Auto-save draft every 30s; Cmd+S manual save
10. Publish button → diff modal → `POST /flows/:id/publish`

**Done when:** Can build a 3-node flow (Input → LLM → Output) on the canvas and publish it. Custom connector nodes appear in sidebar and are droppable.

---

### Feature 5: Canvas Polish + Validation
**What:** Validation on publish, version history, templates.

Steps:
1. Publish validation: at least one Input + one Output, no unconnected required ports, no cycles
2. Show validation errors inline on canvas (red border on invalid nodes)
3. Version history panel (right side): list published versions, click to view diff
4. One-click rollback to any prior version (updates `flows` + creates a new draft from old version)
5. 4 starter templates: load pre-built graph JSON on "New from Template"
6. Undo/redo: use React Flow's built-in history or implement with useReducer (up to 50 steps)
7. Auto-layout button: Dagre algorithm, rearranges nodes left-to-right

**Done when:** Can publish a flow, view version history, and rollback to a prior version.

---

## Weeks 3–4: Connectors

### Feature 6: Connector Management
**What:** Add, test, and revoke connectors (Plaid, Stripe, Custom API).

Steps:
1. Add `connectors` schema, migration
2. `GET /connectors` — list workspace connectors
3. `POST /connectors` — add connector (encrypt creds, store in DB)
4. `POST /connectors/:id/test` — run connectivity test
5. `DELETE /connectors/:id` — revoke
6. AES-256-GCM encryption for credentials (key from env in dev, Vault in prod)
7. Dashboard: `/connectors` route — list + "Add Connector" modal with per-type forms
8. Plaid form: client_id, secret, environment dropdown
9. Stripe form: secret key input
10. Custom API form: base URL, auth type select + auth fields (dynamic based on type)

**Done when:** Can add a Plaid connector, test it (returns 200), and see the masked credential in the list.

---

### Feature 7: Plaid Actions
**What:** Implement the 4 Plaid connector actions.

Steps:
1. `packages/engine/src/connectors/plaid.ts` — implement `PlaidConnector` class:
   - `plaid.getBalance(accountId?)` — calls `/accounts/balance/get`
   - `plaid.getTransactions(startDate, endDate, accountId?, count?)` — calls `/transactions/get`
   - `plaid.getIdentity()` — calls `/identity/get`
   - `plaid.getIncome()` — calls `/income/get`
2. Error handling: ITEM_LOGIN_REQUIRED, INVALID_ACCESS_TOKEN, RATE_LIMIT_EXCEEDED → typed errors
3. Write unit tests with Plaid sandbox credentials
4. Register in `action-registry` — maps `"plaid.getBalance"` → PlaidConnector method
5. Connector node in engine calls `action-registry.execute(action, args, credentials)`

**Done when:** A Connector node in the engine can call `plaid.getBalance` and return real data from Plaid sandbox.

---

### Feature 8: Stripe Actions
**What:** Implement the 5 Stripe connector actions.

Steps:
1. `packages/engine/src/connectors/stripe.ts` — implement `StripeConnector`:
   - `stripe.getCustomer(customerId)`
   - `stripe.listPaymentMethods(customerId)`
   - `stripe.createCharge(amount, currency, customerId, idempotencyKey)`
   - `stripe.getSubscription(subscriptionId)`
   - `stripe.createRefund(chargeId, amount?)`
2. Idempotency: createCharge always uses `executionId` as idempotency key
3. Error handling: card_declined, insufficient_funds, invalid_request_error → typed errors
4. Write unit tests with Stripe test mode keys
5. Register in action-registry

**Done when:** Can create a test Stripe charge via the engine with a connector node.

---

### Feature 9: HTTP Request Node + Custom Connector Import
**What:** Two things in one sprint: the generic HTTP Request node, and the full custom connector import system (OpenAPI spec + manual builder). This is the most impactful feature for companies — their own APIs become canvas nodes.

**Part A — HTTP Request node (1 day)**
1. `packages/engine/src/nodes/http-request.ts` — execute arbitrary REST call
2. Auth types: none, api_key (header), bearer, basic, oauth2_cc
3. Timeout configurable (default 30s), TLS enforced in production
4. Inspector form: method select, URL input, auth config, headers editor, body editor

**Part B — Custom Connector Import (4 days)**
1. Add `custom_connectors` + `custom_connector_actions` schema + migration
2. `POST /custom-connectors/import/openapi` — accept URL or raw spec body:
   - Parse with `openapi-parser.ts`: extract method, path, params, request/response schemas
   - Return action list for review (not saved yet — review step first)
3. `POST /custom-connectors` — save connector + reviewed/selected actions
4. `POST /custom-connectors/:id/actions` — add manually-defined action
5. cURL paste parser in API: extract method, URL, headers, body → return action draft
6. `POST /custom-connectors/:id/actions/:actionId/test` — run action with sample payload, return raw + parsed response
7. `POST /custom-connectors/:id/sync` — re-fetch spec, return `{ added, removed, changed }` for company review
8. `packages/engine/src/custom-connector-runner.ts`:
   - Load action record, fetch auth creds from Vault
   - Interpolate URL template, inject auth, build + execute HTTP request
   - Parse response per `responseSchema`, return typed outputs
9. Engine `custom-connector.ts` node handler calls runner
10. Dashboard `/connectors` → "Your Connectors" tab: import button, action list, test buttons, re-sync

**Done when:** Import a real OpenAPI spec, see actions in canvas sidebar, drag one onto canvas, run flow, see typed data returned from the company's API.

---

## Weeks 4–5: Execution Engine + Embed

### Feature 10: Core Execution Engine
**What:** The engine that loads a flow graph and executes it. This is the heart of the product.

Steps:
1. `packages/engine/src/executor.ts` — `executeFlow(ctx, graph)`:
   - Topological sort of nodes
   - Iterate nodes in order: resolve inputs from upstream outputs, call handler, collect outputs
   - Execution context: workspaceId, executionId, emit (SSE), audit, vault, memory, policy
2. Add node handlers for all 10 MVP node types (stubs for HITL + Memory, full for others)
   — input, output, llm, ifelse, memory, variable, hitl, send-email, http-request, custom-connector
3. `POST /executions` — create execution, enqueue BullMQ job
4. `GET /executions/:id` — return execution status + steps
5. Worker processor: picks up execution job, calls `executeFlow`, writes results
6. PII redaction: runs on every `inputSnapshot` / `outputSnapshot` before DB write
7. Audit writer: writes execution start, node start/complete, execution complete events

**Done when:** Trigger a 3-node flow (Input → LLM → Output) via API call, see it complete, check execution steps in DB.

---

### Feature 11: SSE Streaming
**What:** Real-time execution progress streamed to the embed via Server-Sent Events.

Steps:
1. `GET /executions/:id/stream` — SSE endpoint (Content-Type: text/event-stream)
2. Engine `emit()` function writes events to a Redis pub/sub channel (`execution:{id}:events`)
3. SSE route subscribes to that channel, forwards events to HTTP response
4. Events: `execution.started`, `node.started`, `node.delta` (LLM token), `node.completed`, `execution.completed`, `execution.failed`
5. Reconnection: client sends `Last-Event-ID` header, API replays missed events from `execution_steps`
6. Cleanup: SSE connection closed after `execution.completed` or `execution.failed`

**Done when:** Execute a flow and see streaming token output in a browser EventSource console.

---

### Feature 12: Embed Widget + Mode A
**What:** The embeddable chat widget, first version. Companies can embed it, users can chat.

Steps:
1. `packages/embed/src/widget.tsx` — Chat widget React component
2. Build: Vite, single output file `dist/widget.js` (~80KB gzipped target)
3. Web component wrapper: `<inflection-widget>` custom element, initialized via `InflectionEmbed.init()`
4. Chat UI: message thread, input bar, send button, typing indicator
5. On user send: `POST /executions` (with X-Inflection-Token header), subscribe to SSE stream
6. Stream messages rendered token-by-token into chat thread
7. End-user JWT passthrough auth: `embed-auth.ts` middleware verifies company-signed JWT
8. CORS: only allow requests from `workspace.embedOrigins`
9. Theme: CSS custom properties applied from `init()` theme config
10. Test page: HTML file that loads the widget with a test JWT

**Done when:** Load test page in browser, send message, see streamed response from a real flow.

---

## Weeks 5–6: Guardrails + HITL

### Feature 13: Guardrail Enforcement
**What:** Runtime policy check before any connector action executes.

Steps:
1. `packages/engine/src/guardrail.ts` — `checkGuardrail(workspaceId, action, args, endUserId)`:
   - Load guardrails from DB (cache with 30s TTL)
   - Check kill switch → if on, return DENY
   - Check denylist → if action in list, return DENY
   - Check allowlist → if set and action not in list, return DENY
   - Check requireApprovalFor → if action in list, return HOLD
   - Check rate limits → if exceeded, return DENY
   - Else return ALLOW
2. Add `guardrails` schema + migration
3. `GET /guardrails` + `PUT /guardrails` routes
4. Dashboard: `/settings/guardrails` page — allowlist multi-select, denylist, approval triggers, rate limits, kill switch toggle
5. Rate limit enforcement: check count of executions for this endUser today/hour from `agent_executions`

**Done when:** Add `stripe.createRefund` to denylist, try to execute a flow with that action → execution fails with GUARDRAIL_DENIED.

---

### Feature 14: HITL (Human-in-the-Loop)
**What:** Pause execution at a HITL node, send approval email, resume on approve.

Steps:
1. HITL node handler in engine: create `ApprovalRequest` record, throw `HitlPauseSignal`
2. Worker catches `HitlPauseSignal`: set execution status=`waiting_approval`, delay BullMQ job
3. Emit SSE event: `approval.requested` with context
4. Embed: show "Waiting for approval..." message
5. `POST /approvals/:id/approve` + `POST /approvals/:id/reject` routes
6. On approve: re-enqueue execution job with `resumeFromNodeId` + `approvalContext`
7. Engine on resume: skip nodes before `resumeFromNodeId`, inject approval context
8. Email notification: SendGrid template with one-click approve/reject links (HMAC-signed tokens)
9. Expiry sweeper: marks expired pending approvals, fires `onTimeout` policy
10. Dashboard `/approvals` page: list pending approvals, detail view, approve/reject buttons

**Done when:** Execute a flow with a HITL node → see approval request in dashboard → click approve → execution completes.

---

## Weeks 6–7: Mode B + Scheduler

### Feature 15: Mode B — Personal Agent Creation
**What:** End users describe an agent in plain English → agent is created and ready to run.

Steps:
1. Add `end_users`, `personal_agents`, `personal_agent_versions` schema + migration
2. `POST /me/agents/intent` — parse intent:
   - LLM call (Claude Sonnet) with system prompt containing workspace palette + guardrails
   - Returns structured agent config: `{ name, graph, schedule?, params }`
   - Run guardrail check on proposed config before returning
3. `POST /me/agents` — create personal agent from confirmed config
   - Creates `personal_agent` + `personal_agent_version` + `schedule` (if cron requested)
4. Widget: Mode B flow
   - "What would you like your agent to do?" prompt
   - Loading state while intent is parsed
   - Confirmation screen: agent name (editable), action list, schedule picker
   - Confirm → create agent, show success
5. `GET /me/agents` — list end user's agents
6. `DELETE /me/agents/:id`, `POST /me/agents/:id/pause`, `POST /me/agents/:id/resume`

**Done when:** Type "check my balance every morning and alert me if under $500" → see confirmation → confirm → agent created with cron schedule.

---

### Feature 16: Scheduler
**What:** Cron-based execution of personal agents.

Steps:
1. Add `schedules` schema + migration
2. On personal agent creation with schedule: create `Schedule` record + register BullMQ repeatable job
3. `apps/worker/src/processors/scheduler.ts` — fires scheduled executions:
   - Reads active schedules with `nextRunAt <= now`
   - Creates `agent_execution` (trigger: `scheduled`) for each
   - Enqueues execution job
   - Updates `schedule.lastRunAt` + `schedule.nextRunAt`
4. On pause: remove BullMQ repeatable job, set schedule status=paused
5. On resume: re-register BullMQ job
6. On delete: cancel all schedules for agent
7. Timezone handling: use `cronstrue` to parse cron + timezone, convert to UTC for BullMQ
8. Widget: show "Next run: tomorrow at 9:00 AM" in agent detail

**Done when:** Create a personal agent with a 1-minute cron schedule, watch it execute automatically, see runs appear in history.

---

### Feature 17: Agent Memory
**What:** Persistent per-user/per-agent memory that survives across executions.

Steps:
1. Add `agent_memory` schema + migration
2. Memory node handler in engine:
   - Read: `SELECT value FROM agent_memory WHERE scope=? AND scopeId=? AND key=?` (check TTL)
   - Write: `INSERT ... ON CONFLICT DO UPDATE`
   - Delete: hard delete
3. Memory client exposed on `ExecutionContext` — handlers call `ctx.memory.read(scope, key)`
4. Dynamic key interpolation: `alert_threshold_{{endUserId}}` → replace at runtime
5. TTL sweeper: `apps/worker/src/processors/expiry-sweeper.ts` — delete expired memory rows hourly
6. Test: build a flow that writes `last_balance` to memory, reads it in next run, shows change

**Done when:** Execute a flow twice — second run reads a value written by the first run.

---

## Week 8: Embed SDK + Design Partner Onboarding

### Feature 18: Embed SDK Polish
**What:** The `@inflection/embed` package ready for design partner integration.

Steps:
1. Full `InflectionEmbed.init()` API: all theme options, position, mode, callbacks
2. Inline mode: `position: "inline"`, `containerId: "my-div"` — widget renders inside a container
3. Mobile responsive: full-screen on viewports < 480px wide
4. `InflectionEmbed.open()`, `.close()`, `.toggle()`, `.sendMessage()`, `.destroy()`
5. Error states: auth failure, network error, execution failure — all shown in widget with user-friendly messages
6. Accessibility: keyboard navigation, ARIA labels, focus trap in open widget
7. Bundle size check: < 100KB gzipped (audit with `vite-bundle-visualizer`)
8. "My Agents" tab: list agents, agent detail, run history, pause/resume/delete
9. npm publish: `@inflection/embed` to npm (or private registry for design partner)
10. Embed documentation: code snippet + all SDK options documented

**Done when:** Design partner can `npm install @inflection/embed` and have the widget running in their product within 30 minutes.

---

### Feature 19: Audit Log + Analytics
**What:** Audit chain verification, audit log UI, basic analytics.

Steps:
1. `GET /audit/verify` — walk the hash chain, return `{ valid: true, broken_at: null }`
2. Dashboard `/audit-logs` — table with date/execution/outcome filters, CSV export
3. Audit log row detail view — full payload JSON, hash verification status
4. Dashboard `/analytics` — 4 stat cards + execution volume chart (use Recharts)
5. Write a script that verifies the audit chain on startup (log warning if broken)

**Done when:** Dashboard shows execution stats and audit log is browsable with hash verification.

---

### Feature 20: Design Partner Onboarding
**What:** Get the design partner from zero to live.

Steps:
1. Provision workspace for design partner
2. Set up their connector(s) — Plaid + Stripe credentials
3. Build their first flow on canvas together (live pairing session)
4. Configure guardrails for their use case
5. Generate their workspace public key pair, document the JWT signing flow
6. Test embed integration in their staging environment
7. Monitor first production execution end-to-end
8. Fix any issues found in production

**Done when:** A real end user at the design partner completes a Mode B personal agent creation and it executes on schedule.

---

## Feature Dependency Order

```
1. Monorepo Setup
2. Workspace Auth
3. Flow CRUD
4. Canvas (Core)                    ← needs Auth + Flow CRUD
5. Canvas Polish + Validation
6. Connector Management             ← needs Auth
7. Plaid Actions                    ← needs Connector Management
8. Stripe Actions                   ← needs Connector Management
9. HTTP Request + Custom Connector  ← needs Connector Management (runs in parallel with 7+8)
10. Execution Engine                ← needs Flow CRUD + 7, 8, 9
11. SSE Streaming                   ← needs Execution Engine
12. Embed Widget (Mode A)           ← needs Execution Engine + SSE
13. Guardrails                      ← needs Execution Engine
14. HITL                            ← needs Execution Engine + Guardrails
15. Mode B                          ← needs Embed Widget + Execution Engine + Custom Connectors
16. Scheduler                       ← needs Mode B
17. Memory                          ← needs Execution Engine
18. Embed SDK Polish                ← needs Mode B + Scheduler
19. Audit Log + Analytics           ← can start in parallel from Feature 10
20. Design Partner Onboarding       ← needs all of the above
```

---

## What To Build In Parallel (2 Engineers)

**Engineer A (backend):** 1, 2, 3, 6, 7, 8, 9 (Part A), 10, 11, 13, 14, 16, 17, 19
**Engineer B (frontend):** 4, 5, 9 (Part B — dashboard UI), 12, 15, 18, 20

Key unblock points:
- Feature 9 (custom connectors backend) unblocks Feature 4 (canvas sidebar "Your Connectors")
- Feature 10 (engine) unblocks Feature 12 (embed)
- Feature 15 backend unblocks Feature 15 widget

---

## Weekly Milestone Summary (MVP — Weeks 1–8)

| Week | Engineer A | Engineer B | Demo at end of week |
|---|---|---|---|
| 1 | Setup + Auth + Flow CRUD | Setup + DB schema | Register, login, create a flow via API |
| 2 | Connector Mgmt + Custom Connector Import | Canvas core (10 node types) | Add Plaid connector; import OpenAPI spec; see custom nodes in canvas |
| 3 | Plaid + Stripe actions | Canvas polish + templates | Execute Plaid action from engine; build Balance Alert template |
| 4 | Execution engine + Custom Connector Runner | Embed widget shell | Trigger flow via API; custom connector node calls real company API |
| 5 | SSE streaming + Guardrails | Embed Mode A | Chat → flow runs → streamed response; guardrail blocks denied action |
| 6 | HITL | Mode B widget | HITL email approval; end user creates personal agent with custom connector tool |
| 7 | Scheduler + Memory | Embed SDK polish | Personal agent runs on cron; custom connector tool in Mode B palette |
| 8 | Audit + Analytics | Design partner onboarding | Design partner live with custom connectors deployed |

---

## Phase 2 Build Plan (Weeks 9–16)

After design partner is live, build out the full financial ops node library. These run in order of business impact.

### Feature 21: Loop + AI Routing + Merge nodes (Week 9)
- Loop: iterate over arrays (batch transaction processing, multi-account checks)
- AI Routing: LLM-based branching (route customer queries to the right flow)
- Merge: combine outputs from parallel branches
- Canvas: loop node has "expand" toggle to show inner subgraph

### Feature 22: Google Calendar + Outlook Calendar (Week 9–10)
- OAuth2 flow for both (Google + Microsoft)
- 8 actions each: list, get, create, update, delete events; check availability; find next slot
- Meeting Scheduler compound node (AI-orchestrated)
- Webhook triggers for event creation/cancellation
- Use case: financial advisors scheduling client meetings via agent

### Feature 23: NetSuite connector (Week 10–11)
- OAuth2 / Token-Based Auth setup
- 56 actions: customers, invoices, payments, journal entries, vendors, reports
- HITL required by default on all write operations
- Use case: AP/AR automation; invoice approval workflows

### Feature 24: Slack + SMS (Send Notification node) (Week 11)
- Slack: OAuth2, post to channel/DM, Block Kit messages
- Twilio SMS: API key auth, send SMS
- `send_notification` multi-channel abstraction
- Use case: alert financial ops teams + end users via preferred channel

### Feature 25: Financial Data nodes — Polygon + SEC EDGAR (Week 12)
- Polygon: stock prices, OHLC, ticker details, financials, news
- SEC EDGAR: 10-K/10-Q/8-K search + XBRL structured data
- Use case: portfolio monitoring agents, competitor tracking, compliance alerts

### Feature 26: Workday + QuickBooks (Week 12–13)
- Workday: workers, budgets, cost centers, business process approvals
- QuickBooks: customers, invoices, payments, P&L, balance sheet (OAuth2)
- Use case: expense reporting automation, budget vs. actual alerts

### Feature 27: Knowledge Base (RAG) node (Week 13–14)
- Document upload (PDF, Word, Excel) → chunk + embed → store in pgvector
- Knowledge Base node: semantic search, returns top-k chunks
- Use case: financial policy Q&A agent, product docs search, compliance lookup

### Feature 28: Data Processing nodes — Transform, Aggregate, Spreadsheet (Week 14–15)
- Transform: JSONata/JMESPath data reshaping
- Aggregate: sum, average, group by, filter, sort on arrays
- Spreadsheet Read/Write: Google Sheets + Excel Online
- PDF Generate: HTML template → PDF (invoices, reports, statements)
- Use case: automated report generation, data normalization between systems

### Feature 29: Webhook Trigger + Zapier (Week 15)
- Webhook Trigger node: replaces Input node; starts flows from external events
- Webhook Send: POST to external URLs with HMAC signing
- Zapier: trigger Zaps from flows (bridge to 5,000+ integrations)
- Use case: event-driven financial ops (payment received → reconcile → notify)

### Feature 30: S&P Global + FRED + Xero + Calendly (Week 16)
- S&P Global: credit ratings, financial metrics, ESG scores
- FRED: Federal Reserve macro data, interest rates, CPI
- Xero: accounting for UK/ANZ markets
- Calendly: booking management + webhook triggers
- MCP server import for custom connectors (Phase 2 import method)

---

## Phase 2 Weekly Milestones

| Week | Features | Demo |
|---|---|---|
| 9 | Loop + AI Routing + Google Calendar | Build a flow that loops over 10 transactions and routes each to different handlers |
| 10 | NetSuite + Outlook Calendar | Invoice approval workflow: webhook in → auto-approve small → HITL for large → NetSuite approved |
| 11 | Slack/SMS + Send Notification | Agent sends Slack alert when portfolio drops; SMS when balance critical |
| 12 | Polygon + SEC EDGAR + Workday | Stock price monitor agent running for end user; SEC filing alert for analyst team |
| 13 | QuickBooks + Knowledge Base | P&L alert agent; policy Q&A agent answering from uploaded compliance docs |
| 14 | Transform + Aggregate + Spreadsheet | Weekly expense report: read Google Sheet → aggregate → PDF → email |
| 15 | Webhook Trigger + Zapier | Payment webhook → reconcile in NetSuite → trigger Zapier for downstream apps |
| 16 | S&P Global + FRED + MCP import | Macro data alert agent; company with MCP server imports all tools in one step |
