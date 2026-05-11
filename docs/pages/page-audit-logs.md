# Page: Audit Logs (/audit-logs)

Route: `/audit-logs`  
Persona: Compliance, Ops  
Purpose: Tamper-evident, append-only log of every financial action taken by every agent. Filterable and exportable.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Audit Log"          [Export CSV] [Export JSON]│
├─────────────────────────────────────────────────────┤
│ Filters bar:                                         │
│  [Date range] [Agent ▾] [Rail ▾] [Outcome ▾] [Search]│
├─────────────────────────────────────────────────────┤
│ Table: paginated, 50 rows/page                       │
│  # | Timestamp | Agent | Rail | Action | Args preview│
│    | Amount | Decision | Outcome | Duration | Tx ID  │
│  ▶ expand row → full entry + hash chain proof        │
├─────────────────────────────────────────────────────┤
│ Pagination: ← 1 2 3 ... 24 →     Showing 1–50/1,204 │
└─────────────────────────────────────────────────────┘
```

---

## Components

### `<AuditLogFilters>`
Horizontal filter bar using shadcn components:

| Filter | Component | Options |
|--------|-----------|---------|
| Date range | `DatePickerWithRange` (shadcn) | Custom range, presets: Today / 7d / 30d / 90d |
| Agent | `Select` | All agents + per-agent options |
| Rail | `Select` | All, Stripe, Circle, x402 |
| Outcome | `Select` | All, ALLOWED, DENIED, HELD, APPROVED, REJECTED |
| Search | `Input` with search icon | Searches txId, agentId, args |

"Clear filters" link appears when any filter is active.

### `<AuditLogTable>`
shadcn `Table` with expandable rows.

**Columns:**

| Column | Width | Notes |
|--------|-------|-------|
| # | 48px | Sequential log entry number |
| Timestamp | 160px | `YYYY-MM-DD HH:mm:ss UTC`, monospace |
| Agent | 140px | Agent name, links to `/agents` |
| Rail | 80px | Colored `Badge` |
| Action | 100px | `charge`, `transfer`, `refund`, `pay` |
| Amount | 100px | Right-aligned, formatted |
| Decision | 90px | `Badge`: ALLOW/DENY/HOLD |
| Outcome | 90px | `Badge`: EXECUTED/DENIED/APPROVED/REJECTED/TIMEOUT |
| Duration | 70px | `8ms`, muted |
| Tx ID | 120px | Provider tx ID, monospace, copy button |

**Expanded row** (toggle with `▶`):
- Full structured entry in a `bg-accent rounded-md` code block
- Hash: `sha256: abc123...` + "Chain valid ✓" in `text-primary`
- Policy version applied: `v3`

**Mock data:**
```ts
const auditEntries = [
  {
    seq: 1204,
    timestamp: "2026-05-11 10:02:14 UTC",
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    rail: "circle",
    action: "transfer",
    amount: 52000,
    currency: "USD",
    policyDecision: "HOLD",
    outcome: "PENDING",
    policyVersion: 3,
    durationMs: 4,
    providerTxId: null,
    entryHash: "9f3a2b1c...",
    prevHash: "7e1d4a8b...",
  },
  {
    seq: 1203,
    timestamp: "2026-05-11 09:58:31 UTC",
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    rail: "stripe",
    action: "charge",
    amount: 4200,
    currency: "USD",
    policyDecision: "ALLOW",
    outcome: "EXECUTED",
    policyVersion: 3,
    durationMs: 7,
    providerTxId: "ch_3Abc123XYZ",
    entryHash: "7e1d4a8b...",
    prevHash: "2c9f6e3d...",
  },
  {
    seq: 1202,
    timestamp: "2026-05-11 09:44:02 UTC",
    agentId: "agt_2c6hn1yz",
    agentName: "expense-agent",
    rail: "x402",
    action: "pay",
    amount: 99,
    currency: "USD",
    policyDecision: "DENY",
    outcome: "DENIED",
    policyVersion: null,
    durationMs: 2,
    providerTxId: null,
    entryHash: "2c9f6e3d...",
    prevHash: "8a4b7c1e...",
  },
  {
    seq: 1201,
    timestamp: "2026-05-11 09:37:19 UTC",
    agentId: "agt_4r8jq5vw",
    agentName: "invoice-bot",
    rail: "stripe",
    action: "refund",
    amount: 350,
    currency: "USD",
    policyDecision: "ALLOW",
    outcome: "EXECUTED",
    policyVersion: 1,
    durationMs: 6,
    providerTxId: "re_3Def456ABC",
    entryHash: "8a4b7c1e...",
    prevHash: "5d2e9f0a...",
  },
]
```

### `<ExportDialog>`
Triggered by Export buttons. shadcn `Dialog`:

- Format: `RadioGroup` — CSV / JSON
- Date range: inherit from current filters or pick new range
- Scope: current filters or all records
- `[Download]` button → triggers file download with mock data

### Hash Chain Integrity Display
In expanded row:
```
Entry hash:  9f3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c
Prev hash:   7e1d4a8b2c3d4e5f6a7b8c9d0e1f2a3b
Chain: ✓ Valid
```
`✓ Valid` in `text-primary` (#BAFC00).  
If chain broken (mock error state): `✗ INTEGRITY ERROR` in `text-destructive`.

---

## Design Notes

- Table rows alternate with subtle `hover:bg-accent/50`
- Sticky table header with shadow on scroll
- Decision/Outcome badges are compact (small size, `text-xs`)
- Timestamp in `font-mono text-xs text-muted-foreground`
- Export buttons in header: secondary outline style, not primary (audit log is read-only)
- "Append-only" notice in page subheader: muted text "Entries are append-only and hash-chained"
