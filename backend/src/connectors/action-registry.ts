import type { Rail } from "../policy-engine";

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

// Subset of actions that carry a monetary amount (trigger spend counters + limits)
export const MONETARY_ACTIONS_BY_RAIL: Record<Rail, readonly string[]> = {
  stripe:    ["charges.create", "paymentIntents.create", "refunds.create", "payouts.create", "transfers.create"],
  circle:    ["transfers.create"],
  x402:      ["transfer"],
  square:    ["payments.create", "refunds.create"],
  braintree: ["transactions.sale", "transactions.refund"],
  razorpay:  ["orders.create", "payments.capture", "refunds.create"],
};

export function validateConnectorPolicyRules(
  rail: Rail,
  rules: { allowedActions?: string[]; actionLimits?: Array<{ action: string }> }
): string | null {
  const valid = ACTIONS_BY_RAIL[rail];
  if (!valid) return `Unknown rail "${rail}"`;

  if (rules.allowedActions) {
    for (const action of rules.allowedActions) {
      if (!valid.includes(action)) {
        return `Action "${action}" is not supported by ${rail}. Supported: ${valid.join(", ")}`;
      }
    }
  }

  if (rules.actionLimits) {
    for (const limit of rules.actionLimits) {
      if (!valid.includes(limit.action)) {
        return `actionLimits action "${limit.action}" is not supported by ${rail}. Supported: ${valid.join(", ")}`;
      }
    }
  }

  return null;
}
