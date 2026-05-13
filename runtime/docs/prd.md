# Product Requirements Document — Inflection MVP

---

## 1. Visual Canvas

### What it is
A drag-and-drop workflow editor embedded in the Inflection dashboard. Companies use it to build agent flows by placing nodes on a 2D canvas and wiring them together.

### Requirements

**Canvas surface**
- Infinite canvas with pan (click + drag background) and zoom (scroll or pinch)
- Grid snapping (16px) with toggle to disable
- Minimap in bottom-right corner
- Auto-layout button (Dagre algorithm, left-to-right)
- Cmd+Z / Cmd+Y undo/redo (up to 50 steps)
- Cmd+S manual save; auto-draft save every 30 seconds

**Node sidebar**
- Left panel with node types grouped into categories:
  - **Your Connectors** (top) — custom connectors the company has imported; each shows its icon, name, and expandable action list
  - **Flow Control** — Input, Output, If/Else (MVP); Loop, AI Routing, Merge, Delay (Phase 2)
  - **AI** — LLM (MVP); Knowledge Base (Phase 2)
  - **Memory** — Memory, Variable (both MVP)
  - **HITL** — HITL (MVP)
  - **Native Connectors** — Plaid, Stripe, HTTP Request (MVP); financial data, ERP, calendar, communication, data processing, automation (Phase 2)
- Search filter at top — searches across node name, connector name, and action name
- Drag from sidebar → drop on canvas to create node

**Node inspector**
- Right panel opens when a node is selected
- Shows config form for the selected node type
- Config fields use appropriate input types (text, number, select, code editor for prompts)
- Real-time validation — errors shown inline, not on save
- "Test this node" button — runs just this node in isolation with sample data

**Edges (wires)**
- Drawn by dragging from an output port to an input port
- Ports shown as colored circles on node edges (output = right side, input = left side)
- Color-coded by data type: string=blue, number=green, boolean=yellow, object=purple, any=gray
- Incompatible type connection shows warning but does not block (weak typing in MVP)
- Click edge + Delete to remove

**Flow management**
- Each flow has a name, description, and status (active/archived)
- Flows list at `/flows` — table view with last edited, stage, created by
- "New Flow" → blank canvas
- "New from Template" → pre-built fintech templates (Balance Alert, Transaction Summary, Payment Approval)
- Publish button → creates a new `flow_version` with stage=production
  - Shows diff from last published version before confirming
  - Requires at least one Input and one Output node

**ADLC (MVP: 2 stages)**
- Draft: editing state, never runs in production
- Production: live version. Publishing creates a snapshot.
- Version history panel (right sidebar) — list of all published versions with timestamps
- One-click rollback to any previous version

### Templates (ship with MVP)
| Template | Nodes | Use case |
|---|---|---|
| Balance Alert | Input → Plaid(getBalance) → IfElse → SendEmail → Output | Alert when balance drops below threshold |
| Transaction Summary | Input → Plaid(getTransactions) → LLM → Output | Weekly spending summary |
| Payment Approval | Input → Stripe(createCharge) → HITL → Output | Charge with human approval gate |
| Custom Connector Query | Input → CustomConnector(anyAction) → LLM → Output | Call any company API, format the response |
| Scheduled Financial Report | Input → Plaid(getTransactions) → Aggregate → LLM → SendEmail → Output | Weekly digest on schedule |

**Phase 2 templates**
| Template | Nodes | Use case |
|---|---|---|
| Stock Price Monitor | Input → Polygon(getStockPrice) → IfElse → SendNotification → Output | Alert on price threshold |
| Invoice Auto-Approve | WebhookTrigger → NetSuite(getInvoice) → IfElse → NetSuite(approveInvoice)/HITL → Output | Auto-approve small invoices |
| Meeting Scheduler | Input → GoogleCalendar(checkAvailability) → MeetingScheduler → SendEmail → Output | AI-powered meeting booking |
| SEC Filing Alert | Input → SECEDGAR(getLatest10K) → LLM → SendSlack → Output | Competitor filing notifications |
| Expense Report | Input → SpreadsheetRead → Aggregate → PDFGenerate → SendEmail → Output | Auto-generated expense reports |

