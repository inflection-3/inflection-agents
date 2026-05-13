# Page: Analytics (/analytics)

Route: `/analytics`  
Persona: Ops, Finance  
Purpose: Visual spend overview — daily spend trend, transaction volume by rail, and top action types. P2 feature (v2 roadmap), but page stub exists in v1.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Analytics"              [Agent ▾] [30d ▾]   │
├─────────────────────────────────────────────────────┤
│ Stat row (3 cards):                                  │
│  Total spend (period) | Avg tx size | ALLOW rate     │
├─────────────────────────────────────────────────────┤
│ Daily Spend Chart (line/bar, full width)             │
├────────────────────┬────────────────────────────────┤
│ Tx by Rail         │ Tx by Outcome                  │
│ (donut chart)      │ (bar chart)                    │
├────────────────────┴────────────────────────────────┤
│ Top Actions table                                    │
│  Action | Count | Total $ | ALLOW% | Avg duration   │
└─────────────────────────────────────────────────────┘
```

---

## Components

Uses **Recharts** (standard with shadcn chart primitives — `shadcn/ui` chart components wrap Recharts).

### Summary Stat Cards

| Label | Mock value |
|-------|------------|
| Total Spend (30d) | $48,320 |
| Avg Transaction | $401 |
| Allow Rate | 94.2% |

### `<DailySpendChart>`
shadcn `ChartContainer` wrapping Recharts `AreaChart`

- X axis: dates (last 30 days)
- Y axis: USD spend
- Two data series: `Executed` (primary color #BAFC00) + `Held/Pending` (yellow)
- Tooltip shows date + executed spend + held spend
- `ChartTooltipContent` from shadcn

**Mock data:**
```ts
const dailySpend = [
  { date: "2026-04-12", executed: 3200, held: 0 },
  { date: "2026-04-13", executed: 1800, held: 1500 },
  { date: "2026-04-14", executed: 4100, held: 0 },
  { date: "2026-04-15", executed: 900, held: 0 },
  { date: "2026-04-16", executed: 2700, held: 52000 },
  // ... 25 more days
  { date: "2026-05-10", executed: 5400, held: 15500 },
  { date: "2026-05-11", executed: 4200, held: 52000 },
]
```

### `<TxByRailChart>`
Recharts `PieChart` (donut style) — `innerRadius={60}`

- Stripe: `#635BFF`
- Circle: `#0066FF`
- x402: `#BAFC00`

**Mock data:**
```ts
const txByRail = [
  { rail: "stripe", count: 847, percentage: 70 },
  { rail: "circle", count: 290, percentage: 24 },
  { rail: "x402", count: 67, percentage: 6 },
]
```

### `<TxByOutcomeChart>`
Recharts `BarChart` (horizontal bars)

**Mock data:**
```ts
const txByOutcome = [
  { outcome: "ALLOWED", count: 1135 },
  { outcome: "HELD", count: 48 },
  { outcome: "DENIED", count: 21 },
]
```

### `<TopActionsTable>`
shadcn `Table` — top 5 actions by volume

**Mock data:**
```ts
const topActions = [
  { action: "charge", count: 820, totalUsd: 31200, allowRate: "97%", avgMs: 7 },
  { action: "transfer", count: 245, totalUsd: 12400, allowRate: "88%", avgMs: 5 },
  { action: "refund", count: 98, totalUsd: 2800, allowRate: "100%", avgMs: 6 },
  { action: "pay", count: 41, totalUsd: 1920, allowRate: "92%", avgMs: 4 },
]
```

### V1 Notice Banner
Since analytics is v2, display a banner at top:

```
📊 Analytics is coming in v2. This preview shows sample data.
```
Uses `bg-accent border border-border rounded-lg px-4 py-3` with muted text.  
Remove this banner when real data is wired.

---

## Design Notes

- Chart color palette from `styles.css` CSS vars: `--chart-1` through `--chart-5`
- `chart-1` = primary (#BAFC00), use for the main metric
- All charts use `ChartContainer` with defined `config` prop for legend labels
- Date range selector: shadcn `Select` with options: 7d / 30d / 90d
- Agent filter: `Select` — "All agents" + per-agent
- Charts responsive: `width="100%"` on Recharts containers
