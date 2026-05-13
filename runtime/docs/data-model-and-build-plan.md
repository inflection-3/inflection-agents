# Inflection — Data Model, Technical Flows & Feature Build Plan

_The full technical blueprint. Read this before writing any code._

---

## 1. FULL DATA MODEL

### Company & Workspace

```
Company
  ├── id                        UUID
  ├── name                      string
  ├── slug                      string (used in API paths)
  ├── status                    enum: trial | active | suspended | offboarded
  ├── tier                      enum: starter | enterprise
  ├── contractStartDate         date
  ├── contractEndDate           date
  ├── dataRegion                enum: us-east-1 | eu-west-1 | ap-southeast-1
  ├── dbConnectionString        string (pointer to their isolated Postgres)
  ├── vaultPath                 string (their HashiCorp Vault namespace)
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp

Workspace
  ├── id                        UUID
  ├── companyId                 FK → Company
  ├── environment               enum: sandbox | staging | production
  ├── name                      string
  ├── apiKey                    string (hashed, used for API auth)
  ├── isActive                  boolean
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp

TeamMember
  ├── id                        UUID
  ├── companyId                 FK → Company
  ├── email                     string
  ├── role                      enum: admin | developer | auditor
  ├── status                    enum: invited | active | deactivated
  ├── createdAt                 timestamp
  └── lastLoginAt               timestamp
```

---

### Connectors & Skills

```
Connector
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── name                      string (e.g. "Plaid", "Company Core Banking API")
  ├── type                      enum: oauth | api_key | mtls | custom
  ├── baseUrl                   string
  ├── authConfig                JSON (auth flow definition — no secrets stored here)
  ├── secretRef                 string (pointer to HashiCorp Vault path for credentials)
  ├── status                    enum: draft | testing | active | deprecated
  ├── currentVersion            string (semver)
  ├── isFromMarketplace         boolean
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp

ConnectorVersion
  ├── id                        UUID
  ├── connectorId               FK → Connector
  ├── version                   string (semver e.g. "1.2.0")
  ├── changelog                 string
  ├── authConfig                JSON (snapshot of this version's auth config)
  ├── isBreakingChange          boolean
  ├── migrationGuide            text (shown to users if breaking)
  ├── publishedAt               timestamp
  └── deprecatedAt              timestamp (nullable)

Skill
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── connectorId               FK → Connector
  ├── name                      string (e.g. "Get Account Balance")
  ├── markdownContent           text (the skill definition file)
  ├── status                    enum: draft | shadow_testing | active | deprecated
  ├── currentVersion            string (semver)
  ├── isFromMarketplace         boolean
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp

SkillVersion
  ├── id                        UUID
  ├── skillId                   FK → Skill
  ├── version                   string (semver)
  ├── markdownContent           text (snapshot)
  ├── shadowTestResults         JSON (pass/fail + details from validation run)
  ├── isBreakingChange          boolean
  ├── migrationGuide            text
  ├── publishedAt               timestamp
  └── deprecatedAt              timestamp (nullable)

MarketplaceConnector
  ├── id                        UUID
  ├── name                      string (e.g. "Plaid", "Stripe", "Jumio")
  ├── category                  enum: banking | payments | kyc | communications | storage
  ├── logoUrl                   string
  ├── description               text
  ├── authType                  enum: oauth | api_key | mtls
  ├── currentVersion            string
  ├── tier                      enum: starter | enterprise (who can access it)
  └── isActive                  boolean
```

---

### System Prompt & Guardrails

```
SystemPrompt
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── content                   text (auto-generated from skills + connectors)
  ├── version                   string (increments each time skills/connectors change)
  ├── generatedAt               timestamp
  └── generatedBy               enum: auto | manual_override

Guardrail
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── name                      string
  ├── type                      enum: skill_allowlist | skill_denylist | rate_limit | budget_cap | require_approval
  ├── config                    JSON (type-specific config)
  │     skill_allowlist:        { skillIds: string[] }
  │     skill_denylist:         { skillIds: string[] }
  │     rate_limit:             { maxExecutionsPerUser: int, windowHours: int }
  │     budget_cap:             { maxCostPerExecution: float, onHit: "stop" | "stop_and_notify" }
  │     require_approval:       { skillIds: string[], notifyVia: "email" | "slack", approvers: string[] }
  ├── isActive                  boolean
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp
```

