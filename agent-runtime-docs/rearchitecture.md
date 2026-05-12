# Inflection — Re-Architecture: The B2B2C Agent Platform

_Written after a full read of Stack AI's 293-page documentation corpus._
_Date: 2026-05-12_

---

## What Stack AI Taught Us

Stack AI is the best visual agent builder in the market. After reading their full docs, here is exactly what they have:

**The Canvas** — a drag-and-drop node graph where companies build agent workflows. Nodes include:
- LLM Node (call any model — Claude, GPT-4o, Gemini, local)
- Knowledge Base Node (RAG — vector search over documents)
- Action Node (call a connected app — Salesforce, Slack, Gmail, etc.)
- If/Else Node (conditional branching)
- AI Routing Node (LLM decides which branch to take)
- Loop/Subflow Node (iterate, call sub-agents as tools)
- Human-in-the-Loop Node (pause, ask human, resume)
- Code Node (Python or JS inline)
- Custom API Node (hit any REST endpoint)
- Input/Output Nodes (define what goes in and comes out)

**100+ Connectors** — Salesforce, Slack, Gmail, SharePoint, Snowflake, Notion, HubSpot, Stripe, Jira, Workday, Oracle, SAP, GitHub, and many more.

**6 Deployment Surfaces** — Form, Chat Assistant, Website Chatbot (embeddable widget), API (REST endpoint), Batch Run, Slack App, Teams Bot, WhatsApp/SMS.

**ADLC Lifecycle** — Draft → Development → Staging → Production. PR-style review before each promotion. Frozen snapshots with diffs. Approval gates. Rollback.

**Governance** — 4-tier RBAC (Admin, Editor, User, Viewer). Feature access (admin disables specific LLMs, KBs, tools per org). SCIM provisioning. MFA. SSO.

**Observability** — Analytics dashboard (runs, users, errors, token usage). Manager view (all conversations across all deployed agents). Evaluator (batch testing, LLM-graded quality scoring, comparison against gold-standard answers). Failure alerts.

**Security** — SOC 2 Type II, HIPAA, GDPR, CCPA, ISO 27001. On-premise deployment. PII masking at LLM layer. Encrypted credential storage. No customer data used for model training.

**Stack AI's gap:** When a company deploys a Stack AI agent, their end users can only *talk to it*. They cannot customize it, schedule it, name it, or make it their own. **The end user is passive.** Stack AI is a B2B product — companies are the builders, customers are just the consumers.

---

## The Pivot Thesis

> **Stack AI is Netflix. Inflection is YouTube.**
>
> Stack AI: company produces the agent, user consumes it.
> Inflection: company provides the rails and the palette, user creates and owns their own agent.

The market gap Stack AI leaves open:

Companies don't just want to deploy a fixed AI chatbot to their customers. The most valuable thing a company can give their customer is **agency** — the ability to build their own automations, set their own schedules, configure their own preferences, and own their own AI agent. Within guardrails the company controls.

No platform does this today. Stack AI doesn't. LangChain doesn't. Salesforce Agentforce doesn't. This is Inflection's moat.

---

## What We Are Building

**Inflection is the B2B2C agent platform.** Companies use our visual canvas to define what's possible. Their customers use our embed to build, customize, and own AI agents on top of those primitives.