---

## 2. Connector Library

### What it is
Connections to external APIs, in two categories:
- **Native connectors** — Inflection-built integrations for common services (Plaid, Stripe, NetSuite, etc.)
- **Custom connectors** — company-defined connections to their own internal APIs

Both appear in the canvas sidebar as draggable nodes. Both can be referenced by end users in Mode B.

### Requirements

**Connector management page** (`/connectors`)
- Two tabs: **Native Connectors** and **Your Connectors** (custom)
- List of all connected services with status, masked credential, last tested date
- "Add Connector" button → opens add connector modal
- "Test connection" button per connector — calls a read-only API endpoint to verify creds
- "Revoke" button — marks connector as revoked, all flows referencing it are flagged

**Adding a native connector**
- Modal with connector type selector (grouped: Payments, Financial Data, ERP, Calendar, Communication, Data)
- Per-type credential form (Plaid: client_id + secret + env; Stripe: secret key; etc.)
- "Save & Test" — encrypts credentials, stores in Vault, runs a connectivity test
- Credentials never returned in API responses after creation (only masked version)

**Plaid connector**
- Credential: client_id + secret + environment (sandbox | development | production)
- Actions: getBalance, getTransactions, getIdentity, getIncome, getLiabilities, getInvestments, getAssetReport, exchangePublicToken
- Error handling: INVALID_CREDENTIALS → surface clear error; rate limits → retry with backoff

**Stripe connector**
- Credential: secret key
- Actions (13): see `nodes.md` → `stripe` for full list
- Webhook triggers: payment_intent.succeeded, payment_intent.payment_failed, invoice.payment_failed, subscription.deleted
- Write operations HITL-flagged by default; idempotency key derived from executionId

**HTTP Request connector** (generic REST for one-off calls)
- Auth types: none, api_key, bearer, basic, oauth2_client_credentials
- Timeout: configurable (default 30s, max 120s)
- TLS verification: enforced in production
- Response: JSON or text; binary not supported

---

## 2a. Custom Connector Import

### What it is
Companies import their own internal APIs via OpenAPI spec or manual builder. Each action becomes a first-class draggable node on the canvas, indistinguishable from native nodes. Actions marked as end-user accessible appear in the Mode B palette.

### Requirements

**Adding a custom connector** (button: "Import Your API")

**Path A — OpenAPI import (3 steps)**
1. **Provide spec** — URL (Inflection fetches + parses), file upload (.yaml/.json), or paste raw text
2. **Configure auth** — one auth config applies to all actions in this connector:
   - API key (header name configurable), Bearer token, Basic auth, OAuth2 client credentials, OAuth2 auth code flow, Custom header
3. **Review & configure actions** — table of all discovered endpoints:
   - Enable/disable per action
   - Rename each action (default: generated from method + path)
   - Write a description (LLM reads this for Mode B — make it specific)
   - Toggle: "End users can access this" (appears in Mode B palette)
   - Toggle: "Require approval before running" (forces HITL)
   - Add tags (for sidebar grouping)

**Path B — Manual builder**
1. Define action: name, description, HTTP method, URL template (`https://api.co/v1/loans/{{loanId}}`), params (name, in, type, required)
2. Or paste a cURL command → auto-parsed into action definition
3. Define expected response shape (optional JSON Schema — drives typed output ports)
4. Test with sample data before saving

**Custom connector management**
- Each connector shows: name, icon, action count, last tested, status
- "Re-sync" button (for OpenAPI-imported connectors) — re-fetches spec, shows diff, prompts to update
- Actions that disappear from re-sync are marked deprecated (not deleted, not broken in existing flows)
- Per-action test button — runs action with sample data, shows raw response

**Canvas sidebar behavior**
- Custom connectors appear in "Your Connectors" section above native connectors
- Expandable list per connector showing each enabled action as a draggable node
- Node label = action name; subtitle = connector name
- Visually identical to native nodes (no "custom" badge — intentional)