---

### End Users & Sessions

```
EndUser
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── externalId                string (company's own user ID, from JWT)
  ├── metadata                  JSON (injected context: account ID, tier, balance, etc.)
  ├── firstSeenAt               timestamp
  └── lastActiveAt              timestamp

Session
  ├── id                        UUID
  ├── endUserId                 FK → EndUser
  ├── workspaceId               FK → Workspace
  ├── jwtToken                  string (hashed reference)
  ├── context                   JSON (injected context for this session)
  ├── status                    enum: active | expired | terminated
  ├── createdAt                 timestamp
  └── expiresAt                 timestamp
```

---

### Agents

```
Agent
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── endUserId                 FK → EndUser (agent belongs to the end user, not company)
  ├── name                      string
  ├── description               text (plain English from user)
  ├── currentVersion            string (semver)
  ├── schedule                  string (nullable — cron expression e.g. "0 9 * * 0" for every Sunday 9am)
  ├── isActive                  boolean
  ├── memory                    JSON (persistent across runs)
  ├── createdAt                 timestamp
  └── updatedAt                 timestamp

AgentVersion
  ├── id                        UUID
  ├── agentId                   FK → Agent
  ├── version                   string (semver)
  ├── systemPromptVersion       string (which system prompt version this was built on)
  ├── skillVersions             JSON (map of skillId → pinnedVersion)
  ├── connectorVersions         JSON (map of connectorId → pinnedVersion)
  ├── agentConfig               JSON (full agent configuration snapshot)
  ├── llmConnectorId            FK → Connector (which LLM this agent uses)
  ├── createdAt                 timestamp
  └── createdBy                 string (endUserId)
```

---

### Executions & Audit

```
AgentExecution
  ├── id                        UUID
  ├── agentId                   FK → Agent
  ├── agentVersionId            FK → AgentVersion
  ├── sessionId                 FK → Session
  ├── endUserId                 FK → EndUser
  ├── workspaceId               FK → Workspace
  ├── triggerType               enum: user_message | scheduled | sub_agent
  ├── input                     text (redacted if PII detected)
  ├── output                    text (redacted if PII detected)
  ├── status                    enum: queued | running | awaiting_approval | completed | failed | cancelled
  ├── totalCostUsd              float (LLM cost, from company's own API key usage)
  ├── startedAt                 timestamp
  ├── completedAt               timestamp (nullable)
  └── failureReason             text (nullable)

ExecutionStep
  ├── id                        UUID
  ├── executionId               FK → AgentExecution
  ├── stepIndex                 int (order of steps)
  ├── type                      enum: llm_call | skill_call | sub_agent_call | human_approval | memory_read | memory_write
  ├── skillId                   FK → Skill (nullable)
  ├── skillVersion              string (nullable)
  ├── input                     JSON (redacted)
  ├── output                    JSON (redacted)
  ├── reasoning                 text (LLM reasoning trace, redacted)
  ├── status                    enum: running | completed | failed | retrying
  ├── retryCount                int
  ├── durationMs                int
  ├── startedAt                 timestamp
  └── completedAt               timestamp

ApprovalRequest
  ├── id                        UUID
  ├── executionId               FK → AgentExecution
  ├── executionStepId           FK → ExecutionStep
  ├── workspaceId               FK → Workspace
  ├── requestedAction           text (what the agent is trying to do)
  ├── context                   JSON (relevant data for approver to make decision)
  ├── notifyVia                 enum: email | slack
  ├── notifyTargets             string[] (email addresses or Slack user IDs)
  ├── status                    enum: pending | approved | rejected | expired
  ├── approvedBy                string (nullable)
  ├── approvedAt                timestamp (nullable)
  ├── expiresAt                 timestamp
  └── createdAt                 timestamp

AuditLog
  ├── id                        UUID
  ├── workspaceId               FK → Workspace (also written to S3 Object Lock)
  ├── executionId               FK → AgentExecution
  ├── eventType                 enum: execution_started | step_completed | approval_requested | approval_granted | execution_completed | execution_failed | agent_killed | rate_limit_hit | budget_cap_hit
  ├── actorType                 enum: end_user | agent | system | company_admin
  ├── actorId                   string
  ├── payload                   JSON (full event data, PII redacted)
  ├── checksum                  string (SHA-256 of payload for tamper detection)
  └── createdAt                 timestamp (immutable)
```

