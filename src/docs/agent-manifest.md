# Agent Manifest & Skills System

**Version:** 1.0  
**Date:** 2026-05-11

An agent's **manifest** is the structured declaration of what the agent does, what payment capabilities it needs, which rails it uses, and the typical transaction profile for each skill. The manifest is set once at registration and can be updated as the agent evolves.

The manifest serves three audiences:
- **Deployers**: see exactly what they're consenting to before connecting their payment accounts
- **Policy engine**: uses declared actions to pre-populate `allowedActions` in connector policies
- **Compliance teams**: can compare the declared manifest against the actual audit log to detect scope creep

---

## 1. Agent Manifest Structure

```typescript
interface AgentManifest {
  // Basic identity
  name: string                    // "vendor-pay-agent" — kebab-case, used in audit logs
  displayName: string             // "Vendor Payment Agent" — shown to deployers
  description: string             // what this agent does at a business level
  category: AgentCategory         // top-level classification
  
  // Capability declaration
  skills: AgentSkill[]            // list of discrete capabilities (see AgentSkill below)
  
  // Rails the agent needs connected (union of all skill requirements)
  requiredRails: RailName[]       // must be connected before agent can operate
  optionalRails: RailName[]       // agent degrades gracefully without these

  // Developer's public contact
  developerName: string           // "Acme AI Labs"
  documentationUrl?: string       // link to developer's own agent docs
  webhookUrl?: string             // HTTPS URL for approval outcome callbacks

  // Registry listing (public discovery)
  registry: {
    listed: boolean               // whether this agent appears in the public registry
    slug: string                  // URL slug: inflection.dev/registry/vendor-pay-agent
    tagline: string               // ≤80 char summary shown in search results
    logoUrl?: string              // agent logo, shown in registry cards
    tags: string[]                // up to 5 free-form tags for search (e.g. "invoices", "ap")
    verifiedAt?: string           // ISO 8601 — set by Inflection after review; null if unverified
    deployerCount: number         // how many users have connected this agent (read-only, computed)
  }
}

type AgentCategory =
  | "accounts_payable"        // paying vendors, invoices, suppliers
  | "payroll"                 // paying employees or contractors
  | "billing"                 // charging customers for products/services
  | "expense_management"      // reimbursing employee expenses
  | "procurement"             // purchasing goods or services
  | "marketplace"             // distributing payments to platform participants
  | "micropayments"           // high-frequency small-value payments (x402)
  | "crypto_treasury"         // stablecoin / crypto fund management
  | "ecommerce"               // retail payment processing
  | "subscription"            // recurring billing lifecycle
  | "other"

interface AgentSkill {
  id: string                          // stable slug, e.g. "invoice_payment"
  name: string                        // "Invoice Payment"
  description: string                 // "Pays approved vendor invoices on Stripe"
  
  // What this skill needs
  railCapabilities: RailCapability[]  // one entry per rail this skill uses

  // Risk classification
  riskTier: "low" | "medium" | "high"
  // low:    all transactions < $1,000, no payouts, reversible
  // medium: transactions $1,000–$50,000 or includes payouts
  // high:   transactions > $50,000 or irreversible (crypto, wire)
  
  // Whether this skill is core (agent can't function without it)
  // or supplementary (agent degrades gracefully without it)
  required: boolean
}

interface RailCapability {
  rail: RailName
  
  // Exact actions this skill will call on this rail
  // These become the suggested allowedActions in connector policy
  actions: ActionDeclaration[]
  
  // Aggregate transaction profile for this skill on this rail
  typicalAmountRange: {
    min: number
    max: number
    currency: string
  }
  typicalFrequency: {
    maxPerHour: number
    maxPerDay: number
    description: string     // human-readable: "up to 10 per day during business hours"
  }
}

interface ActionDeclaration {
  action: string           // "charges.create"
  description: string      // "Charges customers for approved invoices"
  
  // Amount constraints specific to THIS action
  // (can differ from the skill-level typicalAmountRange)
  amountRange?: {
    min: number
    max: number
    currency: string
  }
  
  // Whether this action ever triggers human approval
  mayRequireApproval: boolean
  
  // Whether this action is reversible (refund possible)
  reversible: boolean
}
```