**Mode B palette behavior**
- Only actions with `exposedToEndUsers: true` appear in Mode B
- The LLM receives the action name + description for intent parsing
- Well-written descriptions = better personal agent creation
- Bad: "Get loan" → Good: "Get the outstanding balance, status, and next payment date for a specific loan"

---

## 2b. Phase 2 Native Connectors

These connectors follow the same pattern as Plaid/Stripe but ship after MVP. Requirements identical in structure; key actions listed.

**Financial Data**
- `polygon` — stock prices, OHLC, historical data, ticker details, financials, news (8 actions)
- `sec_edgar` — 10-K, 10-Q, 8-K filings, XBRL structured data, insider ownership (7 actions)
- `sp_global` — credit ratings, financial metrics, ESG scores, industry data (25+ actions)
- `fred` — Federal Reserve macro data, interest rates, CPI, employment series (4 actions)

**Accounting / ERP**
- `netsuite` — invoices, customers, payments, journal entries, financial reports (56 actions); OAuth2 or Token-Based Auth
- `workday` — workers, org chart, budgets, cost centers, business process approvals (10+ actions)
- `quickbooks` — customers, invoices, payments, P&L, balance sheet (10+ actions); OAuth2
- `xero` — contacts, invoices, bank transactions, financial reports (7+ actions); OAuth2

**Calendar & Scheduling**
- `google_calendar` — list/create/update/delete events, check availability, find next slot, create recurring events (8 actions); OAuth2
- `outlook_calendar` — same action set against Microsoft Graph API; Azure AD OAuth2
- `calendly` — get bookings, availability, event types, cancel events (4 actions + 2 webhook triggers)
- `meeting_scheduler` — AI-orchestrated: finds best time across calendars, sends invites, handles rescheduling (1 compound action)

**Communication**
- `slack` — post to channel/DM, Block Kit messages, thread replies (3 actions + slash command trigger)
- `twilio` — send SMS, send WhatsApp (2 actions)
- `send_notification` — multi-channel abstraction (in-app + email + SMS + Slack); respects user's channel preferences

**Data Processing**
- `google_sheets` — read rows, append rows, update cells (3 actions); OAuth2
- `excel_online` — same against Microsoft Graph; Azure AD OAuth2
- PDF generation — HTML template → PDF file → deliver via email/URL/Drive

