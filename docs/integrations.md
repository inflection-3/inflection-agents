# Inflection SDK — Framework Integration Guides

This document shows how to integrate the Inflection SDK (`@inflection/sdk`) with five major AI agent frameworks. Each section includes a complete, production-realistic example, notes on how policy decisions surface in that framework's tool-call pattern, and guidance on handling HOLD states.

---

## Table of Contents

1. [Vercel AI SDK](#1-vercel-ai-sdk)
2. [LangChain (JavaScript/TypeScript)](#2-langchain-javascripttypescript)
3. [OpenAI Agents SDK (Python)](#3-openai-agents-sdk-python)
4. [LlamaIndex](#4-llamaindex)
5. [Raw Claude API (Anthropic SDK)](#5-raw-claude-api-anthropic-sdk)

---

## 1. Vercel AI SDK

The Vercel AI SDK is a TypeScript library for building AI-powered streaming UIs and server-side agents. It provides `generateText` and `streamText` with a `tools` parameter for tool-calling.

### Installation

```bash
npm install @inflection/sdk ai @ai-sdk/openai stripe
```

### Complete Example: Billing Agent

This agent processes invoices on behalf of a SaaS platform. It can look up an invoice, charge the customer via Stripe, and issue refunds — all gated by Inflection policy.

```typescript
// billing-agent.ts
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { Inflection, InflectionDenyError, InflectionConnectorError, isPendingApproval } from "@inflection/sdk"
import { z } from "zod"

const inflection = new Inflection({
  agentKey: process.env.INFLECTION_AGENT_KEY!,
})
const { stripe } = inflection.rails

// --- Tool definitions ---

const chargeCustomerTool = tool({
  description: "Charge a customer a specific amount in USD via Stripe. Use for collecting invoice payments.",
  parameters: z.object({
    customerId: z.string().describe("Stripe customer ID"),
    amountCents: z.number().int().positive().describe("Amount to charge in cents (e.g. 5000 for $50.00)"),
    invoiceId: z.string().describe("Internal invoice ID for audit trail"),
    paymentMethodId: z.string().describe("Stripe payment method ID to charge"),
  }),
  execute: async ({ customerId, amountCents, invoiceId, paymentMethodId }) => {
    try {
      const result = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        metadata: { invoiceId },
        description: `Invoice ${invoiceId}`,
      })

      if (isPendingApproval(result)) {
        // Policy requires human approval for this amount
        return {
          status: "pending_approval",
          approvalId: result.approvalId,
          message: `Payment of $${(amountCents / 100).toFixed(2)} is pending approval. The account owner has been notified via ${result.notificationChannel}.`,
        }
      }

      return {
        status: "succeeded",
        paymentIntentId: result.id,
        amount: result.amount,
        message: `Successfully charged $${(amountCents / 100).toFixed(2)} to customer ${customerId}.`,
      }
    } catch (err) {
      if (err instanceof InflectionDenyError) {
        return {
          status: "denied",
          reason: err.code,
          message: `Payment denied by policy: ${err.message}. Audit ID: ${err.auditId}`,
        }
      }
      if (err instanceof InflectionConnectorError) {
        return {
          status: "not_configured",
          message: "Stripe is not connected for this account. Please connect it in the Inflection dashboard.",
        }
      }
      throw err
    }
  },
})

const issueRefundTool = tool({
  description: "Issue a full or partial refund for a Stripe payment intent.",
  parameters: z.object({
    paymentIntentId: z.string().describe("Stripe payment intent ID to refund"),
    amountCents: z.number().int().positive().optional().describe("Amount to refund in cents. Omit for full refund."),
    reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).describe("Reason for refund"),
  }),
  execute: async ({ paymentIntentId, amountCents, reason }) => {
    try {
      const result = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amountCents ? { amount: amountCents } : {}),
        reason,
      })

      if (isPendingApproval(result)) {
        return {
          status: "pending_approval",
          approvalId: result.approvalId,
          message: `Refund is pending approval. The account owner has been notified.`,
        }
      }

      return {
        status: "succeeded",
        refundId: result.id,
        amount: result.amount,
        message: `Refund of $${(result.amount / 100).toFixed(2)} issued successfully.`,
      }
    } catch (err) {
      if (err instanceof InflectionDenyError) {
        return {
          status: "denied",
          message: `Refund denied by policy: ${err.message}`,
        }
      }
      throw err
    }
  },
})

const lookupInvoiceTool = tool({
  description: "Look up invoice details from the internal system.",
  parameters: z.object({
    invoiceId: z.string(),
  }),
  execute: async ({ invoiceId }) => {
    // In a real agent, this would query your database
    return {
      invoiceId,
      customerId: "cus_9abc123",
      paymentMethodId: "pm_card_visa",
      amountCents: 12500,
      status: "unpaid",
      dueDate: "2026-05-15",
    }
  },
})

// --- Agent runner ---

export async function runBillingAgent(userRequest: string): Promise<string> {
  const { text, steps } = await generateText({
    model: openai("gpt-4o"),
    system: `You are a billing agent for a SaaS platform. You help collect payments and process refunds.
Always look up invoice details before charging. Confirm amounts before proceeding.
If a payment is denied or pending approval, explain the situation clearly to the user.`,
    prompt: userRequest,
    tools: {
      lookupInvoice: lookupInvoiceTool,
      chargeCustomer: chargeCustomerTool,
      issueRefund: issueRefundTool,
    },
    maxSteps: 5,
  })

  return text
}

// Usage
const response = await runBillingAgent(
  "Invoice INV-1042 is overdue. Please collect payment."
)
console.log(response)
```

### How policy decisions surface

In the Vercel AI SDK's tool execution model, tools return structured objects (not thrown errors) to keep the LLM in the loop. The `execute` function catches `InflectionDenyError` and `InflectionConnectorError` and returns them as structured results. The LLM then incorporates this into its response to the user.

This pattern works well because:
- DENY → the tool returns `{ status: "denied", reason: "..." }` and the LLM explains it naturally
- HOLD → the tool returns `{ status: "pending_approval", approvalId: "..." }` and the LLM tells the user to wait
- ALLOW → the tool returns `{ status: "succeeded", ... }` and the LLM confirms success

### Handling HOLD in a streaming context

When using `streamText` for real-time UIs, HOLDs need special handling because the approval may take minutes or hours:

```typescript
import { streamText } from "ai"

// In your API route (Next.js example):
export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    tools: {
      chargeCustomer: chargeCustomerTool,  // returns pending_approval status
      // ...
    },
    maxSteps: 5,
    onStepFinish({ toolResults }) {
      // Check for pending approvals and store them
      for (const result of toolResults) {
        if (result.result?.status === "pending_approval") {
          // Store approvalId → conversation context mapping in your DB
          storeApprovalContext({
            approvalId: result.result.approvalId,
            userId: getUserId(req),
          })
        }
      }
    },
  })

  return result.toDataStreamResponse()
}
```

When the approval webhook fires, resume the conversation by injecting a tool result:

```typescript
// webhook handler: POST /inflection/callback
app.post("/inflection/callback", async (req, res) => {
  const { approvalId, decision, providerResult } = req.body
  const ctx = await getApprovalContext(approvalId)

  // Re-run the agent with the approval result injected
  await runBillingAgent(
    decision === "APPROVED"
      ? `The payment was approved. PaymentIntent ID: ${providerResult.id}`
      : `The payment was rejected by the account owner.`,
    ctx.userId
  )
  res.status(200).send("ok")
})
```

### Testing tips

- Use `agentKey: "ak_test_..."` to run in Inflection sandbox mode — all provider calls are mocked
- Set `amount: 200` (cents) to simulate a DENY in sandbox mode
- Set `amount: 300` (cents) to simulate a HOLD in sandbox mode
- Use `MockInflection` from `@inflection/sdk/testing` to write unit tests without any network calls

---

## 2. LangChain (JavaScript/TypeScript)

LangChain is a framework for building LLM-powered applications. It provides `AgentExecutor`, a rich tool interface, and integrations with dozens of LLM providers and vector stores.

### Installation

```bash
npm install @inflection/sdk langchain @langchain/openai @langchain/core stripe
```

### Complete Example: Contractor Payment Agent

This agent manages contractor payouts for a marketplace. It can pay contractors via Stripe transfers and issue dispute refunds.

```typescript
// contractor-agent.ts
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ChatOpenAI } from "@langchain/openai"
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { z } from "zod"
import {
  Inflection,
  InflectionDenyError,
  InflectionConnectorError,
  isPendingApproval,
} from "@inflection/sdk"

const inflection = new Inflection({
  agentKey: process.env.INFLECTION_AGENT_KEY!,
})
const { stripe } = inflection.rails

// --- Tool definitions ---

const payContractorTool = new DynamicStructuredTool({
  name: "pay_contractor",
  description:
    "Transfer funds to a contractor's Stripe connected account. Use after a job is marked complete and approved.",
  schema: z.object({
    contractorAccountId: z
      .string()
      .describe("Stripe connected account ID of the contractor (acct_...)"),
    amountCents: z
      .number()
      .int()
      .positive()
      .describe("Payment amount in cents"),
    jobId: z.string().describe("Job ID for audit trail"),
    description: z.string().describe("Brief description of the payment"),
  }),
  func: async ({ contractorAccountId, amountCents, jobId, description }) => {
    try {
      const result = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: contractorAccountId,
        metadata: { jobId },
        description,
      })

      if (isPendingApproval(result)) {
        // Register a webhook to handle approval asynchronously
        await result.onApproved({
          webhookUrl: `${process.env.BASE_URL}/inflection/callback`,
        })
        return JSON.stringify({
          status: "pending_approval",
          approvalId: result.approvalId,
          message: `Transfer of $${(amountCents / 100).toFixed(2)} to contractor requires approval. The platform owner has been notified via ${result.notificationChannel}. Approval ID: ${result.approvalId}`,
        })
      }

      return JSON.stringify({
        status: "success",
        transferId: result.id,
        amount: result.amount,
        message: `Successfully transferred $${(amountCents / 100).toFixed(2)} to contractor account ${contractorAccountId}. Transfer ID: ${result.id}`,
      })
    } catch (err) {
      if (err instanceof InflectionDenyError) {
        return JSON.stringify({
          status: "denied",
          code: err.code,
          auditId: err.auditId,
          message: `Payment blocked by policy: ${err.message}. This action has been logged (Audit ID: ${err.auditId}).`,
        })
      }
      if (err instanceof InflectionConnectorError) {
        return JSON.stringify({
          status: "not_configured",
          message: `Stripe is not connected. Please set up Stripe in the Inflection dashboard: ${err.message}`,
        })
      }
      return JSON.stringify({ status: "error", message: String(err) })
    }
  },
})

const issueDisputeRefundTool = new DynamicStructuredTool({
  name: "issue_dispute_refund",
  description:
    "Issue a refund to a customer who opened a dispute. Requires job ID and original payment intent.",
  schema: z.object({
    paymentIntentId: z.string().describe("Original Stripe payment intent ID"),
    amountCents: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Partial refund amount in cents. Omit for full refund."),
    disputeId: z.string().describe("Dispute ID for audit trail"),
  }),
  func: async ({ paymentIntentId, amountCents, disputeId }) => {
    try {
      const result = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amountCents ? { amount: amountCents } : {}),
        reason: "requested_by_customer",
        metadata: { disputeId },
      })

      if (isPendingApproval(result)) {
        return JSON.stringify({
          status: "pending_approval",
          approvalId: result.approvalId,
          message: "Refund is awaiting platform owner approval.",
        })
      }

      return JSON.stringify({
        status: "success",
        refundId: result.id,
        message: `Refund of $${(result.amount / 100).toFixed(2)} issued for dispute ${disputeId}.`,
      })
    } catch (err) {
      if (err instanceof InflectionDenyError) {
        return JSON.stringify({
          status: "denied",
          message: `Refund denied: ${err.message}`,
        })
      }
      return JSON.stringify({ status: "error", message: String(err) })
    }
  },
})

const lookupJobTool = new DynamicStructuredTool({
  name: "lookup_job",
  description: "Look up a completed job and its payment details.",
  schema: z.object({
    jobId: z.string(),
  }),
  func: async ({ jobId }) => {
    // Replace with real DB lookup
    return JSON.stringify({
      jobId,
      contractorAccountId: "acct_1NwFMH2eZvKYlo2C",
      customerPaymentIntentId: "pi_3abc...",
      amountCents: 35000,
      status: "completed",
      completedAt: "2026-05-10T14:23:00Z",
    })
  },
})

// --- Agent setup ---

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 })

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a contractor payment agent for a home services marketplace.
You process payments to contractors after jobs are completed and handle customer dispute refunds.
Always look up job details before processing payments.
If a payment is denied or pending, explain clearly and provide the audit/approval ID.`,
  ],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
])

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools: [payContractorTool, issueDisputeRefundTool, lookupJobTool],
  prompt,
})