```
┌──────────────────────────────────────────────────────────────────┐
│                    COMPANY LAYER (B2B)                           │
│                                                                  │
│  Visual Canvas → Build flows using nodes + connectors            │
│  ADLC Lifecycle → Draft → Dev → Staging → Production            │
│  Governance → RBAC, feature access, LLM selection               │
│  Connector Library → 50+ financial + enterprise integrations     │
│  Guardrail Config → what end users can and can't do              │
│  Analytics + Manager → observe everything                        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                   INFLECTION RUNTIME (Core)                      │
│                                                                  │
│  Execution Engine → runs node graphs step by step                │
│  Guardrail Enforcer → checks every execution against policy      │
│  HITL Handler → pause, notify approver, resume on approval       │
│  Audit Writer → immutable, PII-redacted, append-only log         │
│  Memory Store → per-user, per-agent, persistent                  │
│  Scheduler → cron-based agent execution                          │
│  Retry Engine → exponential backoff, failure notification        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                   END-USER LAYER (B2B2C)                         │
│                                                                  │
│  Mode A: Fixed Agent — interact with company-built template      │
│  Mode B: Personal Agent — customize/own your own agent           │
│  Deploy surfaces: Chat Widget, API, Slack, WhatsApp, Form        │
│  Scheduling, memory, version history — all owned by end user     │
│  White-label — Inflection invisible, company's brand             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## The Two Modes of End-User Experience

This is the architecture that Stack AI doesn't have. Every company that uses Inflection gets to offer their customers both modes.

### Mode A — Fixed Agent (Stack AI-compatible)

Company builds a complete flow on the canvas → publishes it → deploys as an embedded chat experience for their customers. Customers interact with it. They can't modify the underlying flow.

**Use case:** A neobank builds a "Loan Application Assistant." Customers ask it questions. The agent retrieves their profile, checks eligibility, explains terms. The bank controls every node in that flow.

This is what Stack AI does. We match it.

### Mode B — Personal Agent (Inflection's unique value)

Company defines a set of agent templates — the capabilities palette. Customers open the embed, describe what they want in plain English, and Inflection creates a personalized agent instance on top of those templates.

Each customer gets their own agent. They can rename it, schedule it, adjust its behavior, give it memory, view its run history, and roll it back. The company controls what's in the palette. The customer controls what they build with it.

**Use case:** A neobank configures their agent palette: "check balance," "send money," "set savings goal," "alert me when." A customer says: "Send me my balance every morning and alert me if I'm under $500." Their agent is created, scheduled, personalized. It runs for them every day. Another customer creates a completely different agent using the same palette.

This is what nothing else does. This is Inflection.

---

## New Technical Architecture

### The Company Layer — Visual Canvas

Companies access the Inflection dashboard. Inside, they use the canvas to build flows.

**Node types we ship:**

| Node | What it does |
|---|---|
| LLM Node | Call any model. Company brings their own API key. Pluggable: Claude, GPT-4o, Gemini, local. |
| Connector Node | Execute an action on a connected app (read/write to Plaid, Stripe, Temenos, etc.) |
| Knowledge Base Node | RAG retrieval — semantic search over company documents or user data |
| If/Else Node | Branch on conditions (balance > X, status == Y) |
| AI Routing Node | Let the LLM decide which branch to take |
| Loop Node | Iterate over a list, call a subflow for each item |
| Subflow Node | Call another published flow as a tool (multi-agent orchestration) |
| HITL Node | Pause execution, send approval request, resume on response |
| Code Node | Python or TypeScript inline for custom transforms |
| Memory Node | Read or write persistent user/agent memory |
| Input Node | Define what the agent receives (user message, injected context, file) |
| Output Node | Define what the agent returns (text, structured JSON, action confirmation) |

**Flow authoring lifecycle (ADLC):**

```
Draft
  → developer builds and tests in sandbox
Dev
  → internal team tests, connector shadow tests run
Staging
  → stakeholder approval, PR review with diff
Production
  → live with real end users
```

Every promotion requires a pull request. PRs are frozen snapshots with diffs. Reviewers can comment and approve/reject. No stage can be skipped. One-click rollback to any previous version.

**Guardrail configuration (company-defined):**

Companies configure — on the canvas or in dashboard settings — what their end users are allowed to do:
- Skill/action allowlist (only these connector actions are available to users)
- Skill/action denylist
- Rate limits per user (max executions per day)
- Budget cap per execution (max LLM cost, what to do on hit)
- Require approval (which actions need a human approver before executing)
- Kill switch (instant disable per agent or all agents)

These guardrails are enforced by the runtime at every execution. The company cannot go wrong. The end user cannot escape the box.

---

### The Runtime Layer — Execution Engine

The runtime executes node graphs. Each node runs in sequence (or parallel where there are no dependencies). The runtime is the most important piece — it's what makes both Mode A and Mode B work.

**Execution flow:**

```
Trigger (user message / scheduled cron / API call / webhook)
  → Check kill switch
  → Check rate limits
  → Check budget cap
  → AgentExecution created (status: queued)
  → Worker picks up execution
  → For each node in the graph:
      → Load node config
      → Fetch credentials from Vault (if connector node)
      → Execute node
      → If HITL node: pause → send approval → wait → resume on response
      → If failure: retry with backoff → if exhausted: notify user + admin
      → Write ExecutionStep to audit log (PII redacted)
      → Stream progress to end user via SSE
  → All nodes complete → AgentExecution: completed
  → Write final audit event
  → Update agent memory if memory nodes present
