# Inflection MVP

## North Star

One design partner — a specific neobank or fintech — live in production, with their customers interacting with company-built agents (Mode A) and creating their own personal agents (Mode B) through an embedded chat widget, all running on Inflection's canvas + runtime.

**MVP is done when:** a real end user at the design partner opens the embedded widget, describes what they want their agent to do, and it runs on a schedule without intervention.

---

## Success Criteria

| Criterion | Measurable definition |
|---|---|
| Design partner live | At least one company has the embed deployed in their product |
| Mode A working | Company-built flow runs end-to-end via embed |
| Mode B working | End user creates a personal agent in plain English, it runs on a cron schedule |
| 3 connectors functional | Plaid + Stripe + Custom API all execute real actions in production |
| Audit trail complete | Every execution step logged, PII-redacted, append-only |
| HITL working | At least one approval gate works (action pauses, email sent, resumes on approval) |

---

## What Is In the MVP

### Company Layer (B2B)
- Visual drag-and-drop canvas — build flows with node graph UI
- Node types (MVP — 10 nodes): **Input, Output, LLM, Connector, If/Else, Memory, Variable, HITL, Send Email, HTTP Request**
- Custom Connector import — companies bring their own APIs via OpenAPI spec or manual builder; each action becomes a canvas node
- ADLC: Draft + Production only (Staging skipped for MVP)
- Native connector library: Plaid (8 actions), Stripe (13 actions + webhook triggers), Custom HTTP
- Guardrail config: action allowlist, rate limits, approval triggers, kill switch
- Dashboard: flows, connectors (native + custom), policies, approvals, audit logs, analytics (basic)
- JWT-based embed auth (company signs JWT with their private key, passes end-user context)

### Runtime (Core)
- Flow execution engine — sequential node execution from graph JSON
- Guardrail enforcer — checks every execution against company policy
- HITL handler — pause on approval node, notify via email, resume on response
- Audit writer — append-only, PII-redacted, hash-chained rows
- Scheduler — cron-based execution via BullMQ
- SSE streaming — real-time execution progress to embed
- Memory store — per-user, per-agent, persistent across runs

### End-User Layer (B2B2C)
- Embeddable chat widget — single script tag, white-label, zero Inflection branding
- Mode A — users talk to company-built fixed agent
- Mode B — users describe what they want → LLM maps to palette → personal agent created
- Personal agent management: list, view history, pause, delete, reschedule
- Embedded SDK — `@inflection/embed` npm package with full customization API

---

## What Is NOT in the MVP (Phase 2+)

| Deferred | Phase | Reason |
|---|---|---|
| Loop / AI Routing / Merge / Delay nodes | Phase 2 | If/Else + LLM covers initial use cases |
| Knowledge Base / RAG node | Phase 2 | First use cases are action-based |
| Financial data nodes (Polygon, SEC EDGAR, S&P Global, FRED) | Phase 2 | Add after design partner live |
| ERP/Accounting connectors (NetSuite, Workday, QuickBooks, Xero) | Phase 2 | High-value; add for second customer or enterprise deal |
| Calendar & scheduling nodes (Google Calendar, Outlook, Calendly, Meeting Scheduler) | Phase 2 | Strong demand from financial ops; build post-MVP |
| Communication: Slack, SMS, multi-channel notification | Phase 2 | Email covers MVP; add Slack for enterprise push |
| Data processing nodes (Transform, Aggregate, Spreadsheet, PDF) | Phase 2 | Add when workflow automation complexity increases |
| Webhook Trigger / Webhook Send / Zapier | Phase 2 | HTTP Request covers one-way; bidirectional webhooks next |
| MCP server import for custom connectors | Phase 2 | OpenAPI import covers MVP; MCP adds broader ecosystem |
| Slack / WhatsApp surfaces | Phase 2 | Web embed is sufficient for design partner |
| ADLC Staging stage | Phase 2 | Draft → Prod enough at one partner |
| SCIM provisioning | Phase 3 | Not required until 10+ company customers |
| SOC 2 / ISO 27001 | Phase 4 | Post design partner, pre Series A |
| Self-hosted / on-premise | Phase 4 | Enterprise add-on |
| Batch run surface | Phase 3 | Not needed for B2B2C model |
| Additional payments (Circle, Square, Braintree) | Phase 2 | Stripe + Plaid covers most neobank use cases |

---

## MVP Connector Set

