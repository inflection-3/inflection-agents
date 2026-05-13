# Node Catalog

All node types available on the Inflection canvas. Organized by category.

**MVP nodes** — built in the initial 8-week sprint.
**Phase 2 nodes** — built after design partner is live (Weeks 9–16).
**Phase 3 nodes** — post-product-market fit, enterprise expansion.

---

## Node Base Schema

```ts
interface Node {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;       // type-specific, see each node below
  inputs: Port[];
  outputs: Port[];
  metadata?: {
    description?: string;   // shown in canvas tooltip
    tags?: string[];        // for search/filtering in sidebar
    connectorId?: string;   // set for custom connector nodes
  };
}

interface Port {
  name: string;
  dataType: "string" | "number" | "boolean" | "object" | "array" | "any";
  required: boolean;
  description?: string;
}
```

---

## Category Overview

| Category | Nodes | Phase |
|---|---|---|
| Flow Control | Input, Output, If/Else, Loop, AI Routing, Merge, Delay | MVP (Input/Output/If/Else), Phase 2 (rest) |
| AI | LLM, Knowledge Base | MVP (LLM), Phase 2 (KB) |
| Memory | Memory, Variable | MVP |
| Human in the Loop | HITL | MVP |
| Payments | Stripe, Plaid, Circle, Square | MVP (Stripe/Plaid), Phase 2 (Circle/Square) |
| Financial Data | Polygon, SEC EDGAR, S&P Global, FRED | Phase 2 |
| Accounting / ERP | NetSuite, Workday, QuickBooks, Xero | Phase 2 |
| Calendar & Scheduling | Google Calendar, Outlook Calendar, Calendly | Phase 2 |
| Communication | Email, Slack, SMS, WhatsApp | MVP (Email), Phase 2 (rest) |
| Data Processing | Transform, Aggregate, Spreadsheet Read/Write, PDF | Phase 2 |
| Automation | Webhook Trigger, Webhook Send, Zapier, HTTP Request | MVP (HTTP), Phase 2 (rest) |
| Custom Connector | Any company-defined API → becomes nodes | MVP |
| Documents | PDF Generate, Google Docs, Notion | Phase 3 |
| HR / Identity | Workday (HR), Okta, Jumio | Phase 3 |

---

## Flow Control Nodes

### `input` — MVP

Entry point. Every flow has exactly one Input node. Defines what the flow receives.

```ts
config: {
  fields: {
    name: string;
    dataType: "string" | "number" | "boolean" | "object" | "array";
    description: string;    // shown to LLM for Mode B intent parsing
    required: boolean;
    defaultValue?: unknown;
    source?: "user_message" | "injected_context" | "any";
    // injected_context = pulled from end-user JWT metadata
  }[];
}
```

**Outputs:** one port per field + `trigger` (string: user_message | scheduled | api_call | webhook).

---

### `output` — MVP

Exit point. Defines what the flow returns.

```ts
config: {
  responseType: "text" | "json" | "action_confirmation" | "card";
  template?: string;          // Handlebars for text/card responses
  cardConfig?: {              // only if responseType = "card"
    title: string;
    subtitle?: string;
    fields: { label: string; value: string }[];
    actions?: { label: string; value: string }[];  // buttons in widget
  };
}
```

**Inputs:** `value` (any).

---

### `ifelse` — MVP

Conditional branching. Evaluates a condition, routes execution to `true` or `false` output.

```ts
config: {
  condition: {
    type: "expression" | "llm_eval";
    // expression:
    leftOperand: string;      // dot-path, e.g. "balance.available"
    operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "not_contains" | "is_empty" | "is_not_empty" | "regex";
    rightOperand: string;     // literal or dot-path
    // llm_eval:
    prompt?: string;          // LLM receives context + this prompt, must return true/false
  };
  combinator?: "AND" | "OR";  // for multi-condition (array of conditions)
}
```

**Inputs:** `value` (any). **Outputs:** `true` (any), `false` (any).

---

### `loop` — Phase 2

Iterate over an array. Executes an embedded subgraph once per item.

```ts
config: {
  iterateOver: string;        // dot-path to an array in the input
  concurrency: number;        // default 1 (sequential); max 10 (parallel)
  maxIterations: number;      // safety cap, default 100
  subflowId?: string;         // if set, calls a published flow instead of embedded nodes
}
```