```

**Multi-agent orchestration:**

A Subflow Node inside a parent flow calls another published flow. The parent flow is the orchestrator. The child flows are specialists. The orchestrator passes context to each specialist. All steps — from all flows — are captured in one unified audit trace.

Example: A "Travel Planning" orchestrator calls a "Find Flights" specialist flow and a "Find Hotels" specialist flow in parallel, then a "Book Best Option" specialist flow sequentially. One audit trail. One execution ID. Full visibility.

---

### The End-User Layer — Embed and Surfaces

End users experience Inflection through deployment surfaces. Companies choose which surfaces to enable.

**Surface types:**

| Surface | How it works |
|---|---|
| Chat Widget | Single script tag. Embeds in company's product. White-labeled. Supports both Mode A and Mode B. |
| API Endpoint | Company calls our API from their own UI. SSO auth. Streaming via SSE. |
| Slack Bot | Deploy an agent as a Slack app in the company's workspace or customer Slack. |
| WhatsApp / SMS | Agent runs via Twilio. Users text in plain English. |
| Form | Static input form → agent runs → result displayed. No chat history. |

**Authentication:**

Companies sign a JWT with their private key. JWT contains:
- `externalId` — their user's ID
- `workspaceId` — which Inflection workspace
- `metadata` — injected context (account ID, balance, tier, permissions)
- `expiry`

Inflection verifies the JWT using the company's public key. No company user account needed. Inflection is invisible to end users.

**Mode B UX in the chat widget:**

End user opens chat:
→ "What would you like your agent to do?"
→ User describes in plain English
→ Inflection LLM reads the system prompt (built from the company's active flows/templates) and maps the request to available capabilities
→ Inflection checks guardrails (is this request within bounds?)
→ Shows user a summary of what will be built: "I'll check your balance every morning and alert you if you're below $500. Should I set this up?"
→ User confirms
→ Personal agent created and stored under their identity
→ Agent runs on schedule, or on demand

The agent is theirs. They can see it in their agent list, edit it, view its run history, roll it back, pause it, or delete it. All within the palette the company configured.

---

## New Data Model

The key structural change: **Skill (markdown file) → Flow (node graph)**.

Everything else builds on top of flows.

```
Company
  └── Workspace (sandbox / staging / production)
        ├── Flows (node graphs built on canvas)
        │     ├── FlowVersion (ADLC snapshot per promotion)
        │     └── Nodes[] (typed: LLM, Connector, KB, Logic, HITL, etc.)
        ├── Connectors (authenticated API clients stored in Vault)
        │     └── ConnectorVersion
        ├── KnowledgeBases (RAG document stores, vector-indexed)
        ├── Guardrails (allowlist, denylist, rate limits, budget, HITL triggers)
        ├── DeployedSurfaces (which surfaces are live: chat widget, API, Slack, etc.)
        └── AuditLogs (S3 Object Lock, immutable, PII-redacted)

EndUser (identified by company JWT)
  ├── PersonalAgents[] (Mode B — user-owned agent instances)
  │     ├── AgentVersion[] (full history, rollback)
  │     ├── Schedule (optional cron)
  │     └── Memory (persistent across runs)
  └── Sessions[]

AgentExecution
  ├── Triggered by: user_message | scheduled | api_call | webhook
  ├── ExecutionSteps[] (one per node — input, output, duration, status)
  ├── ApprovalRequests[] (HITL pauses — pending/approved/rejected/expired)
  └── AuditEvents[] (every state change, checksummed)
