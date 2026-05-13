# Embed SDK — @inflection/embed

The Inflection embed SDK ships as a single JavaScript bundle that companies drop into their product. It is fully white-labeled — no Inflection branding is shown unless explicitly opted in.

---

## Package

```
@inflection/embed
```

Distributed as:
- **npm package** — for projects using a bundler (React, Vue, Svelte, vanilla JS)
- **CDN script tag** — `https://embed.inflection.ai/v1/widget.js` — for no-build setups

---

## Installation

**NPM**
```bash
npm install @inflection/embed
```

**CDN**
```html
<script src="https://embed.inflection.ai/v1/widget.js" async></script>
```

---

## Quick Start

```html
<!-- In the company's product HTML -->
<script>
  window.InflectionConfig = {
    workspaceId: "ws_abc123",
    token: "eyJhbGciOiJSUzI1NiJ9...",  // company-signed JWT
  };
</script>
<script src="https://embed.inflection.ai/v1/widget.js" async></script>
```

That's it. The widget renders as a floating chat button in the bottom-right corner.

---

## JWT Token

The company generates this token **server-side** and injects it into the product page for the logged-in user. Never generate it client-side.

**Claims:**
```json
{
  "workspaceId": "ws_abc123",
  "externalId": "user_789",       // company's user ID — must be stable
  "metadata": {                   // any context to inject into flows
    "accountId": "acct_456",
    "tier": "premium",
    "email": "user@example.com"
  },
  "exp": 1748956800               // expiry — recommend 1 hour
}
```

**Signing (Node.js example):**
```ts
import jwt from 'jsonwebtoken';
import fs from 'fs';

const privateKey = fs.readFileSync('./inflection-private.key');

const token = jwt.sign(
  {
    workspaceId: 'ws_abc123',
    externalId: req.user.id,
    metadata: {
      accountId: req.user.accountId,
      tier: req.user.tier,
    },
  },
  privateKey,
  { algorithm: 'RS256', expiresIn: '1h' }
);
```

Pass the private key to your backend. Give Inflection the corresponding public key (in dashboard → Settings → Embed).

---

## Full Init API

```ts
import { InflectionEmbed } from '@inflection/embed';

InflectionEmbed.init({
  // ─── Required ─────────────────────────────────────────────────
  workspaceId: string;

  token: string;
  // Company-signed RS256 JWT. Required. Refreshed via onTokenExpired callback.

  // ─── Mode ─────────────────────────────────────────────────────
  mode?: 'a' | 'b' | 'both';
  // 'a' = end users can only interact with company-built flows (fixed agent)
  // 'b' = end users can only create their own agents (personal agents)
  // 'both' = both modes available, tabbed interface
  // Default: 'both'

  palette?: string[];
  // Optional filter: array of flow IDs or names to include in Mode B palette.
  // If omitted, all flows with isTemplate=true are included.
  // Example: ['check_balance', 'transaction_summary']

  // ─── Appearance ───────────────────────────────────────────────
  theme?: {
    primaryColor?: string;
    // Hex or CSS color. Used for: send button, agent message bubbles, focus rings.
    // Default: '#1a56db'

    backgroundColor?: string;
    // Widget panel background. Default: '#ffffff'

    textColor?: string;
    // Primary text color. Default: '#111827'

    borderRadius?: string;
    // Border radius for messages, buttons, widget panel. Default: '12px'

    fontFamily?: string;
    // CSS font-family string. Default: 'Inter, system-ui, sans-serif'

    logoUrl?: string;
    // URL of company logo shown in widget header. If omitted, header shows agentName only.

    agentName?: string;
    // Name displayed in widget header and messages. Default: 'Assistant'

    welcomeMessage?: string;
    // First message shown when widget opens. Supports markdown.
    // Default: 'Hi! How can I help you today?'

    placeholderText?: string;
    // Input bar placeholder. Default: 'Type a message...'

    poweredBy?: boolean;
    // Show 'Powered by Inflection' in widget footer. Default: false
  };

  // ─── Position ─────────────────────────────────────────────────
  position?: 'bottom-right' | 'bottom-left' | 'inline';
  // Default: 'bottom-right'

  containerId?: string;
  // Required when position='inline'. The widget renders inside this DOM element.
  // Example: 'my-chat-container'

  // ─── Behavior ─────────────────────────────────────────────────
  defaultOpen?: boolean;
  // Open widget on page load. Default: false

  // ─── Callbacks ────────────────────────────────────────────────
  onReady?: () => void;
  // Fired when widget is mounted and ready for interaction.

  onOpen?: () => void;
  onClose?: () => void;

  onTokenExpired?: () => Promise<string>;
  // Called when the JWT has expired. Return a new token string.
  // If not provided and token expires, widget shows a reconnect prompt.

  onAgentCreated?: (agent: PersonalAgent) => void;
  // Mode B: fired when end user creates a personal agent.

  onExecutionStarted?: (executionId: string) => void;
  // Fired when a flow execution begins.

  onExecutionComplete?: (result: ExecutionResult) => void;
  // Fired when a flow execution completes (success or failure).

  onApprovalRequired?: (request: ApprovalSummary) => void;
  // Fired when a HITL node pauses an execution.
  // Useful if the company wants to show their own UI for approval notifications.

  onError?: (error: EmbedError) => void;
  // Fired on any unrecoverable error.
});
```