**Inputs:** `items` (array). **Outputs:** `results` (array — collected outputs from each iteration), `errors` (array).

**Canvas behavior:** Loop node has an "expand" handle — click to open the inner subgraph canvas. Nodes placed inside run per-iteration. Data from the outer flow is available inside.

---

### `ai_routing` — Phase 2

LLM classifies the input and routes to one of N labeled branches. Better than If/Else for open-ended text classification.

```ts
config: {
  routes: {
    name: string;           // branch label shown on canvas
    description: string;    // LLM uses this to decide whether to route here
  }[];
  model: string;
  fallbackRoute: string;    // which route to take if no route matches
}
```

**Inputs:** `message` (string), `context` (object, optional).
**Outputs:** one port per route name (each outputs the original `message` + `context`), `routeName` (string — which route was chosen).

---

### `merge` — Phase 2

Waits for multiple upstream branches to complete and combines their outputs into a single object. Used after branching with If/Else or AI Routing.

```ts
config: {
  strategy: "object" | "array" | "first_non_null";
  // object: each input becomes a named key in the output object
  // array: all inputs collected into an array
  // first_non_null: returns the first input that has a value
  keys?: string[];            // optional custom key names for "object" strategy
}
```

**Inputs:** `a`, `b`, ... (any, 2–8 inputs). **Outputs:** `merged` (object | array).

---

### `delay` — Phase 2

Pauses execution for a specified duration. Useful for rate-limiting sequences or introducing wait states.

```ts
config: {
  duration: number;           // milliseconds
  maxDuration: number;        // safety cap (enforced by engine)
}
```

**Inputs:** `value` (any — passed through). **Outputs:** `value` (any — same as input).

---

## AI Nodes

### `llm` — MVP

Calls an LLM. The core reasoning node.

```ts
config: {
  provider: "anthropic" | "openai" | "google" | "mistral" | "groq";
  model: string;              // e.g. "claude-sonnet-4-6", "gpt-4o", "gemini-2.5-pro"
  apiKeySource: "workspace" | "bring_own";
  systemPrompt: string;       // supports {{variable}} Handlebars syntax
  userPromptTemplate?: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "text" | "json";
  jsonSchema?: object;        // if json — validate output against this schema
  tools?: ToolRef[];          // expose other nodes as callable tools
  stream: boolean;            // default true — stream tokens to embed
  cacheSystemPrompt: boolean; // default true — use prompt caching for system prompt
}

interface ToolRef {
  nodeId: string;
  name: string;
  description: string;
  inputSchema: object;        // JSON Schema for tool arguments
}
```

**Inputs:** `userMessage` (string), `context` (object, optional), any dynamic vars in system prompt template.
**Outputs:** `response` (string | object), `toolCalls` (array), `usage` (object: inputTokens, outputTokens, cost).

---

### `knowledge_base` — Phase 2

Semantic search over indexed company documents. RAG retrieval.

```ts
config: {
  knowledgeBaseId: string;    // references a KnowledgeBase record
  topK: number;               // how many chunks to return, default 5
  minScore: number;           // minimum similarity score (0–1), default 0.7
  rerankResults: boolean;     // use a reranker model for better ordering
  returnMetadata: boolean;    // include doc title, page number in output
}
```

**Inputs:** `query` (string).
**Outputs:** `chunks` (array of `{ content, score, source, metadata }`), `context` (string — all chunks concatenated, ready to inject into LLM system prompt).

**Use case:** Company uploads financial policy PDFs, product docs, or compliance documents. Knowledge Base node finds the most relevant sections for the user's question.

---

## Memory Nodes

### `memory` — MVP

Read from or write to persistent per-user/per-agent/workspace memory.

```ts
config: {
  operation: "read" | "write" | "delete" | "increment" | "append";
  scope: "user" | "agent" | "workspace";
  key: string;                // supports {{variable}} interpolation
  ttl?: number;               // seconds until expiry; null = permanent
  // For "increment":
  incrementBy?: number;       // default 1
  // For "append":
  maxLength?: number;         // max array length; oldest items dropped when exceeded
}
```

**Inputs (write):** `value` (any). **Outputs (read):** `value` (any), `exists` (boolean).

---

### `variable` — MVP

Set and get named variables scoped to the current execution. Unlike Memory (cross-execution), variables are cleared when the execution ends. Useful for passing computed values between non-adjacent nodes.