```

---

## What Changes from the Old Architecture

| Old | New | Why |
|---|---|---|
| Skills = markdown files | Flows = visual node graphs | Dramatically better company DX. Visual beats text for workflow authoring. |
| System prompt auto-generated from markdown | System prompt generated from flow nodes + connector definitions | Same concept, better source material |
| Single deploy surface (embedded chat) | Multiple surfaces (chat, API, Slack, WhatsApp, form) | Meet users where they are |
| No ADLC | Draft → Dev → Staging → Prod with PR review | Enterprise requirement. Stack AI has it. We need it. |
| Basic usage logs | Full observability suite (analytics, manager view, evaluator) | Companies need to see what's happening in production |
| No RAG | Knowledge Base nodes in canvas | Essential for financial services (product docs, policy PDFs, transaction data) |
| No multi-agent visual pattern | Subflow node = call another flow as a tool | Unlocks complex orchestration without custom code |

## What Does NOT Change

| What | Why we keep it |
|---|---|
| B2B2C model — end users own their agents | This is the moat. Nothing else does this. Stack AI doesn't. |
| Financial services vertical focus | Compliance moat. Connector depth. Guardrails baked in. |
| Per-company isolated Postgres | Enterprise data isolation requirement. Competitors can't match this. |
| HashiCorp Vault for credentials | Security-first. Regulated industries require it. |
| PII auto-redaction in audit logs | Financial compliance non-negotiable. |
| HITL approval flows | Company-level control over high-risk agent actions. |
| Kill switch | Instant disable. Compliance and safety. |
| White-label (Inflection invisible) | B2B2C product requirement. Companies won't embed if their brand is diluted. |
| Pay-per-execution pricing | Scales with value delivered. No per-seat tax on end users. |

---

## Competitive Position After Re-Architecture

| Platform | Model | Gap We Exploit |
|---|---|---|
| **Stack AI** | B2B visual builder. End users are passive. | We have everything they have + end users can own and create their own agents (Mode B). |
| **AWS Bedrock AgentCore** | Developer SDK. No visual builder. No end-user UI. No compliance layer. | We have the full stack: canvas + runtime + embed + compliance. |
| **Salesforce Agentforce** | Company-facing agents only. No B2B2C. Salesforce stack lock-in. Prohibitively expensive. | We're half the price, not locked in, and we deploy into *their* customers' hands. |
| **Microsoft Copilot Studio** | Microsoft stack only. No white-label. No B2B2C. | We're platform-agnostic and fully white-label. |
| **LangChain / LangGraph** | Framework, not platform. Every company re-solves the same problems. | We're the solved platform on top of the framework. |
| **Zapier / Make** | No LLM-native. No compliance. Not embeddable. | Not in our lane. |

---

## The Updated One-Line Position

> **"Inflection is the agent platform that gives your customers their own AI agent — not just a chatbot."**

For companies: Build your agent capabilities once on our canvas. Deploy it into your product. Your customers get a personal AI agent they own and customize. You stay in control.

For compliance officers: Every action is logged. PII is auto-redacted. High-risk actions require approval. You can kill any agent in seconds. SOC 2 Type II, ISO 27001, PCI DSS.

For end users (invisible to them): It just feels like their bank/fintech gave them a powerful personal AI assistant.

---

## Revised Build Plan

### Phase 0 — Canvas + Runtime (Month 1–2)
_Goal: One company can build a flow on the canvas and run it in sandbox._

- Visual canvas with core node types (LLM, Connector, If/Else, Input, Output)
- Per-company Postgres + HashiCorp Vault
- ADLC: Draft + Dev stages (Staging and Prod in Phase 1)
- 5 pre-built connectors: Plaid, Stripe, SendGrid, Slack, Custom API
- Flow execution runtime (sequential, synchronous)
- Admin dashboard shell

### Phase 1 — Embed + End-User Layer (Month 2–4)
_Goal: A neobank embeds our chat, their customers interact with a company-built agent (Mode A)._

- Embeddable chat widget (white-label)
- JWT auth passthrough + context injection
- SSE streaming (real-time progress)
- Fixed agent mode (Mode A) — users interact with company-built flow
- Manager view — company sees all conversations
- ADLC: Staging + Production stages with PR review
- Audit log writer (PII-redacted, S3 Object Lock)

### Phase 2 — Personal Agents (Month 4–6)
_Goal: End users can create and own their own agents. This is Mode B and the full B2B2C product._

- Personal agent creation (plain English → flow instance via LLM)
- Guardrail enforcement (request within palette bounds?)
- Agent list, version history, rollback for end users
- Scheduled execution (cron → BullMQ → execute)
- Agent memory (persistent across runs)
- Failure notifications (user + admin)
- HITL node — pause + approval via email/Slack
- Kill switch

### Phase 3 — Observability + Scale (Month 6–9)
_Goal: 10+ companies in production, full observability, marketplace._

- Analytics dashboard (runs, users, errors, token usage, cost)
- Evaluator (batch testing, quality scoring)
- Additional node types: Knowledge Base (RAG), Loop, Subflow, AI Routing, Code
- Knowledge base creation (document upload → vector indexing)
- Multi-agent orchestration (subflow-as-tool pattern)
- API surface (REST endpoint + WebSocket — companies build own UI)
- Slack bot + WhatsApp/SMS deployment surfaces
- Additional connectors: Jumio, Temenos, FIS, Fiserv, Circle, Coinbase
- CLI tool (inflection canvas push, connector test, agent logs)
- Connector marketplace UI

### Phase 4 — Enterprise + Compliance (Month 9–12)
_Goal: SOC 2 certified, enterprise deals closed, self-hosted option._

- SOC 2 Type II audit + certification
- ISO 27001 initiation
- PCI DSS scoping
- Self-hosted deployment option (data residency)
- SCIM provisioning
- SIEM export (Splunk, Datadog, S3)
- Batch run surface
- Enterprise pricing tier

---

## The First 30 Days

1. **Define the node schema** — typed node definitions are the contract everything builds on (same role as skill markdown was, but typed and visual)
2. **Stand up per-company Postgres + Vault** — infrastructure foundation
3. **Build the canvas** — drag, drop, wire nodes, save as flow graph JSON
4. **Build the LLM node + Connector node** — these two alone enable meaningful flows
5. **Build the execution runtime** — load flow JSON, execute nodes sequentially, log each step
6. **Get one real fintech into sandbox** — everything before that is speculation

---

## What We Are NOT Building (Yet)

- Our own LLM — companies bring their own via LLM node config
- Mobile SDKs — web-first, mobile later
- Our own vector DB — use Pinecone or pgvector, abstract behind KB node interface
- Multi-region failover — single region until paying customers demand it
- Batch run surface — Phase 3 at earliest
- On-premise/self-hosted — Phase 4 enterprise add-on
