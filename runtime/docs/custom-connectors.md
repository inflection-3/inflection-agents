# Custom Connectors

The most important feature for companies deploying Inflection. Custom Connectors let a company turn **any of their own APIs** into first-class nodes on the canvas — and optionally expose those as tools their end users can build personal agents with.

---

## The Core Idea

A company's internal API — their loan origination system, their core banking platform, their portfolio management tool — becomes a set of draggable nodes in the Inflection canvas.

```
Company API
  ↓ (import via OpenAPI spec or manual builder)
Custom Connector
  ↓ (each endpoint = one action)
Named Actions: getLoanStatus, submitApplication, getPortfolioHoldings, ...
  ↓ (each action = draggable node in canvas)
Canvas Node: "Get Loan Status"
  ↓ (company marks which actions end users can access)
Mode B Palette Tool: "Check my loan status"
```

The company defines it once. Their internal team uses it to build automated workflows. Their end customers use it to build personal agents — within whatever guardrails the company sets.

---

## Import Methods

### Method 1: OpenAPI Spec Import (Recommended)

If the company's API has an OpenAPI (Swagger) spec, import happens in 3 clicks.

**Step 1:** Provide the spec

Three ways to provide it:
- **URL** — paste the spec URL (e.g., `https://api.company.com/openapi.json`). Inflection fetches and parses it.
- **File upload** — upload a `.yaml` or `.json` OpenAPI 3.x file
- **Paste** — paste raw YAML/JSON directly into a text editor

**Step 2:** Configure auth (once — applies to all actions in this connector)

| Auth type | What to provide |
|---|---|
| API Key | Header name, API key value |
| Bearer Token | Token value (or select an existing connector credential) |
| Basic Auth | Username, password |
| OAuth 2.0 Client Credentials | Token URL, client ID, client secret, scopes |
| OAuth 2.0 Auth Code | Auth URL, token URL, client ID, client secret, scopes, redirect URI |
| Custom Header | Any header name + value (for proprietary auth schemes) |
| mTLS | Client certificate + key (Phase 3) |

Auth credentials are encrypted and stored in Vault — same as native connectors.

**Step 3:** Review + customize actions

After parsing, Inflection shows a table of all discovered endpoints:

```
┌─────────────────────────────────────────────────────────────────────┐
│ POST /loans/{loanId}/status          → "Get Loan Status"       [✓] │
│ POST /applications                   → "Submit Application"    [✓] │
│ GET  /portfolio/{userId}/holdings    → "Get Holdings"          [✓] │
│ DELETE /accounts/{id}                → "Delete Account"        [ ] │  ← unchecked by default for destructive ops
│ ...                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

For each action, the company can:
- **Enable/disable** — which actions are imported as nodes
- **Rename** — "POST /applications" → "Submit Loan Application"
- **Write a description** — used by the LLM in Mode B intent parsing; the better this is, the better Mode B works
- **Mark as end-user accessible** — should end users see this in Mode B?
- **Set HITL required** — force an approval gate before this action executes
- **Tag** — group related actions (e.g., "Loans", "Portfolio", "Account Management")

---

### Method 2: Manual Action Builder

For companies without an OpenAPI spec, or for quick one-off actions.

**Each action is defined by:**

```ts
interface CustomAction {
  name: string;                // e.g. "Get Loan Status"
  description: string;         // LLM-readable; be specific: "Gets the current status, amount, and next payment date for a loan given its ID"
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  urlTemplate: string;         // e.g. "https://api.company.com/loans/{{loanId}}/status"
  headers?: Record<string, string>;

  parameters: {
    name: string;
    in: "path" | "query" | "body" | "header";
    dataType: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    required: boolean;
    defaultValue?: unknown;
  }[];

  responseSchema?: object;     // JSON Schema for the response — generates typed output ports
  testPayload?: object;        // sample data for testing

  // Exposure settings
  exposedToEndUsers: boolean;
  requireApproval: boolean;
  tags: string[];
}
```

The builder UI has two modes:
- **Form mode** — fill in each field with labeled inputs
- **cURL mode** — paste a cURL command, Inflection parses it into the action definition

**cURL mode example:**
```
Paste: curl -X POST https://api.company.com/loans/L-123/status \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"includeHistory": true}'

