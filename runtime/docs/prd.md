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

---

## 12. Dashboard — Page Reference

### Overview

The Inflection dashboard is the web application companies use to build, manage, and observe their deployed agents. Navigation is a left sidebar with the following top-level items:

```
Home
Flows
Connectors
Knowledge Bases       (Phase 3)
Approvals
Analytics
Manager View          (Phase 3)
Evaluator             (Phase 3)
Audit Logs
Settings
  └── Team
  └── Guardrails
  └── API Keys
  └── Billing
  └── Integrations
```

---

### Home (`/`)

**Purpose:** Single-glance health check. First page seen on login.

**Data shown:**
- **5 stat cards (last 7 days):**
  - Total Executions (delta vs. prior 7d, ↑ or ↓ badge)
  - Success Rate (% and absolute count failed)
  - Pending Approvals (count — links to `/approvals`)
  - Active Personal Agents (Mode B agents across all end users)
  - Estimated LLM Cost (USD, last 7d)
- **Execution sparkline** — 7-day daily bar chart, stacked: completed / failed / cancelled
- **Recent activity feed** — last 20 events across all flows: execution started, approval requested, kill switch toggled, connector revoked, new flow published. Each row shows: event type icon, description, who triggered it, how long ago. Click → detail.
- **Kill switch banner** — if any kill switch is ON, a full-width red banner shows at top with the affected agent name and a "Turn Off" button
- **Pending approvals callout** — if there are pending approvals, an amber card shows count + "Review Now" link
- **Quick actions:**
  - New Flow
  - Add Connector
  - Invite Team Member

---

### Flows (`/flows`)

**Purpose:** Browse, manage, and publish all flows for this workspace.

**Data shown:**

**Flow list (table):**
| Column | Description |
|---|---|
| Name | Flow name, clickable → opens canvas |
| Status badge | Draft / Dev / Staging / Production |
| Last published | Relative timestamp of last promotion to production |
| Last edited | Relative timestamp + "by [user]" |
| Executions (24h) | Run count badge (last 24 hours) |
| Success rate (24h) | % success, colored: green ≥95%, yellow 80–95%, red <80% |
| Created by | Avatar + name |
| Actions | Edit, Duplicate, Archive (kebab menu) |

**Filters:** status (All / Draft / Dev / Staging / Production / Archived), created by, search by name.

---

### Flow Editor (`/flows/:flowId`)

**Purpose:** The visual canvas where company builders author, test, and publish agent flows. This is the primary creation surface — the Stack AI-equivalent canvas.

