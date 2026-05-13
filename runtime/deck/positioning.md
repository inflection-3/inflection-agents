# Inflection — Positioning Document

_Last updated: 2026-05-12_

---

## One-Line Position

**"Inflection is the compliant agent runtime for financial services — plug in your APIs and your customers get a working AI agent in weeks, not months."**

---

## The Analogy

Twilio for SMS. Stripe for payments. **Inflection for AI agents.**

Companies don't want to manage agent runtimes any more than telcos wanted to manage SMS infrastructure. Inflection is the infrastructure layer — companies plug in their APIs as connectors, write skill definitions, and their end users get real AI agents that take real actions. The hard parts — credential vaulting, audit logs, guardrail enforcement, human approvals — are handled by the runtime, not the company's engineering team.

---

## The Problem We Solve

Financial services companies know their customers want AI-powered automation. A user should be able to say _"send me my account balance every morning"_ or _"find a cheaper subscription plan and switch me"_ — and have it actually happen.

But building the agent runtime to support this is a 12–18 month engineering project before shipping anything:

- **Credential management** — every API call needs secrets; storing and rotating them safely at scale is a security project on its own
- **Audit requirements** — every agent action must be logged, tamper-proof, and exportable to a SIEM; regulators don't accept "we think it worked"
- **Guardrail enforcement** — hard limits on what agents can do, not soft prompts
- **Human approval flows** — high-risk actions (move money, book, cancel) need a human in the loop before they fire
- **End-user trust** — users need to see exactly what their agent did, step by step, and be able to roll it back

Most companies can't build all of this. The ones that try spend 18 months on infrastructure before they ship a single agent.

---

## What We Do

Inflection is the runtime layer that handles everything between a company's APIs and their end users' intent.

### For the company (platform customer)

| What they need | What Inflection provides |
|---|---|
| Connect existing APIs | Connectors — OAuth, API key, or mTLS; credentials in HashiCorp Vault |
| Define what agents can do | Skills — markdown definitions per connector |
| Control what users can do | Guardrails — allowlists, rate limits, budget caps, approval requirements |
| Embed in their product | White-labeled chat component — one script tag, fully themed |
| Prove what happened | Immutable audit log — every step, PII redacted, signed, exportable |

### For the end user (company's customer)

- Create agents in plain English — no configuration UI, no dropdowns
- Watch agents run step-by-step in real time via streaming
- Approve or reject high-risk actions before they execute
- Roll back to a previous agent version if something breaks
- Trust the company has full visibility into everything their agent did

---

## Who It's For

**Primary buyer:** Engineering and product leaders at neobanks, fintechs, and embedded finance companies — 50 to 500 person engineering teams.

They have real APIs, customers who want automation, compliance teams who will kill anything that isn't auditable, and no appetite to build this runtime themselves.

**Secondary buyer:** Larger banks and financial institutions looking to add AI agent capabilities to existing products without rebuilding their infrastructure.

**Avoid (for now):** Nubank, Revolut, Robinhood — engineering-heavy, already building in-house.

---

## What We Are Not

- **Not an AI assistant** — we don't answer questions; we execute tasks
- **Not a chatbot builder** — we don't handle support tickets or FAQs
- **Not a general-purpose agent platform** — purpose-built for financial services companies with real API infrastructure and compliance requirements
- **Not a BaaS** — we don't provide banking APIs; we connect to the APIs the company already has

---

## The Core Differentiator

Most agent platforms hand you an LLM and tell you to figure out the rest.

Inflection gives you the **runtime**: credential vault, guardrail enforcement, audit log, human-in-the-loop, scheduled execution, kill switch, version history, PII redaction — all wired together and working before you write a line of code.

A company can go from first connector to their first end user running a real agent in **under one week**.

---

## Competitive Landscape

| | Inflection | AWS Bedrock AgentCore | Salesforce Agentforce | LangChain / DIY |
|---|---|---|---|---|
| Financial services focus | Yes | No | Partial | No |
| Credential vault built-in | Yes | No | No | Build it |
| Tamper-proof audit log | Yes | No | Partial | Build it |
| Guardrail enforcement | Yes | Partial | Partial | Build it |
| Human-in-the-loop | Yes | DIY | Partial | Build it |
| Embeddable white-label UI | Yes | No | No | Build it |
| Time to first agent | < 1 week | Weeks–months | Months | 12–18 months |
| Threat level | — | High (12–18mo window) | Medium | Low (different category) |

---

## The Moats

1. **Compliance by default** — audit trails, explainability, and HITL baked into the runtime from day one; competitors built on generic infra have to retrofit this
2. **Financial connector library** — pre-built integrations to Plaid, Stripe, core banking (Temenos, FIS, Fiserv), KYC/AML; compounds with every new connector
3. **B2B2C runtime model** — the ability to embed agent experiences into a company's branded product is not something hyperscalers optimize for
4. **Network effects** — every new skill/connector added benefits all tenants; every new tenant adds signal to the runtime

---

## Pricing Model

- **Starter** — annual contract, self-serve onboarding, marketplace connectors, all base features
- **Enterprise** — annual contract, dedicated onboarding, custom data residency (EU, APAC), SIEM export, SLA, SSO

Pricing is per workspace, not per execution or per seat. Companies know their cost upfront.

---

## The 3 Risks to Validate

1. **Hyperscalers enter vertical FS** — ~12 month window before AWS/Google ship "Bedrock AgentCore for Financial Services." Need connector depth they can't replicate fast.
2. **Big neobanks build vs. buy** — ICP is mid-tier, not giants. Validate with 3–5 target customers: "Would you have spent 12+ months building this without Inflection?"
3. **Regulatory liability scope** — Map what Inflection can own vs. what the fintech must own before going to market. Run by a compliance lawyer at 3 target banks.