---

## 2. Pre-Defined Skills (Skill Library)

Developers can pick from a library of pre-defined skills or create custom ones. Pre-defined skills come with sensible defaults for actions, descriptions, and risk tiers.

### Billing Skills

| Skill ID | Name | Default Rails | Risk | Description |
|----------|------|---------------|------|-------------|
| `charge_customer` | Charge Customer | Stripe, Square, Braintree | Low–Med | Charges a customer's saved payment method |
| `subscription_create` | Create Subscription | Stripe | Low | Creates recurring billing subscriptions |
| `subscription_modify` | Modify Subscription | Stripe | Low | Upgrades, downgrades, or cancels subscriptions |
| `invoice_pay` | Pay Invoice | Stripe | Med | Marks an outstanding invoice as paid |
| `issue_refund` | Issue Refund | Stripe, Square | Low | Issues partial or full refunds to customers |
| `overage_billing` | Bill Overages | Stripe | Low | Charges usage-based overages beyond plan limits |

### Payroll & Payout Skills

| Skill ID | Name | Default Rails | Risk | Description |
|----------|------|---------------|------|-------------|
| `contractor_payout` | Contractor Payout | Circle, Stripe, Razorpay | High | Pays contractors or freelancers |
| `employee_payroll` | Employee Payroll | Circle | High | Distributes payroll to employees via USDC |
| `marketplace_split` | Marketplace Split | Stripe, Braintree | Med | Splits a payment between platform and seller |
| `vendor_payment` | Vendor Payment | Stripe, Circle | High | Pays supplier invoices or purchase orders |
| `crypto_transfer` | Crypto Transfer | Circle, x402 | High | Transfers stablecoin to external wallets |

### Procurement Skills

| Skill ID | Name | Default Rails | Risk | Description |
|----------|------|---------------|------|-------------|
| `api_micropayment` | API Micropayment | x402 | Low | Pays for per-call API access via x402 |
| `data_purchase` | Data Purchase | x402, Circle | Low–Med | Buys data feeds or reports for agent consumption |
| `service_subscription` | Service Subscription | Stripe | Low | Subscribes to external services on behalf of user |
| `inventory_restock` | Inventory Restock | Square, Stripe | Med | Purchases inventory to restock below-threshold items |

---

## 3. Skill Declarations for Existing Agents

Here is how each agent in `/src/agents/` maps to the manifest system:

### `stripe-agent.ts` — NeuralAPI Billing Agent

```typescript
const neuralApiBillingManifest: AgentManifest = {
  name: "neuralpai-billing-agent",
  displayName: "NeuralAPI Billing Bot",
  description: "Monitors customer API usage, bills overages automatically, and handles plan upgrades and prorated charges.",
  category: "billing",
  requiredRails: ["stripe"],
  optionalRails: [],
  developerName: "NeuralAPI",
  skills: [
    {
      id: "overage_billing",
      name: "Overage Billing",
      description: "Charges customers for API calls beyond their plan limit at the configured per-call rate.",
      required: true,
      riskTier: "low",
      railCapabilities: [{
        rail: "stripe",
        actions: [
          {
            action: "paymentIntents.create",
            description: "Charges the customer's stored payment method for overage amounts",
            amountRange: { min: 1, max: 5000, currency: "USD" },
            mayRequireApproval: false,
            reversible: true,
          }
        ],
        typicalAmountRange: { min: 1, max: 5000, currency: "USD" },
        typicalFrequency: { maxPerHour: 5, maxPerDay: 20, description: "end of billing cycle, up to 20 per day" },
      }],
    },
    {
      id: "plan_upgrade",
      name: "Plan Upgrade Billing",
      description: "Charges the prorated cost when upgrading a customer to a higher plan mid-cycle.",
      required: false,
      riskTier: "low",
      railCapabilities: [{
        rail: "stripe",
        actions: [
          {
            action: "paymentIntents.create",
            description: "Charges prorated plan upgrade fee",
            amountRange: { min: 1, max: 20000, currency: "USD" },
            mayRequireApproval: false,
            reversible: true,
          }
        ],
        typicalAmountRange: { min: 5, max: 200, currency: "USD" },
        typicalFrequency: { maxPerHour: 2, maxPerDay: 10, description: "on-demand, triggered by usage thresholds" },
      }],
    },
    {
      id: "issue_refund",
      name: "Refund Processing",
      description: "Issues prorated refunds when customers downgrade mid-cycle.",
      required: false,
      riskTier: "low",
      railCapabilities: [{
        rail: "stripe",
        actions: [
          {
            action: "refunds.create",
            description: "Issues partial or full refund on a prior payment intent",
            amountRange: { min: 1, max: 5000, currency: "USD" },
            mayRequireApproval: false,
            reversible: false,  // refunds themselves can't be reversed
          }
        ],
        typicalAmountRange: { min: 1, max: 200, currency: "USD" },
        typicalFrequency: { maxPerHour: 2, maxPerDay: 5, description: "on-demand, rare" },
      }],
    },
  ],
}
```

