# Coinbase AgentKit — Purpose-Built Agent Wallet

## Overview

Coinbase AgentKit is the most purpose-built SDK for agentic payments. It gives an AI agent its own wallet and exposes financial actions (transfer, swap, deploy contracts, check balance) as tools the agent can use directly. Built by Coinbase, it integrates with LangChain and Vercel AI SDK out of the box.

Test environment: Base Sepolia testnet with free ETH and USDC from faucets.

---

## Prerequisites

- Node.js 18+
- Coinbase Developer Platform (CDP) account — free at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
- Anthropic API key

---

## SDK Installation

```bash
# Core + LangChain integration
npm install @coinbase/agentkit @coinbase/agentkit-langchain @langchain/langgraph @langchain/anthropic dotenv

# Or with Vercel AI SDK
npm install @coinbase/agentkit @coinbase/agentkit-ai-sdk ai dotenv
```

---

## Enable Test Environment

### Step 1 — Create CDP API Keys

1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Sign up for a free account
3. Go to **API Keys** → **Create API Key**
4. Download the JSON file — it contains `name` and `privateKey`

```env
# .env
CDP_API_KEY_NAME=organizations/xxx/apiKeys/xxx
CDP_API_KEY_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
ANTHROPIC_API_KEY=sk-ant-...
NETWORK_ID=base-sepolia
```

### Step 2 — Get Free Testnet Funds

Once your agent creates its wallet, fund it:

- **Testnet ETH** (for gas): [sepoliafaucet.com](https://sepoliafaucet.com) or the CDP portal faucet
- **Testnet USDC**: [faucet.circle.com](https://faucet.circle.com) → select Base Sepolia

Or use AgentKit's built-in faucet tool — the agent can request funds itself on testnet.

---

## Wallet Persistence Setup

AgentKit wallets need to persist between runs so you don't create a new wallet every time.

```typescript
// src/wallet-store.ts
import fs from "fs";

const WALLET_FILE = "agent-wallet.json";

export function saveWallet(data: object) {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2));
}

export function loadWallet(): object | null {
  if (!fs.existsSync(WALLET_FILE)) return null;
  return JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
}
```

---

## Building the Agent (LangChain)

```typescript
// src/agent-langchain.ts
import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { saveWallet, loadWallet } from "./wallet-store";
import dotenv from "dotenv";

dotenv.config();

async function createAgent() {
  const savedWallet = loadWallet();

  const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
    networkId: process.env.NETWORK_ID || "base-sepolia",
    // Restore wallet if it exists, otherwise create new
    ...(savedWallet ? { cdpWalletData: JSON.stringify(savedWallet) } : {}),
  });

  // Save wallet data for next run
  const walletData = await walletProvider.exportWallet();
  saveWallet(JSON.parse(walletData));

  const agentkit = await AgentKit.from({ walletProvider });

  // These are the tools the agent gets automatically:
  // - get_wallet_details
  // - get_balance
  // - request_faucet_funds (testnet only)
  // - transfer
  // - trade
  // - deploy_token
  // - deploy_nft
  // - mint_nft
  // - wrap_eth
  const tools = getLangChainTools(agentkit);

  const model = new ChatAnthropic({
    model: "claude-opus-4-7",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });

  const agent = createReactAgent({
    llm: model,
    tools,
  });

  return agent;
}

export async function runAgentKitAgent(task: string) {
  const agent = await createAgent();

  console.log(`\nAgent task: ${task}\n`);

  const stream = await agent.stream(
    { messages: [new HumanMessage(task)] },
    { configurable: { thread_id: "agentkit-test-1" } }
  );

  for await (const chunk of stream) {
    if ("agent" in chunk) {
      for (const message of chunk.agent.messages) {
        if (message.content) {
          console.log("Agent:", message.content);
        }
      }
    } else if ("tools" in chunk) {
      for (const message of chunk.tools.messages) {
        console.log("Tool result:", message.content);
      }
    }
  }
}
```

---

## Building the Agent (Vercel AI SDK)

```typescript
// src/agent-vercel.ts
import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-ai-sdk";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { saveWallet, loadWallet } from "./wallet-store";
import dotenv from "dotenv";

dotenv.config();

export async function runAgentKitAgentVercel(task: string) {
  const savedWallet = loadWallet();

  const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
    networkId: "base-sepolia",
    ...(savedWallet ? { cdpWalletData: JSON.stringify(savedWallet) } : {}),
  });

  const walletData = await walletProvider.exportWallet();
  saveWallet(JSON.parse(walletData));

  const agentkit = await AgentKit.from({ walletProvider });
  const tools = getVercelAITools(agentkit);

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const result = await generateText({
    model: anthropic("claude-opus-4-7"),
    tools,
    maxSteps: 10,
    prompt: task,
  });

  console.log("Agent response:", result.text);
  return result;
}
```

---

## Running and Testing

```typescript
// src/index.ts
import { runAgentKitAgent } from "./agent-langchain";

async function main() {
  // Test 1: Check wallet info and request testnet funds
  await runAgentKitAgent(
    "What is my wallet address and current balance? If I have no ETH, request funds from the faucet."
  );

  // Test 2: Transfer a small amount
  await runAgentKitAgent(
    "Send 0.0001 ETH to 0x742d35Cc6634C0532925a3b8D4C9b37dDC1FBE9 on base-sepolia testnet."
  );

  // Test 3: Check balance after transfer
  await runAgentKitAgent(
    "What is my current ETH and USDC balance on base-sepolia?"
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Built-in Agent Tools

AgentKit automatically provides these tools to your agent — no configuration needed:

| Tool | Description |
|---|---|
| `get_wallet_details` | Returns wallet address and network |
| `get_balance` | Returns token balances |
| `request_faucet_funds` | Gets free testnet ETH/USDC (testnet only) |
| `transfer` | Sends tokens to an address |
| `trade` | Swaps tokens on a DEX |
| `deploy_token` | Deploys an ERC-20 token |
| `deploy_nft` | Deploys an NFT collection |
| `mint_nft` | Mints an NFT |
| `wrap_eth` | Wraps ETH to WETH |

---

## Verifying Tests

- Agent logs show tool calls in real time
- Check your wallet on [sepolia.basescan.org](https://sepolia.basescan.org) with your wallet address
- The `agent-wallet.json` file persists your wallet between runs
- CDP portal shows wallet activity at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `API key invalid` | Wrong CDP key format | Use the full JSON from the download |
| `insufficient funds` | No testnet ETH | Ask agent to `request_faucet_funds` |
| `network not supported` | Wrong network ID | Use `base-sepolia` for testnet |
| `wallet not found` | Wallet data corrupted | Delete `agent-wallet.json` and restart |