```ts
config: {
  operation: "set" | "get";
  name: string;
  defaultValue?: unknown;     // for "get" — returned if variable not set
}
```

---

## Human in the Loop

### `hitl` — MVP

Pauses execution and waits for a human to approve or reject before continuing.

```ts
config: {
  reviewers: string[];        // user IDs or emails
  message: string;            // Handlebars template: "{{userName}} wants to transfer ${{amount}}"
  contextFields: string[];    // dot-paths to include in the reviewer's context snapshot
  timeout: number;            // seconds, default 3600
  onTimeout: "cancel" | "auto_approve" | "escalate";
  escalateTo?: string[];      // if onTimeout = "escalate", notify these users
  channels: ("email" | "slack" | "dashboard")[];
  requireNote: boolean;       // reviewer must enter a note on rejection
}
```

**Inputs:** `context` (object). **Outputs:** `approved` (boolean), `approvedBy` (string), `reviewerNote` (string), `approved_context` (object — same as input + approval metadata).

---

## Payment Nodes

### `stripe` — MVP

Execute Stripe actions. Each action is a separate mode of the connector node.

**Actions:**

| Action | Description | HITL by default |
|---|---|---|
| `stripe.getCustomer` | Get customer record by ID | No |
| `stripe.listPaymentMethods` | List saved payment methods for a customer | No |
| `stripe.createPaymentIntent` | Create a payment intent | Yes |
| `stripe.confirmPayment` | Confirm a payment intent | Yes |
| `stripe.createCharge` | Create a direct charge | Yes |
| `stripe.createRefund` | Refund a charge (full or partial) | Yes |
| `stripe.getSubscription` | Get subscription details | No |
| `stripe.cancelSubscription` | Cancel a subscription | Yes |
| `stripe.createSubscription` | Create a new subscription | Yes |
| `stripe.listInvoices` | List invoices for a customer | No |
| `stripe.getBalance` | Get Stripe account balance | No |
| `stripe.listTransactions` | List balance transactions | No |
| `stripe.createPayout` | Create a payout to bank account | Yes |

**Trigger support:** Stripe webhooks can trigger a flow:
- `stripe.payment_intent.succeeded`
- `stripe.payment_intent.payment_failed`
- `stripe.invoice.payment_failed`
- `stripe.customer.subscription.deleted`
- `stripe.payout.failed`

---

### `plaid` — MVP

Read financial data from end-user bank accounts.

**Actions:**

| Action | Description |
|---|---|
| `plaid.getBalance` | Get account balances |
| `plaid.getTransactions` | Get transactions (date range, category) |
| `plaid.getIdentity` | Identity verification data |
| `plaid.getIncome` | Income verification |
| `plaid.getLiabilities` | Get loan/credit liabilities |
| `plaid.getInvestments` | Get investment holdings |
| `plaid.getAssetReport` | Generate an asset report |
| `plaid.exchangePublicToken` | Exchange Link token for access token |

---

### `circle` — Phase 2

USDC/stablecoin payments via Circle.

**Actions:** `circle.createTransfer`, `circle.getTransfer`, `circle.getBalance`, `circle.createPayout`, `circle.listWallets`.

---

### `square` — Phase 2

Point-of-sale and payment processing.

**Actions:** `square.createPayment`, `square.getPayment`, `square.listPayments`, `square.createRefund`, `square.getCustomer`, `square.createOrder`.

---

## Financial Data Nodes

### `polygon` — Phase 2

Real-time and historical stock market data via Polygon.io.

**Actions:**

| Action | Description |
|---|---|
| `polygon.getStockPrice` | Latest price for a ticker |
| `polygon.getOHLC` | Open/high/low/close for a date |
| `polygon.getHistoricalPrices` | Price history (range + interval) |
| `polygon.getMarketStatus` | Is the market open? |
| `polygon.getTickerDetails` | Company info, shares outstanding, etc. |
| `polygon.getFinancials` | Income statement, balance sheet, cash flows |
| `polygon.getNews` | Latest news for a ticker |
| `polygon.searchTickers` | Search tickers by name |

**Config:**
```ts
{
  action: string;
  ticker?: string;          // supports {{variable}} for dynamic tickers
  startDate?: string;
  endDate?: string;
  interval?: "day" | "hour" | "minute";
  limit?: number;
}
```

---

### `sec_edgar` — Phase 2

