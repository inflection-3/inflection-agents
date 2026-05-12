# Inflection — Story Deck

---

## Slide 1 — The Opening

# Your customers want AI that actually does things.

Not a chatbot that answers questions.
Not a copilot that suggests next steps.

An agent that **wakes up on Sunday morning, finds the cheapest hotel, books it with your card, and sends you a confirmation** — all without you touching your phone.

That's what your customers are about to start expecting.

---

## Slide 2 — The Character (Your Customer)

# Meet Maya.

Maya uses your neobank app. She checks her balance every morning. She has three subscriptions she keeps meaning to cancel. She's got a savings goal she never quite hits.

She doesn't want a dashboard. She doesn't want nudges.

She wants to say:

> *"Cancel any subscription I haven't used in 30 days and move that money into my savings account."*

And have it **done**.

---

## Slide 3 — The Problem

# You want to give Maya that experience.

Your product team has been talking about it for a year.

But here's what it actually takes to build it:

- A secure credential vault for every API call Maya's agent makes
- A tamper-proof audit log of every action (your compliance team will not accept "we think it worked")
- Hard guardrails — what can Maya's agent do, what can it not do, what needs a human to approve
- A human-in-the-loop system for high-risk actions
- A way for Maya to see every step her agent took and roll it back if something goes wrong
- Scheduled execution infrastructure that fires at 7am every Monday without you thinking about it

**That's 12–18 months of engineering before Maya can do anything.**

Most teams either don't start, or start and never ship.

---

## Slide 4 — The Turn

# What if you didn't have to build any of that?

What if all of it — the vault, the audit trail, the guardrails, the approvals, the scheduler, the streaming UI — was already running?

And all you had to do was:

1. Connect your existing APIs
2. Write a short definition of what each one can do
3. Drop one script tag into your app

**And Maya gets her agent.**

---

## Slide 5 — The Solution

# Inflection is the agent runtime for financial services.

We sit between your APIs and your customers.

You bring:
- Your core banking API
- Your payments rails
- Your KYC provider
- Your communications layer

We bring:
- The runtime that executes every agent safely
- The vault that stores credentials the right way
- The guardrails your compliance team actually needs
- The audit trail your auditors can export to their SIEM
- The white-labeled chat UI Maya talks to inside your product

**You don't build the runtime. You ship the experience.**

---

## Slide 6 — How It Works

# Three steps. One week.

**Step 1: Connect your APIs**
Add your connectors — OAuth, API key, or mTLS. Credentials go straight to HashiCorp Vault under your namespace. We run a shadow test to confirm they work.

**Step 2: Define your skills**
Write a short markdown file describing what each connector can do. "Get Account Balance." "Initiate Transfer." "Cancel Subscription." We parse it, validate it, and auto-generate the system prompt that tells the AI what it's allowed to do.

**Step 3: Set your guardrails and ship**
Define exactly what your users can and can't do — which skills they can access, rate limits, budget caps, which actions need human approval. Drop the web component into your app. Maya is live.

**First agent running in under a week.**

---

## Slide 7 — What Maya Sees

# Maya opens your app and types:

> *"Send me my account balance every morning at 8am."*

Inflection maps her intent to your "Get Account Balance" skill.
Checks it against your guardrails — allowed, no approval needed.
Creates the agent. Schedules it.

**Tomorrow at 8am, Maya gets her balance. No prompts. No dashboards. It just works.**

She watches every step in real time. She can pause it, edit it, roll it back to yesterday's version if she changes her mind.

Your compliance team can pull every single step she took — every API call, every output — in a tamper-proof, PII-redacted log that's ready for their SIEM.

---

## Slide 8 — What You Control

# You decide what agents can and cannot do.

- **Allowlists** — only the skills you approve
- **Rate limits** — max executions per user per day
- **Budget caps** — hard stop if an agent's LLM cost exceeds your threshold
- **Required approvals** — "any transfer over $500 pauses and waits for a human to approve"
- **Kill switch** — one button to stop every agent instantly, running executions cancelled in seconds

Your compliance team isn't watching. They're covered by design.

---

## Slide 9 — The Audit Trail

# Every step. Forever. Tamper-proof.

Every agent execution writes an immutable audit log — stored in S3 Object Lock, signed with a checksum, PII redacted at write time.

Your auditor can:
- Filter by date, agent, user, event type
- Export to CSV, JSON, Splunk, Datadog
- Verify no tampering — the checksum proves it

**This isn't a nice-to-have. It's what makes enterprise deals close.**

---

## Slide 10 — The Market

# Every financial services company is about to need this.

The expectation is shifting. Customers who use AI tools in their personal life will demand the same from their bank. Companies that can't ship agent experiences will lose.

