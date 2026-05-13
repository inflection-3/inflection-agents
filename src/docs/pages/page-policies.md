# Page: Policies (/policies)

Route: `/policies`  
Persona: Ops, Finance  
Purpose: Configure two tiers of policy for each agent. Tier 1 (agent-level) sets cross-rail guards. Tier 2 (connector-level) sets per-rail, per-action rules. Both must pass for a transaction to execute.

---

## Two-Tier Mental Model

```
Gateway call arrives
        │
        ▼
┌─────────────────────────────────┐
│  TIER 1 — Agent Policy          │  "What can this agent do at all?"
│  • allowedRails                 │
│  • globalDailyLimit             │
│  • globalVelocityCheck          │
│  • blockedCountries (global)    │
│  • blocklist (global)           │
└──────────────┬──────────────────┘
               │ PASS
               ▼
┌─────────────────────────────────┐
│  TIER 2 — Connector Policy      │  "What can this agent do on Stripe specifically?"
│  • allowedActions               │
│  • actionLimits (per-action $)  │
│  • maxPerTransaction            │
│  • dailyLimit / weeklyLimit     │
│  • requireHumanApproval         │
│  • velocityCheck                │
│  • allowedCurrencies            │
│  • allowedCountries             │
│  • recipientDailyLimit          │
│  • scheduleWindow               │
└──────────────┬──────────────────┘
               │ PASS
               ▼
           EXECUTE
```

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Policies"                                   │
├──────────────────────────────────────────────────────┤
│ Agent selector: [vendor-pay-agent ▾]                 │
├──────────────────────────────────────────────────────┤
│ ┌─ TIER 1: Agent Policy ─────────────────────────┐  │
│ │  Cross-rail guards    Policy v3  [Edit] [History]│ │
│ │                                                  │ │
│ │  Allowed Rails: stripe  circle  x402            │ │
│ │  Global Daily Limit: $500,000                   │ │
│ │  Global Velocity: max 200 tx / hour             │ │
│ │  Blocked Countries: KP, IR, CU, SY              │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ TIER 2: Connector Policies ───────────────────┐  │
│ │  [stripe tab] [circle tab] [x402 tab]           │  │
│ │                                                  │ │
│ │  stripe — vendor-pay-agent                       │ │
│ │  Connector Policy v2  [Edit] [History]           │ │
│ │                                                  │ │
│ │  Allowed Actions                                 │ │
│ │    charges.create  refunds.create                │ │
│ │    customers.create                              │ │
│ │                                                  │ │
│ │  Action Limits                                   │ │
│ │    charges.create:  max $10,000                  │ │
│ │    refunds.create:  max $5,000                   │ │
│ │                                                  │ │
│ │  Spend Limits                                    │ │
│ │    Per transaction: $10,000                      │ │
│ │    Daily: $50,000  Weekly: $200,000              │ │
│ │                                                  │ │
│ │  Human Approval: above $5,000                   │ │
│ │  Velocity: max 100 tx / hour                    │ │
│ │  Currencies: USD, EUR, GBP                      │ │
│ │  Countries: US, GB, DE, FR, CA                  │ │
│ │  Recipient daily cap: $25,000                   │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Components

### Agent Selector
`Select` dropdown at top of page. Changing agent reloads both policy tiers. Options are the user's registered agents.

---

### `<AgentPolicyCard>` — Tier 1

shadcn `Card` with `CardHeader` "Agent Policy — Cross-Rail Guards" and policy version badge.

Displays current rules as read-only chips/values. `[Edit]` button opens `<AgentPolicyEditDialog>`. `[History]` shows version list in a `Sheet`.

**Read-only display rows:**

| Rule | Display |
|------|---------|
| allowedRails | Colored rail `Badge` chips |
| globalDailyLimit | "$500,000 / day across all rails" |
| globalMonthlyLimit | "$2,000,000 / month across all rails" |
| globalVelocityCheck | "Max 200 transactions per hour (all rails)" |
| blockedCountries | Country code chips or "None" |
| blocklist | Count of entities + domains, expandable |