**Automation**
- `webhook_trigger` — start a flow from an incoming webhook (replaces Input node as trigger)
- `webhook_send` — POST to external webhook URL with optional HMAC signing
- `zapier` — trigger a Zap from a flow (bridge to Zapier's 5,000+ integrations)

---

## 3. Guardrail Configuration

### What it is
Company-defined policy enforced at runtime on every execution. Companies configure guardrails in the dashboard. The runtime checks guardrails before executing any connector node.

### Requirements

**Guardrail page** (`/settings/guardrails`)

**Action allowlist / denylist**
- Allowlist: if set, only listed actions can execute (e.g., only `plaid.getBalance` and `plaid.getTransactions` — no write operations)
- Denylist: always blocked, regardless of allowlist (e.g., `stripe.createRefund` blocked entirely)
- Actions listed by connector, with descriptions
- Empty allowlist = all actions permitted

**Require approval for**
- Multi-select list of actions that always trigger a HITL node, even if no HITL node exists in the flow
  - If an action is in this list and no HITL node is in the flow, the runtime inserts a synthetic HITL gate
- Default: `stripe.createCharge`, `stripe.createRefund`

**Rate limits**
- Max executions per user per day (integer or blank = unlimited)
- Max executions per user per hour
- On limit exceeded: execution blocked, error returned to embed

**Budget cap**
- Max estimated LLM cost per execution (USD cents)
- On exceed: "cancel" (hard stop) or "warn" (log and continue)

**Kill switch**
- Toggle — when ON, all executions are blocked immediately
- Dashboard shows prominent warning banner when kill switch is active

---

## 4. Execution Engine

### What it is
The runtime component that loads a flow graph and executes each node in topological order. Both Mode A and Mode B use the same engine.

### Requirements

**Trigger types**
- `user_message` — end user sends a message in the embed
- `scheduled` — BullMQ job fires based on cron schedule
- `api_call` — company calls the Inflection API directly
- `webhook` — external service posts to a webhook URL (Phase 2)

**Execution lifecycle**
1. Trigger arrives → create `agent_execution` (status: queued)
2. BullMQ job published to `executions` queue
3. Worker picks up job
4. Check kill switch → if on, status=cancelled, return error
5. Check rate limits → if exceeded, status=cancelled, return rate_limit error
6. Check budget cap (estimated) → if over, status=cancelled
7. Load flow graph (from flow_versions or personal_agent_versions)
8. Execute nodes in topological order:
   - Load node handler by type
   - Resolve inputs from output values of upstream nodes
   - Check guardrails (for connector nodes)
   - Execute node handler
   - Write ExecutionStep
   - Emit SSE progress event to embed
   - On node failure: retry up to 3x with exponential backoff (2s, 4s, 8s)
   - If all retries exhausted: execution status=failed, emit error to embed, send failure notification
9. All nodes complete → status=completed, write final output, emit completion SSE

**Streaming (SSE)**
- Every execution emits events on a per-execution SSE channel
- Channel URL: `/api/ws/{workspaceId}/executions/{executionId}/stream`
- Event types: `execution.started`, `node.started`, `node.delta` (LLM token), `node.completed`, `node.failed`, `execution.completed`, `execution.failed`, `approval.requested`
- Embed client subscribes to this channel for real-time updates

**Concurrency**
- BullMQ with 10 concurrent workers per workspace in MVP
- Each worker is stateless — pulls job, executes, writes results, releases

**Timeout**
- Execution-level timeout: 5 minutes (configurable per workspace, max 30 min in MVP)
- Individual node timeout: 60 seconds (configurable per node)

---

## 5. HITL (Human-in-the-Loop)

### What it is
A node that pauses a running execution, notifies designated reviewers, and resumes or cancels based on their decision.

### Requirements

**HITL node placement**
- Can be placed anywhere in the flow except before the Input node
- Common pattern: after a Connector node that does a write operation

**Approval request lifecycle**
1. Execution hits HITL node
2. `ApprovalRequest` created (status: pending)
3. Execution status set to `waiting_approval`
4. Notifications sent per configured channels
5. Embed shows: "This action is waiting for approval from your team. You'll be notified when it's resolved."
6. Reviewer opens approval in dashboard (`/approvals`) or clicks link in email/Slack
7. Reviewer sees: context snapshot, action description, amount if applicable, requester info
8. Reviewer clicks Approve or Reject (optional rejection reason)
9. On approval: execution resumes from HITL node, approval context passed to outputs
10. On rejection: execution fails gracefully, rejection reason returned to embed
11. On timeout: `onTimeout` policy applied (cancel | auto-approve | escalate)

**Dashboard approvals page** (`/approvals`)
- List of all pending, approved, rejected approvals with filters
- Click approval → detail view with full context snapshot
- Approve / Reject buttons with optional note
- Bulk approve (for batch scenarios, Phase 3)

**Notification channels (MVP)**
- Email: plain-text email with approve/reject links (token-signed, one-click)
- Dashboard: real-time badge on `/approvals` nav item

---

## 6. Embedded Chat Widget

### What it is
A JavaScript widget embedded in the company's product via a single script tag. White-labeled — no Inflection branding by default.

### Requirements

**Embed code (company adds to their product)**
```html
<script>
  window.InflectionConfig = {
    workspaceId: "ws_abc123",
    token: "eyJhbGc...", // company-signed JWT
    mode: "both",        // "a" | "b" | "both"
    theme: {
      primaryColor: "#1a56db",
      agentName: "Aria",
      poweredBy: false
    }
  };
</script>
<script src="https://embed.inflection.ai/v1/widget.js" async></script>
```

**Widget UI**
- Floating button (bottom-right by default) with agent avatar/icon
- Click → chat panel slides up (300ms ease)
- Chat panel: 380px wide, full viewport height on mobile
- Message thread: user messages on right, agent on left
- Agent messages support markdown rendering (bold, lists, code blocks)
- Streaming: agent message appears word by word as LLM generates
- Input bar at bottom with send button and Enter key support
- Typing indicator (animated dots) while execution running

**Mode A behavior**
- User sends message → execution triggered → response streamed back
- If HITL triggered: message shown — "Waiting for approval from your team. We'll notify you at [email] when it's done."

**Mode B behavior**
- On first open (or when user navigates to "My Agents"): "What would you like your agent to do?"
- User types intent in plain English
- Loading state: "Let me set that up for you..."
- Confirmation screen:
  - Shows what the agent will do (bullet list)
  - Shows schedule if applicable: "Runs every morning at 9am"
  - Shows what actions it will take (from action list)
  - "Create Agent" and "Cancel" buttons
- On confirm: personal agent created, success message + agent appears in "My Agents" list
- "My Agents" tab shows list of user's personal agents:
  - Name, status (active/paused), last run time, next run time
  - Click → agent detail: description, run history (last 10 executions), pause/resume/delete buttons

**SDK customization API (full list)**
```ts
InflectionEmbed.init({
  workspaceId: string;          // REQUIRED
  token: string;                // REQUIRED — company-signed JWT
  mode: "a" | "b" | "both";    // default "both"
  palette?: string[];           // optional — filter which flows are in Mode B palette
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    fontFamily?: string;
    logoUrl?: string;
    agentName?: string;
    welcomeMessage?: string;
    placeholderText?: string;
    poweredBy?: boolean;        // default false
  };
  position?: "bottom-right" | "bottom-left" | "inline";
  containerId?: string;         // for inline mode
  defaultOpen?: boolean;        // open widget on load
  onAgentCreated?: (agent: PersonalAgent) => void;
  onExecutionStarted?: (executionId: string) => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
  onError?: (error: EmbedError) => void;
  onApprovalRequired?: (request: ApprovalRequest) => void;
});

InflectionEmbed.open();
InflectionEmbed.close();
InflectionEmbed.toggle();
InflectionEmbed.sendMessage(text: string);   // programmatic message send
InflectionEmbed.destroy();
```

**Widget security**
- JWT verified on every request using workspace public key
- CORS: only requests from `workspace.embedOrigins` domains accepted
- Content Security Policy headers set on widget.js response
- No Inflection cookies set on embedding company's domain

---

## 7. Mode B — Personal Agent Creation

### What it is
The B2B2C differentiator. End users describe what they want in plain English and Inflection creates a personalized agent on their behalf, constrained to the tools the company allows.

### Requirements

**Intent parsing**
- User's message sent to LLM with a structured system prompt containing:
  - The company's palette (list of available flows with descriptions)
  - The company's guardrails (what's allowed)
  - Instructions to extract: trigger type, schedule (if any), actions needed, parameters
