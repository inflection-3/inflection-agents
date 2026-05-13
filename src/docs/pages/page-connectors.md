# Page: Connectors (/connectors)

Route: `/connectors`  
Persona: Ops  
Purpose: First, connect payment provider accounts to Inflection (OAuth or API key). Then assign those connected accounts to agents. An agent can only call a rail if it has been assigned a connector for that rail.

---

## Two-Step Mental Model

```
Step 1: Connect Account           Step 2: Assign to Agent
┌──────────────────┐              ┌──────────────────────┐
│ Your Stripe acct │──(OAuth)────▶│ Inflection            │
│ acct_1Abc23      │              │ Connector store       │
│                  │              │ con_stripe_001        │
└──────────────────┘              └──────────┬───────────┘
                                             │ assign
                                   ┌─────────▼──────────┐
                                   │ vendor-pay-agent   │
                                   │ invoice-bot        │
                                   └────────────────────┘
```

- A **connected account** is a payment provider credential stored encrypted in Inflection.
- An **assignment** links a connected account to one or more agents.
- Revoking a connected account immediately blocks all agents assigned to it.
- One connected account can be assigned to multiple agents; one agent can have multiple connected accounts (across different rails).

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Connectors"         [+ Connect Account]     │
├─────────────────────────────────────────────────────┤
│ Connected Accounts (top section)                     │
│  Cards: one per connected provider account           │
│                                                      │
│  [Stripe card]  [Circle card]  [x402 card]           │
│                                                      │
│  Each card shows: account label, status, assigned    │
│  agents count, actions: [Assign to Agent] [Revoke]   │
├─────────────────────────────────────────────────────┤
│ Agent Assignments (bottom section)                   │
│  Table or card per agent showing which rails are     │
│  connected (with a status chip per rail)             │
└─────────────────────────────────────────────────────┘
```

---

## Components

### `<ConnectedAccountCard>`
shadcn `Card` with left accent border (by rail color).

| Element | Component | Details |
|---------|-----------|---------|
| Rail logo + name | img + `h3` | Stripe / Circle / x402 |
| Account label | subtitle | "Acme Corp (acct_1Abc23)" or wallet address |
| Status chip | `Badge` | ACTIVE / EXPIRED / ERROR |
| Connected date | muted text | "Connected Apr 12, 2026" |
| Assigned agents | muted text | "Used by 2 agents" → expandable list |
| Actions | buttons | `[Assign to Agent]` (outline) · `[Revoke]` (destructive ghost) |

Rail accent borders:
- Stripe: `border-l-4 border-l-[#635BFF]`
- Circle: `border-l-4 border-l-[#0066FF]`
- x402: `border-l-4 border-l-primary` (#BAFC00)

**Mock connected accounts:**
```ts
const connectedAccounts = [
  {
    id: "con_stripe_001",
    rail: "stripe",
    accountId: "acct_1Abc23XYZ",
    accountLabel: "Acme Corp",
    status: "active",
    connectedAt: "2026-04-12",
    assignedAgents: ["agt_7x2kp9mn", "agt_4r8jq5vw"],
  },
  {
    id: "con_circle_001",
    rail: "circle",
    accountId: "circle_api_••••5f2a",
    accountLabel: null,
    status: "active",
    connectedAt: "2026-04-14",
    assignedAgents: ["agt_7x2kp9mn"],
  },
  {
    id: "con_x402_001",
    rail: "x402",
    accountId: "0x4A3B...9C2D",
    accountLabel: "Agent Wallet",
    status: "active",
    connectedAt: "2026-04-15",
    assignedAgents: ["agt_7x2kp9mn"],
  },
]
```

### `<ConnectAccountDialog>`
Triggered by `[+ Connect Account]` in page header.

**Step 1 — Choose Rail**
Grid of rail cards: Stripe, Circle, x402, Square (locked), Braintree (locked), Razorpay (locked).  
Locked rails have `opacity-50` + "Coming soon" `Badge`.

**Step 2 — Authenticate**
- **Stripe:** "Connect with Stripe" button → opens OAuth popup → returns with account info
- **Circle:** `Input` for API key + optional label field
- **x402:** `Input` for wallet address + optional label field

After connect: show success state → option to immediately assign to an agent or "Do later".

### `<AssignToAgentDialog>`
Triggered by `[Assign to Agent]` on a connected account card.

- Shows which agents already have this connector assigned (greyed out, "already assigned")
- Checkboxes for unassigned agents
- `[Save Assignments]` button

### `<AgentConnectorSummary>` (bottom section)
Table or accordion — one row per agent, showing its assigned rails as colored `Badge` chips.

**Example:**
| Agent | Rails |
|-------|-------|
| vendor-pay-agent | `stripe` `circle` `x402` |
| invoice-bot | `stripe` |
| expense-agent | — |

`expense-agent` with no connectors shows a yellow warning: "No connectors assigned — this agent will DENY all payment calls."

Clicking a rail chip on the agent row → opens the connected account card for that rail.

### Revoke `AlertDialog`
Title: "Revoke Stripe connection?"  
Body: "This will immediately block vendor-pay-agent and invoice-bot from making Stripe calls. This cannot be undone — you will need to reconnect via OAuth."  
Actions: `Cancel` / `Revoke` (destructive)

### Status Badges
- `ACTIVE` → `bg-primary/20 text-primary`
- `EXPIRED` → `bg-yellow-500/20 text-yellow-400` + "Reconnect" link
- `ERROR` → `bg-destructive/20 text-destructive` + error message tooltip

---

## Design Notes

- Page has two clear visual sections: "Connected Accounts" (provider-centric) and "Agent Assignments" (agent-centric)
- A `Separator` with label divides the two sections
- Empty state for connected accounts: "No payment accounts connected yet" + `[+ Connect Account]` CTA
- Connected accounts section uses a grid (3-col on desktop, 1-col mobile)
- Agent assignments section uses a compact table (no card per agent)
