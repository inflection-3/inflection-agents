/**
 * Inflection Agents — Agentic Payment Demo Runner
 *
 * Each agent is a real business use case running against a test environment.
 *
 * Usage:
 *   npx tsx src/index.ts <agent>
 *
 * Agents:
 *   stripe     — NeuralAPI: SaaS usage billing + overage detection
 *   x402       — DataForge: AI research agent buying data via micropayments
 *   coinbase   — FlowDAO: On-chain USDC payroll for global contractors
 *   braintree  — CloudStack: Subscription lifecycle (renewal + upgrades)
 *   square     — FreshMart: Autonomous retail restocking agent
 *   circle     — RemoteFirst: Cross-border USDC payroll
 *   razorpay   — QuickKart: Indian e-commerce delivery payment agent
 *   google-pay — StreamAI: Frictionless plan upgrade via Google Pay
 *
 * Note: x402 agent requires the marketplace server running first:
 *   npm run x402:server
 */

import "dotenv/config";

const agent = process.argv[2];

if (!agent) {
  console.log(`
Inflection Agents — Agentic Payment Demos

Usage:  npx tsx src/index.ts <agent>

┌─────────────┬──────────────────┬─────────────────────────────────────────────┐
│ Agent       │ Business         │ Use Case                                    │
├─────────────┼──────────────────┼─────────────────────────────────────────────┤
│ stripe      │ NeuralAPI        │ SaaS metered billing + overage detection    │
│ x402        │ DataForge        │ AI buys market data via USDC micropayments  │
│ coinbase    │ FlowDAO          │ On-chain USDC payroll for contractors        │
│ braintree   │ CloudStack       │ Subscription lifecycle + auto-upgrades      │
│ square      │ FreshMart        │ Retail inventory restocking agent           │
│ circle      │ RemoteFirst      │ Cross-border contractor payroll in USDC     │
│ razorpay    │ QuickKart        │ Indian COD delivery payment processing      │
│ google-pay  │ StreamAI         │ Frictionless Google Pay plan upgrades       │
└─────────────┴──────────────────┴─────────────────────────────────────────────┘

Note: Run 'npm run x402:server' in a separate terminal before running the x402 agent.
`);
  process.exit(0);
}

switch (agent) {
  case "stripe": {
    const { setupTestCustomer, run } = await import("./agents/stripe-agent.js");
    const { customerId, paymentMethodId } = await setupTestCustomer();
    await run(
      `Review customer ${customerId}'s usage for May 2026. Bill any overages and recommend a plan upgrade if it saves them money.`,
      customerId,
      paymentMethodId
    );
    break;
  }
  case "x402": {
    const { run } = await import("./agents/x402-agent.js");
    await run(
      "I need a competitive intelligence report on the AI infrastructure market for a board meeting. Buy the data you need and compile the report."
    );
    break;
  }
  case "coinbase": {
    const { run } = await import("./agents/coinbase-agent.js");
    await run(
      "Run the monthly payroll for FlowDAO contributors. Check balance, pay everyone, and give me a payroll execution report."
    );
    break;
  }
  case "braintree": {
    const { setupTestCustomer, run } = await import("./agents/braintree-agent.js");
    const customer = await setupTestCustomer();
    await run(
      "TechFlow Inc is overdue on their Business plan renewal and nearly at their seat/storage limits. Handle the renewal and upgrade them proactively.",
      customer.paymentMethodToken,
      customer
    );
    break;
  }
  case "square": {
    const { setupTestStoreAccount, run } = await import("./agents/square-agent.js");
    const { cardId } = await setupTestStoreAccount();
    await run(
      "Run the daily inventory check for FreshMart Store #12. Restock all items below threshold and give me a spend report.",
      cardId
    );
    break;
  }
  case "circle": {
    const { setupTreasuryWallet, run } = await import("./agents/circle-agent.js");
    const { walletId } = await setupTreasuryWallet();
    await run(
      "Run the May 2026 payroll for all RemoteFirst contractors. Pay everyone and generate the accounting audit report.",
      walletId
    );
    break;
  }
  case "razorpay": {
    const { setupTestCustomers, run } = await import("./agents/razorpay-agent.js");
    await setupTestCustomers();
    await run(
      "Process today's QuickKart delivery batch. Charge for successful deliveries, handle partials and failures correctly."
    );
    break;
  }
  case "google-pay": {
    const { setupUsersWithGooglePay, run } = await import("./agents/google-pay-agent.js");
    const users = await setupUsersWithGooglePay();
    await run(
      "Run the StreamAI upgrade sweep. Find users at 80%+ usage, upgrade them via Google Pay, notify them, and report new MRR.",
      users as any
    );
    break;
  }
  default:
    console.error(`Unknown agent: "${agent}"`);
    console.log("Run without arguments to see the full list.");
    process.exit(1);
}
