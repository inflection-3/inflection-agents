/**
 * FreshMart — Autonomous Retail Restocking Agent
 *
 * Business context: FreshMart is a chain of convenience stores. This agent
 * monitors inventory levels and autonomously places restocking orders by
 * charging the store's business account when stock falls below threshold.
 * The agent decides what to reorder, calculates quantities, and pays the
 * supplier — all without human intervention.
 *
 * Test environment: Square sandbox
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { Client, Environment } from "square";
import crypto from "crypto";
import { model, logStep } from "../config.js";
import "dotenv/config";

const square = new Client({
  environment: Environment.Sandbox,
  accessToken: process.env.SQUARE_SANDBOX_TOKEN!,
});

// Simulated inventory — in production this would come from a POS/WMS system
const INVENTORY = [
  { sku: "WATER-500ML", name: "Mineral Water 500ml",   stock: 8,   reorder_point: 24, reorder_qty: 96,  unit_cost_cents: 45  },
  { sku: "COFFEE-DARK", name: "Dark Roast Coffee 250g", stock: 3,   reorder_point: 12, reorder_qty: 48,  unit_cost_cents: 890 },
  { sku: "SNACK-CHIPS", name: "Potato Chips 150g",      stock: 45,  reorder_point: 20, reorder_qty: 60,  unit_cost_cents: 220 },
  { sku: "JUICE-OJ",    name: "Orange Juice 1L",        stock: 2,   reorder_point: 15, reorder_qty: 60,  unit_cost_cents: 320 },
  { sku: "MILK-FULL",   name: "Full Cream Milk 2L",     stock: 6,   reorder_point: 20, reorder_qty: 40,  unit_cost_cents: 430 },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupTestStoreAccount() {
  const { result: customerResult } = await square.customersApi.createCustomer({
    idempotencyKey: crypto.randomUUID(),
    emailAddress: "accounts@freshmart.com",
    givenName: "FreshMart",
    familyName: "HQ",
    companyName: "FreshMart Retail Group",
  });

  const customerId = customerResult.customer!.id!;

  const { result: cardResult } = await square.cardsApi.createCard({
    idempotencyKey: crypto.randomUUID(),
    sourceId: "cnon:card-nonce-ok",
    card: { customerId, billingAddress: { postalCode: "10001", country: "US" } },
  });

  return { customerId, cardId: cardResult.card!.id! };
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string, cardId: string) {
  console.log(`\n[freshmart-restock-agent] ${task}\n`);

  const result = await generateText({
    model,
    maxSteps: 15,
    system: `You are RestockBot, the autonomous inventory and purchasing agent for FreshMart convenience stores.

Your job:
1. Scan inventory levels across all SKUs
2. Identify items below their reorder point
3. Calculate the optimal reorder quantity and cost
4. Place purchase orders by charging the store's business account
5. Generate a restocking report

Rules:
- Only reorder items that are at or below their reorder point
- Calculate exact cost: quantity × unit_cost
- Place one order per SKU (don't batch into single payment — each SKU is a separate supplier order)
- Flag any items with critically low stock (< 50% of reorder point)`,
    prompt: task,
    tools: {
      scanInventory: tool({
        description: "Scan all inventory levels and identify items needing restock",
        parameters: z.object({}),
        execute: async () => {
          const critical = INVENTORY.filter((i) => i.stock < i.reorder_point / 2);
          const needsRestock = INVENTORY.filter((i) => i.stock <= i.reorder_point);
          const healthy = INVENTORY.filter((i) => i.stock > i.reorder_point);

          logStep("tool", "scanInventory", null, { critical: critical.length, needsRestock: needsRestock.length });
          return {
            total_skus: INVENTORY.length,
            critical_stock: critical.map((i) => ({ ...i, status: "CRITICAL" })),
            needs_restock: needsRestock.map((i) => ({
              ...i,
              reorder_cost_cents: i.reorder_qty * i.unit_cost_cents,
              status: i.stock < i.reorder_point / 2 ? "CRITICAL" : "LOW",
            })),
            healthy_stock: healthy.map((i) => ({ sku: i.sku, name: i.name, stock: i.stock })),
          };
        },
      }),

      placeRestockOrder: tool({
        description: "Place a supplier order for a specific SKU by charging the store's business account",
        parameters: z.object({
          sku: z.string(),
          quantity: z.number(),
          unit_cost_cents: z.number(),
          supplier: z.string().default("FreshMart Central Warehouse"),
        }),
        execute: async ({ sku, quantity, unit_cost_cents, supplier }) => {
          const item = INVENTORY.find((i) => i.sku === sku);
          if (!item) return { error: `SKU ${sku} not found` };

          const total_cents = quantity * unit_cost_cents;
          const { result } = await square.paymentsApi.createPayment({
            sourceId: cardId,
            idempotencyKey: crypto.randomUUID(),
            amountMoney: { amount: BigInt(total_cents), currency: "USD" },
            note: `Restock order: ${item.name} × ${quantity} units — ${supplier}`,
            autocomplete: true,
          });

          logStep("tool", "placeRestockOrder", { sku, quantity, total_cents }, { id: result.payment!.id });
          return {
            order_id: result.payment!.id,
            sku,
            product: item.name,
            quantity_ordered: quantity,
            total_cost: `$${(total_cents / 100).toFixed(2)}`,
            supplier,
            status: result.payment!.status,
            estimated_delivery: "Next business day",
          };
        },
      }),

      getSpendSummary: tool({
        description: "Get total spend for this restocking run",
        parameters: z.object({}),
        execute: async () => {
          const { result } = await square.paymentsApi.listPayments(
            undefined, undefined, undefined, undefined, "20"
          );
          const orders = (result.payments || []).filter((p) => p.note?.startsWith("Restock order:"));
          const total = orders.reduce((sum, p) => sum + Number(p.amountMoney?.amount || 0), 0);
          return {
            orders_placed: orders.length,
            total_spent: `$${(total / 100).toFixed(2)}`,
            breakdown: orders.map((p) => ({ id: p.id, note: p.note, amount: p.amountMoney })),
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

const { cardId } = await setupTestStoreAccount();

await run(
  `Run the daily inventory check for FreshMart Store #12.
   Identify all items below reorder point, prioritize critical stock first,
   and place restock orders automatically. Calculate exact quantities and costs.
   Give me a complete restocking report with all order IDs and total spend.`,
  cardId
);