export const contractorAgentExecutor = new AgentExecutor({
  agent,
  tools: [payContractorTool, issueDisputeRefundTool, lookupJobTool],
  verbose: process.env.NODE_ENV === "development",
  handleParsingErrors: true,
})

// Usage
const result = await contractorAgentExecutor.invoke({
  input: "Job JOB-9981 is complete. Please pay the contractor.",
})
console.log(result.output)
```

### How policy decisions surface

LangChain's `DynamicStructuredTool.func` must return a string. The pattern above returns `JSON.stringify({ status, message })`. The LLM receives this string, parses the meaning, and incorporates `status: "denied"` or `status: "pending_approval"` naturally into its chain-of-thought.

Key considerations:
- Keep the returned JSON small — the LLM reads the full string as a tool observation
- Always include a human-readable `message` field alongside machine-readable `status` and `code` fields
- For HOLD, always include the `approvalId` so users can look it up

### Handling HOLD / pending approvals

For `AgentExecutor`-based agents, the recommended pattern is to use `result.onApproved({ webhookUrl })` and return the `approvalId` to the LLM. The agent's chain ends, and your webhook handler resumes work asynchronously.

```typescript
// webhook.ts
import { verifyWebhookSignature } from "@inflection/sdk"

app.post("/inflection/callback", express.raw({ type: "application/json" }), async (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers["inflection-signature"] as string,
    secret: process.env.INFLECTION_WEBHOOK_SECRET!,
  })
  if (!isValid) return res.status(401).end()

  const { approvalId, decision, providerResult } = JSON.parse(req.body.toString())

  if (decision === "APPROVED") {
    // Retrieve pending job context from your DB using approvalId
    const ctx = await getApprovalContext(approvalId)
    // Notify contractor, update job status, etc.
    await markJobPaid({ jobId: ctx.jobId, transferId: providerResult.id })
  } else {
    // Handle rejection
    await notifyContractorOfRejection(approvalId)
  }

  res.status(200).send("ok")
})
```

### Testing tips

- Set `verbose: true` on `AgentExecutor` to see the full tool call/observation chain during development
- Use `ak_test_...` agent key + the amount-based sandbox triggers (see SDK spec) to exercise DENY and HOLD paths in tests
- Wrap the executor in a try/catch for `InflectionNetworkError` — if the gateway is unreachable, the executor will surface it as an unhandled error

---

## 3. OpenAI Agents SDK (Python)

The OpenAI Agents SDK is a Python framework for building multi-agent systems using OpenAI models. It provides a function-based tool definition pattern and a `Runner` for executing agents.

### Installation

```bash
pip install inflection-sdk openai-agents stripe
```

### Complete Example: Accounts Payable Agent

This agent processes vendor invoices for a company. It can approve and pay invoices via Stripe, send USDC to crypto-native vendors via Circle, and issue refunds for billing errors.

```python
# ap_agent.py
import os
import asyncio
from typing import Optional
from agents import Agent, Runner, function_tool
from inflection import Inflection, InflectionDenyError, InflectionConnectorError