### `circle-agent.ts` — RemoteFirst Payroll Agent

```typescript
const remoteFirstPayrollManifest: AgentManifest = {
  name: "remotefirst-payroll-agent",
  displayName: "RemoteFirst Payroll",
  description: "Runs monthly USDC payroll for remote contractors. Checks treasury balance, pays each contractor, and generates a payroll audit report.",
  category: "payroll",
  requiredRails: ["circle"],
  optionalRails: [],
  developerName: "RemoteFirst",
  skills: [
    {
      id: "contractor_payout",
      name: "Contractor Payroll Disbursement",
      description: "Transfers USDC to contractor wallets based on confirmed hours and rates.",
      required: true,
      riskTier: "high",
      railCapabilities: [{
        rail: "circle",
        actions: [
          {
            action: "transfers.create",
            description: "Sends USDC to a contractor's wallet address or Circle wallet",
            amountRange: { min: 100, max: 50000, currency: "USD" },
            mayRequireApproval: true,   // large payrolls above threshold need approval
            reversible: false,          // blockchain transfers are irreversible
          }
        ],
        typicalAmountRange: { min: 500, max: 15000, currency: "USD" },
        typicalFrequency: { maxPerHour: 30, maxPerDay: 50, description: "once per month, all contractors paid in a single batch run" },
      }],
    },
  ],
}
```

### `x402-agent.ts` — DataForge Micropayment Agent

```typescript
const dataForgeMicropaymentManifest: AgentManifest = {
  name: "dataforge-research-agent",
  displayName: "DataForge Research Agent",
  description: "Buys market data and research reports via x402 micropayments to compile competitive intelligence reports.",
  category: "micropayments",
  requiredRails: ["x402"],
  optionalRails: [],
  developerName: "DataForge",
  skills: [
    {
      id: "api_micropayment",
      name: "Data API Micropayment",
      description: "Pays per-call fees to x402-gated data APIs. Each call may cost $0.001–$5 in USDC.",
      required: true,
      riskTier: "low",
      railCapabilities: [{
        rail: "x402",
        actions: [
          {
            action: "pay",
            description: "Pays the x402 payment header for a gated API endpoint",
            amountRange: { min: 0.001, max: 10, currency: "USDC" },
            mayRequireApproval: false,
            reversible: false,
          },
          {
            action: "fetch",
            description: "Fetches a resource and auto-pays if a 402 is returned",
            amountRange: { min: 0.001, max: 10, currency: "USDC" },
            mayRequireApproval: false,
            reversible: false,
          }
        ],
        typicalAmountRange: { min: 0.001, max: 5, currency: "USDC" },
        typicalFrequency: { maxPerHour: 100, maxPerDay: 500, description: "high-frequency, many small calls per research task" },
      }],
    },
  ],
}
```

### `square-agent.ts` — FreshMart Restocking Agent