**Layout (3-panel):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar (top bar)                                              │
├───────────────┬─────────────────────────────────┬──────────────┤
│               │                                 │              │
│  Node Sidebar │         Canvas (center)         │  Inspector   │
│  (left, 260px)│         (fills remaining)       │  (right,     │
│               │                                 │   320px)     │
│               │                                 │              │
└───────────────┴─────────────────────────────────┴──────────────┘
```

---

**Toolbar (top bar)**

Left side:
- Flow name (editable inline — click to rename, blur to save)
- Stage badge — Draft / Dev / Staging / Production (color-coded)
- Unsaved changes dot (gray dot appears when there are uncommitted edits)

Center:
- Undo (Cmd+Z) and Redo (Cmd+Y) buttons with keyboard shortcut tooltips
- Auto-layout button (Dagre, left-to-right arrangement)
- Fit view button (zoom to fit all nodes)
- Grid toggle (show/hide snap grid)
- Zoom level display (e.g., "85%") with +/− buttons

Right side:
- **Test Run** button — runs the full flow in sandbox with a sample input; opens the Execution Detail drawer inline
- **Save** button (Cmd+S) — saves current draft; shows "Saved" confirmation for 2 seconds
- **Promote** dropdown → options depend on current stage:
  - Draft → "Promote to Dev"
  - Dev → "Promote to Staging"
  - Staging → "Promote to Production" (requires diff review modal)
- **Version History** button → opens right drawer
- **Flow settings** (gear icon) → name, description, kill switch toggle for this flow

---

**Node Sidebar (left panel)**

Top: search input — filters all node types and connector actions by name.

Sections (collapsible):

| Section | Nodes |
|---|---|
| **Your Connectors** | One entry per custom connector the workspace has imported. Expandable — shows each enabled action as a draggable chip. |
| **Flow Control** | Input, Output, If/Else (MVP); Loop, AI Routing, Merge, Delay (Phase 2) |
| **AI** | LLM Node (MVP); Knowledge Base (Phase 2) |
| **Memory** | Memory Node, Variable Node |
| **HITL** | HITL Node |
| **Native Connectors** | Plaid, Stripe, HTTP Request (MVP); financial, ERP, calendar, communication (Phase 2) |
| **Code** | Code Node — Python or TypeScript inline (Phase 2) |
| **Subflow** | Call another published flow as a sub-agent (Phase 2) |

Each node entry:
- Icon (colored by category) + name
- Subtitle (connector name for connector actions)
- Drag from sidebar → drop on canvas to instantiate

When a connector is not yet connected (no credentials saved), its nodes show a lock icon. Dragging one prompts: "Connect [ConnectorName] first — Add credentials."

---

**Canvas (center)**

The infinite 2D workspace where builders compose flows by placing and wiring nodes.

**Canvas interaction:**
- Pan: click and drag on empty canvas
- Zoom: scroll wheel or pinch on trackpad
- Select node: click (highlights node, opens Inspector)
- Multi-select: shift+click or drag selection box
- Move node: drag selected node
- Delete node: select + Backspace/Delete
- Duplicate node: Cmd+D
- Copy/paste: Cmd+C / Cmd+V (preserves node config)
- Minimap: bottom-right corner — shows full flow layout, click to jump

**Node anatomy (on canvas):**

```
┌──────────────────────────────────┐
│  ●  Plaid — getBalance           │  ← header: icon + connector + action
│  ─────────────────────────────── │
│  account_id: {{input.accountId}} │  ← config preview (first 2 fields)
│  ...                             │
├──────────────────────────────────┤
│  ○ output ────────────────────── │  ← output port (right)
└──────────────────────────────────┘
    ────────────── ○ input           ← input port (left)
