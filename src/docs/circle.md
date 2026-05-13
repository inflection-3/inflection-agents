# Circle — Programmable USDC Wallets

## Overview

Circle makes USDC (the dollar-backed stablecoin). Their Programmable Wallets API lets you create and control wallets for agents programmatically — the agent can hold USDC and transfer it autonomously. Best for agents that need to transact in dollars on-chain without full crypto infrastructure complexity.

Test environment: Circle's sandbox with free testnet USDC.

---

## Prerequisites

- Circle developer account — free at [console.circle.com](https://console.circle.com)
- Node.js 18+
- Anthropic API key

---

## SDK Installation

```bash
npm install @circle-fin/user-controlled-wallets @anthropic-ai/sdk dotenv
```

---

## Enable Test Environment

### Step 1 — Create Circle Developer Account

1. Go to [console.circle.com](https://console.circle.com)
2. Sign up for a free account
3. Go to **API Keys** → **Create New Key**
4. Select **Sandbox** environment
5. Copy the API key

### Step 2 — Get Entity Secret

Circle requires an Entity Secret for wallet operations (a 32-byte hex string):

```typescript
// scripts/generate-entity-secret.ts
import crypto from "crypto";

const entitySecret = crypto.randomBytes(32).toString("hex");
console.log("Entity Secret:", entitySecret);
// Save this — you need it to register and for all operations
```

Register it in the Circle console under **Configurator → Entity Secret**.

### Step 3 — Get Free Testnet USDC

1. Create a wallet first (see below)
2. Go to [faucet.circle.com](https://faucet.circle.com)
3. Select **ETH-SEPOLIA** or **MATIC-AMOY** testnet
4. Paste your wallet address
5. Receive free testnet USDC

```env
# .env
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=your_32_byte_hex_secret
ANTHROPIC_API_KEY=sk-ant-...
```

---

## SDK Setup

```typescript
// src/circle-client.ts
import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import dotenv from "dotenv";

dotenv.config();

export const circleClient = initiateUserControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
});
```

---

## Creating a Wallet Set and Agent Wallet

```typescript
// src/setup-wallet.ts
import { circleClient } from "./circle-client";
import crypto from "crypto";
import fs from "fs";

const WALLET_FILE = "circle-wallet.json";

export async function createAgentWallet() {
  if (fs.existsSync(WALLET_FILE)) {
    const data = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    console.log("Using existing wallet:", data.walletId);
    return data;
  }

  // 1. Create a wallet set (groups wallets together)
  const { data: walletSetData } = await circleClient.createWalletSet({
    idempotencyKey: crypto.randomUUID(),
    entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
    name: "Agent Wallet Set",
  });

  const walletSetId = walletSetData!.walletSet!.id!;

  // 2. Create a wallet in the set
  const { data: walletData } = await circleClient.createWallets({
    idempotencyKey: crypto.randomUUID(),
    entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
    blockchains: ["ETH-SEPOLIA"],    // testnet
    count: 1,
    walletSetId,
  });

  const wallet = walletData!.wallets![0];

  const result = {
    walletId: wallet.id,
    walletAddress: wallet.address,
    walletSetId,
  };

  // Persist wallet info
  fs.writeFileSync(WALLET_FILE, JSON.stringify(result, null, 2));
  console.log("Created wallet:", wallet.address);
  console.log("Fund this address with testnet USDC at faucet.circle.com");

  return result;
}
```

---

## Building the Agent

```typescript
// src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { circleClient } from "./circle-client";
import crypto from "crypto";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "get_wallet_balance",
    description: "Get the current USDC balance of the agent wallet",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "transfer_usdc",
    description: "Transfer USDC to another address",
    input_schema: {
      type: "object" as const,
      properties: {
        destination_address: {
          type: "string",
          description: "The wallet address to send USDC to",
        },
        amount: {
          type: "string",
          description: "Amount of USDC to send, e.g. '1.00'",
        },
        note: {
          type: "string",
          description: "Note for this transfer",
        },
      },
      required: ["destination_address", "amount"],
    },
  },
  {
    name: "list_transactions",
    description: "List recent transactions for the agent wallet",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  walletId: string
): Promise<string> {
  if (toolName === "get_wallet_balance") {
    const { data } = await circleClient.getWalletTokenBalance({ id: walletId });
    const tokenBalances = data?.tokenBalances || [];

    return JSON.stringify({
      balances: tokenBalances.map((tb) => ({
        token: tb.token?.symbol,
        amount: tb.amount,
        blockchain: tb.token?.blockchain,
      })),
    });
  }

  if (toolName === "transfer_usdc") {
    const { destination_address, amount, note } = toolInput as {
      destination_address: string;
      amount: string;
      note?: string;
    };

    // Get USDC token ID for ETH-SEPOLIA
    const { data: tokensData } = await circleClient.listTokens({
      blockchain: "ETH-SEPOLIA",
    });

    const usdcToken = tokensData?.tokens?.find(
      (t) => t.symbol === "USDC"
    );

    if (!usdcToken) {
      return JSON.stringify({ error: "USDC token not found for ETH-SEPOLIA" });
    }

    const { data: txData } = await circleClient.createTransaction({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET!,
      walletId,
      tokenId: usdcToken.id!,
      destinationAddress: destination_address,
      amounts: [amount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return JSON.stringify({
      success: true,
      transaction_id: txData?.transaction?.id,
      state: txData?.transaction?.state,
      amount_sent: `${amount} USDC`,
      destination: destination_address,
    });
  }

  if (toolName === "list_transactions") {
    const { data } = await circleClient.listTransactions({
      walletIds: [walletId],
      pageSize: 5,
    });

    const txs = (data?.transactions || []).map((tx) => ({
      id: tx.id,
      type: tx.transactionType,
      state: tx.state,
      amounts: tx.amounts,
      createDate: tx.createDate,
    }));

    return JSON.stringify({ transactions: txs });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

export async function runCircleAgent(task: string, walletId: string) {
  console.log(`\nAgent task: ${task}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") console.log("Agent:", block.text);
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`\nCalling tool: ${block.name}`, block.input);

          const result = await handleToolCall(
            block.name,
            block.input as Record<string, unknown>,
            walletId
          );

          console.log("Tool result:", JSON.parse(result));
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
  }
}
```

---

## Running and Testing

```typescript
// src/index.ts
import { createAgentWallet } from "./setup-wallet";
import { runCircleAgent } from "./agent";

async function main() {
  const { walletId } = await createAgentWallet();

  // Fund the wallet first at faucet.circle.com if balance is 0
  await runCircleAgent(
    "Check my USDC balance. If I have funds, list my recent transactions.",
    walletId
  );
}

main().catch(console.error);
```

```bash
npx tsx src/index.ts
```

---

## Verifying Tests

1. Log in to [console.circle.com](https://console.circle.com)
2. Go to **Wallets** — see your agent wallet and balance
3. Go to **Transactions** — all transfers appear here
4. Check on testnet explorer using the wallet address

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `INVALID_ENTITY_SECRET` | Wrong or unregistered secret | Register via Circle console Configurator |
| `INSUFFICIENT_FUNDS` | No USDC in wallet | Fund from faucet.circle.com |
| `INVALID_WALLET_ID` | Wallet not found | Check `circle-wallet.json` has correct ID |
| `TOKEN_NOT_FOUND` | USDC not available on chain | Use `ETH-SEPOLIA` for testnet |
