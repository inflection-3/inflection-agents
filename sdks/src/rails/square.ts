import type { ExecuteResponse } from "../types.ts";

export interface SquarePaymentsCreateArgs {
	source_id: string;
	amount_money: { amount: number; currency: string };
	customer_id?: string;
	note?: string;
}

export interface SquareRefundsCreateArgs {
	payment_id: string;
	amount_money?: { amount: number; currency: string };
	reason?: string;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

function normalizeAmount(amountMoney: { amount: number; currency: string }) {
	return { amount: (amountMoney.amount / 100).toFixed(2), currency: amountMoney.currency.toLowerCase() };
}

export function createSquareClient(execute: ExecuteFn) {
	return {
		payments: {
			create: async (args: SquarePaymentsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount_money, ...rest } = args;
				const n = normalizeAmount(amount_money);
				return execute({ rail: "square", action: "payments.create", args: rest, amount: n.amount, currency: n.currency, idempotencyKey });
			},
		},
		refunds: {
			create: async (args: SquareRefundsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount_money, ...rest } = args;
				const n = amount_money ? normalizeAmount(amount_money) : undefined;
				return execute({ rail: "square", action: "refunds.create", args: rest, amount: n?.amount, currency: n?.currency, idempotencyKey });
			},
		},
	};
}