```typescript
const freshMartRestockingManifest: AgentManifest = {
  name: "freshmart-restocking-agent",
  displayName: "FreshMart Inventory Restocking",
  description: "Monitors store inventory levels and autonomously places restock orders when items fall below threshold.",
  category: "procurement",
  requiredRails: ["square"],
  optionalRails: [],
  developerName: "FreshMart",
  skills: [
    {
      id: "inventory_restock",
      name: "Inventory Purchase",
      description: "Charges the store's payment method to purchase restocking inventory from suppliers.",
      required: true,
      riskTier: "medium",
      railCapabilities: [{
        rail: "square",
        actions: [
          {
            action: "paymentsApi.createPayment",
            description: "Pays for inventory purchase from a configured supplier",
            amountRange: { min: 10, max: 5000, currency: "USD" },
            mayRequireApproval: true,  // orders above threshold need manager approval
            reversible: true,
          }
        ],
        typicalAmountRange: { min: 50, max: 2000, currency: "USD" },
        typicalFrequency: { maxPerHour: 5, maxPerDay: 20, description: "daily inventory sweep, typically 5–20 restock orders" },
      }],
    },
  ],
}
```

---

## 4. How Manifest Feeds Into Policy Suggestions

When a deployer opens the Policies page after connecting a connector, Inflection reads the agent's manifest and pre-populates the connector policy editor with:

- `allowedActions`: all `action` values declared in the manifest for that rail
- `actionLimits`: each action's `amountRange.max` as a suggested limit
- `maxPerTransaction`: the skill's `typicalAmountRange.max`
- `velocityCheck`: `{ maxTransactions: typicalFrequency.maxPerDay, windowSeconds: 86400 }`
- `requireHumanApproval` suggestion: set to `typicalAmountRange.max * 0.5` for high-risk skills

The deployer can accept, adjust, or reject every suggestion. The suggestion is displayed as:

```
Suggested from agent manifest — based on NeuralAPI Billing Bot's declared capabilities.
You can modify any of these values.
```

This eliminates the blank-slate problem where deployers don't know what values to set.

---

## 5. Skill Risk Tiers

Risk tiers inform default policy strictness and influence anomaly detection in the audit log.

| Tier | Criteria | Default `requireHumanApproval` | Default `dailyLimit` |
|------|----------|-------------------------------|---------------------|
| Low | All actions < $1,000; all reversible; no payouts/transfers | None suggested | 10× typical daily volume |
| Medium | Actions $1,000–$50,000; includes payouts or marketplace splits | 50% of max declared amount | 5× typical daily volume |
| High | Actions > $50,000; irreversible (crypto/stablecoin); payroll | Suggested at 30% of max declared | 3× typical daily volume |

High-risk agents also get a warning shown to deployers during the connector assignment step:

```
⚠ This agent has High-Risk skills (Contractor Payroll Disbursement).
  Transfers are irreversible. We strongly recommend:
  • Setting requireHumanApproval above $5,000
  • Enabling Slack or email notifications
  • Setting a daily limit
```

---

## 6. Manifest vs Actual Behavior (Audit Reconciliation)

The audit log records every actual action the agent takes. The gateway compares each call against the manifest and adds an `undeclaredAction: true` flag to the audit log entry if the agent calls an action not in its declared manifest.

