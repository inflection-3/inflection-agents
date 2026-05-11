/**
 * QuickKart — Indian E-Commerce Fulfillment Agent
 *
 * Business context: QuickKart is a 10-minute grocery delivery platform in India.
 * This agent handles the payment lifecycle for Cash-on-Delivery orders:
 * creates orders when items are dispatched, charges customers on delivery
 * confirmation, processes refunds for failed or partial deliveries,
 * and flags suspicious non-delivery patterns for fraud review.
 *
 * Test environment: Razorpay test mode (rzp_test_...)
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import Razorpay from "razorpay";
import { model, logStep } from "../config.js";
import "dotenv/config";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_TEST_KEY_ID!,
  key_secret: process.env.RAZORPAY_TEST_KEY_SECRET!,
});

// Simulated delivery events — in production from delivery partner webhook
const DELIVERY_EVENTS = [
  { order_id: "ORD-8821", customer: "Priya Sharma",  items: "Milk, Bread, Eggs",      amount_paise: 28500, status: "delivered",         customer_id: "" },
  { order_id: "ORD-8822", customer: "Rahul Gupta",   items: "Rice 5kg, Dal 1kg",       amount_paise: 52000, status: "delivered",         customer_id: "" },
  { order_id: "ORD-8823", customer: "Anita Patel",   items: "Vegetables assorted",     amount_paise: 34000, status: "partial_delivery",  delivered_pct: 70, customer_id: "" },
  { order_id: "ORD-8824", customer: "Vikram Singh",  items: "Frozen meals × 4",        amount_paise: 68000, status: "failed_delivery",   customer_id: "" },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupTestCustomers() {
  const customers = await Promise.all(
    DELIVERY_EVENTS.map((e) =>
      razorpay.customers.create({
        name: e.customer,
        email: `${e.customer.toLowerCase().replace(" ", ".")}@quickkart.test`,
        contact: "+919876543210",
        fail_existing: "0",
      })
    )
  );

  // Assign customer IDs to delivery events
  DELIVERY_EVENTS.forEach((e, i) => {
    e.customer_id = (customers[i] as any).id;
  });

  return DELIVERY_EVENTS;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string) {
  console.log(`\n[quickkart-fulfillment-agent] ${task}\n`);

  const result = await generateText({
    model,
    maxSteps: 20,
    system: `You are FulfillBot, the autonomous payment and fulfillment agent for QuickKart.

Your responsibilities:
1. Process payments for successfully delivered COD orders
2. Issue partial refunds for partial deliveries (proportional to items delivered)
3. Issue full refunds for failed deliveries
4. Flag suspicious patterns (multiple failed deliveries from same address)
5. Generate a fulfillment payment report

Payment rules:
- Successful delivery → charge full amount
- Partial delivery → charge (delivered_pct / 100) × order_amount
- Failed delivery → create order for ₹0 (log the failure, no charge)
- All amounts are in paise (100 paise = ₹1)

Always log the order ID, customer name, action taken, and amount.`,
    prompt: task,
    tools: {
      getDeliveryQueue: tool({
        description: "Get all pending delivery events awaiting payment processing",
        parameters: z.object({}),
        execute: async () => {
          logStep("tool", "getDeliveryQueue", null, { count: DELIVERY_EVENTS.length });
          return DELIVERY_EVENTS.map((e) => ({
            ...e,
            amount_rupees: `₹${e.amount_paise / 100}`,
          }));
        },
      }),

      chargeDelivery: tool({
        description: "Charge a customer for a successful delivery",
        parameters: z.object({
          order_id: z.string(),
          customer_id: z.string(),
          customer_name: z.string(),
          amount_paise: z.number(),
          items: z.string(),
        }),
        execute: async ({ order_id, customer_id, customer_name, amount_paise, items }) => {
          const order = await razorpay.orders.create({
            amount: amount_paise,
            currency: "INR",
            receipt: order_id,
            notes: {
              customer_name,
              items,
              delivery_status: "confirmed",
              agent: "quickkart-fulfillment",
            },
          });

          logStep("tool", "chargeDelivery", { order_id, amount_paise }, { id: order.id, status: order.status });
          return {
            quickkart_order_id: order_id,
            razorpay_order_id: order.id,
            customer: customer_name,
            items,
            amount_charged: `₹${amount_paise / 100}`,
            status: order.status,
          };
        },
      }),

      issuePartialRefund: tool({
        description: "Issue a partial refund for a partial delivery (agent calculates correct amount)",
        parameters: z.object({
          order_id: z.string(),
          customer_name: z.string(),
          full_amount_paise: z.number(),
          delivered_percent: z.number().describe("Percentage of items delivered, e.g. 70"),
          reason: z.string(),
        }),
        execute: async ({ order_id, customer_name, full_amount_paise, delivered_percent, reason }) => {
          const charged_paise = Math.round((delivered_percent / 100) * full_amount_paise);
          const refund_paise = full_amount_paise - charged_paise;

          // Create the order for the delivered portion
          const order = await razorpay.orders.create({
            amount: charged_paise,
            currency: "INR",
            receipt: order_id,
            notes: {
              customer_name,
              delivery_status: "partial",
              delivered_percent: String(delivered_percent),
              refund_applied: `₹${refund_paise / 100}`,
              reason,
            },
          });

          logStep("tool", "issuePartialRefund", { order_id, charged_paise, refund_paise }, { id: order.id });
          return {
            quickkart_order_id: order_id,
            customer: customer_name,
            full_amount: `₹${full_amount_paise / 100}`,
            amount_charged: `₹${charged_paise / 100}`,
            refund_applied: `₹${refund_paise / 100}`,
            items_delivered: `${delivered_percent}%`,
            razorpay_order_id: order.id,
          };
        },
      }),

      logFailedDelivery: tool({
        description: "Log a failed delivery — no charge, creates an audit record",
        parameters: z.object({
          order_id: z.string(),
          customer_name: z.string(),
          items: z.string(),
          reason: z.string(),
        }),
        execute: async ({ order_id, customer_name, items, reason }) => {
          // Create a ₹0 record for audit purposes
          // Note: Razorpay minimum is ₹1, so we log it as metadata only
          logStep("tool", "logFailedDelivery", { order_id, reason }, null);
          return {
            quickkart_order_id: order_id,
            customer: customer_name,
            items,
            action: "NO_CHARGE",
            reason,
            audit_logged: true,
            refund_due: "₹0 (COD — not yet collected)",
          };
        },
      }),

      getCollectionSummary: tool({
        description: "Summarize total collections and refunds for this fulfillment batch",
        parameters: z.object({}),
        execute: async () => {
          const recentOrders = await razorpay.orders.all({ count: 20 });
          const orders = (recentOrders.items as any[]).filter(
            (o) => o.notes?.agent === "quickkart-fulfillment"
          );
          const total_paise = orders.reduce((sum: number, o: any) => sum + o.amount, 0);
          return {
            orders_processed: orders.length,
            total_collected: `₹${total_paise / 100}`,
            orders: orders.map((o: any) => ({
              id: o.id,
              receipt: o.receipt,
              amount: `₹${o.amount / 100}`,
              status: o.status,
            })),
          };
        },
      }),
    },
    onStepFinish({ text }) {
      if (text) console.log("\n[agent]", text);
    },
  });

  console.log("\n[done]", result.text);
  return result;
}

// ── Demo ──────────────────────────────────────────────────────────────────────

await setupTestCustomers();

await run(
  `Process today's delivery batch for QuickKart.
   Get all delivery events and handle each one:
   - Successful deliveries → charge the customer
   - Partial deliveries → charge proportionally, apply correct refund
   - Failed deliveries → log with no charge
   At the end, give me the total collections, number of refunds, and any patterns to flag.`
);
