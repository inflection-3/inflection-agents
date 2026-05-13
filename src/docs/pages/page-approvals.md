# Page: Approvals (/approvals)

Route: `/approvals`  
Persona: Ops, CFO  
Purpose: Review and act on transactions the policy engine has held for human approval. Agents block waiting for a decision (or auto-deny on timeout).

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Pending Approvals"          3 pending       │
├─────────────────────────────────────────────────────┤
│ Filter: [Agent ▾] [Rail ▾] [Amount range]            │
├─────────────────────────────────────────────────────┤
│ Approval Card — PENDING                              │
│  $52,000 · circle · vendor-pay-agent                 │
│  Action: transfer → 0x4A3B...9C2D                    │
│  Held: 8 min ago  · Timeout in: 22 min               │
│  Policy: requireHumanApproval > $5,000               │
│  [View full details ▾]                               │
│             [Reject]           [Approve]             │
├─────────────────────────────────────────────────────┤
│ Recent Decisions (last 20)                           │
│  Table: tx | agent | amount | decision | by | time   │
└─────────────────────────────────────────────────────┘
```

---

## Components

### `<ApprovalCard>`
shadcn `Card` with left border: `border-l-4 border-l-yellow-400`

| Element | Component | Details |
|---------|-----------|---------|
| Amount | `text-3xl font-bold` | "$52,000" |
| Rail chip | `Badge` | rail name, color-coded |
| Agent name | muted link | → `/agents` |
| Action details | `<code>` block | `transfer → 0x4A3B...9C2D` |
| Held time | muted text | "Held 8 min ago" |
| Timeout countdown | orange text | "Auto-denies in 22 min" |
| Policy trigger | muted text | "requireHumanApproval threshold: $5,000" |
| Expand details | shadcn `Collapsible` | shows full args object (sanitized) |
| Actions | `Button` pair | Reject (outline) + Approve (primary) |

**On Approve:** opens a small inline `Textarea` for an optional reason note, then confirm button.  
**On Reject:** same reason flow, then confirm.

**Mock data:**
```ts
const pendingApprovals = [
  {
    id: "hold_001",
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    rail: "circle",
    action: "transfer",
    amount: 52000,
    currency: "USD",
    args: { destination: "0x4A3B...9C2D", memo: "Vendor invoice #2041" },
    policyRule: "requireHumanApproval",
    policyThreshold: 5000,
    heldAt: "2026-05-11T10:02:00Z",
    timeoutAt: "2026-05-11T10:32:00Z",
  },
  {
    id: "hold_002",
    agentId: "agt_4r8jq5vw",
    agentName: "invoice-bot",
    rail: "stripe",
    action: "charge",
    amount: 15500,
    currency: "USD",
    args: { customerId: "cus_Abc123", description: "Enterprise license Q2" },
    policyRule: "requireHumanApproval",
    policyThreshold: 15000,
    heldAt: "2026-05-11T09:48:00Z",
    timeoutAt: "2026-05-11T10:18:00Z",
  },
  {
    id: "hold_003",
    agentId: "agt_2c6hn1yz",
    agentName: "expense-agent",
    rail: "stripe",
    action: "charge",
    amount: 9800,
    currency: "USD",
    args: { customerId: "cus_Def456", description: "Contractor payment May" },
    policyRule: "requireHumanApproval",
    policyThreshold: 5000,
    heldAt: "2026-05-11T09:29:00Z",
    timeoutAt: "2026-05-11T09:59:00Z",
  },
]
```

### Empty State
When no pending approvals:
```
✓ No pending approvals
All transactions are flowing through automatically.
```
Uses `text-center py-16` with a `CheckCircle` icon in `text-primary`.

### `<RecentDecisionsTable>`
shadcn `Table` at bottom of page.

Columns: Transaction ID, Agent, Rail, Amount, Decision badge, Decided By, Reason, Time

**Mock data:**
```ts
const recentDecisions = [
  { txId: "tx_prev_001", agent: "vendor-pay-agent", rail: "stripe", amount: 8200, decision: "APPROVED", by: "sarah@acme.com", reason: "Approved vendor invoice", decidedAt: "1 hour ago" },
  { txId: "tx_prev_002", agent: "invoice-bot", rail: "circle", amount: 75000, decision: "REJECTED", by: "cfo@acme.com", reason: "Exceeds Q2 budget", decidedAt: "3 hours ago" },
  { txId: "tx_prev_003", agent: "vendor-pay-agent", rail: "stripe", amount: 6500, decision: "APPROVED", by: "sarah@acme.com", reason: null, decidedAt: "Yesterday" },
]
```

Decision badge colors:
- `APPROVED` → `bg-primary/20 text-primary`
- `REJECTED` → `bg-destructive/20 text-destructive`
- `TIMEOUT` → `bg-muted text-muted-foreground`

---

## Design Notes

- Pending cards sorted by timeout (most urgent first — least time remaining)
- Timeout countdown updates live (client-side interval, no SSE needed for mock)
- Approved/rejected state transitions: card fades out with brief success/error flash
- Reason `Textarea` is optional; placeholder "Add a reason (optional)"
- Mobile: stack approve/reject buttons full-width
