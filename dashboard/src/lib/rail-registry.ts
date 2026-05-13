export type Rail = "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay";

export const ACTIONS_BY_RAIL: Record<Rail, readonly string[]> = {
  stripe: [
    "charges.create",
    "paymentIntents.create",
    "paymentIntents.confirm",
    "refunds.create",
    "customers.create",
    "payouts.create",
    "transfers.create",
  ],
  circle: [
    "transfers.create",
    "wallets.create",
    "walletSets.create",
    "balance.get",
  ],
  x402: [
    "transfer",
    "balanceOf",
  ],
  square: [
    "payments.create",
    "refunds.create",
  ],
  braintree: [
    "transactions.sale",
    "transactions.refund",
    "transactions.void",
  ],
  razorpay: [
    "orders.create",
    "payments.capture",
    "refunds.create",
  ],
};

export const CURRENCIES_BY_RAIL: Record<Rail, readonly string[]> = {
  stripe:    ["usd", "eur", "gbp", "aud", "cad", "sgd", "jpy", "nzd", "chf", "dkk", "nok", "sek"],
  circle:    ["usdc", "eurc"],
  x402:      ["usdc"],
  square:    ["usd", "eur", "gbp", "aud", "cad", "jpy"],
  braintree: ["usd", "eur", "gbp", "aud", "cad"],
  razorpay:  ["inr", "usd"],
};