---

### Platform Controls

```
KillSwitch
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── scope                     enum: agent | all_agents
  ├── agentId                   FK → Agent (nullable — null means all agents)
  ├── triggeredBy               FK → TeamMember
  ├── reason                    text
  ├── isActive                  boolean
  ├── triggeredAt               timestamp
  └── liftedAt                  timestamp (nullable)

RateLimit
  ├── id                        UUID
  ├── workspaceId               FK → Workspace
  ├── endUserId                 FK → EndUser (nullable — null means workspace-wide)
  ├── windowHours               int
  ├── maxExecutions             int
  ├── currentCount              int
  └── windowResetAt             timestamp
```

---

## 2. ALL TECHNICAL FLOWS

### Flow 1: Company Onboarding

```
1. Sales call completed → Inflection creates Company record
2. Inflection provisions isolated Postgres instance for company
3. Inflection creates Vault namespace for company's secrets
4. Admin invite email sent to company's admin
5. Admin signs up → creates TeamMember (role: admin)
6. Admin creates Workspace (sandbox first)
7. Guided onboarding session begins:
   a. Company connects first Connector (OAuth flow or API key paste)
      → Credentials stored in HashiCorp Vault under company's namespace
      → Connector record created (status: draft)
   b. Company writes first Skill markdown file
      → Skill record created (status: draft)
      → Shadow test triggered automatically
      → Shadow test passes → Skill status: active
   c. Inflection auto-generates SystemPrompt from active skills + connectors
   d. Company configures Guardrails (what end users can/can't do)
8. Company creates staging Workspace → repeats connector setup
9. Company creates production Workspace → production connectors set up
10. Company gets embed code (web component script tag) for their product
11. Company goes live
```

---

### Flow 2: Connector Setup (OAuth)

```
1. Company selects connector from Marketplace (or creates custom)
2. If OAuth:
   a. Inflection redirects to third-party OAuth consent screen
   b. Company authenticates with third-party
   c. Access token + refresh token returned
   d. Tokens stored in HashiCorp Vault under company's Vault path
   e. Connector record created with secretRef pointing to Vault path
3. If API Key:
   a. Company pastes API key into dashboard
   b. Key stored in Vault
   c. Connector record created with secretRef
4. Inflection runs a shadow test (real API call with test payload)
5. Pass → Connector status: active
6. Fail → Company shown error + guidance
```

---

### Flow 3: Skill Validation (Shadow Test)

```
1. Company submits Skill markdown file
2. Inflection parses the markdown for:
   - Which connector it references
   - What actions it describes
   - What inputs/outputs it expects
3. Inflection generates a test payload based on the skill definition
4. Test payload sent through the connector to the real API (sandbox mode)
5. Response validated against expected output shape from the skill definition
6. Pass:
   → SkillVersion created (status: active)
   → Shadow test results stored on SkillVersion
7. Fail:
   → Error shown in dashboard with specific failure reason
   → Skill stays in draft
8. SystemPrompt regenerated automatically (new version created)
```

---

### Flow 4: End User Authentication

```
1. End user opens company's product (which has Inflection web component embedded)
2. Company's backend generates a signed JWT containing:
   - externalId (company's user ID)
   - workspaceId
   - metadata (account ID, tier, balance, permissions, etc.)
   - expiry
3. JWT passed to Inflection web component on init
4. Web component sends JWT to Inflection API
5. Inflection verifies JWT signature using company's public key
6. Inflection creates or updates EndUser record
7. Inflection creates Session record
8. Session token returned to web component
9. All subsequent requests use session token
```

---

### Flow 5: Agent Creation (End User via Chat)

