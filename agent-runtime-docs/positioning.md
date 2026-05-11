# Inflection — Market Positioning Document

_Last updated: 2026-05-12_

---

## One-Line Position

**"Inflection is the compliant agent runtime for financial services — plug in your APIs and your customers get a working AI agent in weeks, not months."**

---

## The Analogy

Twilio for SMS. Stripe for payments. **Inflection for AI agents.**

Companies don't want to manage agent runtimes any more than telcos wanted to manage SMS infrastructure. Inflection is the infrastructure layer — companies plug in their skills and connectors, and their end users get AI agents.

---

## The Market Gap

No platform today simultaneously offers:
- Managed runtime infrastructure
- Financial compliance layer (audit trails, explainability, human-in-the-loop)
- Embeddable end-user experience (B2B2C)

Today's options:
| Path | Cost | Time |
|---|---|---|
| Build on LangChain / Bedrock | $2M+ engineering | 12–18 months |
| Salesforce Agentforce FSC | $150/user/month + $2–5/conversation | Locked to Salesforce stack |
| Zapier / Relevance AI | Cheap | No compliance, no embedding |
| **Inflection** | Pay-per-execution | Weeks to ship |

---

## Who We Target (ICP)

**Primary:** Mid-tier fintechs, embedded finance companies, neobanks in emerging markets.
- Engineering-capable but not engineering-heavy
- Want to ship customer-facing AI agents
- Can't afford 18 months of runtime engineering
- Too small for Salesforce to care about them

**Secondary:** Larger neobanks that want a fast internal prototype before deciding to build vs. buy.

**Avoid (for now):** Nubank, Revolut, Robinhood — engineering-heavy, already building in-house.

---

## What We Sell

**To CTOs / Engineering leads:**
Infrastructure. Managed runtime, pre-built financial connectors, compliance baked in. Call our API or embed our UI. Ship in weeks.

**To CPOs / Product leads:**
Speed. Your customers get an AI agent experience without your team building the runtime.

**To Compliance officers:**
Control. Full audit trails, explainability, human-in-the-loop escalations, data residency options. You define what agents can and cannot do.

---

## Pricing Model

Stripe-style: **pay-per-execution**.
- Per conversation / per agent action
- No per-seat tax on the company's customer base
- Platform fee for access to premium connectors
- Enterprise: flat monthly + overage

---

## Competitive Landscape

| Competitor | Threat Level | Gap We Exploit |
|---|---|---|
| AWS Bedrock AgentCore | High (12–18mo window) | Requires heavy engineering; no end-user UI; no FS compliance layer |
| Salesforce Agentforce FSC | Medium | Prohibitively expensive; Salesforce lock-in; not embeddable |
| Microsoft Copilot Studio | Medium | Microsoft stack only; no white-label; compliance incomplete |
| Uptiq.ai | High (closest analog) | Internal workflow focus; not a B2B2C runtime; no API model |
| LangChain / LangGraph | Low (different category) | Framework, not platform; every company re-solves the same problems |
| Zapier / Relevance AI | Low | No compliance, no FS domain knowledge, not embeddable |

---

## The 3 Risks to Validate

1. **Hyperscalers move into vertical FS** — ~12 month window before AWS/Google ship "Bedrock AgentCore for Financial Services." Need to build connector depth they can't replicate fast.

2. **Big neobanks build vs. buy** — ICP is mid-tier, not giants. Validate with 3–5 target customers in 90-day pilot: "Would you have spent 12+ months building this without Inflection?"

3. **Regulatory liability can't be abstracted** — Map what Inflection can own vs. what the fintech must own before going to market. Run by a compliance lawyer at 3 target banks.

---

## The Moats (How We Stay Defensible)

1. **Compliance by default** — Audit trails, explainability, HITL baked into the runtime. Competitors built on generic infra have to add this later.
2. **Financial connector library** — Pre-built integrations to Plaid, Stripe, core banking (Temenos, FIS, Fiserv), KYC/AML providers. Compounds over time.
3. **B2B2C runtime model** — The ability to embed agent experiences into a company's branded product is not something hyperscalers optimize for.
4. **Network effects** — Every new skill/connector added benefits all tenants; every new tenant adds signal to the runtime.