→ Inflection extracts:
  method: POST
  url: https://api.company.com/loans/{loanId}/status
  headers: { Authorization: "Bearer {{credential:api_key}}", Content-Type: "application/json" }
  body: { includeHistory: boolean }
```

---

### Method 3: MCP Server Import (Phase 2)

If the company already has an MCP (Model Context Protocol) server, Inflection can connect to it directly. Every tool exposed by the MCP server becomes a custom connector action.

```ts
config: {
  mcpServerUrl: string;       // e.g. "https://mcp.company.com/sse"
  authType: "bearer" | "api_key" | "none";
  credential?: string;
}
```

This gives companies with existing MCP infrastructure instant access to all their tools without re-defining them.

---

## Custom Connector Data Model

```ts
interface CustomConnector {
  id: string;
  workspaceId: string;
  name: string;                  // e.g. "LoanStar Core Banking"
  description: string;           // shown in canvas sidebar tooltip
  iconUrl?: string;              // company-uploaded icon (40x40px)
  iconColor?: string;            // fallback: auto-color from name hash
  baseUrl: string;               // e.g. "https://api.company.com/v2"
  authConfig: AuthConfig;        // encrypted, stored in Vault
  actions: CustomAction[];
  importMethod: "openapi" | "manual" | "mcp";
  openApiSpecUrl?: string;       // if imported from URL, stored for re-sync
  status: "active" | "error" | "syncing";
  lastTestedAt?: Date;
  createdBy: string;             // userId
  createdAt: Date;
  updatedAt: Date;
}
```

---

## How It Appears in the Canvas

### Sidebar

Custom connectors appear in the sidebar under **"Your Connectors"** section, above the native connectors.

```
Sidebar
├── Flow Control
│     Input, Output, If/Else, ...
├── AI
│     LLM Node, Knowledge Base
├── Your Connectors                    ← company-defined
│     ┌─────────────────────────────┐
│     │ [🏦] LoanStar Core Banking  │
│     │   • Get Loan Status         │  ← draggable node
│     │   • Submit Application      │
│     │   • Get Portfolio Holdings  │
│     └─────────────────────────────┘
│     ┌─────────────────────────────┐
│     │ [📊] Internal Analytics API │
│     │   • Get KPI Dashboard       │
│     │   • Export Report           │
│     └─────────────────────────────┘
├── Native Connectors
│     Stripe, Plaid, NetSuite, ...
```

Each custom connector action is a draggable node. Drop it on canvas → configured connector node created.

### Node appearance on canvas

Custom connector nodes look identical to native nodes:

```
┌──────────────────────────────────┐
│ [🏦] Get Loan Status             │  ← connector icon + action name
│      LoanStar Core Banking        │  ← connector name (subdued)
├──────────────────────────────────┤
│ ○ loanId (string)                │  ← input ports (left side)
│ ○ includeHistory (boolean)       │
├──────────────────────────────────┤
│                status (string) ○ │  ← output ports (right side)
│             nextPayment (date) ○ │
│                 amount (number) ○│
└──────────────────────────────────┘
```

Output ports are inferred from the `responseSchema`. If no schema is defined, a single `response` (object) port is used.

---

## How It Appears in Mode B

End users interact with the company's custom connector actions as natural language tools.

### LLM system prompt injection

When a user describes their intent in Mode B, the LLM receives a system prompt containing the palette — the list of available tools. Custom connector actions marked `exposedToEndUsers: true` are included:

```
Available tools for this user:

Native tools:
- plaid.getBalance: Get the user's current bank account balance
- plaid.getTransactions: Get recent transactions with optional filters