SEC public filings — 10-K, 10-Q, 8-K, XBRL financials.

**Actions:**

| Action | Description |
|---|---|
| `sec.searchFilings` | Search for filings by company/CIK/ticker + form type |
| `sec.getFiling` | Get a specific filing (returns parsed text + metadata) |
| `sec.getXBRL` | Get structured XBRL financial metrics for a company |
| `sec.getCompanyFacts` | All financial facts for a company (GAAP concepts) |
| `sec.getLatest10K` | Most recent annual report |
| `sec.getLatest10Q` | Most recent quarterly report |
| `sec.getOwnership` | Insider ownership filings (Forms 3, 4, 5) |

**Config:**
```ts
{
  action: string;
  ticker?: string;
  cik?: string;
  formType?: "10-K" | "10-Q" | "8-K" | "DEF 14A" | "any";
  limit?: number;
}
```

---

### `sp_global` — Phase 2

S&P Global financial data — credit ratings, market intelligence, financial metrics.

**Actions:** `sp.getCompanyRatings`, `sp.getFinancialData`, `sp.getIndustryData`, `sp.getEsgScores`, `sp.getKeyMetrics`, and 20+ more.

---

### `fred` — Phase 2

Federal Reserve Economic Data — macro indicators, interest rates, CPI, employment.

**Actions:**

| Action | Description |
|---|---|
| `fred.getSeries` | Get a FRED data series (e.g. FEDFUNDS, CPIAUCSL) |
| `fred.getLatestValue` | Get the latest value for a series |
| `fred.searchSeries` | Search series by keyword |
| `fred.getRelease` | Get a data release and all its series |

---

## Accounting / ERP Nodes

### `netsuite` — Phase 2

NetSuite ERP — accounting, finance, CRM, operations. 56 available actions.

**Core action groups:**

| Group | Key Actions |
|---|---|
| Customers | `netsuite.getCustomer`, `netsuite.createCustomer`, `netsuite.searchCustomers` |
| Invoices | `netsuite.getInvoice`, `netsuite.createInvoice`, `netsuite.approveInvoice`, `netsuite.listInvoices` |
| Payments | `netsuite.createPayment`, `netsuite.getPayment`, `netsuite.applyPayment` |
| Accounts | `netsuite.getAccount`, `netsuite.getAccountBalance`, `netsuite.listAccounts` |
| Journal Entries | `netsuite.createJournalEntry`, `netsuite.getJournalEntry`, `netsuite.searchJournalEntries` |
| Vendors | `netsuite.getVendor`, `netsuite.createVendor`, `netsuite.createBill` |
| Reports | `netsuite.getBalanceSheet`, `netsuite.getIncomeStatement`, `netsuite.getCashFlow` |
| Transactions | `netsuite.searchTransactions`, `netsuite.getTransaction` |

**Config:**
```ts
{
  action: string;
  params: Record<string, unknown>;   // action-specific; mapped from input ports
  subsidiary?: string;               // for multi-subsidiary NetSuite setups
  environment: "production" | "sandbox";
}
```

**Auth:** OAuth 2.0 (TBA credentials) or Token-Based Authentication.

---

### `workday` — Phase 2

HR, finance, and planning data.

**Actions:**

| Group | Key Actions |
|---|---|
| Workers | `workday.getWorker`, `workday.searchWorkers`, `workday.getOrgChart` |
| Finance | `workday.getSpendingByCategory`, `workday.getBudget`, `workday.getCostCenter` |
| Reports | `workday.runReport`, `workday.getCustomReport` |
| Approvals | `workday.getBusinessProcess`, `workday.approveBusinessProcess` |

---

### `quickbooks` — Phase 2

QuickBooks Online — small/mid-market accounting.

**Actions:** `qbo.getCustomer`, `qbo.createInvoice`, `qbo.getInvoice`, `qbo.createPayment`, `qbo.getBalanceSheet`, `qbo.getProfitLoss`, `qbo.searchTransactions`, `qbo.createExpense`, `qbo.listAccounts`, and more.

---

### `xero` — Phase 2

Xero accounting platform.

**Actions:** `xero.getContacts`, `xero.createInvoice`, `xero.getInvoice`, `xero.createPayment`, `xero.getBalanceSheet`, `xero.getProfitLoss`, `xero.listBankTransactions`.

---

## Calendar & Scheduling Nodes