---

## Programmatic Control

After `init()`, control the widget from your application code:

```ts
InflectionEmbed.open();
// Opens the chat panel.

InflectionEmbed.close();
// Closes the chat panel.

InflectionEmbed.toggle();
// Toggles open/close.

InflectionEmbed.sendMessage(text: string);
// Programmatically sends a message as the end user.
// Useful for: deep-link into a specific agent task from a button in your UI.
// Example: InflectionEmbed.sendMessage("Check my account balance");

InflectionEmbed.setToken(newToken: string);
// Update the end-user JWT without re-initializing.
// Call this when your token refreshes.

InflectionEmbed.destroy();
// Unmounts the widget completely. Removes DOM elements and event listeners.

InflectionEmbed.getState(): WidgetState;
// Returns current state: { isOpen, mode, activeAgentId, pendingApprovals }
```

---

## Types

```ts
interface PersonalAgent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused';
  schedule?: {
    cronExpression: string;
    timezone: string;
    nextRunAt: string; // ISO 8601
  };
  createdAt: string;
}

interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output?: unknown;
  durationMs: number;
  error?: {
    code: string;
    message: string;
  };
}

interface ApprovalSummary {
  approvalId: string;
  message: string;
  expiresAt: string;
}

interface EmbedError {
  code:
    | 'AUTH_FAILED'
    | 'TOKEN_EXPIRED'
    | 'NETWORK_ERROR'
    | 'EXECUTION_FAILED'
    | 'GUARDRAIL_DENIED'
    | 'RATE_LIMITED'
    | 'UNKNOWN';
  message: string;
  details?: unknown;
}

interface WidgetState {
  isOpen: boolean;
  mode: 'a' | 'b' | 'both';
  activeAgentId: string | null;
  pendingApprovals: number;
}
```

---

## Widget UI Reference

### Floating button (default)
- Fixed position, bottom-right (or bottom-left)
- Company logo or default chat icon
- Badge shows count of pending approval notifications
- Click → chat panel slides up

### Chat panel
```
┌─────────────────────────────┐
│ [Logo] Aria          [×]    │  ← Header: agentName + close
├─────────────────────────────┤
│ [Mode A] [My Agents]        │  ← Tab bar (only if mode='both')
├─────────────────────────────┤
│                             │
│   Hi! How can I help you   │  ← Welcome message (agent bubble)
│   today?                    │
│                             │
│              What's my      │  ← User message
│              balance?        │
│                             │
│   Your current balance is   │  ← Agent response (streamed)
│   $1,243.50 across 2        │
│   accounts. ✓               │
│                             │
├─────────────────────────────┤
│ [Type a message...     ] [→] │  ← Input bar
└─────────────────────────────┘
```

### My Agents tab (Mode B)

```
┌─────────────────────────────┐
│ [Logo] Aria          [×]    │
├─────────────────────────────┤
│ [Mode A] [My Agents]        │
├─────────────────────────────┤
│ + Create a new agent        │
│                             │
│ ● Balance Watcher           │  ← Active personal agent
│   Runs daily at 9am         │
│   Last run: 2h ago          │
│                             │
│ ⏸ Savings Tracker           │  ← Paused agent
│   Paused                    │
├─────────────────────────────┤
│ [Type what you want...] [→] │
└─────────────────────────────┘
```

### Mode B creation flow