Company tools (LoanStar Core Banking):
- loanstar.getLoanStatus: Gets the current status, amount, and next payment date for a loan.
  Required: loanId (the user's loan ID, available in their profile)
- loanstar.getPortfolioHoldings: Get the user's current investment portfolio holdings.

...
```

The LLM maps the user's request to these tools, the same way it maps to native tools.

### Example

**User types:** "Tell me my loan balance and when my next payment is due every Monday morning"

**LLM maps to:**
- Tool: `loanstar.getLoanStatus` (using `loanId` from the end-user's JWT metadata)
- Schedule: every Monday at 9am
- Output: formatted text message with loan status + next payment

**Agent created:** Runs every Monday, calls `getLoanStatus`, formats result, sends notification.

---

## Syncing & Version Management

### Re-sync from OpenAPI URL

If the connector was imported from a URL, a "Re-sync" button appears in the connector settings. Re-syncing:
1. Re-fetches the spec
2. Detects new endpoints → prompts to add as actions
3. Detects removed endpoints → warns, marks those actions as deprecated
4. Detects changed schemas → shows diff, prompts to update or ignore
5. Never auto-deletes actions that are used in existing flows — marks as deprecated instead

### Connector versioning

Each published flow snapshot (`flow_versions.graph`) contains a copy of the connector's action schema at the time of publishing. This ensures:
- Flows don't break when the connector is updated
- Rollback to an old flow version uses the old connector schema
- Breaking changes are isolated until the company explicitly re-publishes

---

## Testing Custom Connector Actions

Each action has a **Test** button in the connector settings:

1. Shows all defined parameters
2. Company fills in test values (or uses defaults from `testPayload`)
3. Inflection calls the action with those values
4. Shows raw response + parsed output ports
5. If it fails: shows error details + curl-equivalent for debugging

There's also a **"Test node in isolation"** button on the canvas inspector — same as above, but launched in-context with the current flow's variable values.

---

## Using Custom Connectors as Internal Workflow Tools (B2B mode)

Custom connectors aren't just for end users. Companies use them to build internal automation workflows:

**Example internal workflow: Loan Approval Automation**

```
Webhook Trigger (loan application submitted)
  → Get Loan Application (loanstar.getApplication)
  → Get Applicant Credit Score (custom: creditCheckApi.getScore)
  → If/Else (score > 700)
      → true:  Auto-approve (loanstar.approveApplication)
               → Send Email (notify applicant)
      → false: Get Risk Assessment (loanstar.getRiskAssessment)
               → HITL (underwriter review required)
               → On approve: loanstar.approveApplication
               → On reject: loanstar.rejectApplication
               → Send Email (notify applicant either way)
  → Log to NetSuite (netsuite.createTransaction)
```

This entire flow runs internally — no end user involved. Triggered by a webhook from their loan origination system. Uses custom connectors for the company-specific steps, native nodes for the rest.

---

## Custom Connector Quick Reference

| Feature | Details |
|---|---|
| Import methods | OpenAPI URL, OpenAPI file upload, manual builder, MCP server (Phase 2) |
| Max actions per connector | 200 |
| Max connectors per workspace | 50 |
| Auth types | API key, Bearer, Basic, OAuth2 CC, OAuth2 Auth Code, Custom header |
| Re-sync | Manual re-sync from OpenAPI URL; diff-aware |
| Versioning | Actions snapshotted in flow_versions; no silent breaking changes |
| End-user exposure | Per-action toggle; description used by Mode B LLM |
| HITL | Per-action toggle; forced approval before execution |
| Test in isolation | Per-action, in connector settings and on canvas inspector |
| MCP import | Phase 2 — import tools from any MCP server |
| Canvas appearance | Grouped under "Your Connectors", visually identical to native nodes |

---

## Setup Guide for Companies (What to Send to Customers)

### Step 1: Get your API docs ready

You need one of:
- A URL to your OpenAPI 3.x spec (e.g. `https://api.yourcompany.com/openapi.json`)
- Your OpenAPI YAML or JSON file
- A list of the API endpoints you want to expose (for manual builder)

### Step 2: Create the connector in Inflection

1. Go to **Connectors** in the dashboard
2. Click **"Add Connector"** → **"Custom API"**
3. Choose import method
4. Configure auth once (API key, OAuth, etc.)
5. Review and enable the actions you want

### Step 3: Write good action descriptions

This is the most important step for Mode B. The LLM reads your descriptions to understand what each action does. Be specific:

❌ Bad: "Get loan"
✓ Good: "Get the current status, outstanding balance, interest rate, and next payment due date for a specific loan, identified by its loan ID."

### Step 4: Mark actions for end-user access

Decide which actions your end users should be able to build personal agents with. Toggle `exposedToEndUsers` for those actions.

### Step 5: Set guardrails

In Settings → Guardrails:
- Add any write operations to `requireApprovalFor` if they should always have HITL
- Add destructive operations to `actionDenylist` if end users should never trigger them

### Step 6: Test

Use the Test button on each action to verify it works with real data. Then build a test flow on the canvas using your custom connector nodes and run it in the sandbox.