### `google_calendar` — Phase 2

Read and write Google Calendar events.

**Actions:**

| Action | Description |
|---|---|
| `gcal.listEvents` | List events in a date range |
| `gcal.getEvent` | Get a specific event |
| `gcal.createEvent` | Create a calendar event |
| `gcal.updateEvent` | Update an existing event |
| `gcal.deleteEvent` | Delete an event |
| `gcal.checkAvailability` | Check free/busy slots for attendees |
| `gcal.findNextSlot` | Find the next available time slot for a meeting |
| `gcal.createRecurring` | Create a recurring event (RRULE) |

**Config:**
```ts
{
  action: string;
  calendarId: string;        // "primary" or specific calendar ID
  // createEvent params:
  title?: string;
  description?: string;
  startTime?: string;        // ISO 8601; supports {{variable}}
  endTime?: string;
  attendees?: string[];      // email addresses
  location?: string;
  conferenceType?: "google_meet" | "zoom" | "teams" | "none";
  sendInvites?: boolean;
}
```

**Trigger support:** Webhooks for event creation, updates, cancellations.

---

### `outlook_calendar` — Phase 2

Microsoft Outlook/Exchange calendar.

**Actions:** Same set as `google_calendar` but against Microsoft Graph API. Auth: OAuth2 (Azure AD).

---

### `calendly` — Phase 2

Scheduling links and booked meetings.

**Actions:**

| Action | Description |
|---|---|
| `calendly.getBookings` | List scheduled events |
| `calendly.getAvailability` | Get available slots for an event type |
| `calendly.cancelEvent` | Cancel a booking |
| `calendly.getEventType` | Get event type details |

**Trigger support:** `calendly.event_created`, `calendly.event_canceled`.

---

### `meeting_scheduler` — Phase 2

AI-powered meeting scheduler — finds the best time across multiple calendars, sends invites, handles rescheduling. Orchestrates Google Calendar + Outlook Calendar + email.

```ts
config: {
  calendarConnectorId: string;   // which calendar to use
  duration: number;              // minutes
  attendees: string[];           // email or {{variable}}
  preferredTimes?: {
    startHour: number;           // 9 for 9am
    endHour: number;             // 17 for 5pm
    timezone: string;
    daysOfWeek: number[];        // 0=Sun, 1=Mon, ...
  };
  lookaheadDays: number;         // search window, default 14
  bufferMinutes: number;         // buffer before/after meetings
  conferenceType: "google_meet" | "zoom" | "teams" | "phone" | "none";
  title: string;
  description?: string;
}
```

**Inputs:** `attendees` (array of strings, optional — override config). **Outputs:** `event` (object — created calendar event), `startTime` (ISO 8601), `meetingLink` (string).

---

## Communication Nodes

### `send_email` — MVP

Send an email via SendGrid or SMTP.

```ts
config: {
  provider: "sendgrid" | "smtp";
  to: string;                    // supports {{variable}}
  from: string;
  subject: string;               // Handlebars template
  body: string;                  // Handlebars template, HTML or plain text
  bodyFormat: "html" | "text";
  cc?: string[];
  attachments?: { filename: string; contentType: string; contentPath: string }[];
}
```

---

### `send_slack` — Phase 2

Post a message to a Slack channel or DM.

```ts
config: {
  target: "channel" | "user" | "dm";
  channelId?: string;            // supports {{variable}}
  userId?: string;
  message: string;               // Handlebars template, supports markdown
  blocks?: object[];             // Slack Block Kit JSON for rich messages
  threadTs?: string;             // reply in thread
  attachments?: object[];
}
```

**Trigger support:** Respond to Slack slash commands or mentions that trigger flows.

---

### `send_sms` — Phase 2

Send SMS via Twilio.

```ts
config: {
  to: string;                    // E.164 format, supports {{variable}}
  from: string;                  // Twilio number
  message: string;               // Handlebars template, max 1600 chars
}
```

---

### `send_whatsapp` — Phase 3

WhatsApp Business API via Twilio or Meta.

---

### `send_notification` — Phase 2

Multi-channel notification node. Sends to whatever channels the end user has enabled (in-app, email, SMS, Slack). Abstracts channel selection — ideal for end-user alerts.

```ts
config: {
  channels: ("in_app" | "email" | "sms" | "slack")[];
  title: string;
  body: string;               // Handlebars template
  priority: "low" | "normal" | "high";
  actionUrl?: string;         // deep link on notification tap
}
```

