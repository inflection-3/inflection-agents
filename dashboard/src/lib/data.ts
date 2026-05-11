export const agents = [
  {
    id: "agt_7x2kp9mn",
    name: "vendor-pay-agent",
    status: "active" as const,
    apiKey: "sk_inf_7x2kp9mn_live_••••••••••••••••",
    createdAt: "2026-04-12",
    lastCallAt: "2 min ago",
    connectorCount: 3,
    policyCount: 1,
    txCount: 1204,
  },
  {
    id: "agt_4r8jq5vw",
    name: "invoice-bot",
    status: "active" as const,
    apiKey: "sk_inf_4r8jq5vw_live_••••••••••••••••",
    createdAt: "2026-04-28",
    lastCallAt: "22 min ago",
    connectorCount: 1,
    policyCount: 1,
    txCount: 389,
  },
  {
    id: "agt_2c6hn1yz",
    name: "expense-agent",
    status: "inactive" as const,
    apiKey: "sk_inf_2c6hn1yz_live_••••••••••••••••",
    createdAt: "2026-05-01",
    lastCallAt: "3 days ago",
    connectorCount: 2,
    policyCount: 0,
    txCount: 47,
  },
]

export const recentTransactions = [
  { id: "tx_001", agent: "vendor-pay-agent", rail: "stripe", action: "charge", amount: 4200, status: "ALLOWED" as const, ts: "2 min ago" },
  { id: "tx_002", agent: "vendor-pay-agent", rail: "circle", action: "transfer", amount: 52000, status: "HELD" as const, ts: "8 min ago" },
  { id: "tx_003", agent: "invoice-bot", rail: "stripe", action: "refund", amount: 350, status: "ALLOWED" as const, ts: "14 min ago" },
  { id: "tx_004", agent: "expense-agent", rail: "x402", action: "pay", amount: 99, status: "DENIED" as const, ts: "31 min ago" },
  { id: "tx_005", agent: "vendor-pay-agent", rail: "stripe", action: "charge", amount: 1800, status: "ALLOWED" as const, ts: "45 min ago" },
]

export const pendingApprovals = [
  { id: "hold_001", agentId: "agt_7x2kp9mn", agent: "vendor-pay-agent", rail: "circle", action: "transfer", amount: 52000, currency: "USD", args: { destination: "0x4A3B...9C2D", memo: "Vendor invoice #2041" }, policyRule: "requireHumanApproval", policyThreshold: 5000, heldAt: "2026-05-11T10:02:00Z", timeoutAt: "2026-05-11T10:32:00Z", waitingMin: 8 },
  { id: "hold_002", agentId: "agt_4r8jq5vw", agent: "invoice-bot", rail: "stripe", action: "charge", amount: 15500, currency: "USD", args: { customerId: "cus_Abc123", description: "Enterprise license Q2" }, policyRule: "requireHumanApproval", policyThreshold: 15000, heldAt: "2026-05-11T09:48:00Z", timeoutAt: "2026-05-11T10:18:00Z", waitingMin: 22 },
  { id: "hold_003", agentId: "agt_2c6hn1yz", agent: "expense-agent", rail: "stripe", action: "charge", amount: 9800, currency: "USD", args: { customerId: "cus_Def456", description: "Contractor payment May" }, policyRule: "requireHumanApproval", policyThreshold: 5000, heldAt: "2026-05-11T09:29:00Z", timeoutAt: "2026-05-11T09:59:00Z", waitingMin: 41 },
]

export const recentDecisions = [
  { txId: "tx_prev_001", agent: "vendor-pay-agent", rail: "stripe", amount: 8200, decision: "APPROVED" as const, by: "sarah@acme.com", reason: "Approved vendor invoice", decidedAt: "1 hour ago" },
  { txId: "tx_prev_002", agent: "invoice-bot", rail: "circle", amount: 75000, decision: "REJECTED" as const, by: "cfo@acme.com", reason: "Exceeds Q2 budget", decidedAt: "3 hours ago" },
  { txId: "tx_prev_003", agent: "vendor-pay-agent", rail: "stripe", amount: 6500, decision: "APPROVED" as const, by: "sarah@acme.com", reason: null, decidedAt: "Yesterday" },
]