```
1. End user opens chat UI
2. End user describes what they want in plain English:
   e.g. "Find me cheap hotels every Sunday and book with my card, then email me"
3. Inflection sends description to LLM with:
   - The workspace's SystemPrompt (skills + connectors available)
   - The workspace's Guardrails (what this user is allowed to do)
   - End user's injected context (account info, tier, etc.)
4. LLM interprets intent and maps to available skills:
   - "Find hotels" → search_hotels skill (via Hotels connector)
   - "Book with my card" → create_booking skill (via Payments connector)
   - "Email me" → send_email skill (via Email connector)
5. LLM checks guardrails:
   - Is "create_booking" in the allowlist? Yes
   - Does "create_booking" require approval? Check guardrails
6. Agent config generated:
   - steps: [search_hotels → create_booking → send_email]
   - schedule: "0 9 * * 0" (every Sunday 9am)
   - skillVersions pinned
   - llmConnector set
7. Inflection shows user a summary: "I'll find hotels, book the cheapest one, and email you every Sunday. Confirm?"
8. User confirms
9. Agent record created + AgentVersion created
10. If scheduled: added to job queue
11. Confirmation shown to user in chat
```

---

### Flow 6: Agent Execution (Real-Time)

```
1. User sends message to agent / scheduled trigger fires
2. AgentExecution record created (status: queued)
3. Execution picked up by runtime worker
4. AgentExecution status → running
5. For each step:
   a. ExecutionStep created (status: running)
   b. Step type determined (llm_call / skill_call / sub_agent_call)
   c. If skill_call:
      - Credentials fetched from HashiCorp Vault
      - API call made to external service
      - Response parsed
   d. If requires_approval (Guardrail):
      - ExecutionStep status → paused
      - ApprovalRequest created
      - Notification sent (email / Slack)
      - Execution paused → status: awaiting_approval
      - On approval → execution resumes
      - On rejection → execution cancelled
      - On expiry → execution failed
   e. Step completed → ExecutionStep status: completed
   f. Progress streamed to user in real-time via SSE
   g. AuditLog event written for each step
6. All steps done → AgentExecution status: completed
7. Final output streamed to user
8. Agent memory updated if needed
9. AuditLog event: execution_completed
```

---

### Flow 7: Scheduled Agent Execution

```
1. Cron scheduler checks for agents with schedule = now
2. For each due agent:
   a. Check if agent is active (not kill-switched)
   b. Check rate limits — has end user hit their limit?
   c. Create AgentExecution (triggerType: scheduled)
   d. Push to execution queue
3. Execution proceeds same as Flow 6 (real-time)
4. On failure after max retries:
   a. AgentExecution status → failed
   b. AuditLog event: execution_failed
   c. Notification sent to end user (via email or in-app)
   d. Notification sent to company admin
5. On success:
   a. AuditLog event: execution_completed
   b. Result stored (end user can view in chat history)
```

---

### Flow 8: Failure & Retry

```
1. ExecutionStep fails (API timeout, error response, etc.)
2. Retry logic kicks in:
   - Attempt 1: immediate retry
   - Attempt 2: 30 second backoff
   - Attempt 3: 2 minute backoff
   - Attempt 4+: exponential backoff up to 10 minutes
3. RetryCount incremented on ExecutionStep
4. If max retries exhausted:
   a. ExecutionStep status → failed
   b. AgentExecution status → failed
   c. Failure reason logged
   d. AuditLog event written
   e. If scheduled: notify end user + company admin
   f. If real-time: error shown to user in chat with reason
```

---

### Flow 9: Kill Switch

```
1. Company admin hits kill switch in dashboard
2. Scope chosen: specific agent or all agents
3. KillSwitch record created (isActive: true)
4. All running executions for affected agents:
   a. Marked as cancelled immediately
   b. In-flight API calls aborted where possible
   c. AuditLog event: agent_killed
5. All queued executions for affected agents:
   a. Removed from queue
6. All scheduled jobs for affected agents:
   a. Paused in scheduler
7. End users hitting affected agents get immediate error response
8. Admin can lift kill switch → KillSwitch.liftedAt set → executions resume
```

---

### Flow 10: Agent Rollback (End User)

