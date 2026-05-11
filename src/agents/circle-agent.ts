/**
 * RemoteFirst — Cross-Border USDC Payroll Agent
 *
 * Business context: RemoteFirst is a global company that employs contractors
 * across 40 countries. This agent runs monthly payroll in USDC — bypassing
 * banks and FX fees entirely. It checks treasury health, executes payments
 * to each contractor's wallet, handles adjustments, and generates a payroll
 * audit trail for accounting.
 *
 * Test environment: Circle sandbox + ETH-SEPOLIA testnet USDC
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import crypto from "crypto";
import fs from "fs";
import { model, logStep } from "../config.js";
import "dotenv/config";

const circle = initiateUserControlledWalletsClient({ apiKey: process.env.CIRCLE_API_KEY! });

const WALLET_FILE = ".circle-wallet.json";

// Contractor payroll roster — in production from HRIS
const CONTRACTORS = [
  { id: "C001", name: "Mei Lin",       role: "Frontend Engineer",  country: "Singapore",   usdc: "4200", wallet: "0x742d35Cc6634C0532925a3b8D4C9b37dDC1FBE9" },
  { id: "C002", name: "Carlos Ruiz",   role: "Backend Engineer",   country: "Colombia",    usdc: "3800", wallet: "0x53d284357ec70cE289D6D64134DfAc8E511c8a3" },
  { id: "C003", name: "Priya Nair",    role: "Product Designer",   country: "India",       usdc: "3500", wallet: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B" },
  { id: "C004", name: "James Okafor", role: "DevOps Engineer",    country: "Nigeria",     usdc: "4500", wallet: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359" },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupTreasuryWallet() {
  if (fs.existsSync(WALLET_FILE)) {
    const data = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    console.log("[remotefirst] using treasury wallet:", data.walletAddress);
    return data as { walletId: string; walletAddress: string; walletSetId: string };
  }

  const { data: wsData } = await circle.createWalletSet({
    idempotencyKey: crypto.randomUUID(),
    entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
    name: "RemoteFirst Treasury",
  });

  const { data: wData } = await circle.createWallets({
    idempotencyKey: crypto.randomUUID(),
    entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
    blockchains: ["ETH-SEPOLIA"],
    count: 1,
    walletSetId: wsData!.walletSet!.id!,
  });

  const wallet = wData!.wallets![0];
  const result = { walletId: wallet.id!, walletAddress: wallet.address!, walletSetId: wsData!.walletSet!.id! };
  fs.writeFileSync(WALLET_FILE, JSON.stringify(result, null, 2));

  console.log("[remotefirst] treasury wallet created:", wallet.address);
  console.log("[remotefirst] fund at faucet.circle.com with ETH-SEPOLIA USDC");
  return result;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string, walletId: string) {
  console.log(`\n[remotefirst-payroll-agent] ${task}\n`);

  const totalPayroll = CONTRACTORS.reduce((sum, c) => sum + parseFloat(c.usdc), 0);

  const result = await generateText({
    model,
    maxSteps: 20,
    system: `You are PayrollBot, the autonomous global payroll agent for RemoteFirst.

Your job:
1. Check treasury USDC balance before running payroll
2. Verify we have enough to cover all contractor payments
3. Execute USDC transfers to each contractor's wallet
4. Generate an audit-ready payroll report

Contractor roster (monthly USDC payments):
${CONTRACTORS.map((c) => `  ${c.id} | ${c.name} (${c.country}) | ${c.role} | ${c.usdc} USDC → ${c.wallet}`).join("\n")}

Total payroll: ${totalPayroll} USDC

Rules:
- Always verify balance first
- Process payments in order of contractor ID
- If a transfer fails, log it and continue with the rest
- Generate a complete audit trail at the end (contractor name, amount, tx ID, status)`,
    prompt: task,
    tools: {
      checkTreasuryBalance: tool({
        description: "Check the treasury wallet USDC balance",
        parameters: z.object({}),
        execute: async () => {
          const { data } = await circle.getWalletTokenBalance({ id: walletId });
          const usdcBalance = data?.tokenBalances?.find((b) => b.token?.symbol === "USDC");
          logStep("tool", "checkTreasuryBalance", null, { usdc: usdcBalance?.amount });
          return {
            usdc_balance: usdcBalance?.amount || "0",
            total_payroll_needed: `${totalPayroll} USDC`,
            sufficient_funds: parseFloat(usdcBalance?.amount || "0") >= totalPayroll,
          };
        },
      }),

      transferToContractor: tool({
        description: "Send USDC to a contractor's wallet as their monthly payment",
        parameters: z.object({
          contractor_id: z.string(),
          contractor_name: z.string(),
          wallet_address: z.string(),
          amount_usdc: z.string(),
          pay_period: z.string().describe("e.g. 'May 2026'"),
        }),
        execute: async ({ contractor_id, contractor_name, wallet_address, amount_usdc, pay_period }) => {
          const { data: tokensData } = await circle.listTokens({ blockchain: "ETH-SEPOLIA" });
          const usdc = tokensData?.tokens?.find((t) => t.symbol === "USDC");
          if (!usdc) return { error: "USDC not found on ETH-SEPOLIA" };

          const { data: txData } = await circle.createTransaction({
            idempotencyKey: crypto.randomUUID(),
            entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
            walletId,
            tokenId: usdc.id!,
            destinationAddress: wallet_address,
            amounts: [amount_usdc],
            fee: { type: "level", config: { feeLevel: "MEDIUM" } },
          });

          logStep("tool", "transferToContractor", { contractor_id, amount_usdc }, { id: txData?.transaction?.id });
          return {
            contractor_id,
            contractor_name,
            amount_paid: `${amount_usdc} USDC`,
            pay_period,
            transaction_id: txData?.transaction?.id,
            state: txData?.transaction?.state,
            destination: wallet_address,
          };
        },
      }),

      getPayrollLedger: tool({
        description: "Get recent transactions from the treasury to build the payroll ledger",
        parameters: z.object({ limit: z.number().default(10) }),
        execute: async ({ limit }) => {
          const { data } = await circle.listTransactions({ walletIds: [walletId], pageSize: limit });
          return (data?.transactions || []).map((tx) => ({
            id: tx.id,
            type: tx.transactionType,
            state: tx.state,
            amounts: tx.amounts,
            destination: tx.destinationAddress,
            date: tx.createDate,
          }));
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

const { walletId } = await setupTreasuryWallet();

await run(
  `Run the May 2026 payroll for all RemoteFirst contractors.
   Check treasury balance first. If sufficient, pay all 4 contractors.
   Generate a complete payroll audit report with transaction IDs that I can hand to accounting.`,
  walletId
);