inflection = Inflection(agent_key=os.environ["INFLECTION_AGENT_KEY"])
stripe = inflection.rails.stripe
circle = inflection.rails.circle


# --- Tool definitions ---

@function_tool
async def lookup_vendor_invoice(invoice_id: str) -> dict:
    """Look up vendor invoice details from the AP system."""
    # Replace with real AP system query
    return {
        "invoice_id": invoice_id,
        "vendor_name": "Acme Supplies Inc.",
        "vendor_stripe_account": "acct_1NwFMH2eZvKYlo2C",
        "amount_cents": 847500,  # $8,475.00
        "currency": "usd",
        "due_date": "2026-05-20",
        "status": "approved_for_payment",
    }


@function_tool
async def pay_vendor_stripe(
    vendor_account_id: str,
    amount_cents: int,
    invoice_id: str,
    description: str,
) -> dict:
    """
    Pay a vendor via Stripe transfer. Use for USD payments to vendors with Stripe accounts.
    Returns payment status including any pending approval information.
    """
    try:
        result = await stripe.transfers.create(
            amount=amount_cents,
            currency="usd",
            destination=vendor_account_id,
            metadata={"invoice_id": invoice_id},
            description=description,
        )

        if result.is_pending_approval:
            return {
                "status": "pending_approval",
                "approval_id": result.approval_id,
                "notification_channel": result.notification_channel,
                "message": (
                    f"Transfer of ${amount_cents / 100:.2f} requires human approval. "
                    f"The account owner has been notified via {result.notification_channel}. "
                    f"Approval ID: {result.approval_id}"
                ),
            }

        return {
            "status": "success",
            "transfer_id": result.id,
            "amount": result.amount,
            "message": f"Successfully paid ${amount_cents / 100:.2f} to vendor. Transfer ID: {result.id}",
        }

    except InflectionDenyError as e:
        return {
            "status": "denied",
            "code": e.code,
            "audit_id": e.audit_id,
            "message": f"Payment blocked by policy: {e.message}. Audit ID: {e.audit_id}",
        }
    except InflectionConnectorError as e:
        return {
            "status": "not_configured",
            "message": f"Stripe not connected: {e.message}",
        }