export const connectedAccounts = [
  {
    id: "con_stripe_001",
    rail: "stripe" as const,
    accountId: "acct_1Abc23XYZ",
    accountLabel: "Acme Corp",
    status: "active" as const,
    connectedAt: "2026-04-12",
    assignedAgents: ["agt_7x2kp9mn", "agt_4r8jq5vw"],
  },
  {
    id: "con_circle_001",
    rail: "circle" as const,
    accountId: "circle_api_••••5f2a",
    accountLabel: null,
    status: "active" as const,
    connectedAt: "2026-04-14",
    assignedAgents: ["agt_7x2kp9mn"],
  },
  {
    id: "con_x402_001",
    rail: "x402" as const,
    accountId: "0x4A3B...9C2D",
    accountLabel: "Agent Wallet",
    status: "active" as const,
    connectedAt: "2026-04-15",
    assignedAgents: ["agt_7x2kp9mn"],
  },
]

export const vendorPayPolicy = {
  agentId: "agt_7x2kp9mn",
  version: 3,
  maxPerTransaction: 10000,
  dailyLimit: 50000,
  requireHumanApproval: 5000,
  allowedRails: ["stripe", "circle", "x402"],
  velocityCheck: { maxCount: 20, windowMinutes: 60 },
  allowedCurrencies: null,
  blockedCountries: null,
  updatedAt: "2026-05-10T14:22:00Z",
}

export const invoiceBotPolicy = {
  agentId: "agt_4r8jq5vw",
  version: 1,
  maxPerTransaction: 25000,
  dailyLimit: 100000,
  requireHumanApproval: 15000,
  allowedRails: ["stripe"],
  velocityCheck: null,
  updatedAt: "2026-04-29T09:10:00Z",
}

export const auditEntries = [
  {
    seq: 1204,
    timestamp: "2026-05-11 10:02:14 UTC",
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    rail: "circle",
    action: "transfer",
    amount: 52000,
    currency: "USD",
    policyDecision: "HOLD",
    outcome: "PENDING",
    policyVersion: 3,
    durationMs: 4,
    providerTxId: null,
    entryHash: "9f3a2b1c...",
    prevHash: "7e1d4a8b...",
  },
  {
    seq: 1203,
    timestamp: "2026-05-11 09:58:31 UTC",
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    rail: "stripe",
    action: "charge",
    amount: 4200,
    currency: "USD",
    policyDecision: "ALLOW",
    outcome: "EXECUTED",
    policyVersion: 3,
    durationMs: 7,
    providerTxId: "ch_3Abc123XYZ",
    entryHash: "7e1d4a8b...",
    prevHash: "2c9f6e3d...",
  },
  {
    seq: 1202,
    timestamp: "2026-05-11 09:44:02 UTC",
    agentId: "agt_2c6hn1yz",
    agentName: "expense-agent",
    rail: "x402",
    action: "pay",
    amount: 99,
    currency: "USD",
    policyDecision: "DENY",
    outcome: "DENIED",
    policyVersion: null,
    durationMs: 2,
    providerTxId: null,
    entryHash: "2c9f6e3d...",
    prevHash: "8a4b7c1e...",
  },
  {
    seq: 1201,
    timestamp: "2026-05-11 09:37:19 UTC",
    agentId: "agt_4r8jq5vw",
    agentName: "invoice-bot",
    rail: "stripe",
    action: "refund",
    amount: 350,
    currency: "USD",
    policyDecision: "ALLOW",
    outcome: "EXECUTED",
    policyVersion: 1,
    durationMs: 6,
    providerTxId: "re_3Def456ABC",
    entryHash: "8a4b7c1e...",
    prevHash: "5d2e9f0a...",
  },
]

export const notificationConfigs = [
  {
    agentId: "agt_7x2kp9mn",
    agentName: "vendor-pay-agent",
    slack: {
      configured: true,
      webhookPreview: "https://hooks.slack.com/services/T04A•••/B05B•••/••••••••••••",
      channel: "#payments-approvals",
      lastTestedAt: "2026-05-09T11:30:00Z",
      lastTestStatus: "ok" as const,
    },
    email: null,
  },
  {
    agentId: "agt_4r8jq5vw",
    agentName: "invoice-bot",
    slack: null,
    email: null,
  },
  {
    agentId: "agt_2c6hn1yz",
    agentName: "expense-agent",
    slack: null,
    email: null,
  },
]