Building the runtime from scratch:
- 12–18 months
- 4–6 senior engineers
- Every company solves the same problems independently

**There's no reason to build this twice.**

Inflection is the infrastructure layer — like Stripe for payments, Twilio for SMS, Plaid for bank data. You don't build it. You plug in.

---

## Slide 11 — Why Now

# The window is 12–18 months.

AWS, Google, and Microsoft are all building vertical agent platforms. When they get to financial services, they'll have distribution and pricing pressure we can't match.

But they won't have:
- The financial connector library
- The compliance-by-default runtime built for this industry
- The B2B2C embedding model
- The domain depth

The companies that build on Inflection now get:
- A head start on the agent experience before competitors ship
- A runtime that compounds — every new connector and skill benefits every tenant
- A partner who is building for financial services, not adapting a generic platform

---

## Slide 12 — The Ask

# What we're building and where we're going.

**Today:** Core runtime live. Connector framework, skill validation, agent execution, audit log, kill switch, scheduled agents, white-labeled chat UI.

**Month 3:** First agents running in real products at pilot companies.

**Month 5:** Compliance-ready — human-in-the-loop approvals, full audit export, SIEM integrations.

**Month 7:** Marketplace — pre-built connectors for Plaid, Stripe, Jumio, Temenos, FIS. First paying customers.

**We're looking for 3–5 pilot companies** to go from zero to their first user-facing agent in under a week — with hands-on support from the Inflection team.

---

## Slide 13 — The Close

# Maya is waiting.

She doesn't know it yet. But the moment your competitor ships an agent that actually does what she asks — she'll know something is different.

You can ship that experience first.

**Inflection gives you the runtime. You bring the APIs.**

Let's get Maya's first agent running.

---

*inflection.ai — contact@inflection.ai*

---

## Deck Color System — Light Mode

Pulled directly from `dashboard/src/styles.css` `:root` (light mode tokens).

### Core Palette

| Role | Token | Value | Hex approx |
|---|---|---|---|
| **Primary / Brand** | `--primary` | `oklch(0.88 0.22 116)` | `#BAFC00` — electric lime |
| Primary text on brand | `--primary-foreground` | `oklch(0.145 0 0)` | `#1a1a1a` — near black |
| Background | `--background` | `oklch(1 0 0)` | `#ffffff` — pure white |
| Body text | `--foreground` | `oklch(0.145 0 0)` | `#1a1a1a` — near black |
| Card / surface | `--card` | `oklch(0.97 0 0)` | `#f7f7f7` — off white |
| Card text | `--card-foreground` | `oklch(0.145 0 0)` | `#1a1a1a` |
| Muted text | `--muted-foreground` | `oklch(0.556 0 0)` | `#737373` — mid gray |
| Borders | `--border` | `oklch(0.922 0 0)` | `#e8e8e8` — light gray |
| Destructive | `--destructive` | `oklch(0.577 0.245 27.325)` | `#e53e1a` — red |

### Slide Background & Text Rules

| Slide element | Color to use |
|---|---|
| Slide background | `#ffffff` (white) |
| Section dividers / hero slides | `#BAFC00` background, `#1a1a1a` text |
| Body text | `#1a1a1a` |
| Supporting / secondary text | `#737373` |
| Cards / callout boxes | `#f7f7f7` with `#e8e8e8` border |
| CTA buttons | `#BAFC00` fill, `#1a1a1a` label |
| Danger / warning callouts | `#e53e1a` |

### Chart / Data Colors

| | Token | Use for |
|---|---|---|
| Chart 1 — Brand | `oklch(0.88 0.22 116)` = `#BAFC00` | Primary data series |
| Chart 2 — Blue | `oklch(0.67 0.15 220)` ≈ `#3a82c4` | Secondary data series |
| Chart 3 — Yellow | `oklch(0.85 0.18 85)` ≈ `#d4c200` | Tertiary |
| Chart 4 — Amber | `oklch(0.75 0.15 50)` ≈ `#c07a20` | Quaternary |
| Chart 5 — Red-orange | `oklch(0.65 0.18 15)` ≈ `#c44020` | Quinary |

### Typography

| | Value |
|---|---|
| Font | **Inter Variable** (`@fontsource-variable/inter`) |
| Heading font | Inter Variable (same as body) |
| Border radius base | `0.625rem` (10px) |

### Usage Notes

- The `#BAFC00` lime is the only brand color — use it sparingly as an accent and CTA, not as a background on every slide
- Hero / chapter-break slides work well with `#BAFC00` full-bleed background + black text
- Keep slide backgrounds `#ffffff` or `#f7f7f7` for readability
- Muted gray (`#737373`) for captions, footnotes, and supporting copy only