- LLM returns a structured agent config (JSON)
- If the intent cannot be mapped to available tools: LLM explains what it can and can't do, no agent created

**Guardrail check**
- Before showing the confirmation screen, the proposed agent config is validated:
  - Every action in the config must be in the company's allowlist
  - No actions in the denylist
  - Rate limits won't be immediately exceeded
- If guardrail fails: "Sorry, I can't set that up — [specific reason]."

**Confirmation flow**
- Confirmation screen shown before any agent is created (never auto-create)
- Screen shows:
  - Agent name (LLM-generated, user can edit inline)
  - What it will do (plain English summary, not technical details)
  - Schedule: "Runs every morning at 9am" or "Runs when you ask"
  - Actions it will take: icon + label list (e.g., "Check your Plaid balance", "Send you an email")
- User can edit schedule before confirming (time picker)
- "Create" button → PersonalAgent + PersonalAgentVersion created, Schedule registered

**Agent management (in widget)**
- "My Agents" section in widget navigation
- List view: agent name, status badge, last run relative time, next run time
- Agent detail (tap to open):
  - Description
  - Run history: last 10 executions with status, timestamp, duration, output summary
  - Edit button → modify schedule or parameters (creates new version)
  - Pause / Resume toggle
  - Delete (with confirmation)

**Editing an agent**
- User can change: schedule, threshold values, notification preferences
- Each edit creates a new `PersonalAgentVersion`
- Rollback: agent detail shows version history, user can revert to any prior version

