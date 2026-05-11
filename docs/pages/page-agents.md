# Page: Agents (/agents)

Route: `/agents`  
Personas: Developer (My Agents tab), Ops/Deployer (Browse Registry tab)  
Purpose: Two-sided page. Developers register and manage agents here. Deployers browse the public registry to find agents to connect to their payment accounts.

See `docs/agent-registration.md` and `docs/agent-manifest.md` for the full registration and skills system.

---

## Page Structure — Two Tabs

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: "Agents"                                                 │
│                                                                 │
│  [My Agents]  [Browse Registry]                                 │
└─────────────────────────────────────────────────────────────────┘
```

shadcn `Tabs` at the top. Default tab depends on user role:
- Developer accounts → default "My Agents"
- Ops/deployer accounts with no registered agents → default "Browse Registry"

---

## Tab 1: My Agents

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [My Agents] [Browse Registry]           [+ Register New Agent]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌── vendor-pay-agent ──────────────────────────────────────┐   │
│  │ ● Active                                       [•••]     │   │
│  │ agt_7x2kp9mn                           [copy]            │   │
│  │                                                          │   │
│  │ Skills:  [AP / Invoices]  [Refund Processing]            │   │
│  │ Rails:   [stripe]  [circle]                              │   │
│  │ Risk:    ■ Medium                                        │   │
│  │                                                          │   │
│  │ Live Key:  ak_live_7x2k••••••  [Copy] [Regen]            │   │
│  │ Test Key:  ak_test_7x2k••••••  [Copy] [Regen]            │   │
│  │                                                          │   │
│  │ Created Apr 12 · Last call 2 min ago                     │   │
│  │ [3 Connectors]  [Policies]  [1,204 Tx]  [Audit Log]      │   │
│  │                                                          │   │
│  │ Registry: ● Listed publicly  [View listing] [Edit]       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### `<AgentCard>` (My Agents)

shadcn `Card`. Left border by status: active → `border-l-4 border-l-primary`, suspended → `border-l-4 border-l-yellow-400`.

| Element | Component | Detail |
|---------|-----------|--------|
| Agent name | `h3 font-semibold` | e.g. "vendor-pay-agent" |
| Status badge | `Badge` | Active / Suspended |
| 3-dot menu | `DropdownMenu` | See actions table below |
| Agent ID | `code` + copy button | `agt_7x2kp9mn` monospace |
| **Skills row** | `Badge` chips | One per declared skill, e.g. `[AP / Invoices]` `[Refund Processing]` |
| **Rails row** | colored `Badge` chips | `[stripe]` `[circle]` — only required rails shown |
| **Risk tier** | colored indicator | Low (green) / Medium (amber) / High (red) |
| Live key | masked + copy + regen | `ak_live_7x2k••••••` |
| Test key | masked + copy + regen | `ak_test_7x2k••••••` |
| Timestamps | muted text | "Created Apr 12 · Last call 2 min ago" |
| Stats row | ghost button links | "3 Connectors" → `/connectors?agent=agt_7x2kp9mn`, "Policies", "1,204 Tx", "Audit Log" |
| **Registry row** | `Badge` + links | "Listed publicly" or "Unlisted" + "View listing" + "Edit" |

**Mock data (full):**
```ts
const agents = [
  {
    id: "agt_7x2kp9mn",
    name: "vendor-pay-agent",
    displayName: "Vendor Payment Agent",
    description: "Autonomous AP automation — pays vendor invoices, handles approvals, and reconciles spend.",
    category: "accounts_payable",
    status: "active",
    riskTier: "medium",
    skills: [
      { id: "vendor_payment", name: "AP / Invoices", railCapabilities: [{ rail: "stripe" }, { rail: "circle" }] },
      { id: "issue_refund",   name: "Refund Processing", railCapabilities: [{ rail: "stripe" }] },
    ],
    requiredRails: ["stripe", "circle"],
    liveKeyPrefix: "ak_live_7x2k",
    testKeyPrefix: "ak_test_7x2k",
    createdAt: "2026-04-12T10:00:00Z",
    lastCallAt: "2026-05-11T10:08:00Z",
    connectorCount: 3,
    txCount: 1204,
    registryListing: {
      listed: true,
      slug: "vendor-pay-agent",
      deployerCount: 12,
      verifiedAt: "2026-04-20T00:00:00Z",
    },
  },
  {
    id: "agt_4r8jq5vw",
    name: "invoice-bot",
    displayName: "Invoice Bot",
    description: "Processes vendor invoices from email/PDF and initiates payment workflows.",
    category: "accounts_payable",
    status: "active",
    riskTier: "medium",
    skills: [
      { id: "vendor_payment", name: "Invoice Payment", railCapabilities: [{ rail: "stripe" }] },
    ],
    requiredRails: ["stripe"],
    liveKeyPrefix: "ak_live_4r8j",
    testKeyPrefix: "ak_test_4r8j",
    createdAt: "2026-04-28T09:00:00Z",
    lastCallAt: "2026-05-11T09:48:00Z",
    connectorCount: 1,
    txCount: 389,
    registryListing: { listed: false },
  },
  {
    id: "agt_2c6hn1yz",
    name: "expense-agent",
    displayName: "Expense Reimbursement Agent",
    description: null,
    category: "expense_management",
    status: "suspended",
    riskTier: "low",
    skills: [],           // no manifest yet → warning shown
    requiredRails: [],
    liveKeyPrefix: "ak_live_2c6h",
    testKeyPrefix: "ak_test_2c6h",
    createdAt: "2026-05-01T14:00:00Z",
    lastCallAt: "2026-05-08T16:20:00Z",
    connectorCount: 2,
    txCount: 47,
    registryListing: { listed: false },
  },
]
```

### No Manifest Warning

When `skills.length === 0`, show inside the card:

```
┌─────────────────────────────────────────────────────┐
│ ⚠ No capabilities declared                          │
│ Add a manifest so deployers know what this agent    │
│ does before connecting their payment accounts.      │
│ [+ Add Skills and Capabilities →]                   │
└─────────────────────────────────────────────────────┘
```

`bg-yellow-500/10 border border-yellow-500/20 rounded-md`

---

### `<RegisterAgentDialog>` — Multi-Step

shadcn `Dialog`. Three steps rendered as a stepper inside the dialog.

#### Step 1 of 3: Basic Info

```
┌────────────────────────────────────────────────────────┐
│ Register New Agent          ●──○──○  Step 1 of 3      │
│ Basic Information                                      │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ Agent Name *                                           │
│ [vendor-pay-agent                              ]       │
│  Kebab-case, used in audit logs and the registry       │
│                                                        │
│ Display Name *                                         │
│ [Vendor Payment Agent                          ]       │
│  Shown to deployers in the registry                    │
│                                                        │
│ Category *                                             │
│ [Accounts Payable                              ▾]      │
│                                                        │
│ Description *                                          │
│ [Autonomous AP automation — pays vendor          ]     │
│ [invoices, handles approvals, reconciles spend.  ]     │
│  Shown to deployers before they connect              │
│                                                        │
│ Developer / Company Name                               │
│ [Acme AI Labs                                  ]       │
│                                                        │
│ Approval Webhook URL (optional)                        │
│ [https://your-agent.example.com/inflection/ca  ]       │
│                                                        │
│ Documentation URL (optional)                           │
│ [https://docs.acmeai.com/vendor-pay-agent       ]      │
│                                                        │
│                             [Cancel]  [Next: Skills →] │
└────────────────────────────────────────────────────────┘
```

Category dropdown options (maps to `AgentCategory`):
- Accounts Payable
- Payroll & Disbursement
- Customer Billing
- Expense Management
- Procurement
- Marketplace Payouts
- Micropayments
- Crypto Treasury
- E-commerce
- Subscription Management
- Other

#### Step 2 of 3: Skills & Capabilities

```
┌────────────────────────────────────────────────────────┐
│ Register New Agent          ○──●──○  Step 2 of 3      │
│ Skills & Capabilities                                  │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ What can this agent do? Declare every payment          │
│ action it performs. Deployers see this before         │
│ connecting their accounts.                             │
│                                                        │
│ ┌── Skill 1 ──────────────────────────────────────┐   │
│ │ Skill type  [Vendor Invoice Payment        ▾]   │   │
│ │ Name        [AP / Invoice Payment          ]    │   │
│ │ Description [Pays approved vendor invoices ]    │   │
│ │             [on Stripe and Circle.         ]    │   │
│ │                                                 │   │
│ │ Rails used                                      │   │
│ │  ☑ Stripe   ☑ Circle   ☐ x402   ☐ Square       │   │
│ │                                                 │   │
│ │ ┌─ Stripe actions ──────────────────────────┐  │   │
│ │ │ ☑ charges.create     max $[10,000]        │  │   │
│ │ │   "Charges vendor's stored payment method"│  │   │
│ │ │ ☑ refunds.create     max $[5,000 ]        │  │   │
│ │ │   "Issues refunds for duplicate invoices" │  │   │
│ │ │ ☐ payouts.create                          │  │   │
│ │ │ ☐ paymentIntents.create                   │  │   │
│ │ │ ☐ transfers.create                        │  │   │
│ │ └───────────────────────────────────────────┘  │   │
│ │                                                 │   │
│ │ ┌─ Circle actions ──────────────────────────┐  │   │
│ │ │ ☑ transfers.create   max $[100,000]       │  │   │
│ │ │   "Large international vendor payments"   │  │   │
│ │ │ ☐ payouts.create                          │  │   │
│ │ └───────────────────────────────────────────┘  │   │
│ │                                                 │   │
│ │ Typical transaction range  $[100] to $[100,000] │   │
│ │ Max per day  [50 ]  transactions                │   │
│ │                                                 │   │
│ │ Risk tier (auto-calculated): ■ Medium            │   │
│ │ May require approval: ● Yes  ○ No               │   │
│ │                                                 │   │
│ │ Required for agent to function: ● Yes  ○ No     │   │
│ └─────────────────────────────────────────────── ┘   │
│                                                        │
│ [+ Add Another Skill]                                  │
│                                                        │
│      [← Back]                  [Next: Listing →]       │
└────────────────────────────────────────────────────────┘
```

**Skill type dropdown** shows the pre-defined skill library (from `docs/agent-manifest.md` section 2). Selecting a pre-defined skill auto-fills name, description, and action checkboxes. Developer can override any field.

**Actions per rail** are checkboxes. Each checked action has an optional max amount `Input`. When checked, shows a description placeholder.

**Risk tier** auto-calculates from declared actions and max amounts:
- All reversible + max < $1,000 → Low (green)
- Any max $1,000–$50,000 or any payout action → Medium (amber)  
- Any max > $50,000 or irreversible (Circle/x402 transfers) → High (red)

Shown as a read-only chip that updates live as the developer fills in amounts.

#### Step 3 of 3: Registry Listing

```
┌────────────────────────────────────────────────────────┐
│ Register New Agent          ○──○──●  Step 3 of 3      │
│ Registry Listing                                       │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ List this agent in the public registry?                │
│                                                        │
│ ◉ Yes — make it discoverable by deployers              │
│   Deployers can find and connect your agent            │
│   without you having to share the Agent ID manually.   │
│                                                        │
│ ○ No — keep it private                                 │
│   Only deployers with the Agent ID can connect.        │
│                                                        │
│ ─── Listing details (shown if Yes) ────────────────── │
│                                                        │
│ Agent Logo                                             │
│ [Upload image ▲]  or  [Enter URL            ]          │
│  Shown in registry search results. Recommended: 256×256│
│                                                        │
│ Tags (up to 5)                                         │
│ [accounts-payable] [invoices] [stripe] [circle]  [+]  │
│                                                        │
│ Short tagline (≤ 80 chars)                             │
│ [Automates AP — pays invoices, handles approvals.]     │
│                                                        │
│ ─── Registry Preview ──────────────────────────────── │
│ ┌──────────────────────────────────────────────────┐  │
│ │ [logo] Vendor Payment Agent         ✓ Verified   │  │
│ │ by Acme AI Labs                                  │  │
│ │ Automates AP — pays invoices, handles approvals. │  │
│ │                                                  │  │
│ │ [AP/Invoices] [Refunds]  ■ Medium risk           │  │
│ │ Rails: [stripe] [circle]                         │  │
│ │                              [Connect →]         │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
│     [← Back]               [Register Agent →]         │
└────────────────────────────────────────────────────────┘
```

**Registry Preview** updates live as the developer fills in the form — shows exactly what deployers will see in the registry.

---

### `<RegisterSuccessDialog>` — Step 4: Keys

Same as before but now includes a "View in registry" link if listed publicly:

```
┌────────────────────────────────────────────────────────┐
│ ✓ Agent registered                                     │
│ Vendor Payment Agent                                   │
│                                                        │
│ Agent ID                                               │
│ agt_7x2kp9mn                                 [Copy]    │
│                                                        │
│ Live API Key                                           │
│ ak_live_7x2kp9mn_51abc...xxxx               [Copy]     │
│                                                        │
│ Test API Key                                           │
│ ak_test_7x2kp9mn_99xyz...yyyy               [Copy]     │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ⚠ Save both keys now — they won't be shown again  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ # .env                              [Copy snippet]     │
│ INFLECTION_AGENT_KEY=ak_live_7x2kp9mn_51abc...         │
│ npm install @inflection/sdk                            │
│                                                        │
│ Your agent is listed in the registry:                  │
│ inflection.dev/registry/vendor-pay-agent  [View →]    │
│                                                        │
│                          [I've saved both keys ✓]      │
└────────────────────────────────────────────────────────┘
```

---

## Tab 2: Browse Registry

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [My Agents]  [Browse Registry]                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [🔍 Search agents by name, skill, or category...          ]    │
│                                                                  │
│  Category:  [All ▾]   Rail:  [All ▾]   Risk:  [All ▾]          │
│                                                                  │
│  Featured                                                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ Vendor Pay Agent │ │ Payroll Bot      │ │ DataForge        │ │
│  │ Acme AI Labs     │ │ RemoteFirst      │ │ DataForge Inc    │ │
│  │ ✓ Verified       │ │ ✓ Verified       │ │                  │ │
│  │                  │ │                  │ │                  │ │
│  │ Automates AP...  │ │ USDC payroll...  │ │ Buys market      │ │
│  │                  │ │                  │ │ data via x402    │ │
│  │ [AP] [Refunds]   │ │ [Payroll]        │ │ [Micropayments]  │ │
│  │ ■ Med · Stripe   │ │ ■ High · Circle  │ │ ● Low · x402     │ │
│  │ 12 deployers     │ │ 8 deployers      │ │ 3 deployers      │ │
│  │    [Connect →]   │ │    [Connect →]   │ │   [Connect →]    │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  All agents (24)                                                 │
│  (same card grid continues below)                                │
└─────────────────────────────────────────────────────────────────┘
```

### `<RegistryAgentCard>`

shadcn `Card` — 3-column grid on desktop, 1-column on mobile.

| Element | Component | Detail |
|---------|-----------|--------|
| Logo | `Avatar` or `img` | 48×48 agent logo |
| Name | `h3 font-semibold` | Display name, e.g. "Vendor Payment Agent" |
| Developer | muted text | "by Acme AI Labs" |
| Verified badge | `Badge variant="outline"` with checkmark | Only for Inflection-verified agents |
| Tagline | `p text-sm text-muted-foreground` | ≤80 char tagline |
| Skills chips | `Badge` | One per skill, max 3 shown, "+N more" for overflow |
| Risk indicator | colored dot + label | ● Low / ■ Medium / ■ High |
| Rails | small colored `Badge` chips | `stripe` `circle` `x402` |
| Deployer count | muted text | "12 deployers" |
| Connect button | `Button variant="default"` | Opens `<ConnectFromRegistryDialog>` |

**Mock registry data:**
```ts
const registryAgents = [
  {
    id: "agt_7x2kp9mn",
    slug: "vendor-pay-agent",
    displayName: "Vendor Payment Agent",
    developerName: "Acme AI Labs",
    tagline: "Automates AP — pays invoices, handles approvals, reconciles spend.",
    category: "accounts_payable",
    verified: true,
    riskTier: "medium",
    skills: [
      { id: "vendor_payment", name: "AP / Invoices" },
      { id: "issue_refund", name: "Refunds" },
    ],
    requiredRails: ["stripe", "circle"],
    deployerCount: 12,
    logoUrl: null,
  },
  {
    id: "agt_rem_001",
    slug: "remotefirst-payroll",
    displayName: "RemoteFirst Payroll",
    developerName: "RemoteFirst",
    tagline: "Monthly USDC payroll for global contractors. Pays, logs, and reports.",
    category: "payroll",
    verified: true,
    riskTier: "high",
    skills: [
      { id: "contractor_payout", name: "Contractor Payroll" },
    ],
    requiredRails: ["circle"],
    deployerCount: 8,
    logoUrl: null,
  },
  {
    id: "agt_df_001",
    slug: "dataforge-research",
    displayName: "DataForge Research Agent",
    developerName: "DataForge Inc",
    tagline: "Buys market data via x402 micropayments to compile AI research reports.",
    category: "micropayments",
    verified: false,
    riskTier: "low",
    skills: [
      { id: "api_micropayment", name: "Data API Micropayments" },
    ],
    requiredRails: ["x402"],
    deployerCount: 3,
    logoUrl: null,
  },
  {
    id: "agt_fm_001",
    slug: "freshmart-restocking",
    displayName: "FreshMart Restocking Agent",
    developerName: "FreshMart",
    tagline: "Monitors store inventory and autonomously places restock orders.",
    category: "procurement",
    verified: false,
    riskTier: "medium",
    skills: [
      { id: "inventory_restock", name: "Inventory Purchase" },
    ],
    requiredRails: ["square"],
    deployerCount: 1,
    logoUrl: null,
  },
]
```

### Registry Filters

| Filter | Component | Options |
|--------|-----------|---------|
| Search | `Input` with search icon | Full-text on name, tagline, skills, developer |
| Category | `Select` | All categories from `AgentCategory` enum |
| Rail | `Select` | All, Stripe, Circle, x402, Square, Braintree, Razorpay |
| Risk | `Select` | All, Low, Medium, High |
| Verified only | `Switch` | Toggle to show only Inflection-verified agents |

### `<ConnectFromRegistryDialog>`

When a deployer clicks "Connect →" on a registry card. Three sub-steps:

**Sub-step 1: Review agent capabilities**

```
┌──────────────────────────────────────────────────────────────┐
│ Connect Vendor Payment Agent                          ✕      │
│ by Acme AI Labs  ✓ Verified                                  │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ This agent will be able to:                                  │
│                                                              │
│ ON STRIPE                                                    │
│  ● charges.create      up to $10,000 per transaction         │
│  ● refunds.create      up to $5,000 per transaction          │
│  Not included: payouts, transfers, subscriptions             │
│                                                              │
│ ON CIRCLE                                                    │
│  ● transfers.create    up to $100,000 per transaction        │
│  ⚠ Irreversible — USDC transfers cannot be refunded          │
│                                                              │
│ Typical usage: up to 50 Stripe transactions per day,         │
│ up to 10 Circle transfers per day                            │
│                                                              │
│ Risk tier: ■ Medium                                          │
│                                                              │
│ Documentation: docs.acmeai.com/vendor-pay-agent →            │
│                                                              │
│                    [Cancel]  [I understand, continue →]      │
└──────────────────────────────────────────────────────────────┘
```

This screen is intentionally detailed — deployers are about to give an AI agent access to their payment accounts. The declared capabilities from the agent's manifest are shown verbatim.

**Sub-step 2: Connect payment accounts**

```
┌──────────────────────────────────────────────────────────────┐
│ Connect Vendor Payment Agent                                 │
│ Step 2: Connect your payment accounts                        │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Required rails:                                              │
│                                                              │
│ ┌── Stripe ──────────────────────────────────────────────┐  │
│ │ ✓ Already connected: Acme Corp (acct_1Abc23XYZ)       │  │
│ │ This account will be used for this agent.              │  │
│ │ [Use a different Stripe account]                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌── Circle ──────────────────────────────────────────────┐  │
│ │ ✗ Not connected                                        │  │
│ │ [Connect Circle Account →]                             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ You can connect Circle now or skip and connect later.        │
│ The agent will only be able to use connected rails.          │
│                                                              │
│  [← Back]   [Skip Circle for now]   [Continue →]            │
└──────────────────────────────────────────────────────────────┘
```

If a rail is already connected (another agent uses the same Stripe account), it's shown as pre-selected with an option to use a different account.

**Sub-step 3: Set policies** (pre-populated from manifest)

```
┌──────────────────────────────────────────────────────────────┐
│ Connect Vendor Payment Agent                                 │
│ Step 3: Review suggested policies                            │
│ ─────────────────────────────────────────────────────────── │
│ Suggested from agent manifest. You can adjust anything.      │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ STRIPE POLICY                                                │
│  Allowed actions:  charges.create  refunds.create            │
│  Max per transaction:  $10,000  [Edit]                       │
│  Daily limit:          $50,000  [Edit]                       │
│  Require approval:     above $5,000  [Edit]                  │
│  Velocity:             50 / day  [Edit]                      │
│                                                              │
│ CIRCLE POLICY                                                │
│  Allowed actions:  transfers.create                          │
│  Max per transaction:  $100,000  [Edit]                      │
│  Daily limit:          $200,000  [Edit]                      │
│  Require approval:     above $25,000  [Edit]                 │
│                                                              │
│ NOTIFICATIONS                                                │
│  ○ No notifications                                          │
│  ◉ Slack  [https://hooks.slack.com/...  ]                    │
│  ○ Email  [you@company.com             ]                     │
│                                                              │
│  [← Back]            [Connect and activate agent →]         │
└──────────────────────────────────────────────────────────────┘
```

On "Connect and activate agent":
1. Creates connector records for each connected rail
2. Saves connector policies
3. Saves notification config
4. Returns to the Connectors page with a success toast: "Vendor Payment Agent connected — 2 connectors active"

---

### `<AgentDetailSheet>`

Clicking an agent name in the registry opens a `Sheet` from the right with the full agent profile.

```
┌────────────────────────────────────────────────────────────────┐
│ [logo] Vendor Payment Agent            ✓ Verified      [✕]    │
│        by Acme AI Labs                                         │
│        12 deployers · accounts_payable                         │
│ ──────────────────────────────────────────────────────────     │
│                                                                 │
│ Automates AP — pays vendor invoices, handles approval           │
│ workflows, and reconciles spend across Stripe and Circle.       │
│                                                                 │
│ ──────────────────────────────────────────────────────────     │
│ Skills & Capabilities                                           │
│                                                                 │
│ ┌── AP / Invoice Payment ──────────────────────────────────┐   │
│ │ ■ Medium risk · Required                                │   │
│ │                                                          │   │
│ │ On Stripe                                               │   │
│ │  charges.create    Charges vendor's payment method       │   │
│ │                    up to $10,000 per transaction         │   │
│ │  refunds.create    Issues refunds for disputes           │   │
│ │                    up to $5,000 per transaction          │   │
│ │                                                          │   │
│ │ On Circle                                               │   │
│ │  transfers.create  Sends USDC for large intl payments    │   │
│ │                    up to $100,000 · Irreversible ⚠       │   │
│ │                                                          │   │
│ │ Typical: $100–$10,000 · up to 50 Stripe/day             │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌── Refund Processing ─────────────────────────────────────┐   │
│ │ ● Low risk · Optional                                   │   │
│ │                                                          │   │
│ │ On Stripe                                               │   │
│ │  refunds.create    Issues partial or full refunds        │   │
│ │                    up to $5,000 per transaction          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ──────────────────────────────────────────────────────────     │
│ Required connections: stripe  circle                           │
│ Documentation: docs.acmeai.com/vendor-pay-agent →              │
│                                                                 │
│                                    [Connect to My Account →]   │
└────────────────────────────────────────────────────────────────┘
```

---

## Design Notes

### My Agents tab
- Left border color by status: `border-l-primary` (active), `border-l-yellow-400` (suspended)
- Skills chips: `Badge variant="secondary"` — neutral, informational
- Risk indicator: `● Low` in `text-green-400`, `■ Medium` in `text-yellow-400`, `■ High` in `text-red-400`
- "Listed publicly" badge uses `text-primary` (lime) with `Globe` lucide icon
- No manifest warning uses `AlertTriangle` + `bg-yellow-500/10`

### Registry tab
- Cards in `grid grid-cols-3 gap-4` (desktop), `grid-cols-1` (mobile)
- "Featured" section: horizontal scroll row of 3 cards, `bg-accent/50` background
- Verified badge: `CheckCircle2` lucide icon + `text-primary` (lime) — only Inflection-reviewed agents get this
- `[Connect →]` button: `Button variant="default"` (full primary lime)
- Registry empty state (no results): "No agents match your filters. Try searching for a skill or category."
- `<ConnectFromRegistryDialog>` uses a mini stepper: `Step 1: Review` · `Step 2: Connect` · `Step 3: Policy`
- Irreversible action warning uses `AlertTriangle` in `text-destructive`
- Pre-populated policy fields show a `Sparkles` icon + "Suggested from manifest" tooltip
