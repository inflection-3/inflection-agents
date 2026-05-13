# Inflection — Technical Architecture Plan

_CTO perspective. Decisions locked in through co-founder Q&A session on 2026-05-12._

---

## The Big Picture (What We're Actually Building)

Three layers:

```
┌─────────────────────────────────────────────────┐
│              COMPANY LAYER (B2B)                │
│  Onboarding → Skills/Connectors → Controls      │
├─────────────────────────────────────────────────┤
│           INFLECTION RUNTIME (Core)             │
│  Agent Builder → Execution → Audit → Billing    │
├─────────────────────────────────────────────────┤
│          END-USER LAYER (B2B2C)                 │
│  Embedded Chat UI / API / Mobile SDKs           │
└─────────────────────────────────────────────────┘
```

---

## Decisions Log (All 50 Questions Answered)

### Company Onboarding

| # | Question | Decision |
|---|---|---|
| 1 | How do companies sign up? | Sales-led only |
| 2 | What does Day 1 look like? | Guided onboarding session — we help them set up connectors, skills, and first agent |
| 3 | Sandbox or test mode flag? | Full isolated sandbox environment per company |
| 4 | How do companies define agent capabilities? | Visual UI — company defines skills/connectors, we auto-generate the system prompt, end users create agents on top |
| 5 | How do we store credentials? | Both OAuth flow + API key paste. Stored in HashiCorp Vault |
| 6 | Roles inside the company? | Admin, Developer, Read-only Auditor |
| 7 | Multiple environments? | Yes — dev, staging, prod, all fully isolated |
| 8 | Offboarding / data deletion? | We export their data. 30-day window. After 30 days we delete everything. |

### Skills & Connectors

| # | Question | Decision |
|---|---|---|
| 9 | Skill vs connector definition? | Connector = authenticated API client (the plumbing). Skill = markdown file describing what the API does and how the agent uses it |
| 10 | Who creates skills? | Companies write their own skill markdown files. We also maintain a pre-built library |
| 11 | Do we validate skills before go-live? | Yes — shadow tests against sandbox connector to verify expected results |
| 12 | Versioning? | Yes — skills and connectors are versioned. Agents can be pinned to a specific version |
| 13 | Connector failure handling? | Automatic retry logic. Configured by Inflection (not per company) |
| 14 | Pre-built connector library? | Yes — marketplace of pre-built connectors (Plaid, Stripe, Jumio, etc.) that companies authenticate into |

### Agent Creation

| # | Question | Decision |
|---|---|---|
| 15 | How do end users create agents? | Plain English description → we map to available skills/connectors → orchestrate multi-step autonomous agent |
| 16 | Can agents trigger other agents? | Yes — multi-agent orchestration supported |
| 17 | Persistent memory across runs? | Yes — agents remember user preferences and past context |
| 18 | Who controls end user freedom? | Company has full control over what skills end users can combine |
| 19 | Multiple LLMs? | Yes — LLMs are connectors. Companies plug in their own model (Claude, GPT-4o, Gemini, etc.) |
| 20 | Real-time progress shown to user? | Yes — step-by-step progress shown during multi-step execution |

### Agent Execution Runtime

| # | Question | Decision |
|---|---|---|
| 21 | Real-time and scheduled execution? | Both — real-time and scheduled/async (e.g. "every Sunday at 9am") |
| 22 | Scheduled agent failure handling? | Auto-retry. After retries exhausted, notify both end user and company admin |
| 23 | Where does execution run? | Both — managed cloud (Inflection-hosted) and self-hosted option for companies with strict data residency |
| 24 | Human-in-the-loop for high-risk actions? | Yes — agent pauses, sends approval request via whatever communication connector is available (email, Slack, etc.) |

### Embedded Chat UI

| # | Question | Decision |
|---|---|---|
| 25 | How do companies embed our chat? | Single web component (script tag drop-in) |
| 26 | End user identity passthrough? | JWT — company signs, Inflection verifies |
| 27 | White-label? | Yes — fully white-labeled. Logo, colors, fonts, agent name. Inflection invisible to end users |
| 28 | Mobile SDKs in v1? | No — web only. Mobile later |
| 29 | File uploads in chat? | Yes — end users can upload files (e.g. bank statements for agent to analyze) |
| 30 | Silent context injection? | Yes — company can inject account ID, balance, tier, etc. on backend before session starts |

### Audit Trails & Compliance