@function_tool
async def pay_vendor_usdc(
    wallet_address: str,
    amount_usd: str,
    invoice_id: str,
) -> dict:
    """
    Pay a vendor via Circle USDC transfer. Use for crypto-native vendors.
    amount_usd should be a string like "1000.00".
    """
    import uuid

    try:
        result = await circle.transfers.create_transfer(
            idempotency_key=str(uuid.uuid4()),
            source={"type": "wallet", "id": os.environ["CIRCLE_WALLET_ID"]},
            destination={"type": "blockchain", "address": wallet_address, "chain": "ETH"},
            amount={"amount": amount_usd, "currency": "USD"},
            metadata={"invoice_id": invoice_id},
        )

        if result.is_pending_approval:
            return {
                "status": "pending_approval",
                "approval_id": result.approval_id,
                "message": f"USDC transfer of ${amount_usd} is pending approval.",
            }

        return {
            "status": "success",
            "transfer_id": result.data.id,
            "message": f"USDC transfer of ${amount_usd} initiated. Transfer ID: {result.data.id}",
        }

    except InflectionDenyError as e:
        return {
            "status": "denied",
            "code": e.code,
            "message": f"USDC transfer blocked: {e.message}",
        }


@function_tool
async def issue_vendor_credit(
    payment_intent_id: str,
    amount_cents: Optional[int],
    reason: str,
    invoice_id: str,
) -> dict:
    """
    Issue a credit (refund) for a vendor overpayment or billing error.
    amount_cents is optional — omit for full credit.
    """
    try:
        params = {
            "payment_intent": payment_intent_id,
            "reason": "requested_by_customer",
            "metadata": {"invoice_id": invoice_id, "reason": reason},
        }
        if amount_cents:
            params["amount"] = amount_cents

        result = await stripe.refunds.create(**params)

        if result.is_pending_approval:
            return {
                "status": "pending_approval",
                "approval_id": result.approval_id,
                "message": "Credit memo pending approval.",
            }

        return {
            "status": "success",
            "refund_id": result.id,
            "amount": result.amount,
            "message": f"Credit of ${result.amount / 100:.2f} issued. Refund ID: {result.id}",
        }

    except InflectionDenyError as e:
        return {
            "status": "denied",
            "message": f"Credit denied by policy: {e.message}",
        }


# --- Agent definition ---

ap_agent = Agent(
    name="AccountsPayableAgent",
    instructions="""You are an accounts payable agent for a mid-size company.
Your job is to process vendor invoices that have been approved for payment.
- Always look up invoice details before making any payment.
- Use Stripe transfers for USD vendors with Stripe accounts.
- Use Circle USDC transfers for crypto-native vendors (wallet_address in their profile).
- If a payment is denied, report the policy code and audit ID — never retry automatically.
- If a payment is pending approval, report the approval ID and stop — do not re-attempt.
- For billing errors, issue a vendor credit after confirming the original payment intent ID.""",
    tools=[
        lookup_vendor_invoice,
        pay_vendor_stripe,
        pay_vendor_usdc,
        issue_vendor_credit,
    ],
    model="gpt-4o",
)


async def run_ap_agent(request: str) -> str:
    result = await Runner.run(ap_agent, request)
    return result.final_output


# Example usage
if __name__ == "__main__":
    response = asyncio.run(
        run_ap_agent("Invoice INV-2841 has been approved by the CFO. Please process payment.")
    )
    print(response)
```

### How policy decisions surface

The `@function_tool` decorator exposes your Python function directly as an agent tool. Function return values (dicts) are serialized and returned to the model as tool results. The agent reads `status: "denied"` or `status: "pending_approval"` and incorporates them into its reasoning.

For async operations (HOLD), returning the `approval_id` allows a human-in-the-loop system to resume processing via a callback — the agent stops naturally after reporting the pending state.

### Handling HOLD / pending approvals

```python
# webhook_handler.py (FastAPI example)
from fastapi import FastAPI, Request, HTTPException
from inflection import verify_webhook_signature
import hmac, hashlib, os

app = FastAPI()

