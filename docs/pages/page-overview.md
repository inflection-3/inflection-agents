# Page: Overview (/)

Route: `/`  
Persona: Ops, Compliance  
Purpose: At-a-glance health of all agents — spend, approvals, and recent activity.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Overview"                      [date range] │
├────────────┬────────────┬────────────┬──────────────┤
│ Stat Card  │ Stat Card  │ Stat Card  │  Stat Card   │
│ Total Spend│ Tx Count   │ Pending    │ Active Agents│
│ $48,320    │ 1,204      │ 3          │ 7            │
├────────────┴────────────┴────────────┴──────────────┤
│ Recent Transactions (last 10)                        │
│ Table: agent | rail | amount | status | time         │
├─────────────────────────────────────────────────────┤
│ Pending Approvals (inline preview, max 3)            │
│ Card per item: agent name, amount, "Review" button   │
└─────────────────────────────────────────────────────┘
```

---

## Components

### `<StatCard>`
shadcn `Card` + `CardHeader` + `CardContent`

| Prop | Type | Mock value |
|------|------|------------|
| label | string | "Total Spend (30d)" |
| value | string | "$48,320" |
| delta | string | "+12% vs last month" |
| icon | ReactNode | `<DollarSign />` from lucide |

Four instances: Total Spend, Transaction Count, Pending Approvals, Active Agents.

### `<RecentTransactionsTable>`
shadcn `Table` → `TableHeader` / `TableBody` / `TableRow`

Columns: Agent, Rail, Action, Amount, Status badge, Time (relative)

**Mock data:**
```ts
const recentTransactions = [
  { id: "tx_001", agent: "vendor-pay-agent", rail: "stripe", action: "charge", amount: 4200, status: "ALLOWED", ts: "2 min ago" },
  { id: "tx_002", agent: "vendor-pay-agent", rail: "circle", action: "transfer", amount: 52000, status: "HELD", ts: "8 min ago" },
  { id: "tx_003", agent: "invoice-bot", rail: "stripe", action: "refund", amount: 350, status: "ALLOWED", ts: "14 min ago" },
  { id: "tx_004", agent: "expense-agent", rail: "x402", action: "pay", amount: 99, status: "DENIED", ts: "31 min ago" },
  { id: "tx_005", agent: "vendor-pay-agent", rail: "stripe", action: "charge", amount: 1800, status: "ALLOWED", ts: "45 min ago" },
]
```

Status badge colors (shadcn `Badge` with variant):
- `ALLOWED` → `bg-primary text-primary-foreground` (#BAFC00 / black)
- `HELD` → `bg-yellow-500/20 text-yellow-400`
- `DENIED` → `bg-destructive/20 text-destructive`

### `<PendingApprovalPreview>`
Up to 3 shadcn `Card` components in a horizontal row.

Each card:
- Agent name + rail chip
- Amount (large, bold)
- "Waiting X min" muted text
- `<Button variant="default">Approve</Button>` + `<Button variant="outline">Reject</Button>`
- Link to full `/approvals` page: "View all (3 pending)"

**Mock data:**
```ts
const pendingApprovals = [
  { id: "hold_001", agent: "vendor-pay-agent", rail: "circle", amount: 52000, waitingMin: 8 },
  { id: "hold_002", agent: "invoice-bot", rail: "stripe", amount: 15500, waitingMin: 22 },
  { id: "hold_003", agent: "expense-agent", rail: "stripe", amount: 9800, waitingMin: 41 },
]
```

---

## Design Notes

- Dark mode: background `#121212`, cards `#575757`, accent containers `#313131`
- Stat cards use `border border-border` with subtle hover `hover:bg-accent`
- Primary action buttons use `bg-primary` (#BAFC00) with black text
- Page header uses `text-2xl font-semibold` with a muted sub-label