```
Step 1: Intent
┌─────────────────────────────┐
│  What would you like your   │
│  agent to do?               │
│                             │
│  [Describe in plain English]│
│                             │
│  [              ] [→]       │
└─────────────────────────────┘

Step 2: Loading
  "Let me set that up for you..."
  [spinner]

Step 3: Confirmation
┌─────────────────────────────┐
│  Here's what I'll set up:   │
│                             │
│  📋 Balance Watcher         │  ← Editable name
│                             │
│  • Check your Plaid balance │
│  • Alert you if under $500  │
│                             │
│  ⏰ Runs daily at 9:00 AM   │  ← Editable time
│     [Change time]           │
│                             │
│  [Create Agent] [Cancel]    │
└─────────────────────────────┘

Step 4: Success
  "✓ Balance Watcher created!
   It'll run tomorrow at 9:00 AM."
```

---

## HITL in Embed

When a flow execution hits a HITL node, the embed shows:

```
┌─────────────────────────────┐
│  This action needs approval │
│  from your team.            │
│                             │
│  ⏳ Waiting for:            │
│  finance@company.com        │
│                             │
│  We'll notify you when it's │
│  approved or rejected.      │
│                             │
│  Expires in: 59:32          │  ← Countdown timer
└─────────────────────────────┘
```

If the company implements `onApprovalRequired`, they can show their own UI instead.

When approved:
```
  "✓ Approved! Continuing..."
  [execution resumes, result streamed]
```

When rejected:
```
  "✗ This action was declined.
   Reason: Amount exceeds daily limit."
```

---

## Inline Mode

For companies that want the widget inside their product layout (not floating):

```html
<div id="ai-assistant" style="height: 600px; width: 400px;"></div>
```

```ts
InflectionEmbed.init({
  workspaceId: 'ws_abc123',
  token: userToken,
  position: 'inline',
  containerId: 'ai-assistant',
});
```

The widget fills the container. No floating button is rendered.

---

## Security Notes

- The `token` is only sent over HTTPS
- The widget never stores the JWT in localStorage or cookies — kept in memory only
- CORS: Inflection API only accepts requests from domains in `workspace.embedOrigins`
- Content Security Policy: companies should add `https://embed.inflection.ai` to their script-src
- The widget runs in the same origin as the embedding page — not an iframe — so it can safely access the company's DOM if needed for inline mode

---

## Bundle Size Budget

| Chunk | Target |
|---|---|
| widget.js (gzipped) | < 100KB |
| React (shared) | ~45KB |
| Core widget logic | ~30KB |
| Mode B UI | ~15KB |
| Icons/assets | ~5KB |

Dependencies: React 19, React DOM, no CSS framework (CSS-in-JS with zero-runtime), EventSource polyfill for older browsers.

---

## Framework Integrations

**React**
```tsx
import { useEffect } from 'react';
import { InflectionEmbed } from '@inflection/embed';

function App() {
  useEffect(() => {
    InflectionEmbed.init({
      workspaceId: 'ws_abc123',
      token: userSession.inflectionToken,
      theme: { agentName: 'Aria', primaryColor: '#6366f1' },
    });
    return () => InflectionEmbed.destroy();
  }, [userSession.inflectionToken]);

  return <div id="app">...</div>;
}
```

**Vue**
```ts
// main.ts
import { InflectionEmbed } from '@inflection/embed';

app.mixin({
  mounted() {
    if (this.$root === this) {
      InflectionEmbed.init({ workspaceId: '...', token: store.inflectionToken });
    }
  },
  beforeUnmount() {
    if (this.$root === this) InflectionEmbed.destroy();
  },
});
```

**Next.js (App Router)**
```tsx
'use client';
import { useEffect } from 'react';
import { InflectionEmbed } from '@inflection/embed';

export function InflectionWidget({ token }: { token: string }) {
  useEffect(() => {
    InflectionEmbed.init({ workspaceId: 'ws_abc123', token });
    return () => InflectionEmbed.destroy();
  }, [token]);
  return null;
}

// In layout.tsx — add server-side generated token
import { getServerSession } from 'next-auth';
export default async function Layout({ children }) {
  const session = await getServerSession();
  const token = generateInflectionToken(session.user.id); // server-side
  return (
    <html>
      <body>
        {children}
        <InflectionWidget token={token} />
      </body>
    </html>
  );
}
```

---

## Changelog (planned)

| Version | Contents |
|---|---|
| 1.0.0 | Mode A + Mode B, floating + inline, all theme options, full callback API |
| 1.1.0 | Slack surface (company deploys agent as Slack bot — no embed change needed) |
| 1.2.0 | Voice input (Web Speech API) |
| 2.0.0 | Mobile SDK (React Native) |