@app.post("/inflection/callback")
async def handle_approval(request: Request):
    body = await request.body()
    signature = request.headers.get("inflection-signature", "")

    if not verify_webhook_signature(
        payload=body,
        signature=signature,
        secret=os.environ["INFLECTION_WEBHOOK_SECRET"]
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    approval_id = payload["approval_id"]
    decision = payload["decision"]

    if decision == "APPROVED":
        provider_result = payload["provider_result"]
        # Update AP records, notify finance team, etc.
        await mark_invoice_paid(
            approval_id=approval_id,
            transfer_id=provider_result["id"]
        )
    else:
        await notify_ap_team_of_rejection(
            approval_id=approval_id,
            reason=payload.get("rejection_reason", "No reason given")
        )

    return {"status": "ok"}
```

### Testing tips

- Set `INFLECTION_AGENT_KEY=ak_test_...` and use amount `2.00` to trigger a DENY, `3.00` for HOLD
- Use `pytest-asyncio` for async tool testing:
  ```python
  import pytest
  from unittest.mock import AsyncMock, patch

  @pytest.mark.asyncio
  async def test_pay_vendor_denied():
      with patch.object(inflection.rails.stripe.transfers, "create",
                        side_effect=InflectionDenyError("Limit exceeded", code="DAILY_LIMIT_EXCEEDED")):
          result = await pay_vendor_stripe.func(
              vendor_account_id="acct_test",
              amount_cents=5000,
              invoice_id="INV-001",
              description="Test",
          )
      assert result["status"] == "denied"
      assert result["code"] == "DAILY_LIMIT_EXCEEDED"
  ```

---

## 4. LlamaIndex

LlamaIndex is a Python framework for building RAG pipelines and LLM-powered agents. It provides `FunctionTool` and `ReActAgent` for tool-calling agents.

### Installation

```bash
pip install inflection-sdk llama-index llama-index-llms-openai stripe razorpay
```

### Complete Example: International Vendor Payment Agent

This agent handles vendor payments for a company with international suppliers. It processes USD payments via Stripe and INR payments via Razorpay, with full policy enforcement.

```python
# vendor_payment_agent.py
import os
import asyncio
from typing import Optional
from llama_index.core.tools import FunctionTool
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI
from inflection import Inflection, InflectionDenyError, InflectionConnectorError, is_pending_approval

inflection = Inflection(agent_key=os.environ["INFLECTION_AGENT_KEY"])
stripe = inflection.rails.stripe
razorpay = inflection.rails.razorpay


# --- Tool functions ---

def lookup_vendor(vendor_id: str) -> dict:
    """
    Retrieve vendor profile including preferred payment rail and account details.

    Args:
        vendor_id: Internal vendor identifier

    Returns:
        Vendor profile dict with payment details
    """
    # Replace with real vendor database lookup
    vendors = {
        "VND-001": {
            "name": "TechParts Ltd",
            "country": "US",
            "rail": "stripe",
            "stripe_account": "acct_1NwFMH2eZvKYlo2C",
            "currency": "usd",
        },
        "VND-002": {
            "name": "Mumbai Electronics",
            "country": "IN",
            "rail": "razorpay",
            "razorpay_account": "acc_NwKMH2eZvKY123",
            "currency": "inr",
        },
    }
    return vendors.get(vendor_id, {"error": f"Vendor {vendor_id} not found"})


def pay_vendor_usd_stripe(
    stripe_account_id: str,
    amount_cents: int,
    po_number: str,
    description: str,
) -> str:
    """
    Pay a USD vendor via Stripe transfer. Use for vendors in the US and other Stripe-supported countries.

    Args:
        stripe_account_id: Vendor's Stripe connected account ID (acct_...)
        amount_cents: Payment amount in USD cents
        po_number: Purchase order number for audit trail
        description: Payment description

    Returns:
        JSON string with payment status and details
    """
    import json

    try:
        # Run async in sync context
        result = asyncio.get_event_loop().run_until_complete(
            stripe.transfers.create(
                amount=amount_cents,
                currency="usd",
                destination=stripe_account_id,
                metadata={"po_number": po_number},
                description=description,
            )
        )

        if is_pending_approval(result):
            return json.dumps({
                "status": "pending_approval",
                "approval_id": result.approval_id,
                "message": (
                    f"Transfer of ${amount_cents / 100:.2f} to Stripe account {stripe_account_id} "
                    f"requires approval. Notified via {result.notification_channel}. "
                    f"Approval ID: {result.approval_id}"
                ),
            })

        return json.dumps({
            "status": "success",
            "transfer_id": result.id,
            "amount_usd": amount_cents / 100,
            "message": f"Payment of ${amount_cents / 100:.2f} sent. Transfer ID: {result.id}",
        })

    except InflectionDenyError as e:
        return json.dumps({
            "status": "denied",
            "code": e.code,
            "audit_id": e.audit_id,
            "message": f"Payment denied: {e.message} (Audit: {e.audit_id})",
        })
    except InflectionConnectorError as e:
        return json.dumps({
            "status": "connector_error",
            "message": str(e),
        })
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


def pay_vendor_inr_razorpay(
    razorpay_account_id: str,
    amount_paise: int,
    po_number: str,
    purpose: str,
) -> str:
    """
    Pay an Indian vendor via Razorpay payout. Use for vendors in India (INR currency).

    Args:
        razorpay_account_id: Vendor's Razorpay fund account ID
        amount_paise: Payment amount in paise (1 INR = 100 paise)
        po_number: Purchase order number
        purpose: Payout purpose code

    Returns:
        JSON string with payout status
    """
    import json, uuid

    try:
        result = asyncio.get_event_loop().run_until_complete(
            razorpay.payouts.create(
                account_number=os.environ["RAZORPAY_ACCOUNT_NUMBER"],
                fund_account_id=razorpay_account_id,
                amount=amount_paise,
                currency="INR",
                mode="NEFT",
                purpose=purpose,
                queue_if_low_balance=True,
                reference_id=f"{po_number}-{uuid.uuid4().hex[:8]}",
                narration=f"Payment for PO {po_number}",
            )
        )

        if is_pending_approval(result):
            return json.dumps({
                "status": "pending_approval",
                "approval_id": result.approval_id,
                "message": f"INR {amount_paise / 100:.2f} payout pending approval. ID: {result.approval_id}",
            })

        return json.dumps({
            "status": "success",
            "payout_id": result["id"],
            "amount_inr": amount_paise / 100,
            "message": f"INR {amount_paise / 100:.2f} payout initiated. Payout ID: {result['id']}",
        })

    except InflectionDenyError as e:
        return json.dumps({
            "status": "denied",
            "code": e.code,
            "message": f"Payout denied: {e.message}",
        })
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


def get_pending_invoices() -> list:
    """
    Retrieve a list of vendor invoices that are approved and ready for payment.

    Returns:
        List of invoice dicts with vendor_id, amount, currency, and PO number
    """
    return [
        {"invoice_id": "INV-3301", "vendor_id": "VND-001", "amount_cents": 250000, "po": "PO-8801"},
        {"invoice_id": "INV-3302", "vendor_id": "VND-002", "amount_paise": 18500000, "po": "PO-8802"},
    ]


# --- Build LlamaIndex tools ---

lookup_vendor_tool = FunctionTool.from_defaults(fn=lookup_vendor)
pay_stripe_tool = FunctionTool.from_defaults(fn=pay_vendor_usd_stripe)
pay_razorpay_tool = FunctionTool.from_defaults(fn=pay_vendor_inr_razorpay)
get_invoices_tool = FunctionTool.from_defaults(fn=get_pending_invoices)

# --- Agent ---

llm = OpenAI(model="gpt-4o", temperature=0)

vendor_payment_agent = ReActAgent.from_tools(
    tools=[
        get_invoices_tool,
        lookup_vendor_tool,
        pay_stripe_tool,
        pay_razorpay_tool,
    ],
    llm=llm,
    verbose=True,
    max_iterations=10,
    context="""You are a vendor payment agent for a company with global suppliers.
Process all pending invoices:
1. Retrieve pending invoices
2. For each invoice, look up the vendor to determine the correct payment rail
3. Use Stripe transfers for USD vendors, Razorpay payouts for INR vendors
4. If a payment is denied, record the denial code and audit ID — do not retry
5. If a payment requires approval, record the approval ID and move to the next invoice
Report a summary at the end.""",
)


def run_vendor_payments() -> str:
    response = vendor_payment_agent.chat("Process all pending vendor invoices.")
    return str(response)


if __name__ == "__main__":
    print(run_vendor_payments())
```

### How policy decisions surface

`FunctionTool.from_defaults` uses the function's docstring and type annotations as the tool description for the model. The function returns a string (JSON) which becomes the tool observation in the ReAct loop.

The ReAct agent's chain of thought will be visible in the observation-action loop, making it easy to see when a DENY or HOLD occurs:

```
Thought: I need to pay vendor VND-001 via Stripe for $2,500.
Action: pay_vendor_usd_stripe
Action Input: {"stripe_account_id": "acct_1Nw...", "amount_cents": 250000, ...}
Observation: {"status": "denied", "code": "DAILY_LIMIT_EXCEEDED", "audit_id": "aud_xyz"}
Thought: The payment was denied due to daily limit. I'll record this and move to the next invoice.
```

### Handling HOLD / pending approvals

For synchronous LlamaIndex agents, the `result.wait()` approach is most straightforward when operating within a request/response cycle with a timeout:

```python
def pay_vendor_usd_stripe_with_wait(
    stripe_account_id: str,
    amount_cents: int,
    po_number: str,
    description: str,
    wait_timeout_seconds: int = 300,
) -> str:
    """... (same as above but waits for approval) ..."""
    import json

    result = asyncio.get_event_loop().run_until_complete(
        stripe.transfers.create(...)
    )

    if is_pending_approval(result):
        try:
            approved_transfer = asyncio.get_event_loop().run_until_complete(
                result.wait(timeout_ms=wait_timeout_seconds * 1000, poll_interval_ms=5000)
            )
            return json.dumps({
                "status": "success",
                "transfer_id": approved_transfer.id,
                "message": f"Payment approved and completed. Transfer ID: {approved_transfer.id}",
            })
        except InflectionDenyError:
            return json.dumps({"status": "rejected", "message": "Payment rejected by account owner."})
        except Exception as e:
            return json.dumps({"status": "timeout", "message": str(e)})
```

### Testing tips

- Use `verbose=True` on `ReActAgent` to trace the full thought-action-observation loop
- Mock tool functions directly in pytest to test the agent's reasoning without network calls:
  ```python
  from unittest.mock import patch

  def test_agent_handles_deny():
      with patch("vendor_payment_agent_module.pay_vendor_usd_stripe") as mock_pay:
          mock_pay.return_value = '{"status": "denied", "code": "DAILY_LIMIT_EXCEEDED"}'
          result = vendor_payment_agent.chat("Process invoice INV-3301")
          assert "denied" in str(result).lower()
  ```

---

## 5. Raw Claude API (Anthropic SDK)

The Claude API (Anthropic SDK) supports tool use natively via the `tool_use` content block pattern. This approach gives you full control over the agentic loop without an additional framework.

### Installation

```bash
# Python
pip install inflection-sdk anthropic stripe

# TypeScript
npm install @inflection/sdk @anthropic-ai/sdk stripe
```

### Complete Example: Invoice Processing Agent (TypeScript)

This agent processes a queue of invoices, charging customers and sending receipts. It implements the full tool-use loop manually, which gives maximum control over error handling and approval flows.

```typescript
// invoice-agent.ts
import Anthropic from "@anthropic-ai/sdk"
import {
  Inflection,
  InflectionDenyError,
  InflectionConnectorError,
  isPendingApproval,
} from "@inflection/sdk"

const client = new Anthropic()
const inflection = new Inflection({ agentKey: process.env.INFLECTION_AGENT_KEY! })
const { stripe } = inflection.rails

// --- Tool definitions (passed to Claude) ---

const tools: Anthropic.Tool[] = [
  {
    name: "get_pending_invoices",
    description:
      "Retrieve the list of invoices that are approved and ready for payment collection.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "charge_invoice",
    description:
      "Charge a customer for a specific invoice via Stripe. Returns a status object including any policy denials or pending approvals.",
    input_schema: {
      type: "object",
      properties: {
        invoiceId: {
          type: "string",
          description: "Internal invoice ID",
        },
        customerId: {
          type: "string",
          description: "Stripe customer ID",
        },
        paymentMethodId: {
          type: "string",
          description: "Stripe payment method ID",
        },
        amountCents: {
          type: "number",
          description: "Amount to charge in cents",
        },
        description: {
          type: "string",
          description: "Invoice description for the charge",
        },
      },
      required: ["invoiceId", "customerId", "paymentMethodId", "amountCents", "description"],
    },
  },
  {
    name: "mark_invoice_status",
    description:
      "Update an invoice's status in the system (e.g., paid, failed, pending_approval).",
    input_schema: {
      type: "object",
      properties: {
        invoiceId: { type: "string" },
        status: {
          type: "string",
          enum: ["paid", "failed", "pending_approval", "denied"],
        },
        metadata: {
          type: "object",
          description: "Additional metadata like paymentIntentId, approvalId, auditId, or error code",
        },
      },
      required: ["invoiceId", "status"],
    },
  },
]

// --- Tool execution ---

interface ToolInput {
  invoiceId?: string
  customerId?: string
  paymentMethodId?: string
  amountCents?: number
  description?: string
  status?: string
  metadata?: Record<string, unknown>
}

async function executeTool(
  toolName: string,
  toolInput: ToolInput
): Promise<string> {
  switch (toolName) {
    case "get_pending_invoices": {
      // Replace with real database query
      return JSON.stringify([
        {
          invoiceId: "INV-4401",
          customerId: "cus_9abc",
          paymentMethodId: "pm_card_visa",
          amountCents: 9900,
          description: "Pro Plan - May 2026",
        },
        {
          invoiceId: "INV-4402",
          customerId: "cus_9def",
          paymentMethodId: "pm_card_mastercard",
          amountCents: 49900,
          description: "Enterprise Plan - May 2026",
        },
        {
          invoiceId: "INV-4403",
          customerId: "cus_9ghi",
          paymentMethodId: "pm_card_amex",
          amountCents: 150000,
          description: "Custom Contract - May 2026",
        },
      ])
    }

    case "charge_invoice": {
      const { invoiceId, customerId, paymentMethodId, amountCents, description } = toolInput

      try {
        const result = await stripe.paymentIntents.create({
          amount: amountCents!,
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true,
          metadata: { invoiceId: invoiceId! },
          description,
        })

        if (isPendingApproval(result)) {
          // Use webhook for async approval — don't block
          await result.onApproved({
            webhookUrl: `${process.env.BASE_URL}/inflection/callback`,
          })
          return JSON.stringify({
            status: "pending_approval",
            approvalId: result.approvalId,
            notificationChannel: result.notificationChannel,
            message: `Invoice ${invoiceId} requires manual approval. Account owner notified via ${result.notificationChannel}.`,
          })
        }

        return JSON.stringify({
          status: "success",
          paymentIntentId: result.id,
          amountCharged: result.amount,
          message: `Invoice ${invoiceId} charged successfully. Payment intent: ${result.id}`,
        })
      } catch (err) {
        if (err instanceof InflectionDenyError) {
          return JSON.stringify({
            status: "denied",
            code: err.code,
            auditId: err.auditId,
            message: `Invoice ${toolInput.invoiceId} payment denied: ${err.message} (${err.code})`,
          })
        }
        if (err instanceof InflectionConnectorError) {
          return JSON.stringify({
            status: "connector_error",
            rail: err.rail,
            message: `Stripe not configured: ${err.message}`,
          })
        }
        return JSON.stringify({ status: "error", message: String(err) })
      }
    }

    case "mark_invoice_status": {
      const { invoiceId, status, metadata } = toolInput
      // Replace with real DB update
      console.log(`[DB] Invoice ${invoiceId} → ${status}`, metadata)
      return JSON.stringify({ success: true, invoiceId, status })
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

// --- Agentic loop ---

export async function runInvoiceAgent(): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Process all pending invoices. Charge each one and update the invoice status. " +
        "For denied payments, record the denial. For pending approvals, mark them and move on.",
    },
  ]

  const systemPrompt = `You are an automated invoice collection agent for a SaaS company.
Your job is to:
1. Retrieve all pending invoices
2. Attempt to charge each invoice via Stripe
3. Handle each outcome:
   - success: mark the invoice as paid with the payment intent ID
   - denied: mark as denied with the denial code and audit ID
   - pending_approval: mark as pending_approval with the approval ID
   - error: mark as failed with the error message
4. Report a final summary of what was processed

Process invoices one at a time. Always mark the invoice status after each charge attempt.`

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools,
    })

    // Add assistant response to message history
    messages.push({ role: "assistant", content: response.content })

    // If Claude is done, return the final text
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text")
      return textBlock ? textBlock.text : "Done."
    }

    // If Claude wants to use tools, execute them
    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input as ToolInput)

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          })
        }
      }

      // Add tool results and continue the loop
      messages.push({ role: "user", content: toolResults })
    }
  }
}