---

## Data Processing Nodes

### `transform` — Phase 2

Transform/reshape data using JSONata or Handlebars. No-code data manipulation.

```ts
config: {
  engine: "jsonata" | "handlebars" | "jmespath";
  expression: string;         // the transform expression
  outputType: "string" | "number" | "boolean" | "object" | "array";
}
```

**Inputs:** `data` (any). **Outputs:** `result` (any).

**Example (JSONata):** Extract all transaction amounts > 100: `transactions[amount > 100].amount`

---

### `aggregate` — Phase 2

Aggregate an array: sum, average, count, min, max, group by.

```ts
config: {
  operation: "sum" | "average" | "count" | "min" | "max" | "group_by" | "sort" | "filter" | "deduplicate";
  field?: string;             // dot-path to the field to aggregate
  groupByField?: string;      // for group_by
  sortDirection?: "asc" | "desc";
  filterExpression?: string;  // JSONata filter for "filter" operation
}
```

**Inputs:** `items` (array). **Outputs:** `result` (number | array | object depending on operation).

---

### `spreadsheet_read` — Phase 2

Read data from Google Sheets or Excel Online.

```ts
config: {
  provider: "google_sheets" | "excel_online";
  spreadsheetId: string;
  sheetName: string;
  range?: string;              // e.g. "A1:D100"; null = entire sheet
  hasHeaderRow: boolean;
  outputFormat: "array_of_objects" | "array_of_arrays";
}
```

**Outputs:** `rows` (array), `rowCount` (number), `headers` (array of strings).

---

### `spreadsheet_write` — Phase 2

Append rows to or update cells in a Google Sheet or Excel Online file.

```ts
config: {
  provider: "google_sheets" | "excel_online";
  spreadsheetId: string;
  sheetName: string;
  operation: "append" | "update" | "clear_and_write";
  startRange?: string;
  valueInputOption: "raw" | "user_entered";
}
```

**Inputs:** `rows` (array of arrays or array of objects).

---

### `pdf_generate` — Phase 2

Generate a PDF from a Handlebars HTML template. Useful for reports, invoices, statements.

```ts
config: {
  templateType: "html_template" | "google_doc" | "handlebars";
  template: string;           // HTML template with {{variable}} placeholders
  filename: string;           // supports {{variable}}, e.g. "statement_{{month}}.pdf"
  paperSize: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  outputTo: "url" | "email_attachment" | "google_drive" | "output_port";
}
```

**Inputs:** `data` (object — values for template variables). **Outputs:** `fileUrl` (string), `filename` (string).

---

## Automation Nodes

### `http_request` (Custom API) — MVP

Generic HTTP request to any REST API. Used for connectors not yet in the native library.

```ts
config: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;                // supports {{variable}} interpolation
  auth: {
    type: "none" | "api_key" | "bearer" | "basic" | "oauth2_client_credentials";
    headerName?: string;      // for api_key
    apiKey?: string;          // reference to connector credential
    username?: string;        // for basic
    password?: string;
    tokenUrl?: string;        // for oauth2
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
  };
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: object | string;     // supports {{variable}} in values
  timeout: number;            // ms, default 30000
  responseType: "json" | "text" | "ignore";
  retryOn?: number[];         // HTTP status codes to retry on, e.g. [429, 503]
}
```

**Outputs:** `body` (any), `statusCode` (number), `headers` (object), `durationMs` (number).

---

### `webhook_trigger` — Phase 2

An alternative Input node. Starts a flow when an external service sends a webhook.

```ts
config: {
  method: "POST" | "GET" | "PUT";
  path: string;               // unique path segment: /webhooks/{workspaceId}/{path}
  verification: {
    type: "none" | "hmac_sha256" | "stripe_signature" | "svix";
    secret?: string;          // reference to connector credential
    headerName?: string;
  };
  responseBody?: string;      // what to return to the caller immediately (before flow completes)
  responseStatus?: number;    // default 200
}
```

**Outputs:** `body` (any — webhook payload), `headers` (object), `queryParams` (object).

---

### `webhook_send` — Phase 2

POST data to any webhook URL. Notify external systems of events.