**No agent policy set:** yellow warning: "No agent-level policy. All rails are accessible and no cross-rail limits apply. Consider adding a global daily limit."

**Mock data:**
```ts
const agentPolicy = {
  policyId: "apol_v3_abc123",
  agentId: "agt_7x2kp9mn",
  version: 3,
  updatedAt: "2026-05-10T14:22:00Z",
  rules: {
    allowedRails: ["stripe", "circle", "x402"],
    globalVelocityCheck: { maxTransactions: 200, windowSeconds: 3600 },
    globalDailyLimit: { amount: 500000, currency: "USD" },
    blockedCountries: ["KP", "IR", "CU", "SY"],
    blocklist: { entities: ["Sanctioned Entity LLC"], domains: [] },
  },
}
```

### `<AgentPolicyEditDialog>`
shadcn `Dialog`. Fields:

- **Allowed Rails**: `CheckboxGroup` (only shows rails with active connectors) 
- **Global Daily Limit**: `Input` with `$` prefix
- **Global Monthly Limit**: `Input` with `$` prefix
- **Global Velocity**: `Input` (count) + `Select` (window: 5m / 15m / 1h / 24h)
- **Blocked Countries**: multi-select combobox (ISO country codes with names)
- **Blocklist entities**: `Textarea` (one per line)
- `[Cancel]` / `[Save — creates v{n+1}]`

Saving creates a new immutable version. Shows "This will create Policy v4" in the save button.

---

### `<ConnectorPolicyTabs>` — Tier 2

shadcn `Tabs` — one tab per connected rail for the selected agent.

Each tab shows the connector name + status chip. If the connector has no policy: red `Badge` "No policy — all calls DENIED".

### `<ConnectorPolicyCard>` (content of each tab)

Same read-only → edit pattern as the agent policy card.

**Sections:**

#### Allowed Actions
`Badge` chips for each allowed action. Missing = all actions denied.

Available actions per rail:

**Stripe:** `charges.create`, `charges.retrieve`, `customers.create`, `customers.update`, `paymentIntents.create`, `paymentIntents.confirm`, `refunds.create`, `payouts.create`, `subscriptions.create`, `subscriptions.cancel`

**Circle:** `transfers.create`, `payouts.create`, `wallets.create`, `wallets.transfer`

**x402:** `pay`, `getBalance`

#### Action Limits
Table: Action | Max Amount

```ts
// stripe connector policy example
actionLimits: {
  "charges.create":  { maxAmount: 10000, currency: "USD" },
  "refunds.create":  { maxAmount: 5000,  currency: "USD" },
  "payouts.create":  { maxAmount: 50000, currency: "USD" },
}
```

Displayed as:
```
charges.create    $10,000 max
refunds.create    $5,000 max
payouts.create    $50,000 max
```

Actions in `allowedActions` but not in `actionLimits` have no per-action cap (only the `maxPerTransaction` applies).

#### Spend Limits
- Per transaction: `$10,000`
- Daily: `$50,000`
- Weekly: `$200,000`
- Monthly: (not set)

#### Human Approval
- Threshold: `above $5,000` → "Transactions above $5,000 are held for human approval"

#### Velocity
- `max 100 transactions per hour on this connector`

#### Geography
- Currencies: `USD`, `EUR`, `GBP`
- Allowed countries: `US`, `GB`, `DE`, `FR`, `CA`
- Additional blocked countries: (supplements agent-level list)

#### Recipient Daily Cap
- `$25,000 max per recipient per day`
- Muted explanation: "Prevents concentrating spend on a single customer or counterparty"

#### Schedule Window (P2)
- "Business hours only: Mon–Fri 09:00–18:00 UTC" or "Not configured"