This does not block the call (the connector policy controls what's allowed), but it:
1. Highlights the entry in the audit log with a yellow badge "Undeclared action"
2. Counts toward an anomaly score shown on the agent card
3. Is surfaced in compliance exports

This gives compliance teams the evidence they need to say: "The agent only does what it declared it would do."

---

## 7. Database Schema: `agent_manifest` and `agent_skills`

```sql
-- Top-level manifest per agent (versioned alongside the agent record)
CREATE TABLE agent_manifests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  display_name        TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL,
  required_rails      TEXT[] NOT NULL DEFAULT '{}',
  optional_rails      TEXT[] NOT NULL DEFAULT '{}',
  developer_name      TEXT,
  documentation_url   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

CREATE INDEX idx_agent_manifests_agent ON agent_manifests(agent_id, version DESC);

-- Individual skills within a manifest
CREATE TABLE agent_skills (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id         UUID NOT NULL REFERENCES agent_manifests(id) ON DELETE CASCADE,
  skill_id            TEXT NOT NULL,          -- slug: "invoice_payment", "contractor_payout"
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  risk_tier           TEXT NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  required            BOOLEAN NOT NULL DEFAULT true,
  rail_capabilities   JSONB NOT NULL,         -- RailCapability[] (see types above)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_skills_manifest ON agent_skills(manifest_id);
```

The `rail_capabilities` JSONB stores the full `RailCapability[]` structure including declared actions, amount ranges, and frequency profiles.

---

## 8. API Endpoints for Manifests

**POST /v1/agents/:agentId/manifest** — Set or update the agent manifest (creates new version)

```json
POST /v1/agents/agt_7x2kp9mn/manifest
Authorization: Bearer <jwt>

{
  "displayName": "Vendor Payment Agent",
  "description": "Pays vendor invoices and manages AP automation for enterprise deployments.",
  "category": "accounts_payable",
  "requiredRails": ["stripe", "circle"],
  "optionalRails": ["x402"],
  "developerName": "Acme AI Labs",
  "documentationUrl": "https://docs.acmeai.com/vendor-pay-agent",
  "skills": [
    {
      "skillId": "vendor_payment",
      "name": "Vendor Invoice Payment",
      "description": "Pays approved vendor invoices on Stripe. Triggers approval workflow for invoices above $5,000.",
      "required": true,
      "riskTier": "medium",
      "railCapabilities": [
        {
          "rail": "stripe",
          "actions": [
            {
              "action": "charges.create",
              "description": "Charges vendor payment method for approved invoice",
              "amountRange": { "min": 100, "max": 10000, "currency": "USD" },
              "mayRequireApproval": true,
              "reversible": true
            },
            {
              "action": "refunds.create",
              "description": "Issues refund for disputed or duplicate invoices",
              "amountRange": { "min": 10, "max": 5000, "currency": "USD" },
              "mayRequireApproval": false,
              "reversible": false
            }
          ],
          "typicalAmountRange": { "min": 100, "max": 10000, "currency": "USD" },
          "typicalFrequency": {
            "maxPerHour": 10,
            "maxPerDay": 50,
            "description": "business hours, Mon–Fri, up to 50 payments per day"
          }
        },
        {
          "rail": "circle",
          "actions": [
            {
              "action": "transfers.create",
              "description": "Sends USDC for large international vendor payments",
              "amountRange": { "min": 1000, "max": 100000, "currency": "USD" },
              "mayRequireApproval": true,
              "reversible": false
            }
          ],
          "typicalAmountRange": { "min": 1000, "max": 100000, "currency": "USD" },
          "typicalFrequency": {
            "maxPerHour": 2,
            "maxPerDay": 10,
            "description": "occasional large international payments"
          }
        }
      ]
    }
  ]
}
```

**GET /v1/agents/:agentId/manifest** — Get current manifest with all skills

**GET /v1/agents/:agentId/manifest/policy-suggestions** — Get suggested connector policies derived from the manifest (used by the policies page to pre-populate the editor)

Response:
```json
{
  "suggestions": {
    "stripe": {
      "allowedActions": ["charges.create", "refunds.create"],
      "actionLimits": {
        "charges.create": { "maxAmount": 10000, "currency": "USD" },
        "refunds.create": { "maxAmount": 5000, "currency": "USD" }
      },
      "maxPerTransaction": { "amount": 10000, "currency": "USD" },
      "dailyLimit": { "amount": 50000, "currency": "USD" },
      "velocityCheck": { "maxTransactions": 50, "windowSeconds": 86400 },
      "requireHumanApproval": { "above": 5000, "currency": "USD" },
      "source": "agent_manifest_v2"
    },
    "circle": {
      "allowedActions": ["transfers.create"],
      "actionLimits": {
        "transfers.create": { "maxAmount": 100000, "currency": "USD" }
      },
      "maxPerTransaction": { "amount": 100000, "currency": "USD" },
      "dailyLimit": { "amount": 200000, "currency": "USD" },
      "velocityCheck": { "maxTransactions": 10, "windowSeconds": 86400 },
      "requireHumanApproval": { "above": 25000, "currency": "USD" },
      "source": "agent_manifest_v2"
    }
  }
}
```