```

- Status ring on node header: gray (not run), green (last test passed), red (last test failed), yellow (running)
- Port colors match data type: string=blue, number=green, boolean=yellow, object=purple, any=gray
- Connecting: drag from output port → hover over input port → release to connect
- Invalid connection: port turns red with tooltip explaining type mismatch (warning, not blocked in MVP)
- Edge: drawn as a bezier curve; click edge to highlight, press Delete to remove
- Edge label (hover): shows the data type flowing through that wire

**Node status indicators (during test runs):**
- Pulse animation on the running node's border
- Checkmark overlay on completion
- X overlay on failure with red border
- Token stream appears below LLM nodes during generation (word by word)

---

**Node Inspector (right panel)**

Opens when a node is selected. Closes when clicking empty canvas.

**Inspector tabs:**

| Tab | Content |
|---|---|
| **Config** | The node's configuration form (default tab) |
| **Test** | Run this node in isolation with sample data |
| **Docs** | Reference docs for this node type / connector action |

**Config tab — common fields across all nodes:**
- Node display name (editable — shown on the canvas header)
- Node description (optional — shown in Mode B palette if node is exposed to end users)

**Config tab — per node type:**

*LLM Node:*
- Model selector (Claude Sonnet 4.6 / Claude Opus 4.7 / GPT-4o / Gemini 2.0 Flash / custom)
- API key (select from saved keys or enter inline)
- System prompt (multi-line code editor with `{{variable}}` syntax highlighting)
- Temperature (0–2 slider)
- Max tokens (number input)
- Output format: Text / JSON (with JSON schema editor when JSON selected)
- Streaming: on/off toggle

*Connector Node (e.g., Plaid — getBalance):*
- Connector selector (pre-set to the node's connector, change to swap)
- Action selector (pre-set, change to swap action)
- Per-parameter inputs: each shows the parameter name, type badge, required indicator, and an input field that accepts literal values or `{{variable}}` references
- "Map from upstream node" — click any field → dropdown of all upstream node output paths

*If/Else Node:*
- Condition builder: left operand (variable picker) + operator (equals, contains, greater than, etc.) + right operand (literal or variable)
- Add condition row (AND / OR)
- True branch label + False branch label (editable)

*HITL Node:*
- Approval message template (what reviewers see)
- Timeout: duration input + on-timeout policy (cancel / auto-approve / escalate)
- Notification channels: Email (recipient list) / Slack channel / Dashboard only
- Outputs: `approved` (boolean), `reviewer_note` (string), `reviewer_id` (string)

*Input Node:*
- Input schema: add fields (name, type, required, description)
- Each field becomes an output port on the node
- Sample data (JSON editor) — used during test runs when no real trigger exists

*Output Node:*
- Output format: plain text / JSON / markdown
- Map output fields from upstream nodes (drag-and-drop field mapping or `{{variable}}` syntax)

*Memory Node:*
- Operation: Read / Write / Delete
- Scope: user / agent / workspace
- Key: string or `{{variable}}` interpolated key
- TTL (Write only): duration in seconds, or blank for no expiry

**Test tab:**
- Sample input JSON editor (pre-populated from Input Node schema)
- "Run this node" button — executes just this node in isolation using connected credentials
- Output panel: raw JSON response, formatted; token usage for LLM nodes; duration
- Error panel (if failed): error type, message, stack trace (dev mode only)

**Docs tab:**
- Connector: action description, all parameters with types and descriptions, example response JSON
- LLM node: link to model provider docs
- Logic nodes: plain-English explanation of behavior + example

---

**Version History (right drawer — toggled from toolbar)**

- List of all `FlowVersion` records for this flow
- Each entry:
  - Version number (v1, v2, v3…)
  - Stage it was promoted to (Dev / Staging / Production)
  - Promoted by (avatar + name)
  - Timestamp
  - Commit message (editable at promote time)
  - "View diff" → opens diff modal (changed / added / removed nodes shown side-by-side)
  - "Restore this version" → creates a new draft from this version's node graph
- Current production version: highlighted with a green "LIVE" badge
- Current working draft: shown at top with "Unsaved changes" count if dirty

---

**Promote to Production modal**

Triggered by "Promote to Production" in the toolbar dropdown. Requires a staged version.

**Modal content:**
- Diff summary: N nodes changed, M nodes added, P nodes removed
- Diff detail: expandable list per changed node — what config fields changed and how
- "What's changed" text field (required commit message)
- Checklist (auto-validated before enabling confirm button):
  - ☐ At least one Input node present
  - ☐ At least one Output node present
  - ☐ No disconnected nodes (nodes with unwired required ports)
  - ☐ All required connector credentials are connected
- Confirm button: "Publish to Production"
- On confirm: new `FlowVersion` created, stage set to production, prior production version archived

---

**Flow Settings modal (gear icon)**

- Flow name
- Flow description
- Kill switch toggle — when ON, all executions of this flow are immediately blocked; dashboard shows red banner
- Mode B exposure — toggle: "Allow end users to create personal agents from this flow" (adds flow to the Mode B palette)
- If Mode B exposed: palette description (plain English — LLM uses this for intent parsing; bad description = bad matching)
- Delete flow (danger zone) — requires typing flow name to confirm; only available to Admins

---

### Connectors (`/connectors`)

**Purpose:** Manage all authenticated API connections the workspace uses.

**Data shown:**

Two tabs: **Native Connectors** and **Your Connectors** (custom)

**Native connectors tab (table):**
| Column | Description |
|---|---|
| Connector | Icon + name (Plaid, Stripe, etc.) |
| Status | Connected / Error / Revoked |
| Credential | Masked value (e.g., `sk_live_****abcd`) |
| Last tested | Relative timestamp + pass/fail badge |
| Used in | Count of flows referencing this connector |
| Actions | Test, Edit credentials, Revoke |

**Your connectors tab (table):**
| Column | Description |
|---|---|
| Connector | Icon (auto or uploaded) + name |
| Actions | Count of enabled actions |
| Last synced | For OpenAPI-imported connectors |
| Status | Active / Partial (some actions failed) / Revoked |
| Used in | Count of flows referencing this connector |
| Actions | Re-sync, Edit, View actions, Revoke |

**Connector detail drawer** (click any connector):
- Auth config summary (masked)
- Action list — each action shows: name, description, enabled toggle, "end users can access" toggle, "requires approval" toggle, last tested status
- Per-action test button — runs action with sample data, shows raw response JSON

See Section 2 (Connector Library) and Section 2a (Custom Connector Import) for full authoring requirements.

---

### Approvals (`/approvals`)

**Purpose:** Review and resolve pending HITL approval requests.

**Data shown:**

**Tabs:** Pending (default) | Approved | Rejected | All

**Approval list (table):**
| Column | Description |
|---|---|
| ID | Short approval ID, clickable |
| Flow | Flow name that triggered the request |
| Action | Connector + action (e.g., `stripe.createCharge`) |
| Requested by | End user identifier (external ID or masked email) |
| Amount | If monetary action (e.g., "$250.00") |
| Requested | Relative timestamp |
| Expires | Time remaining until timeout policy fires |
| Status | Pending / Approved / Rejected / Expired |
| Reviewer | Who approved/rejected (if resolved) |

**Filters:** flow, date range, action type, requested by.

**Approval detail view** (`/approvals/:approvalId`):
- Full execution context snapshot (the input values the node received)
- Action description (plain English: "Charge $250.00 to card ending 4242")
- End user info: external ID, name if provided in JWT metadata
- Upstream node outputs (what the flow computed before reaching this HITL node)
- Timeline: when triggered, which notifications sent, when resolved
- Approve button (green) + optional note field
- Reject button (red) + required rejection reason field
- Execution trace link → jumps to the full execution in Analytics

**Bulk approve** — checkbox selection on list → "Approve selected" (Phase 3)

**Notification badge** — `/approvals` nav item shows live count of pending approvals, updated via WebSocket

---

### Analytics (`/analytics`)

**Purpose:** Understand execution volume, performance, cost, and error patterns.

**Time range selector:** Last 24h / 7d / 30d / 90d / Custom range (applies to all charts)

**Data shown:**

**Summary stat cards (row of 4):**
| Card | Metric |
|---|---|
| Total Executions | Count + sparkline trend |
| Success Rate | % + count failed |
| Avg Duration | Median execution time in seconds |
| Estimated Cost | LLM cost in USD (based on token usage × model pricing) |

**Execution volume chart:**
- Line chart, daily data points
- Three series: Completed (green), Failed (red), Cancelled (gray)
- Tooltip shows exact counts per day per status

**Flow performance table:**
| Column | Description |
|---|---|
| Flow | Flow name |
| Executions | Run count in period |
| Success rate | % |
| Avg duration | Median ms |
| P95 duration | 95th percentile |
| Failure count | Clickable → filtered to failed executions for this flow |
| Est. cost | LLM cost USD |

**Error breakdown:**
- Horizontal bar chart: execution failures grouped by error type (node timeout, guardrail denied, connector error, budget exceeded, user cancelled)
- Click bar → execution list filtered to that error type

**Approval metrics:**
- Average time from request to resolution (hours)
- Resolution breakdown: pie chart (approved / rejected / expired)

**Phase 3 additions:**
- Token usage by model (stacked bar: Claude / GPT-4o / Gemini / other)
- Per-end-user analytics (top users by execution count)
- Cost per flow (detailed breakdown)
- Evaluator quality score trend

---

### Execution Detail (`/analytics/executions/:executionId`)

**Purpose:** Full trace of a single execution — every node, every input/output, every timestamp.

**Data shown:**

**Header:**
- Execution ID, flow name, flow version, trigger type (user_message / scheduled / api_call)
- Status badge (completed / failed / cancelled / waiting_approval)
- Start time, end time, total duration
- End user external ID (if triggered by user message)
- Links: parent execution (if subflow), Approval request (if HITL triggered)

**Node execution timeline (main panel):**
- Vertical list of `ExecutionStep` records in execution order
- Each step shows:
  - Node type icon + node name
  - Status badge + duration
  - Input values (collapsed by default, click to expand)
  - Output values (collapsed by default, click to expand)
  - Error message if failed, retry count if retried
  - Token usage (for LLM nodes: prompt tokens, completion tokens, model used)
- LLM nodes: "Show prompt" toggle → reveals full prompt sent (guardrail-redacted if PII)
- Connector nodes: "Show request" toggle → reveals request params (credentials always masked)

**Audit events panel (right sidebar):**
- List of all `AuditEvent` records for this execution
- Each event: type, outcome, timestamp, hash (click to verify against chain)

---

### Manager View (`/manager`) — Phase 3

**Purpose:** Company sees every conversation every end user has had with every deployed agent — across Mode A and Mode B.

**Data shown:**

**Conversation list (table):**
| Column | Description |
|---|---|
| User | End user external ID / display name |
| Agent | Flow name (Mode A) or personal agent name (Mode B) |
| Mode | A or B badge |
| Started | Timestamp |
| Messages | Turn count |
| Status | Completed / In progress / Failed / Waiting approval |
| Duration | Total session time |

**Filters:** mode, flow, date range, status, user search.

**Conversation detail:**
- Full message thread — user messages and agent responses in chronological order
- Agent responses show which nodes ran (expandable)
- HITL gaps shown in thread ("Waiting for approval — 4 hours 12 minutes")
- Execution ID per turn → links to Execution Detail

---

### Evaluator (`/evaluator`) — Phase 3

**Purpose:** Batch-test flows against a dataset of expected inputs/outputs. Measure quality. Compare versions.

**Data shown:**

**Test suites list:**
- Name, flow it tests, last run date, last run result (pass/fail/partial), dataset size

**Test suite detail:**
- **Dataset tab** — table of test cases: input, expected output, last actual output, grade (Pass / Fail / Partial)
- **Runs tab** — history of evaluation runs: when run, flow version tested, pass rate, avg score
- **Run detail** — per-test-case result: input sent → output received → LLM judge score (0–100) → reasoning

**Run a new evaluation:**
- Select flow version (defaults to latest production)
- Select dataset (existing or upload CSV)
- Select grading method: exact match, LLM judge (uses Claude to compare), regex
- Run → background job → email when complete

**Version comparison view:**
- Side-by-side: Version A vs. Version B pass rates per test case
- Highlighted regressions (cases that pass in A but fail in B)

---

### Audit Logs (`/audit-logs`)

**Purpose:** Immutable compliance record of every state change across all executions.

**Data shown:**

**Filter bar:**
- Date range picker
- Execution ID (exact match)
- End user (external ID search)
- Event type (multi-select: execution.started, node.completed, guardrail.denied, approval.requested, approval.resolved, kill_switch.toggled, connector.accessed)
- Outcome (ALLOW / DENY / HOLD)

**Audit log table:**
| Column | Description |
|---|---|
| Timestamp | UTC timestamp, ms precision |
| Event type | Icon + label |
| Outcome | ALLOW (green) / DENY (red) / HOLD (yellow) |
| Execution ID | Clickable → Execution Detail |
| Actor | End user external ID or system |
| Description | Plain-English summary of the event |
| Hash | First 8 chars of row hash, with copy button |

**Row detail view (click row):**
- Full JSON payload (all fields except PII, which shows `[REDACTED]`)
- Hash chain fields: `rowHash`, `prevHash`
- "Verify hash" button — recomputes hash client-side and confirms it matches stored value
- Chain integrity status for this row

**Export:**
- "Export CSV" button — exports all rows matching current filter (max 100k rows)
- Includes all non-PII fields

---

### Settings — Team (`/settings/team`)

**Purpose:** Manage who has access to the workspace and what they can do.

**Data shown:**

**Members table:**
| Column | Description |
|---|---|
| Name | Avatar + display name |
| Email | |
| Role | Admin / Editor / Viewer |
| Last active | Relative timestamp |
| MFA | Enabled / Not set badge |
| Actions | Change role, Remove |

**Roles:**
| Role | Permissions |
|---|---|
| Admin | All permissions including billing, team management, kill switch, connector revoke |
| Editor | Build flows, add connectors, configure guardrails; cannot manage team or billing |
| Viewer | Read-only — can view flows, analytics, audit logs; cannot edit or publish |

**Invite section:**
- Email input + role selector + "Send Invite" button
- Pending invites list with resend / revoke options
- SSO enforcement toggle (when ON, only SSO login allowed; password login blocked)
- SCIM provisioning config (Phase 4)

---

### Settings — Guardrails (`/settings/guardrails`)

See Section 3 (Guardrail Configuration) for full requirements. Summary of data shown:

- Action allowlist editor (connector → action tree with enable/disable toggles)
- Action denylist editor (same tree, always-blocked actions highlighted red)
- HITL-required actions list (always insert approval gate for these)
- Rate limit config (max executions / user / day and / user / hour)
- Budget cap config (max LLM cost USD per execution + on-exceed behavior)
- Kill switch toggle (with confirmation dialog — shows active execution count before toggling)

---

### Settings — API Keys (`/settings/api-keys`)

**Purpose:** Manage keys for direct API access and embedding.

**Data shown:**

**API keys table:**
| Column | Description |
|---|---|
| Name | Descriptive label set on creation |
| Key | Masked (e.g., `inf_live_****abcd`) |
| Created | Date |
| Last used | Relative timestamp or "Never" |
| Permissions | Read-only / Read+Write |
| Actions | Copy key (one-time, shown on creation), Revoke |

**Embed credentials section:**
- Workspace ID (copyable)
- Public key (used by SDK to verify company-signed JWTs)
- "Rotate public key" button (with warning: requires updating all embed deployments)
- Allowed embed origins list (domains that may load the widget) — add / remove

---

### Settings — Billing (`/settings/billing`)

**Purpose:** View usage, invoices, and manage payment method.

**Data shown:**

**Current billing period card:**
- Period dates
- Executions consumed / included in plan
- Estimated overage charge
- Next invoice date + estimated amount

**Usage breakdown:**
- Executions by flow (table)
- LLM token usage by model
- Connector call count by connector

**Invoice history table:**
- Date, period, amount, status (Paid / Due / Failed), PDF download link

**Payment method:**
- Current card (masked) or bank account
- Update payment method button
- Billing email + billing address

---

### Settings — Integrations (`/settings/integrations`)

**Purpose:** Configure workspace-level integrations used for notifications and team workflows (distinct from data connectors, which live in `/connectors`).

**Data shown:**

**Notification integrations:**
| Integration | What it does |
|---|---|
| Email (SendGrid) | Approval request emails, failure alerts, invite emails |
| Slack | Approval request notifications, kill switch alerts, weekly digest |
| PagerDuty | On-call alerts for critical execution failures (Phase 3) |
| Webhook | POST to company's own endpoint on any Inflection event |

Each integration row: status (Connected / Not connected), configure button, test button.

**Slack integration config:**
- OAuth connect button → installs Inflection app to company Slack
- Channel selector for approval notifications
- Channel selector for failure alerts
- Optional: DM the requester's Slack user directly (if Slack identity matches)

**Webhook config:**
- Endpoint URL
- Events to send (multi-select: approval.requested, execution.failed, kill_switch.toggled, etc.)
- Secret for HMAC signature verification
- Last 10 delivery attempts (timestamp, status code, response preview)
