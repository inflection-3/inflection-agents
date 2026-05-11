# Page: Notifications (/notifications)

Route: `/notifications`  
Persona: Ops  
Purpose: Configure where approval notifications are sent. Currently: Slack webhook per agent. Email in v2.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Header: "Notifications"                              │
├─────────────────────────────────────────────────────┤
│ Per-agent notification config (one section per agent)│
│                                                      │
│ ┌── vendor-pay-agent ───────────────────────────┐   │
│ │ Slack Webhook                    [CONFIGURED ✓]│   │
│ │  URL: https://hooks.slack.com/••••••           │   │
│ │  [Edit]  [Test]  [Remove]                      │   │
│ │                                                │   │
│ │ Email                           [NOT SET]      │   │
│ │  "Available in v2"              [Coming soon]  │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│ ┌── invoice-bot ─────────────────────────────────┐   │
│ │ Slack Webhook                   [NOT CONFIGURED]│  │
│ │  [+ Add Slack Webhook]                          │  │
│ └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Components

### `<AgentNotificationSection>`
shadcn `Card` per agent, with `CardHeader` showing agent name + status summary.

Status summary chips (right-aligned in header):
- Slack: `Badge` — "Configured" (primary) or "Not set" (muted)
- Email: `Badge` — "Coming soon" (muted, disabled)

### `<SlackWebhookConfig>`
Inside each agent card:

**Configured state:**
- Masked webhook URL: `https://hooks.slack.com/services/T•••/B•••/••••••••••••`
- Three actions: `[Edit]` / `[Test]` / `[Remove]`
- Last tested: "Tested 2 days ago — ✓ OK" in muted text

**Not configured state:**
- Description: "Get notified in Slack when a transaction requires approval."
- `[+ Add Slack Webhook]` button (outline)

**Edit/Add flow:** inline expansion (shadcn `Collapsible`) with:
```
Webhook URL:  [__________________________________]
              Paste your Slack Incoming Webhook URL

Channel:      [#approvals          ]  (optional label)
              
              [Cancel]  [Save Webhook]
```
Below URL field: "How to create a Slack webhook →" link (opens external docs)

**Test action:** sends a sample notification. Inline feedback:
- Success: `✓ Test message sent to #approvals`
- Failure: `✗ Webhook returned 404. Check the URL and try again.` in `text-destructive`

**Mock data:**
```ts
const notificationConfigs = [
  {
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    slack: {
      configured: true,
      webhookPreview: "https://hooks.slack.com/services/T04A•••/B05B•••/••••••••••••",
      channel: "#payments-approvals",
      lastTestedAt: "2026-05-09T11:30:00Z",
      lastTestStatus: "ok",
    },
    email: null,
  },
  {
    agentId: "agt_4r8jq5vw",
    agentName: "invoice-bot",
    slack: null,
    email: null,
  },
  {
    agentId: "agt_2c6hn1yz",
    agentName: "expense-agent",
    slack: null,
    email: null,
  },
]
```

### Email Section (v2 Preview)
Shown as a disabled, grayed-out section within each agent card:
- Label: "Email notifications"
- `Badge` variant muted: "Available in v2"
- `Input` with `disabled` prop, placeholder "you@company.com"
- `Button disabled` — "Save Email"

This communicates the roadmap without hiding the feature.

### WhatsApp Section
Not shown (out of scope for v1, no teaser needed).

---

## Design Notes

- Each agent section separated by `Separator` component
- Webhook URL always masked after save — never show full URL in UI
- Test button: `Button variant="outline" size="sm"` with `BellRing` icon
- Remove action uses `Button variant="ghost" size="sm" className="text-destructive"` — no confirmation dialog needed (it's just removing a webhook URL, not revoking access)
- Empty state (agent has approval threshold but no Slack configured): yellow warning banner: "This agent has a requireHumanApproval policy but no notification channel configured. Approvals will only appear in the dashboard."
