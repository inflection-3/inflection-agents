# Page: Settings (/settings)

Route: `/settings`  
Persona: Developer, Ops  
Purpose: Account management — profile, team members, API key management, and billing/plan info.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Settings"                                   │
├──────────────┬──────────────────────────────────────┤
│ Tabs (left)  │ Tab content (right)                  │
│              │                                       │
│ • Profile    │                                       │
│ • API Keys   │                                       │
│ • Team       │                                       │
│ • Plan       │                                       │
└──────────────┴──────────────────────────────────────┘
```

Uses shadcn `Tabs` (horizontal on desktop, or vertical sidebar-style).

---

## Components

### Tab: Profile

Fields:
- Full Name: `Input` 
- Email: `Input` (read-only, change requires email verification)
- Organization name: `Input`
- `[Save Changes]` button

**Mock data:**
```ts
const profile = {
  name: "Sarah Chen",
  email: "sarah@acme.com",
  org: "Acme Corp",
}
```

Password section:
- Current password, New password, Confirm new password
- `[Update Password]` button
- Separate from profile save

### Tab: API Keys

For managing SDK API keys (different from connector credentials).

Header: "SDK API Keys" + `[+ Create Key]` button

**Key list:**
```ts
const apiKeys = [
  {
    id: "key_001",
    name: "Production",
    prefix: "sk_inf_live_7x2k••••",
    createdAt: "2026-04-12",
    lastUsedAt: "2 min ago",
    scopes: ["gateway:call"],
  },
  {
    id: "key_002", 
    name: "Staging",
    prefix: "sk_inf_test_4r8j••••",
    createdAt: "2026-04-28",
    lastUsedAt: "3 hours ago",
    scopes: ["gateway:call"],
  },
]
```

Each row (shadcn `Table`):
- Name | Key preview | Created | Last used | `[Revoke]`

Create key dialog:
- Name input
- On create: show full key **once** with copy button + warning "You won't see this again"

### Tab: Team (P1)

Shown with "Invite team members" but marked as coming in v2 with `Badge`.

Basic layout:
- Current members table: Name | Email | Role | Joined
- `[+ Invite]` button (disabled with tooltip "Coming in v2")

**Mock members:**
```ts
const teamMembers = [
  { name: "Sarah Chen", email: "sarah@acme.com", role: "Admin", joinedAt: "2026-04-12" },
  { name: "James Park", email: "james@acme.com", role: "Approver", joinedAt: "2026-04-20" },
]
```

### Tab: Plan

Shows current plan and usage.

**Mock:**
```ts
const plan = {
  tier: "Free",
  gatewayCallsUsed: 1204,
  gatewayCallsLimit: 5000,
  activeAgents: 3,
  activeAgentsLimit: 5,
}
```

Usage bars using shadcn `Progress`:
- Gateway calls: 1,204 / 5,000 (24%)
- Active agents: 3 / 5

Upgrade CTA card:
```
Upgrade to Pro
Unlimited gateway calls · Up to 20 agents · Priority support
[$49/month]  [Upgrade]
```
Uses `bg-primary/10 border border-primary/30` highlight.

---

## Design Notes

- Tabs use `shadcn Tabs` with `TabsList` + `TabsTrigger` + `TabsContent`
- Destructive actions (revoke key) use `Button variant="destructive" size="sm"`
- One-time key display uses a `bg-accent` box with monospace font + copy button
- Profile and password are separate forms with separate save buttons (don't mix concerns)
- Plan tab is read-only in v1; no billing integration yet
