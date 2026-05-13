# Inflection — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-11  
**Status:** Draft  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [Core Features](#4-core-features)
5. [User Stories](#5-user-stories)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Success Metrics](#7-success-metrics)
8. [Out of Scope for v1](#8-out-of-scope-for-v1)
9. [Roadmap](#9-roadmap-v1--v2--v3)

---

## 1. Executive Summary

Inflection is a **financial policy enforcement and compliance layer for AI agents** — the infrastructure primitive that sits between an AI agent and every payment rail it touches.

As AI agents gain autonomy over financial operations — paying vendors, disbursing funds, subscribing to services, executing transfers — the tooling to govern those actions has not kept pace. Today, every agent developer reinvents credential management, every business deploying an agent has no audit trail, and every compliance team has no systematic way to prove control.

Inflection solves this by acting as a **gateway between AI agents and payment providers**. The developer installs one SDK; the SDK intercepts every outbound financial API call; the Inflection gateway evaluates the call against the deploying business's policy, writes a tamper-evident audit log entry, and either executes, holds, or denies the call — all in under 10ms on the hot path.

The analogy is **WorkOS for agent financial actions**: a single integration that unlocks enterprise deployment by solving auth/compliance on behalf of every team in the stack.

---

## 2. Problem Statement

### 2.1 The Current Situation

AI agents are increasingly capable of taking financial actions: charging customers, paying APIs, disbursing funds, topping up wallets, processing refunds. The agent frameworks (LangChain, CrewAI, custom tool-calling loops) provide no guardrails on financial tool invocations. The payment rails (Stripe, Circle, Square) provide excellent APIs but no concept of agent identity, policy, or oversight.

The result is a capability gap: agent developers can wire up a Stripe client in 30 lines of code, but there is no standard mechanism for the business deploying that agent to:

- Set a maximum spend per transaction or per day
- Require human approval for transactions above a threshold
- Restrict the agent to certain currencies or geographies
- Get an immutable audit log they can hand to a compliance team
- Revoke agent access to a payment rail without re-deploying the agent

### 2.2 The Three Pain Points

**Credential sprawl for developers.** An agent that needs to handle payments on multiple rails must manage API keys for Stripe, Circle, Square, Braintree, and any other provider. Each key needs to be injected at runtime, rotated, scoped correctly, and kept out of logs. Developers either under-scope credentials (too risky) or over-scope them (too dangerous). There is no standard pattern. The SDK surface is different for every provider.

**No oversight for deploying businesses.** A company that deploys an AI agent to handle vendor payments has no real-time visibility into what the agent is spending. Budgets are enforced at the bank level (blunt, asynchronous) or not at all. There is no mechanism to pause a runaway agent short of killing the process. Human approval for large transactions requires custom webhook infrastructure built per deployment. The result: businesses limit what agents are allowed to do, stunting their utility.

**No compliance posture for regulated entities.** SOC2 and PCI DSS require demonstrating control over systems that process payment data. An agent that holds Stripe keys and makes Stripe calls is a material control risk. Compliance teams have no tamper-evident audit trail of what the agent did, no evidence of policy enforcement, and no artifact to show an auditor. This is a hard blocker for any enterprise deployment in a regulated industry.

### 2.3 Why Now

The convergence of three trends makes this the right moment:

1. **Agent autonomy is real and increasing.** Enterprises are actively deploying agents that process payments, not just researching it.
2. **Enterprises need compliance.** Regulated industries (fintech, healthcare, logistics) represent the highest-value agent deployments, and they have hard compliance requirements.
3. **The plumbing is undifferentiated.** Every team solving this is solving the same problem independently. One correct infrastructure layer eliminates duplicated effort across the ecosystem.

---

## 3. Target Users & Personas

### 3.1 Persona 1: The Agent Developer

**Name:** Dev  
**Role:** Software engineer / AI engineer at a startup or enterprise building an AI agent product  
**Technical level:** High — comfortable with SDKs, REST APIs, async programming

**Context:** Dev is building an agent that takes financial actions on behalf of their users. They need to integrate with 2–3 payment rails. They have been given API keys by their employer and told to "handle the payment side." They are spending roughly 20% of their development time on credential management, error handling, and building audit logging that nobody will ever review.

**Goals:**
- Ship the agent integration as fast as possible
- Not own the operational burden of credential rotation and rail compliance
- Have a credible answer when their head of security asks "what controls are on the agent's payment access?"
- Get their agent enterprise-ready without building a compliance platform

**Frustrations:**
- Every payment rail has a different SDK, auth mechanism, and error format
- Building audit logging from scratch is tedious and always incomplete
- No standard way to let the business deploying the agent set spending limits
- Credential secrets leaking into logs is a constant near-miss risk

**Success for Dev:** Install the Inflection SDK in under 30 minutes, replace all payment rail imports with Inflection clients, and never think about credential management or audit logs again.

---

### 3.2 Persona 2: The Operations / Finance Team (Agent Deployer)

**Name:** Ops  
**Role:** Head of Finance Operations or VP Engineering at a company deploying an AI agent built by a vendor or internal team  
**Technical level:** Medium — can use dashboards, understands API concepts, not writing code

**Context:** Ops's company has deployed an AI agent that handles vendor invoice payments. The agent was built by an internal AI team and is now in production. Ops is accountable for the money that moves through it. They have no real-time view of what the agent is spending, they only find out about large transactions after the fact, and they cannot easily pause or restrict the agent without going back to engineering.

**Goals:**
- Connect their existing Stripe or Circle account to the agent without handing over root API keys
- Set policies: max $10K per transaction, require CFO approval above $50K, block payments to certain countries
- Get notified immediately on Slack when a transaction is held for approval
- Approve or reject held transactions from Slack or the dashboard without calling engineering
- Export a full transaction audit log at end of quarter for the finance team

**Frustrations:**
- No visibility into agent spending until the bank statement arrives
- Human approval flows are bespoke webhook integrations that break
- Cannot enforce policy without code changes
- Audit logs (if they exist) are in raw application logs, not structured and exportable

**Success for Ops:** Log in to the Inflection dashboard, connect their Stripe account in 10 minutes, define a policy in 5 minutes, and receive their first Slack approval request the same day without touching engineering.

---

### 3.3 Persona 3: The Compliance Officer

**Name:** Compliance  
**Role:** CISO, Head of Compliance, or GRC Manager at a regulated enterprise  
**Technical level:** Low-to-medium — reviews systems and artifacts, does not write code

**Context:** Compliance's company is preparing for a SOC2 Type II audit and has AI agents processing payments in production. The auditor has asked for evidence of controls on automated financial transactions. Compliance has been told "the agent is logged" but when they look at the logs they see unstructured JSON blobs in CloudWatch with no integrity guarantee and no policy enforcement evidence.

**Goals:**
- Get a tamper-evident, append-only audit log of every financial action taken by every agent
- See evidence that policies were evaluated and applied for every transaction
- Export a clean, structured report for any date range, filterable by agent, rail, outcome
- Be able to demonstrate segregation of duties (the agent cannot modify its own policy or audit log)
- Get assurance that payment credentials are encrypted at rest and not accessible to the agent developer

**Frustrations:**
- Audit logs are only as reliable as the developers who wrote the logging code
- No integrity proof — logs can be modified or deleted
- No evidence of policy enforcement — the agent could have bypassed controls
- Cannot produce a compliance artifact without manual log-scraping

**Success for Compliance:** Pull up the Inflection dashboard, generate an export for Q4, and hand it to the auditor with a documented description of Inflection's append-only, hash-chained log architecture.

---

## 4. Core Features

### Priority Legend
- **P0** — Required for launch; product does not function without it
- **P1** — Required for any paying customer; ships in first month post-launch
- **P2** — High-value; ships in first quarter post-launch

---

### 4.1 SDK & Gateway (Developer Surface)

| Feature | Priority | Description |
|---|---|---|
| Inflection SDK (Node.js/TypeScript) | P0 | Single package with pre-authorized clients for all supported rails |
| Request interception | P0 | Every SDK client call is automatically routed through Inflection gateway |
| API key authentication for SDK | P0 | SDK authenticates to gateway with a developer API key |
| Blocked-by-default when no connector | P0 | If user has not connected a rail, calls to that rail are blocked |
| Python SDK | P1 | Python equivalent of the Node SDK |
| SDK error formatting | P1 | Standardized error responses across all rails with reason codes |
| Local development mode | P1 | SDK bypass mode for local dev that logs but does not enforce |
| Go SDK | P2 | Go equivalent |

---

### 4.2 Connector System (User Surface)

| Feature | Priority | Description |
|---|---|---|
| Stripe connector (OAuth) | P0 | Connect a Stripe account via OAuth; credentials encrypted at rest |
| Circle connector (API key) | P0 | Connect Circle account via API key; credentials encrypted |
| x402 connector (wallet address) | P0 | Configure an x402 wallet address for agent use |
| Square connector (OAuth) | P1 | Connect Square account |
| Braintree connector (API key) | P1 | Connect Braintree account |
| Razorpay connector (API key) | P1 | Connect Razorpay account |
| Multiple connectors per agent | P1 | An agent can have connectors to multiple rails simultaneously |
| Connector health status | P1 | Dashboard shows whether each connector is active/expired/erroring |
| Connector revocation | P0 | User can revoke a connector at any time; all subsequent agent calls to that rail are blocked immediately |

---

### 4.3 Policy Engine

Policies operate at **two tiers**: agent-level (cross-rail guards) and connector-level (per-rail, per-action rules). Every gateway call is evaluated against both tiers in sequence — agent rules run first, then connector rules. Both tiers must pass for the call to proceed.

#### Agent-Level Policy (Cross-Rail Guards)

These rules apply regardless of which rail is being called. They represent the highest-level constraints the deployer sets on the agent as a whole.

| Feature | Priority | Description |
|---|---|---|
| `allowedRails` | P0 | Whitelist of rails this agent is permitted to call. Calls to any unlisted rail are denied even if a connector exists. |
| `globalVelocityCheck` | P0 | Max N transactions per time window across **all rails combined**. Prevents an agent from bursting across multiple rails simultaneously to evade per-rail limits. |
| `globalDailyLimit` | P0 | Total spend ceiling per day across all rails combined. |
| `globalMonthlyLimit` | P1 | Total spend ceiling per month across all rails combined. |
| `blockedCountries` | P1 | Countries blocked for all rails (OFAC/sanctions use case). Evaluated before connector-level geography rules. |
| `blocklist` | P1 | Entities or domains blocked for all rails. |
| Default-deny (no policy) | P0 | An agent with no agent-level policy and no connector policies has all calls denied. A connector-level policy must exist for the relevant connector to allow calls. |
| Agent policy versioning | P1 | Changes to the agent policy create immutable versioned records; audit log entries reference the policy version that was active at call time. |

#### Connector-Level Policy (Per-Rail, Per-Action Rules)

Each connected account (connector) has its own independent policy. A Stripe connector and a Circle connector for the same agent can have entirely different rules. Connector-level rules are evaluated after agent-level rules pass.

| Feature | Priority | Description |
|---|---|---|
| `maxPerTransaction` | P0 | Block transactions above a per-call amount ceiling for this connector. |
| `dailyLimit` | P0 | Block transactions once this connector's daily spend is exceeded. |
| `requireHumanApproval` | P0 | Hold transactions above a configured amount on this connector for manual approval. |
| `velocityCheck` | P0 | Max N transactions per time window on this connector specifically. |
| `weeklyLimit` / `monthlyLimit` | P1 | Broader spend windows scoped to this connector. |
| `allowedCurrencies` | P1 | Restrict this connector to specific ISO 4217 currency codes. |
| `allowedCountries` | P1 | Restrict this connector to a recipient country whitelist. |
| `blockedCountries` | P1 | Block specific countries on this connector (supplements the agent-level blocklist). |
| `allowedActions` | P0 | Whitelist of provider API actions this connector may execute. E.g., allow `charges.create` and `refunds.create` but deny `payouts.create`. An agent that should never initiate payouts cannot accidentally do so. |
| `actionLimits` | P1 | Per-action amount overrides. E.g., refunds capped at $5,000 independently of the general `maxPerTransaction`. Format: `{ "refunds.create": { maxAmount: 5000 }, "payouts.create": { maxAmount: 50000 } }`. |
| `recipientDailyLimit` | P1 | Maximum cumulative spend to any single recipient ID (customer, wallet address, or account ID) per day on this connector. Prevents the agent from concentrating spend on one counterparty. |
| `scheduleWindow` | P2 | Restrict this connector to a time window (e.g., Mon–Fri 09:00–18:00 UTC). Calls outside the window are denied. |
| `singleTransactionRecipientCap` | P2 | Per-recipient cumulative cap over a rolling window (e.g., no more than $100k to any one recipient in 30 days). |
| Connector policy versioning | P1 | Same as agent policy versioning; each connector's policy is independently versioned. |
| Default-deny (no connector policy) | P0 | A connector with no policy attached allows only calls that pass the agent-level policy and have an explicitly set `allowedActions` list. A connector with no `allowedActions` defaults to denying all calls. |

---

### 4.4 Approval Flow

| Feature | Priority | Description |
|---|---|---|
| Transaction hold queue | P0 | Held transactions wait in queue; agent execution blocks or is notified async |
| Slack notification on hold | P0 | Configurable Slack webhook; notification includes transaction details and approve/reject links |
| Email notification on hold | P1 | Email notification to configured address |
| WhatsApp notification on hold | P2 | WhatsApp Business API notification |
| Approve from dashboard | P0 | User can approve/reject from the Inflection web dashboard |
| Approve from Slack | P1 | One-click approve/reject from Slack message |
| Approval timeout | P1 | Configurable timeout after which held transaction auto-denies |
| Approval reason field | P1 | Approver can add a reason note; recorded in audit log |
| Multi-approver | P2 | Require N of M approvers for transactions above a second threshold |

---

### 4.5 Audit Log

| Feature | Priority | Description |
|---|---|---|
| Append-only log | P0 | Audit entries cannot be modified or deleted |
| Hash-chained entries | P0 | Each entry includes the hash of the prior entry; chain integrity is verifiable |
| Structured log fields | P0 | timestamp, agentId, rail, action, args (sanitized), policyDecision, outcome, providerTxId, durationMs |
| Dashboard log viewer | P0 | Filterable, searchable log view in the dashboard |
| CSV/JSON export | P1 | Export filtered log range for compliance reporting |
| Per-agent log view for developers | P1 | Developer dashboard shows log across all deployments of their agent |
| Per-connector log view for users | P1 | User sees log scoped to their own connectors |
| Retention policy | P1 | 7-year default retention; configurable; deletion prohibited for chained entries |

---

### 4.6 Dashboard

| Feature | Priority | Description |
|---|---|---|
| User onboarding / account creation | P0 | Email/password + invite flow |
| Agent registration | P0 | User registers an agent by agent ID; connects it to their account |
| Connector management UI | P0 | Add, view, and revoke connectors |
| Policy editor UI | P0 | Form-based policy editor; JSON view for advanced users |
| Pending approvals UI | P0 | List of held transactions with approve/reject actions |
| Audit log UI | P0 | Filterable, paginated log view |
| Notification config UI | P1 | Configure Slack webhook, email, WhatsApp per agent |
| Spend analytics | P2 | Charts: daily spend, transaction count by rail, top action types |

---

## 5. User Stories

### 5.1 Developer Stories

**SDK Installation**
> As an agent developer, I want to install one npm package and replace my existing Stripe/Circle/x402 clients with Inflection-provided clients, so that all my payment calls are automatically intercepted without changing my business logic.

**Zero Credential Management**
> As an agent developer, I want to initialize the Inflection SDK with a single API key and never handle payment provider credentials in my codebase, so that I eliminate credential sprawl and rotation risk.

**Transparent Interception**
> As an agent developer, I want every financial API call my agent makes to pass through Inflection's gateway automatically, so that my agent gains policy enforcement without any per-call instrumentation from me.

**Clear Denial Feedback**
> As an agent developer, I want denied or held transactions to return a structured error with a reason code (POLICY_DENIED, HELD_FOR_APPROVAL, CONNECTOR_NOT_FOUND), so that my agent can handle these cases gracefully and surface appropriate messages.

**Local Development Bypass**
> As an agent developer, I want a local development mode that logs interception events but does not enforce policy or hit the gateway, so that I can develop and test my agent without needing a live Inflection configuration.

**Multi-Deployment Audit View**
> As an agent developer, I want to see an aggregate audit log across all deployments of my agent (all users who have connected it), so that I can debug issues and understand usage patterns without accessing any user's credentials.

**Agent Registration**
> As an agent developer, I want to register my agent with Inflection and receive a stable agent ID, so that the users who deploy my agent can identify and configure it in their dashboard.

---

### 5.2 Business / Deployer Stories

**Connect Payment Provider**
> As an operations manager, I want to connect my existing Stripe account to an agent via OAuth in the Inflection dashboard, so that the agent can process payments through my account without me sharing root API keys with the developer.

**Set Spend Limits**
> As a finance lead, I want to set a maximum per-transaction limit and a daily spend limit for each agent, so that the agent cannot exceed authorized spend thresholds without human intervention.

**Require Approval for Large Transactions**
> As a CFO, I want to configure the agent to hold any transaction above $5,000 for my approval, so that large disbursements require human sign-off before they execute.

**Receive Slack Approval Requests**
> As an operations manager, I want to receive a Slack notification when a transaction is held for approval, with the full transaction details and one-click approve/reject buttons, so that I can handle approvals without logging into a separate dashboard.

**Revoke Agent Access Instantly**
> As an operations manager, I want to revoke an agent's connector at any time with a single click, so that if an agent behaves unexpectedly I can cut off its payment access immediately without calling engineering.

**Restrict to Allowed Rails**
> As a finance lead, I want to configure an agent to only use specific payment rails (e.g., only Circle, no Stripe), so that payment flows go through approved channels.

**Block Geographic Regions**
> As a compliance officer, I want to configure a blocklist of countries for an agent, so that the agent cannot initiate transactions to sanctioned or unauthorized jurisdictions.

**View Full Transaction History**
> As an operations manager, I want to see a complete, filterable history of every financial action taken by each agent, so that I can reconcile agent activity against our books.

**Export Audit Log**
> As a finance analyst, I want to export the audit log for a date range to CSV, so that I can include agent transaction history in our monthly financial reporting.

---

### 5.3 Compliance Stories

**Tamper-Evident Audit Log**
> As a compliance officer, I want the audit log to be append-only and hash-chained, so that I can demonstrate to auditors that log entries have not been altered after the fact.

**Policy Enforcement Evidence**
> As a compliance officer, I want every audit log entry to record the policy decision (ALLOW/DENY/HOLD) and the policy version applied, so that I can prove to auditors that controls were in place and applied to every transaction.

**Credential Isolation**
> As a CISO, I want payment provider credentials to be stored encrypted at rest and not accessible to the agent developer, so that access to the codebase does not grant access to payment credentials.

**Compliance Export**
> As a GRC manager, I want to generate a structured audit report for any date range and export it to JSON or CSV, so that I can produce compliance artifacts for SOC2 or PCI DSS audits.

**Segregation of Duties**
> As a compliance officer, I want the agent to be incapable of modifying its own policy or audit log, so that I can demonstrate separation between the automated actor and the controls governing it.

---

## 6. Non-Functional Requirements

### 6.1 Latency

| Requirement | Target | Notes |
|---|---|---|
| Policy evaluation on hot path | < 5ms p99 | In-memory eval with Redis for stateful rules |
| Total gateway overhead (intercept → decision → forward) | < 10ms p99 | Excludes downstream provider latency |
| Approval notification delivery (Slack) | < 5 seconds | From gateway hold to Slack message |
| Dashboard page load | < 2 seconds | |

### 6.2 Availability

| Requirement | Target |
|---|---|
| Gateway uptime | 99.99% (< 52 min/year downtime) |
| Dashboard uptime | 99.9% |
| Data durability (audit log) | 99.999999999% (eleven nines) |

The gateway is the single most critical path. Any gateway outage blocks all agent financial operations for all customers simultaneously. Multi-region active-active deployment with automatic failover is required.

### 6.3 Security

- All data in transit over TLS 1.3 minimum
- Payment provider credentials encrypted at rest with AES-256-GCM using a KMS-managed key
- Developer API keys hashed (bcrypt/Argon2) before storage; never stored in plaintext
- Audit logs append-only at the storage layer; deletion not possible via any API surface
- No PAN (Primary Account Number) or card data stored at any point; Inflection is not a card processor
- All employee access to production systems via MFA and hardware key
- Penetration test before GA launch

### 6.4 Compliance Posture

- SOC2 Type II: Inflection commits to pursuing SOC2 Type II certification within 12 months of GA
- PCI DSS: Inflection handles no cardholder data (PANs, CVVs) and is scoped as a PCI-adjacent system; developers and users must not pass card data through the `args` field of execute calls
- GDPR: Audit log entries contain no personal data beyond agentId and opaque providerTxId; full GDPR deletion is not applicable to the append-only log (which stores no PII)
- OFAC/Sanctions: The `blockedCountries` policy primitive enables customers to implement their own sanctions screening; Inflection does not certify OFAC compliance on behalf of customers

### 6.5 Scalability

- Gateway must handle 10,000 requests/second per region at launch
- Audit log must be write-scalable to 1 million entries/day without degraded query performance
- Redis state (velocity counters, daily limits) must survive a node failure without loss; Redis Cluster with persistence required

### 6.6 Observability

- Gateway emits structured logs (JSON) for every request
- Prometheus metrics for gateway: request rate, latency p50/p95/p99, policy decision distribution (ALLOW/DENY/HOLD), error rate by rail
- Alerting on: gateway error rate > 0.1%, policy eval latency p99 > 8ms, Redis connectivity loss
- Distributed tracing (OpenTelemetry) across gateway → policy engine → connector → provider

---

## 7. Success Metrics

### 7.1 Activation Metrics

| Metric | Definition | v1 Target (90 days post-launch) |
|---|---|---|
| SDK installs | npm downloads of `@inflection/sdk` per month | 500 |
| Active agents | Distinct agent IDs with at least 1 gateway call in last 30 days | 50 |
| Connectors created | Total connectors across all users | 100 |
| Time-to-first-call | Median time from SDK install to first successful gateway call | < 30 minutes |

### 7.2 Policy Adoption Metrics

| Metric | Definition | v1 Target |
|---|---|---|
| Agents with policy configured | % of active agents with at least one non-default policy rule | > 70% |
| Policies with `requireHumanApproval` | % of active agents using approval threshold | > 30% |
| Approval flow activations | Distinct approval requests per week | 20 |
| Approval response time (median) | From hold notification to approve/reject action | < 30 minutes |

### 7.3 Audit Log Usage

| Metric | Definition | v1 Target |
|---|---|---|
| Dashboard log views | Unique user sessions viewing audit log per week | 40 |
| Exports generated | CSV/JSON exports per month | 20 |
| Audit entries written | Total log entries per day across all agents | 5,000 |

### 7.4 Retention & Growth

| Metric | Definition | v1 Target |
|---|---|---|
| Developer retention | % of developers making gateway calls in month 2 who also made calls in month 1 | > 60% |
| NPS | Net Promoter Score from developer survey | > 40 |
| Paid conversion | % of free-tier users converting to a paid plan within 60 days | > 20% |

---

## 8. Out of Scope for v1

The following are explicitly deferred to avoid scope creep and ensure a focused, shippable v1.

| Item | Rationale |
|---|---|
| Multi-approver / M-of-N approval | Adds significant workflow complexity; single approver handles the majority of cases |
| WhatsApp approval notifications | Integration complexity; Slack + email covers the initial market |
| Spend analytics / dashboards | Valuable but not blocking; raw audit log viewer ships first |
| Custom webhook notifications | Slack + email covers initial use cases; generic webhooks in v2 |
| Policy simulation / dry-run mode | Useful for testing policies; deferred to v2 |
| Go / Rust / Java SDKs | Node and Python cover the majority of agent frameworks today |
| Self-hosted / on-premise deployment | Significant operational burden; cloud-hosted only for v1 |
| Agent-to-agent delegation (sub-agent spending) | Complex trust model; single agent → policy → rail for v1 |
| ACH / wire transfers | Requires bank-level licensing complexity; card rails first |
| Automatic OFAC screening | Requires sanctions data feed license; `blockedCountries` primitive covers manual use case |
| Billing / metering of agent spend | Distinct product surface; tracked but not surfaced in v1 |
| Connector credential rotation automation | Manually initiated in v1; automated rotation in v2 |

---

## 9. Roadmap: v1 → v2 → v3

### v1: Foundation (Months 1–3)
**Theme:** Working product that solves the core loop end-to-end for early adopters

- [ ] Node.js / TypeScript SDK with Stripe, Circle, x402 clients
- [ ] Gateway: intercept → policy eval → forward / hold / deny
- [ ] Policy engine: maxPerTransaction, dailyLimit, requireHumanApproval, allowedRails, velocityCheck
- [ ] Connectors: Stripe (OAuth), Circle (API key), x402 (wallet address)
- [ ] Approval flow: hold queue, Slack notification, dashboard approve/reject
- [ ] Audit log: append-only, hash-chained, dashboard viewer
- [ ] Developer dashboard: agent registration, API key management
- [ ] User dashboard: connector management, policy editor, approvals, audit log
- [ ] Developer documentation and quickstart guide
- [ ] SOC2 Type II readiness work begins

---

### v2: Breadth (Months 4–6)
**Theme:** Complete the connector and SDK ecosystem; harden for enterprise

- [ ] Python SDK
- [ ] Square, Braintree, Razorpay connectors
- [ ] Email approval notifications
- [ ] Approve from Slack (one-click without leaving Slack)
- [ ] Policy primitives: weeklyLimit, monthlyLimit, allowedCurrencies, allowedCountries, blockedCountries, blocklist
- [ ] Policy versioning with audit log linkage
- [ ] CSV/JSON audit log export
- [ ] Approval timeout and auto-deny
- [ ] Connector credential rotation (manual initiation)
- [ ] Local development mode (bypass with structured logging)
- [ ] Spend analytics: daily spend chart, transaction count by rail
- [ ] Webhook-based custom notification delivery
- [ ] SOC2 Type II audit begins
- [ ] Policy simulation / dry-run mode

---

### v3: Enterprise & Ecosystem (Months 7–12)
**Theme:** Multi-org, deep compliance, ecosystem integrations

- [ ] Go SDK
- [ ] Multi-approver (M-of-N) approval flows
- [ ] WhatsApp Business API notifications
- [ ] RBAC for user accounts (admin, approver, read-only)
- [ ] SOC2 Type II certification
- [ ] PCI DSS scoping documentation and evidence package
- [ ] Automated connector credential rotation
- [ ] Self-hosted / on-premise deployment option (for regulated industries)
- [ ] Agent-to-agent delegation model with sub-agent spend limits
- [ ] Automatic OFAC / sanctions list screening
- [ ] Agent spend billing and metering (for SaaS agents billing their users for agent spend)
- [ ] API for programmatic policy management (for IaC / GitOps policy management)
- [ ] Terraform provider for Inflection policy-as-code