```ts
config: {
  url: string;                // supports {{variable}}
  method: "POST" | "PUT";
  payload: object;            // Handlebars template for payload
  headers?: Record<string, string>;
  retries: number;
  signPayload?: {
    algorithm: "hmac_sha256";
    secretRef: string;        // connector credential ID
    headerName: string;       // e.g. "X-Inflection-Signature"
  };
}
```

---

### `zapier` — Phase 2

Trigger a Zapier Zap from a flow. Bridge between Inflection and Zapier's 5,000+ app integrations.

```ts
config: {
  zapHookUrl: string;         // Zapier webhook URL (stored as connector credential)
  payload: object;            // data to send to Zapier
}
```

**Use case:** Company has existing Zapier automations. Inflection triggers them as part of a larger flow. "Do the complex reasoning + financial logic in Inflection, then hand off to Zapier for the 5,000-app integrations it already has."

---

## Custom Connector Nodes

### `custom_connector` — MVP

This is the most important node type for companies. A Custom Connector is a company-defined API that becomes first-class nodes in the canvas, indistinguishable from native connectors.

See **`custom-connectors.md`** for the full import flow and configuration guide.

```ts
config: {
  connectorId: string;        // ID of the company's registered custom connector
  action: string;             // action name within that connector
  paramMapping: {
    [paramName: string]: string;   // maps input port → action parameter
  };
  requireApproval?: boolean;
}
```

**Canvas behavior:**
- Custom connectors appear in the sidebar under a dedicated "Your Connectors" section
- Each custom connector shows its icon (auto-generated or company-uploaded)
- Each action in the connector appears as a draggable node
- Looks identical to native connector nodes — no visual distinction
- Node label defaults to the action name but can be renamed on canvas

**Mode B behavior:**
- Custom connector actions that are marked `exposedToEndUsers: true` appear in the Mode B palette
- When the LLM interprets a user's intent, it can map to these actions just like native ones
- The action's `description` field (set during import) is what the LLM reads to understand what it does

---

## Node Quick Reference

| Node | Category | Phase | HITL default |
|---|---|---|---|
| `input` | Flow Control | MVP | — |
| `output` | Flow Control | MVP | — |
| `ifelse` | Flow Control | MVP | — |
| `loop` | Flow Control | Phase 2 | — |
| `ai_routing` | Flow Control | Phase 2 | — |
| `merge` | Flow Control | Phase 2 | — |
| `delay` | Flow Control | Phase 2 | — |
| `llm` | AI | MVP | — |
| `knowledge_base` | AI | Phase 2 | — |
| `memory` | Memory | MVP | — |
| `variable` | Memory | MVP | — |
| `hitl` | HITL | MVP | — |
| `stripe` | Payments | MVP | write ops |
| `plaid` | Payments | MVP | — |
| `circle` | Payments | Phase 2 | write ops |
| `square` | Payments | Phase 2 | write ops |
| `polygon` | Financial Data | Phase 2 | — |
| `sec_edgar` | Financial Data | Phase 2 | — |
| `sp_global` | Financial Data | Phase 2 | — |
| `fred` | Financial Data | Phase 2 | — |
| `netsuite` | Accounting/ERP | Phase 2 | write ops |
| `workday` | Accounting/ERP | Phase 2 | write ops |
| `quickbooks` | Accounting/ERP | Phase 2 | write ops |
| `xero` | Accounting/ERP | Phase 2 | — |
| `google_calendar` | Calendar | Phase 2 | — |
| `outlook_calendar` | Calendar | Phase 2 | — |
| `calendly` | Calendar | Phase 2 | — |
| `meeting_scheduler` | Calendar | Phase 2 | — |
| `send_email` | Communication | MVP | — |
| `send_slack` | Communication | Phase 2 | — |
| `send_sms` | Communication | Phase 2 | — |
| `send_notification` | Communication | Phase 2 | — |
| `transform` | Data Processing | Phase 2 | — |
| `aggregate` | Data Processing | Phase 2 | — |
| `spreadsheet_read` | Data Processing | Phase 2 | — |
| `spreadsheet_write` | Data Processing | Phase 2 | write ops |
| `pdf_generate` | Data Processing | Phase 2 | — |
| `http_request` | Automation | MVP | — |
| `webhook_trigger` | Automation | Phase 2 | — |
| `webhook_send` | Automation | Phase 2 | — |
| `zapier` | Automation | Phase 2 | — |
| `custom_connector` | Custom | MVP | configurable |