```
1. End user opens agent settings in chat UI
2. End user views version history (list of AgentVersions)
3. End user selects a previous version to roll back to
4. New AgentVersion created as a copy of the selected version
   (we never mutate history — always forward-append)
5. Agent.currentVersion updated to new version
6. Confirmation shown to user
7. Next execution uses rolled-back version
8. AuditLog event: agent_rolled_back
```

---

### Flow 11: Skill Breaking Change

```
1. Company publishes new SkillVersion with isBreakingChange: true
2. Inflection queries all AgentVersions pinned to old skill version
3. For each affected agent:
   a. EndUser notified in chat: "Your agent [name] uses a skill that has changed"
   b. Migration guide shown (SkillVersion.migrationGuide)
   c. Agent flagged as needs_migration in dashboard
4. Old skill version remains active until all agents migrate or deprecation date
5. On deprecation date: old skill version deactivated
6. Agents still on old version → disabled with clear error message
```

---

### Flow 12: Audit Log Export

```
1. Company auditor opens audit log viewer in dashboard
2. Filters by: date range, agent, end user, event type, execution status
3. Views logs in UI (PII already redacted at write time)
4. Export options:
   a. CSV / JSON download
   b. Webhook push to SIEM (Splunk, Datadog, etc.) — configured in settings
   c. Direct S3 bucket export (enterprise only)
5. Logs are signed with checksum — auditor can verify no tampering
6. Logs stored for 90 days in Inflection (S3 Object Lock)
7. For longer retention: company exports to their own storage
```

---

## 3. WHAT WE NEED TO BUILD (COMPLETE LIST)

### Infrastructure
- [ ] Per-company Postgres provisioning (automated)
- [ ] HashiCorp Vault setup with per-company namespaces
- [ ] Per-company KMS encryption keys
- [ ] S3 Object Lock buckets for immutable audit logs
- [ ] BullMQ job queues for async + scheduled execution
- [ ] Cron scheduler for agent schedules
- [ ] SSE (Server-Sent Events) for real-time streaming
- [ ] AWS region selection per company (data residency)
- [ ] Status page (status.inflection.ai)
- [ ] CI/CD pipeline

### Company Platform (Dashboard)
- [ ] Company signup + admin invite flow
- [ ] Workspace management (sandbox / staging / prod)
- [ ] Team member management (invite, roles, deactivate)
- [ ] Connector setup UI (marketplace browse + custom)
- [ ] OAuth flow handler for marketplace connectors
- [ ] API key input + Vault storage UI
- [ ] Skill markdown editor + file upload
- [ ] Shadow test runner + results viewer
- [ ] System prompt viewer (auto-generated, read-only)
- [ ] Guardrail configuration UI (allowlist, denylist, rate limits, budget caps, approval flows)
- [ ] Agent browser (view all end-user-created agents)
- [ ] Kill switch UI (per agent + all agents)
- [ ] Audit log viewer + export
- [ ] Usage dashboard (executions, failures, approvals)
- [ ] Billing management (plan, invoices, usage)
- [ ] SIEM export configuration
- [ ] Incident notifications (email + Slack)

