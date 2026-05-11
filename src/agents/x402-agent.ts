/**
 * DataForge — AI Research Marketplace Agent
 *
 * Business context: DataForge is an AI research assistant that autonomously
 * purchases data from paid APIs to answer business intelligence queries.
 * It acts like an agent browsing a paid web — buying only what it needs,
 * per-call, in USDC micropayments via the x402 protocol.
 *
 * The x402 server (src/x402-server.ts) simulates a marketplace of data products.
 * Run the server first: npm run x402:server
 *
 * Test environment: Base Sepolia testnet (free USDC from faucet.circle.com)
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { erc20Abi } from "viem";
import { model, logStep } from "../config.js";
import "dotenv/config";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const SERVER_URL = process.env.X402_SERVER_URL || "http://localhost:3001";

function buildClients() {
  const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const payingHttp = withPaymentInterceptor(axios.create(), wallet);
  return { account, payingHttp, publicClient };
}

// ── Agent ──────────────────────────────────────────────────────────────────────

export async function run(task: string) {
  console.log(`\n[dataforge-research-agent] ${task}\n`);

  const { account, payingHttp, publicClient } = buildClients();

  const result = await generateText({
    model,
    maxSteps: 15,
    system: `You are DataForge's autonomous research agent. Your job is to answer business intelligence queries
by purchasing data from the DataForge marketplace using USDC micropayments.

Marketplace endpoints (each costs USDC per call):
  GET /api/market/trends       — industry trend analysis ($0.005)
  GET /api/company/profile     — company intelligence report ($0.003)
  GET /api/news/feed           — latest news for a topic ($0.002)
  GET /api/competitor/analysis — competitor benchmarking ($0.008)
  GET /api/finance/metrics     — financial KPIs and metrics ($0.005)

Strategy:
1. Check wallet balance before starting
2. Plan which data products you need to answer the query
3. Purchase them in order of relevance
4. Synthesize the results into a coherent report
5. Report total spend at the end

Be cost-efficient — don't buy data you don't need.`,
    prompt: task,
    tools: {
      checkBalance: tool({
        description: "Check the agent's USDC balance before purchasing data",
        parameters: z.object({}),
        execute: async () => {
          const balance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account.address],
          });
          const usdc = formatUnits(balance, 6);
          logStep("tool", "checkBalance", null, { usdc });
          return { usdc_balance: usdc, address: account.address, network: "base-sepolia" };
        },
      }),

      purchaseData: tool({
        description: "Purchase data from a marketplace endpoint. Payment via x402 is automatic.",
        parameters: z.object({
          endpoint: z.string().describe("API path, e.g. /api/market/trends"),
          query: z.string().optional().describe("Query parameter for the data request"),
        }),
        execute: async ({ endpoint, query }) => {
          const url = `${SERVER_URL}${endpoint}${query ? `?q=${encodeURIComponent(query)}` : ""}`;
          logStep("tool", "purchaseData", { endpoint, query }, null);
          const response = await payingHttp.get(url);
          logStep("tool", "purchaseData:result", null, response.data);
          return { endpoint, paid: true, data: response.data };
        },
      }),
    },
    onStepFinish({ text, toolCalls }) {
      if (text) console.log("\n[agent]", text);
      if (toolCalls?.length) {
        for (const call of toolCalls) {
          console.log(`\n[paying for] ${call.toolName}:`, call.args);
        }
      }
    },
  });

  console.log("\n[done]", result.text);
  return result;
}

// ── Demo ──────────────────────────────────────────────────────────────────────

await run(
  `I need a competitive intelligence report on the AI infrastructure market.
   Specifically: who are the top players, what are the key trends, and what are
   the financial metrics that VCs are watching right now?
   Purchase the data you need and give me a structured report I can use for a board meeting.`
);