// Usage
runInvoiceAgent().then(console.log).catch(console.error)
```

### Complete Example: Refund Processing Agent (Python)

```python
# refund_agent.py
import os
import json
import asyncio
from typing import Any
import anthropic
from inflection import Inflection, InflectionDenyError, is_pending_approval

client = anthropic.Anthropic()
inflection = Inflection(agent_key=os.environ["INFLECTION_AGENT_KEY"])
stripe = inflection.rails.stripe

# --- Tool definitions ---

tools = [
    {
        "name": "get_refund_requests",
        "description": "Get the queue of approved refund requests waiting to be processed.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "process_refund",
        "description": (
            "Process a refund for a specific payment. Returns status with policy decision details. "
            "Use for customer refund requests that have been approved by the support team."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "payment_intent_id": {
                    "type": "string",
                    "description": "Stripe payment intent ID to refund",
                },
                "amount_cents": {
                    "type": "integer",
                    "description": "Refund amount in cents. Omit for full refund.",
                },
                "reason": {
                    "type": "string",
                    "enum": ["duplicate", "fraudulent", "requested_by_customer"],
                },
                "ticket_id": {
                    "type": "string",
                    "description": "Support ticket ID for audit trail",
                },
            },
            "required": ["payment_intent_id", "reason", "ticket_id"],
        },
    },
    {
        "name": "update_ticket_status",
        "description": "Update a support ticket with the refund outcome.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticket_id": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["refunded", "partially_refunded", "denied", "pending_approval", "failed"],
                },
                "notes": {"type": "string"},
            },
            "required": ["ticket_id", "status"],
        },
    },
]