### Inflection Runtime (Core Engine)
- [ ] System prompt auto-generator (parses skills + connectors → generates prompt)
- [ ] Agent config interpreter (plain English → agent config via LLM)
- [ ] Guardrail enforcement engine (checks every execution against company guardrails)
- [ ] Execution runtime worker (runs agent steps sequentially/parallel)
- [ ] Skill executor (fetches Vault credentials → makes API call → returns result)
- [ ] LLM connector (pluggable — calls company's chosen model)
- [ ] Multi-agent orchestrator (agent calling sub-agents)
- [ ] Retry logic engine (per step, with backoff)
- [ ] Human-in-the-loop handler (pause, notify, resume on approval)
- [ ] Memory store (per agent, per end user, persistent)
- [ ] PII redaction pipeline (runs on all inputs/outputs before logging)
- [ ] Audit log writer (append-only, signed with checksum)
- [ ] Kill switch enforcer (checks before every execution)
- [ ] Rate limit enforcer (checks before every execution)
- [ ] Budget cap enforcer (checks in real time during execution)
- [ ] Scheduled execution handler (cron → queue → execute)
- [ ] Failure notification dispatcher (email + Slack on exhausted retries)

### End User Chat UI (Web Component)
- [ ] Single embeddable web component React 
- [ ] JWT auth + session management
- [ ] Context injection handler (silent metadata from company backend)
- [ ] Real-time streaming (SSE)
- [ ] Agent creation via chat (conversational builder)
- [ ] Step-by-step progress display
- [ ] Agent management UI (list, edit, version history, rollback)
- [ ] File upload handler
- [ ] White-label theming (colors, logo, fonts, agent name)
- [ ] Approval notification display (in-chat approval prompts)
- [ ] Error states and retry prompts

### API (For Companies Building Their Own UI)
- [ ] REST API (all platform operations)
- [ ] WebSocket / SSE endpoint for streaming
- [ ] Webhook system (async execution events)
- [ ] API key management
- [ ] API versioning (/v1/)
- [ ] Rate limiting per API key
- [ ] Idempotency keys for retried requests
- [ ] SDK: TypeScript / JavaScript (Node + browser)
- [ ] SDK: Python

### CLI
- [ ] Auth (login with API key)
- [ ] `inflection skill push` (upload skill markdown)
- [ ] `inflection skill list` / `inflection skill validate`
- [ ] `inflection connector list` / `inflection connector test`
- [ ] `inflection agent list` / `inflection agent logs`
- [ ] `inflection deploy` (push config changes to workspace)
- [ ] `inflection env` (switch between sandbox / staging / prod)

### Marketplace (Phase 3)
- [ ] Pre-built connectors: Plaid, Stripe, Jumio, Temenos, FIS, Fiserv, Twilio, SendGrid
- [ ] LLM connectors: Anthropic Claude, OpenAI GPT-4o, Google Gemini
- [ ] Communication connectors: Email (SendGrid), Slack, WhatsApp
- [ ] Marketplace browse UI in dashboard
- [ ] Connector certification process (how we vet third-party connectors)

---

## 4. FEATURE-BY-FEATURE BUILD PLAN

Build the thinnest possible base that a real company can use. Then add one feature at a time.

---

### FEATURE 1 — Company Exists (Week 1)
_A company can be created and an admin can log in._

Build:
- Company + Workspace + TeamMember data models
- Postgres provisioning script (manual for now, automated later)
- Admin signup + login (Clerk)
- Dashboard shell (empty, but authenticated)

Done when: An Inflection team member can manually provision a company and the admin can log in.

---

### FEATURE 2 — Connector Setup (Week 2)
_A company can add a connector and store credentials securely._

Build:
- Connector + ConnectorVersion data models
- HashiCorp Vault integration (per-company namespace)
- Connector setup UI (API key paste)
- OAuth flow for marketplace connectors (Plaid first)
- Shadow test runner (ping the API, verify it responds)
- Connector status management (draft → active)

Done when: A company can add their Plaid API key, we store it in Vault, and a shadow test confirms it works.

---

### FEATURE 3 — Skill Creation (Week 3)
_A company can write a skill markdown file and validate it._

Build:
- Skill + SkillVersion data models
- Skill markdown editor in dashboard
- Shadow test against sandbox connector
- Skill status management (draft → active)

Done when: A company uploads a "Get Account Balance" skill markdown, shadow test passes, skill goes active.

---

### FEATURE 4 — System Prompt Generation (Week 3–4)
_Inflection reads active skills + connectors and auto-generates the system prompt._

Build:
- System prompt generator (LLM call that reads all active skills/connectors)
- SystemPrompt data model + versioning
- System prompt viewer in dashboard (read-only)
- Auto-regenerate on any skill/connector change

Done when: A company has 2 skills active and we generate a coherent system prompt that accurately describes what the agent can do.

---

### FEATURE 5 — Guardrails (Week 4)
_A company can define what end users are and aren't allowed to do._

Build:
- Guardrail data model
- Guardrail config UI (skill allowlist, denylist, rate limits, budget cap)
- Guardrail enforcement in execution runtime (pre-execution checks)

Done when: A company can set "users can only use skill X and Y" and the runtime enforces it.

---

### FEATURE 6 — End User Auth (Week 5)
_A company can authenticate their end users into Inflection._

Build:
- JWT verification (company signs, Inflection verifies)
- EndUser + Session data models
- Context injection (company passes account metadata in JWT)
- Session management (expiry, refresh)

Done when: A test JWT from a company's backend is verified, EndUser record created, session started.

---

### FEATURE 7 — Agent Creation via Chat (Week 5–6)
_An end user can describe what they want and we create an agent._

Build:
- Agent + AgentVersion data models
- Agent creation flow (plain English → LLM maps to skills → agent config generated)
- Guardrail check during agent creation (is the requested config within bounds?)
- Agent confirmation UI (show user what will be created, ask to confirm)
- Agent stored and shown in user's agent list

Done when: An end user says "send me my account balance every morning" and an agent is created, configured, and listed.

---

### FEATURE 8 — Agent Execution (Real-Time) (Week 6–7)
_A created agent can actually run and do things._

Build:
- AgentExecution + ExecutionStep data models
- Execution runtime worker (step-by-step execution)
- Skill executor (fetch Vault credentials → API call → parse response)
- LLM connector (call company's chosen model)
- Real-time SSE streaming (progress shown step-by-step in chat)
- Audit log writer (every step logged, PII redacted)
- Failure handling (error shown in chat)

Done when: The "account balance" agent runs, calls the real API, and returns the balance in chat.

---

### FEATURE 9 — Scheduled Execution (Week 7–8)
_An agent can run on a schedule without the user asking._

Build:
- Cron expression parser + validator
- Job scheduler (BullMQ cron jobs)
- Scheduled execution handler (trigger → queue → execute)
- Failure notification (email to user + admin after retries exhausted)
- Retry logic (immediate → 30s → 2m → exponential)

Done when: "Send me account balance every morning at 8am" runs automatically at 8am, succeeds, and the user receives the result.

---

### FEATURE 10 — Embedded Web Component (Week 8–9)
_A company can embed the chat into their own product._

Build:
- Web component (custom element, single script tag)
- White-label theming (colors, logo, fonts, agent name via config)
- JWT passthrough (company's frontend passes JWT to component)
- Component connects to Inflection session API
- Full chat UI inside component (create agent, talk to agent, view progress)

Done when: A company drops one script tag into their app and their users can create and run agents with full branding.

---

### FEATURE 11 — Human-in-the-Loop Approvals (Week 9–10)
_High-risk agent actions pause and wait for human approval._

Build:
- ApprovalRequest data model
- Guardrail: require_approval (company configures which skills need approval)
- Execution pause handler (agent pauses at step requiring approval)
- Approval notification sender (email first, Slack later)
- Approval UI (approver clicks approve/reject from email/Slack)
- Execution resume handler (on approval → continue from paused step)
- Expiry handler (if not approved in time → fail execution)

Done when: An agent tries to book a hotel, pauses, sends an email to the approver, approver clicks approve, booking completes.

---

### FEATURE 12 — Kill Switch (Week 10)
_A company admin can instantly stop an agent or all agents._

Build:
- KillSwitch data model
- Kill switch UI in dashboard (per agent + global)
- Kill switch enforcer (checked before every execution start)
- Running executions cancelled immediately
- Queued executions removed
- Lift kill switch UI

Done when: Admin hits kill switch, running executions stop within seconds, new executions blocked.

---

### FEATURE 13 — Agent Memory (Week 10–11)
_Agents remember user preferences across runs._

Build:
- Memory store (per agent + per end user, stored on Agent record)
- Memory read step in execution (agent reads memory at start)
- Memory write step in execution (agent updates memory at end)
- Memory shown to user in chat (optional transparency)

Done when: User tells agent "I prefer window seats" and next run the agent uses that preference without being told again.

---

### FEATURE 14 — Agent Version History & Rollback (Week 11)
_End users can roll back their agent to a previous version._

Build:
- Version history UI in chat (list of AgentVersions)
- Rollback action (creates new AgentVersion as copy of old)
- Diff view (what changed between versions)

Done when: User changes their hotel agent, it breaks, they roll back to yesterday's version in two clicks.

---

### FEATURE 15 — Audit Log Viewer & Export (Week 11–12)
_Company auditors can view and export full execution logs._

Build:
- Audit log viewer in dashboard (filter by date, agent, user, event type)
- PII confirmed redacted at display layer (double-check)
- CSV/JSON export
- Checksum verification display (prove logs haven't been tampered)
- SIEM webhook config (push logs to Splunk, Datadog, etc.)

Done when: An auditor can find any execution from the last 90 days, see every step, and export to their SIEM.

---

### FEATURE 16 — Multi-Agent Orchestration (Week 12–13)
_An agent can call another agent as a sub-step._

Build:
- Sub-agent call step type in execution runtime
- Agent-to-agent context passing
- Nested execution tracking (parent execution → child executions)
- Nested audit logs (all steps from all agents in one trace)

Done when: A "travel planning" agent calls a "find flights" agent and a "find hotels" agent as sub-steps, all tracked in one audit trail.

---

### FEATURE 17 — Pre-Built Connector Marketplace (Week 13–15)
_Companies can pick from pre-built connectors instead of building from scratch._

Build:
- MarketplaceConnector data model
- Marketplace browse UI in dashboard (filter by category, tier)
- One-click OAuth connect for marketplace connectors
- First 5 connectors: Plaid, Stripe, Jumio, SendGrid, Slack
- First 3 LLM connectors: Claude, GPT-4o, Gemini

Done when: A neobank can connect Plaid in 2 minutes via OAuth, no custom connector setup needed.

---

### FEATURE 18 — CLI (Week 15–16)
_Developers can manage skills and connectors from their terminal._

Build:
- CLI tool (npm package)
- Auth command (`inflection login`)
- Skill commands (`push`, `list`, `validate`)
- Connector commands (`list`, `test`)
- Agent commands (`list`, `logs`)
- Deploy command (`inflection deploy`)
- Environment switching (`inflection env sandbox`)

Done when: A developer can push a new skill file and deploy it to staging from their terminal in under 30 seconds.

---

### FEATURE 19 — REST API + SDKs (Week 16–17)
_Companies building their own UI can call Inflection programmatically._

Build:
- Full REST API (all platform operations)
- API key management in dashboard
- TypeScript SDK (npm)
- Python SDK (PyPI)
- API documentation (OpenAPI spec + docs site)
- Webhook system for async events

Done when: A company can create an agent, run it, and receive streamed results via their own custom UI using our SDK.

---

### FEATURE 20 — Billing & Plans (Week 17–18)
_Companies pay a yearly fee, plans enforced._

Build:
- Stripe Billing integration (yearly subscription)
- Starter vs Enterprise plan enforcement (connector limits, feature gates)
- Free trial management (time-limited sandbox access)
- Usage dashboard (executions, failures, approvals this period)
- Invoice history in dashboard
- Plan upgrade flow

Done when: A company on trial converts to a paid plan, their Stripe invoice is generated, and starter limits are enforced.

---

## 5. SUMMARY — WHAT THE BASE PRODUCT IS

The base product (Features 1–10) is:

> A company can onboard, connect their APIs as connectors, write skill definitions, and embed a white-labeled chat into their product — and their end users can create and run real AI agents that execute multi-step tasks using the company's own APIs, with full audit trails and real-time progress, all in under 1 week from guided onboarding.

Everything after Feature 10 is expansion:
- Features 11–14: Controls and trust (approvals, kill switch, memory, rollback)
- Features 15–16: Audit and compliance (log viewer, export)
- Features 17–18: Scale (multi-agent, marketplace)
- Features 19–20: Platform (CLI, API, SDKs, billing)

---

## 6. MILESTONE TARGETS

| Milestone | Features | Target |
|---|---|---|
| Internal demo ready | 1–5 | End of Month 1 |
| First pilot company in sandbox | 6–8 | End of Month 2 |
| First agent running in a real product | 9–10 | End of Month 3 |
| Compliance-ready (controls + audit) | 11–16 | End of Month 5 |
| Full platform (marketplace + CLI + API) | 17–20 | End of Month 6–7 |
| First paying customer | All | Month 4–5 |