**Full mock connector policies:**
```ts
const stripeConnectorPolicy = {
  policyId: "cpol_v2_stripe_001",
  connectorId: "con_stripe_001",
  rail: "stripe",
  version: 2,
  updatedAt: "2026-05-10T14:30:00Z",
  rules: {
    allowedActions: ["charges.create", "refunds.create", "customers.create"],
    actionLimits: {
      "charges.create": { maxAmount: 10000, currency: "USD" },
      "refunds.create": { maxAmount: 5000,  currency: "USD" },
    },
    maxPerTransaction:    { amount: 10000, currency: "USD" },
    dailyLimit:           { amount: 50000, currency: "USD" },
    weeklyLimit:          { amount: 200000, currency: "USD" },
    requireHumanApproval: { above: 5000, currency: "USD" },
    velocityCheck:        { maxTransactions: 100, windowSeconds: 3600 },
    allowedCurrencies:    ["USD", "EUR", "GBP"],
    allowedCountries:     ["US", "GB", "DE", "FR", "CA"],
    recipientDailyLimit:  { amount: 25000, currency: "USD" },
    scheduleWindow:       null,
  },
}

const circleConnectorPolicy = {
  policyId: "cpol_v1_circle_001",
  connectorId: "con_circle_001",
  rail: "circle",
  version: 1,
  updatedAt: "2026-04-15T09:00:00Z",
  rules: {
    allowedActions: ["transfers.create"],
    actionLimits: {
      "transfers.create": { maxAmount: 100000, currency: "USD" },
    },
    maxPerTransaction:    { amount: 100000, currency: "USD" },
    dailyLimit:           { amount: 500000, currency: "USD" },
    requireHumanApproval: { above: 25000, currency: "USD" },
    velocityCheck:        { maxTransactions: 20, windowSeconds: 3600 },
    allowedCurrencies:    ["USD", "USDC"],
    recipientDailyLimit:  { amount: 200000, currency: "USD" },
  },
}

const x402ConnectorPolicy = {
  policyId: "cpol_v1_x402_001",
  connectorId: "con_x402_001",
  rail: "x402",
  version: 1,
  rules: {
    allowedActions: ["pay"],
    actionLimits: {
      "pay": { maxAmount: 500, currency: "USD" },
    },
    maxPerTransaction:    { amount: 500, currency: "USD" },
    dailyLimit:           { amount: 2000, currency: "USD" },
    requireHumanApproval: null,
    velocityCheck:        { maxTransactions: 50, windowSeconds: 3600 },
    allowedCurrencies:    ["USD", "USDC", "ETH"],
  },
}
```

### `<ConnectorPolicyEditDialog>`
shadcn `Dialog` with sections matching the read-only view. Key interactions:

**Allowed Actions section:**
`Checkbox` group showing all known actions for this rail. Each action has a tooltip explaining what it does.  
Below each checked action: optional `Input` for an action-specific max amount ("Add limit for this action").

**Why `allowedActions` matters — shown as info callout:**
```
Without an allowedActions list, all calls to this connector are DENIED.
This is intentional: explicitly state what your agent is allowed to do.
```

**Recipient Daily Cap section:**
`Switch` + `Input`. Tooltip: "Caps total spend to any single customer, wallet address, or account in a 24-hour window."

**Schedule Window section (P2):**
`Switch` (disabled with "Available in v2" badge) — shows the concept without being buildable yet.

**Save behavior:** creates a new connector policy version. Button label: "Save — creates Stripe Policy v3".

### `<PolicyVersionSheet>`
shadcn `Sheet` (slides in from right). Shows all versions of either the agent or connector policy.

Each version row: version number, date, changed by, summary of what changed.

Clicking a version shows a diff view: old rules vs new rules side by side (simple key-value diff, not code diff).

---

## Design Notes

- Page has clear visual hierarchy: Tier 1 card always on top, Tier 2 tabs below
- Tier 1 card uses `border-l-4 border-l-primary` (lime) to signal it's the top-level guard
- Tier 2 tabs use rail-specific left border colors (Stripe purple, Circle blue, x402 lime)
- Missing `allowedActions` on a connector shows a prominent red warning, not just a gray chip
- The "what changed" diff in version history uses simple `bg-green-500/10` / `bg-red-500/10` row coloring
- JSON view toggle available in both edit dialogs for power users
- Policy version footer: "Agent Policy v3 · saved May 10 · by sarah@acme.com"