### 1. Plaid (native)
- `plaid.getBalance`, `plaid.getTransactions`, `plaid.getIdentity`, `plaid.getIncome`
- `plaid.getLiabilities`, `plaid.getInvestments`, `plaid.getAssetReport`, `plaid.exchangePublicToken`

### 2. Stripe (native)
- Read: `stripe.getCustomer`, `stripe.listPaymentMethods`, `stripe.getSubscription`, `stripe.listInvoices`, `stripe.getBalance`, `stripe.listTransactions`
- Write (HITL by default): `stripe.createPaymentIntent`, `stripe.confirmPayment`, `stripe.createCharge`, `stripe.createRefund`, `stripe.createSubscription`, `stripe.cancelSubscription`, `stripe.createPayout`
- Webhook triggers: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_failed`, `customer.subscription.deleted`

### 3. HTTP Request (native)
- Generic REST connector for one-off API calls not covered by a custom connector
- Auth: API key, Bearer, Basic, OAuth2 client credentials

### 4. Custom Connector Import (MVP — the most important one)

Companies import their own internal APIs and they become first-class nodes on the canvas.

**Two import methods in MVP:**

**Method A — OpenAPI spec import** (recommended):
1. Paste spec URL or upload `.yaml`/`.json`
2. Configure auth once (API key, Bearer, OAuth2, Basic, Custom header)
3. Review discovered endpoints — enable/disable, rename, write LLM-readable descriptions
4. Mark which actions end users can access in Mode B
5. Set per-action HITL requirements

**Method B — Manual action builder**:
1. Define action: name, description, HTTP method, URL template, parameters
2. Or paste a cURL command → Inflection parses it
3. Test the action with sample data before saving

Once imported, custom connector actions appear in the canvas sidebar under **"Your Connectors"** — visually identical to native nodes, draggable into any flow.

End users in Mode B see these as tools they can use to build personal agents, using the descriptions the company wrote during import.

See `custom-connectors.md` for the full spec.

---

## Mode B — Personal Agent Creation (Minimum Viable)

The full Mode B loop that must work in MVP:

1. User opens embed widget
2. User types: "Send me my balance every morning and alert me if I'm under $500"
3. Inflection LLM reads the company's palette (list of available flows/actions)
4. LLM generates an agent config: `{ trigger: cron("0 9 * * *"), flow: [...nodes...], params: { threshold: 500 } }`
5. Guardrail check: are all actions in this config on the company's allowlist?
6. Widget shows: "I'll check your balance every morning and alert you if it falls below $500. Confirm?"
7. User confirms → PersonalAgent record created, schedule registered
8. Agent runs every morning at 9am → executes flow → sends alert if condition met
9. User can see agent in their list, view run history, pause, or delete

---

## Embedded SDK — Customization Surface

Companies control the embed via SDK config at init time:

```js
InflectionEmbed.init({
  workspaceId: "ws_abc123",
  token: "eyJhbGc...", // company-signed JWT
  mode: "b", // "a" | "b" | "both"
  palette: ["check_balance", "set_alert", "send_money"], // optional filter
  theme: {
    primaryColor: "#1a56db",
    borderRadius: "12px",
    fontFamily: "Inter, sans-serif",
    logoUrl: "https://company.com/logo.png",
    agentName: "Aria", // what the agent is called in UI
    poweredBy: false, // hide "Powered by Inflection"
  },
  position: "bottom-right", // "bottom-left" | "bottom-right" | "inline"
  containerId: "my-div", // if inline
  onAgentCreated: (agent) => { ... },
  onExecutionComplete: (result) => { ... },
  onError: (error) => { ... },
});
```

---

## Timeline

Solo/2-engineer team, 6–8 weeks:

| Weeks | Focus |
|---|---|
| 1–2 | Monorepo setup, data model, workspace auth, flow CRUD |
| 2–3 | Canvas UI (React Flow) — 10 MVP node types + canvas polish |
| 3–4 | Plaid + Stripe native connectors + **Custom Connector import** (OpenAPI + manual) |
| 4–5 | Execution engine + SSE streaming + embed widget (Mode A) |
| 5–6 | Guardrails + HITL |
| 6–7 | Mode B (personal agent creation) + Scheduler |
| 7–8 | Memory + Embed SDK polish + Audit log + Design partner onboarding |

**Phase 2 (Weeks 9–16, post-design-partner):**
Financial data nodes (Polygon, SEC EDGAR), ERP connectors (NetSuite, Workday), Calendar/Scheduling nodes, Slack/SMS communication, Data processing nodes, Webhook triggers, Loop/AI Routing nodes, Knowledge Base (RAG).