async def execute_tool(tool_name: str, tool_input: dict[str, Any]) -> str:
    if tool_name == "get_refund_requests":
        return json.dumps([
            {
                "ticket_id": "TKT-8801",
                "payment_intent_id": "pi_3abc...",
                "amount_cents": 2999,
                "reason": "requested_by_customer",
                "customer": "alice@example.com",
            },
            {
                "ticket_id": "TKT-8802",
                "payment_intent_id": "pi_3def...",
                "amount_cents": None,  # full refund
                "reason": "duplicate",
                "customer": "bob@example.com",
            },
        ])

    elif tool_name == "process_refund":
        params: dict[str, Any] = {
            "payment_intent": tool_input["payment_intent_id"],
            "reason": tool_input["reason"],
            "metadata": {"ticket_id": tool_input["ticket_id"]},
        }
        if tool_input.get("amount_cents"):
            params["amount"] = tool_input["amount_cents"]

        try:
            result = await stripe.refunds.create(**params)

            if is_pending_approval(result):
                return json.dumps({
                    "status": "pending_approval",
                    "approval_id": result.approval_id,
                    "message": f"Refund requires approval. Approval ID: {result.approval_id}",
                })

            return json.dumps({
                "status": "success",
                "refund_id": result.id,
                "amount": result.amount,
                "message": f"Refund of ${result.amount / 100:.2f} processed. Refund ID: {result.id}",
            })

        except InflectionDenyError as e:
            return json.dumps({
                "status": "denied",
                "code": e.code,
                "audit_id": e.audit_id,
                "message": f"Refund denied by policy: {e.message}",
            })

    elif tool_name == "update_ticket_status":
        print(f"[DB] Ticket {tool_input['ticket_id']} → {tool_input['status']}: {tool_input.get('notes', '')}")
        return json.dumps({"success": True})

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