---

## 8. Scheduler

### What it is
Cron-based execution of personal agents (Mode B) and optionally scheduled Mode A flows.

### Requirements

- BullMQ + Redis backing store
- Each active `Schedule` has a corresponding BullMQ repeatable job
- On schedule fire: create `agent_execution` (trigger: `scheduled`) → enqueue execution job
- When schedule status changes to `paused`: remove BullMQ repeatable job
- When schedule resumes: re-register BullMQ job with same cron expression
- When personal agent is deleted: cancel all associated schedules + jobs
- Timezone support: cron expression stored with timezone, BullMQ job fires at correct UTC time
- Missed runs (server was down): skip missed runs, fire next scheduled occurrence
- Dashboard shows: last run time, next run time, execution success rate (last 30 days)

---

## 9. Memory

### What it is
Persistent key-value store for per-user or per-agent data that survives across executions.

### Requirements

- Memory Node in canvas: operation (read/write/delete), scope (user/agent/workspace), key, optional TTL
- Keys are strings; values are any JSON-serializable type
- Dynamic keys: `alert_threshold_{{endUserId}}` interpolated at runtime
- TTL: records auto-deleted after expiry (background sweeper job, runs every hour)
- Read returns `{ value, exists }` — exists=false if key not set or expired, value=null
- No size limit per key in MVP (practical limit: Postgres JSONB ~255MB per cell)
- Memory contents never included in audit events (only the key name and operation are logged)

---

## 10. Audit Log

### What it is
Immutable, PII-redacted, hash-chained record of every state change in every execution. Required for financial compliance.

### Requirements

**What gets logged**
- Every execution start and completion
- Every node start, completion, and failure
- Every guardrail decision (ALLOW / DENY / HOLD)
- Every approval request and resolution
- Every kill switch toggle
- Every connector credential access (just the access, not the credential)

**PII redaction**
- Automatic redaction before writing:
  - Credit card numbers (PAN masking: keep first 6 + last 4)
  - SSN / Tax ID patterns
  - Email addresses in connector responses
  - Phone numbers
  - Account numbers
- Redaction applied to `inputSnapshot` and `outputSnapshot` in execution steps
- Original data never written to audit log

**Integrity**
- Hash chain: each row's `prevHash` = SHA-256 of the previous row's `rowHash`
- `rowHash` = SHA-256(id + workspaceId + executionId + eventType + outcome + prevHash)
- Genesis row: prevHash = "0000...0000"
- Chain can be verified at any time via `/api/ws/{id}/audit/verify`

**Retention**
- Retained for 7 years (financial compliance minimum)
- Postgres append-only (no UPDATE or DELETE via database trigger)
- Future: export to S3 Object Lock for WORM storage (Phase 4)

**Dashboard audit log page** (`/audit-logs`)
- Table with filters: date range, execution ID, user, outcome, event type
- Click row → full detail view (full JSON payload, hash verification status)
- Export to CSV (filtered results)

---

## 11. Analytics

### What it is
Basic observability for companies to understand how their deployed agents are performing.

### MVP requirements (minimal — enough for design partner)

**Dashboard page** (`/analytics`)
- 4 stat cards: Total Executions (last 30d), Success Rate, Avg Duration, Estimated Cost
- Execution volume chart: line chart, daily, last 30 days, grouped by status
- Top flows by execution count
- Approval resolution time average

Phase 3 additions (not MVP):
- Per-user analytics
- Token usage by model
- Failure breakdown by node type
- Evaluator / quality scoring