| # | Question | Decision |
|---|---|---|
| 31 | What do we log? | Everything — full reasoning trace, every tool call, input/output at each step, timestamps, user, agent version |
| 32 | PII handling in logs? | Auto-redact PII before storing |
| 33 | Who can access audit logs? | Company admin/auditor only. Inflection staff have zero visibility |
| 34 | Export to external systems? | Yes — companies can pipe logs to Splunk, Datadog, their own S3, etc. |
| 35 | Retention period? | 90 days default. Companies needing longer (e.g. 7 years for banking regs) must export to their own storage |

### Controls

| # | Question | Decision |
|---|---|---|
| 36 | Kill switch? | Yes — instant kill per agent or all agents from dashboard |
| 37 | Budget caps? | Company sets the cap and configures behavior on hit (stop + notify, or just stop) |
| 38 | Agent versioning / rollback? | End users can roll back their own agents to previous versions. Company admins can view and manage all user agents |
| 39 | Rate limits per user? | Yes — company configures max executions per user per day |
| 40 | Skill/connector breaking changes? | We notify affected users with a migration guide explaining what changed and how to update their agent |

### Billing & Metering

| # | Question | Decision |
|---|---|---|
| 41 | What do we charge on? | Flat yearly platform fee. Companies bring their own LLM API keys — we don't touch model costs |
| 42 | Pricing tiers? | Yes — starter tier (limited connectors/agents) and enterprise tier (full controls, audit, data residency) |
| 43 | Free trial? | Yes — trial period in sandbox before committing to yearly fee |

### Developer Experience

| # | Question | Decision |
|---|---|---|
| 44 | Time to first working agent? | Target: 1 week from guided onboarding session to working agent in sandbox |
| 45 | CLI tool? | Yes — CLI for managing skills, connectors, deployments from terminal |
| 46 | Status page? | Yes — status.inflection.ai with proactive email/Slack incident notifications |

### Multi-Tenancy & Security

| # | Question | Decision |
|---|---|---|
| 47 | Database isolation? | Separate database per company — maximum isolation |
| 48 | Compliance certifications? | SOC 2 Type II, PCI DSS, ISO 27001 — build toward all three from day one |
| 49 | Do we touch card data? | Never — card data flows through company's own payment connectors. We stay out of PCI scope for card storage |
| 50 | Incident response? | Company gets direct access to their own isolated database to act immediately without waiting on Inflection |

---

## Core Architecture

### How Agent Creation Works (The Full Flow)

```
Company (Visual UI)
  → Defines connectors (authenticated APIs stored in Vault)
  → Writes skill markdown files (what each API can do)
  → Inflection auto-generates system prompt from skills + connectors
  → Company sets guardrails (what users can/can't do)

End User (Chat UI)
  → Describes what they want in plain English
  → Inflection maps to available skills, builds agent config
  → Agent runs (real-time or scheduled)
  → Real-time progress shown step by step
  → Full audit trail written at every step
```

### How Execution Works

```
User message / Scheduled trigger
  → Agent picked up by execution runtime
  → Steps executed sequentially (or in parallel where possible)
  → Each step: tool call → connector → external API
  → High-risk step? → Pause → send HITL approval (email/Slack)
  → On approval → resume
  → On failure → auto-retry → if exhausted → notify user + admin
  → Completion → full audit log written → response streamed to user
```

---

## Core Data Model

```
Company
  └── Workspace (dev / staging / prod)
        ├── Connectors (API credentials in HashiCorp Vault + auth config)
        ├── Skills (markdown files, versioned)
        ├── SystemPrompt (auto-generated from skills + connectors)
        ├── Guardrails (what end users can/can't do)
        ├── EndUsers (JWT-verified, context injected by company)
        └── AuditLogs (immutable, append-only, auto-redacted PII)

Agent (owned by EndUser)
  ├── id
  ├── name
  ├── description (plain English from user)
  ├── skillsUsed[] (pinned versions)
  ├── connectorsUsed[] (pinned versions)
  ├── memory (persistent across runs)
  ├── schedule (optional cron)
  └── versions[] (full history, rollback supported)

AgentExecution
  ├── id
  ├── agentId + version
  ├── endUserId
  ├── input
  ├── steps[] (tool call, input, output, timestamp, reasoning)
  ├── output
  ├── status (running / completed / failed / awaiting_approval)
  └── reasoningTrace (explainability, PII redacted)
```

---

## Technology Stack

