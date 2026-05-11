/**
 * FlowDAO — On-Chain Treasury & Contractor Payroll Agent
 *
 * Business context: FlowDAO is a decentralized organization that pays
 * contributors and contractors in USDC. This agent manages the DAO treasury:
 * checks health, executes scheduled payroll runs, handles one-off payments
 * for bounties, and reports treasury status to governance.
 *
 * Test environment: Base Sepolia testnet (free ETH/USDC from CDP faucet)
 */

import { generateText } from "ai";
import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { model } from "../config.js";
import fs from "fs";
import "dotenv/config";

const WALLET_FILE = ".coinbase-wallet.json";

// Simulated contractor payroll — in production this would come from a DB
const PAYROLL = [
  { name: "Alice Chen",    role: "Lead Engineer",    address: "0x742d35Cc6634C0532925a3b8D4C9b37dDC1FBE9", usdc: "2500" },
  { name: "Bob Martinez",  role: "Protocol Designer", address: "0x53d284357ec70cE289D6D64134DfAc8E511c8a3", usdc: "1800" },
  { name: "Carol Singh",   role: "Security Auditor",  address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", usdc: "3200" },
];

async function buildAgentKit() {
  const savedWallet = fs.existsSync(WALLET_FILE)
    ? JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"))
    : null;

  const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
    networkId: process.env.NETWORK_ID || "base-sepolia",
    ...(savedWallet ? { cdpWalletData: JSON.stringify(savedWallet) } : {}),
  });

  const exported = await walletProvider.exportWallet();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(exported, null, 2));

  const agentkit = await AgentKit.from({ walletProvider });
  return agentkit;
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string) {
  console.log(`\n[flowdao-treasury-agent] ${task}\n`);

  const agentkit = await buildAgentKit();
  const tools = getVercelAITools(agentkit);

  const payrollSummary = PAYROLL.map(
    (c) => `  - ${c.name} (${c.role}): ${c.usdc} USDC → ${c.address}`
  ).join("\n");

  const result = await generateText({
    model,
    maxSteps: 20,
    tools,
    system: `You are TreasuryBot, the autonomous treasury and payroll agent for FlowDAO.

Your responsibilities:
1. Check DAO treasury health (wallet balance) before any payroll run
2. Execute USDC payroll to contributors on Base Sepolia
3. Handle one-off bounty payments
4. Report treasury status after operations

Current payroll list (monthly, in USDC):
${payrollSummary}

Rules:
- Always check balance before executing payroll
- If balance is insufficient, request faucet funds (testnet only) and explain
- After each transfer, confirm it went through
- Provide a full payroll report at the end with tx IDs

Network: base-sepolia (testnet — all payments are simulated)`,
    prompt: task,
    onStepFinish({ text, toolCalls, toolResults }) {
      if (text) console.log("\n[agent]", text);
      for (const call of toolCalls ?? []) {
        console.log(`\n[on-chain:${call.toolName}]`, JSON.stringify(call.args, null, 2));
      }
      for (const res of (toolResults ?? []) as Array<{ result: unknown }>) {
        console.log(`[tx-result]`, JSON.stringify(res.result, null, 2));
      }
    },
  });

  console.log("\n[done]", result.text);
  return result;
}

// ── Demo ──────────────────────────────────────────────────────────────────────

await run(
  `Run the monthly payroll for FlowDAO contributors.
   First check the treasury balance. If we have enough USDC, pay all 3 contributors.
   If not, request testnet funds first.
   After all payments, give me a payroll execution report with transaction IDs and status.`
);