async def run_refund_agent() -> str:
    messages = [
        {
            "role": "user",
            "content": (
                "Process all pending refund requests in the queue. "
                "For each refund, attempt to process it and update the ticket status with the outcome."
            ),
        }
    ]

    system = """You are a refund processing agent. Process each refund request:
1. Get the full refund queue
2. For each request, process the refund
3. Update the support ticket with the outcome (success, denied, pending_approval)
4. Summarize results at the end, including total refunded and any denials."""

    while True:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4096,
            system=system,
            messages=messages,
            tools=tools,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return "Done."

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = await execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    print(asyncio.run(run_refund_agent()))
```

### How policy decisions surface

In the raw Claude API pattern, you control the agentic loop directly. `tool_use` blocks from the model are executed by your `executeTool` function, which returns a string fed back as a `tool_result`. The model reads the result and continues reasoning.

For Inflection, the key pattern is:
- Return structured JSON strings from every tool, not plain text
- Include `status`, `code`, and `message` fields consistently
- Claude is very good at extracting meaning from JSON tool results and explaining them in natural language

Because you control the loop, you can implement sophisticated retry and approval logic:

```typescript
// Advanced: poll for approval within the tool execution
case "charge_invoice": {
  const result = await stripe.paymentIntents.create({ ... })

  if (isPendingApproval(result)) {
    // Only block-poll if the agent context allows it (e.g., a long-running background job)
    if (process.env.ALLOW_APPROVAL_POLLING === "true") {
      try {
        const approved = await result.wait({ timeoutMs: 5 * 60 * 1000 })
        return JSON.stringify({ status: "success", paymentIntentId: approved.id })
      } catch {
        return JSON.stringify({ status: "approval_timeout", approvalId: result.approvalId })
      }
    }
    // Otherwise, register webhook and return immediately
    await result.onApproved({ webhookUrl: `${process.env.BASE_URL}/webhook` })
    return JSON.stringify({ status: "pending_approval", approvalId: result.approvalId })
  }
  // ...
}
```

### Handling HOLD / pending approvals

The webhook pattern works identically across frameworks. For the raw Claude API, inject the approval result back into a fresh agent run:

```typescript
// webhook.ts
app.post("/inflection/callback", async (req, res) => {
  const { approvalId, decision, providerResult } = req.body

  const ctx = await getApprovalContext(approvalId)

  if (decision === "APPROVED") {
    // Resume the agent with the approval outcome
    const summary = await runInvoiceAgent(
      `The payment for invoice ${ctx.invoiceId} was approved. ` +
      `Payment intent ID: ${providerResult.id}. ` +
      `Please mark the invoice as paid.`
    )
    console.log("Post-approval run:", summary)
  }

  res.status(200).send("ok")
})
```

### Testing tips

- Use `max_tokens: 1024` in tests to keep cost low — tool-calling agents don't need large outputs for most test scenarios
- Mock the Anthropic client with `nock` or `msw` to intercept API calls and return canned tool_use responses:
  ```typescript
  import nock from "nock"

  // Intercept Anthropic API and return a tool_use response
  nock("https://api.anthropic.com")
    .post("/v1/messages")
    .reply(200, {
      stop_reason: "tool_use",
      content: [{
        type: "tool_use",
        id: "toolu_01",
        name: "charge_invoice",
        input: { invoiceId: "INV-001", amountCents: 9900, ... }
      }]
    })
  ```
- Test the agentic loop by running it against the Inflection sandbox (ak_test_ key) — you get realistic policy decisions without real Stripe calls
- Keep tool result strings deterministic in tests; avoid timestamps or random IDs in the mock layer

---

## Cross-framework: Common Patterns

### Environment variables (all frameworks)

```bash
INFLECTION_AGENT_KEY=ak_live_...       # or ak_test_... for sandbox
INFLECTION_WEBHOOK_SECRET=whsec_...    # for webhook verification
BASE_URL=https://your-agent.example.com
```

### Consistent error handling strategy

Across all frameworks, the recommended pattern is:

| Decision | What to return to model | Model behavior |
|---|---|---|
| ALLOW | `{ "status": "success", ... }` | Reports success to user |
| DENY | `{ "status": "denied", "code": "...", "audit_id": "..." }` | Explains why it was blocked |
| HOLD | `{ "status": "pending_approval", "approval_id": "..." }` | Reports that human review is needed |
| ConnectorError | `{ "status": "not_configured", "message": "..." }` | Prompts user to connect account |
| NetworkError | Re-throw or `{ "status": "error", "message": "..." }` | Retries or reports outage |

### Audit correlation

Every Inflection error and every `PendingApproval` carries an `auditId` (or `audit_id` in Python). Always include this in tool results so it flows into the model's response and your application logs. The audit ID links the agent's action to the immutable Inflection audit log entry.