| Layer | Decision |
|---|---|
| Cloud | AWS (primary) + self-hosted option for enterprise |
| Language | TypeScript (platform) + Python (ML/agent layer) |
| LLM | Pluggable — companies bring their own model via LLM connector |
| Database | Separate Postgres instance per company |
| Secrets | HashiCorp Vault with per-tenant KMS keys |
| Queue | BullMQ → Kafka at scale (scheduled + async execution) |
| Audit log storage | S3 Object Lock (immutable) + Postgres index |
| Chat embed | Single Web Component (script tag) |
| Auth | JWT passthrough for end users. Clerk for company admin accounts |
| CLI | Custom CLI (like Stripe CLI / Vercel CLI) |
| Billing | Flat yearly fee via Stripe. Companies bring own LLM API keys |
| Credentials | HashiCorp Vault |
| Compliance targets | SOC 2 Type II, PCI DSS, ISO 27001 |

---

## Phased Build Plan

### Phase 0 — Foundation (Month 1–2)
_Goal: One company can onboard, define one skill, and run one agent in sandbox._

- [ ] Multi-tenant data model (separate DB per company)
- [ ] HashiCorp Vault integration for secrets
- [ ] Company onboarding flow (sales-led + guided session tooling)
- [ ] Visual UI for defining connectors and skill markdown files
- [ ] System prompt auto-generation from skills + connectors
- [ ] Basic agent execution runtime (synchronous, single-step)
- [ ] Audit log writer (every execution, PII auto-redacted, append-only S3)
- [ ] Admin dashboard (view agents, connectors, skills, logs)
- [ ] Sandbox environment with mock financial data

### Phase 1 — Chat & Embed (Month 3–4)
_Goal: A neobank embeds our chat, their users create and run agents._

- [ ] Single web component chat UI (white-label, brandable)
- [ ] JWT end-user auth passthrough
- [ ] Silent context injection (company passes user context on backend)
- [ ] Streaming real-time progress (SSE)
- [ ] Agent creation via plain English chat
- [ ] Multi-agent orchestration (agent calling agent)
- [ ] Persistent agent memory
- [ ] File upload support in chat
- [ ] Agent version history + rollback for end users
- [ ] REST API for companies building their own UI

### Phase 2 — Controls & Compliance (Month 5–6)
_Goal: A compliance officer can sleep at night._

- [ ] Kill switch (instant disable per agent or all agents)
- [ ] Rate limits per end user (company-configured)
- [ ] Budget caps per execution (company-configured)
- [ ] Skill/connector allowlist + denylist per company
- [ ] Human-in-the-loop pause + approval flow (email/Slack connector)
- [ ] Company admin view of all user-created agents
- [ ] Audit log viewer + export (CSV, JSON, SIEM webhook)
- [ ] Data residency config (choose AWS region per company)
- [ ] Status page (status.inflection.ai)
- [ ] Incident response: direct DB access for company on breach
- [ ] Begin SOC 2 Type II audit process

### Phase 3 — Scale & Marketplace (Month 7–9)
_Goal: 10+ companies in production. Connector marketplace live._

- [ ] Scheduled/async execution (cron-based agents)
- [ ] Failure handling: auto-retry + notify user + admin on exhaustion
- [ ] Self-hosted execution option for enterprise (data residency)
- [ ] Pre-built connector library (Plaid, Stripe, Jumio, Temenos, FIS)
- [ ] LLM connector (companies plug in Claude, GPT-4o, Gemini, etc.)
- [ ] CLI tool (manage skills, connectors, deployments from terminal)
- [ ] Skill/connector breaking change notifications + migration guides
- [ ] Pricing tiers (starter vs enterprise)
- [ ] Free trial flow (sandbox → convert to paid)
- [ ] ISO 27001 + PCI DSS scoping initiated

---

## What We Are NOT Building (Yet)

- Our own LLM — companies bring their own via LLM connector
- Mobile SDKs — web-first, mobile in a later phase
- On-prem / self-hosted in v1 — cloud first, self-hosted as Phase 3 enterprise add-on
- Multi-region failover — single region until paying customers demand it
- Connector marketplace UI — hand-build first 5 connectors, marketplace in Phase 3

---

## The First 30 Days

1. Define the skill markdown schema — this is the contract everything builds on
2. Stand up per-company Postgres with HashiCorp Vault for secrets
3. Build guided onboarding tooling — target: 1 week from session to first agent in sandbox
4. Auto-generate system prompt from skill files — this is the core IP
5. Get one real fintech into the guided onboarding session — everything before that is speculation