export const dailySpend = [
  { date: "2026-04-12", executed: 3200, held: 0 },
  { date: "2026-04-13", executed: 1800, held: 1500 },
  { date: "2026-04-14", executed: 4100, held: 0 },
  { date: "2026-04-15", executed: 900, held: 0 },
  { date: "2026-04-16", executed: 2700, held: 52000 },
  { date: "2026-04-17", executed: 5400, held: 0 },
  { date: "2026-04-18", executed: 3100, held: 1200 },
  { date: "2026-04-19", executed: 2200, held: 0 },
  { date: "2026-04-20", executed: 4800, held: 0 },
  { date: "2026-04-21", executed: 1500, held: 8000 },
  { date: "2026-04-22", executed: 3900, held: 0 },
  { date: "2026-04-23", executed: 2100, held: 0 },
  { date: "2026-04-24", executed: 5600, held: 2500 },
  { date: "2026-04-25", executed: 3400, held: 0 },
  { date: "2026-04-26", executed: 2800, held: 0 },
  { date: "2026-04-27", executed: 6200, held: 0 },
  { date: "2026-04-28", executed: 1900, held: 15000 },
  { date: "2026-04-29", executed: 4300, held: 0 },
  { date: "2026-04-30", executed: 3700, held: 0 },
  { date: "2026-05-01", executed: 5100, held: 0 },
  { date: "2026-05-02", executed: 2400, held: 800 },
  { date: "2026-05-03", executed: 4600, held: 0 },
  { date: "2026-05-04", executed: 3300, held: 0 },
  { date: "2026-05-05", executed: 5800, held: 3200 },
  { date: "2026-05-06", executed: 2900, held: 0 },
  { date: "2026-05-07", executed: 4100, held: 0 },
  { date: "2026-05-08", executed: 5200, held: 0 },
  { date: "2026-05-09", executed: 3600, held: 12000 },
  { date: "2026-05-10", executed: 5400, held: 15500 },
  { date: "2026-05-11", executed: 4200, held: 52000 },
]

export const txByRail = [
  { rail: "stripe", count: 847, percentage: 70 },
  { rail: "circle", count: 290, percentage: 24 },
  { rail: "x402", count: 67, percentage: 6 },
]

export const txByOutcome = [
  { outcome: "ALLOWED", count: 1135 },
  { outcome: "HELD", count: 48 },
  { outcome: "DENIED", count: 21 },
]

export const topActions = [
  { action: "charge", count: 820, totalUsd: 31200, allowRate: "97%", avgMs: 7 },
  { action: "transfer", count: 245, totalUsd: 12400, allowRate: "88%", avgMs: 5 },
  { action: "refund", count: 98, totalUsd: 2800, allowRate: "100%", avgMs: 6 },
  { action: "pay", count: 41, totalUsd: 1920, allowRate: "92%", avgMs: 4 },
]

export const apiKeys = [
  {
    id: "key_001",
    name: "Production",
    prefix: "sk_inf_live_7x2k••••",
    createdAt: "2026-04-12",
    lastUsedAt: "2 min ago",
    scopes: ["gateway:call"],
  },
  {
    id: "key_002",
    name: "Staging",
    prefix: "sk_inf_test_4r8j••••",
    createdAt: "2026-04-28",
    lastUsedAt: "3 hours ago",
    scopes: ["gateway:call"],
  },
]

export const teamMembers = [
  { name: "Sarah Chen", email: "sarah@acme.com", role: "Admin", joinedAt: "2026-04-12" },
  { name: "James Park", email: "james@acme.com", role: "Approver", joinedAt: "2026-04-20" },
]

export const plan = {
  tier: "Free",
  gatewayCallsUsed: 1204,
  gatewayCallsLimit: 5000,
  activeAgents: 3,
  activeAgentsLimit: 5,
}
