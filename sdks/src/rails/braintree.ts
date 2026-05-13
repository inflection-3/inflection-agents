import type { ExecuteResponse } from "../types.ts";

export interface BraintreeTransactionsSaleArgs {
	amount: string;
	paymentMethodNonce: string;
	orderId?: string;
	options?: { submitForSettlement: boolean };
}

export interface BraintreeTransactionsRefundArgs {
	transactionId: string;
	amount?: string;
}

export interface BraintreeTransactionsVoidArgs {
	transactionId: string;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

export function createBraintreeClient(execute: ExecuteFn) {
	return {
		transactions: {
			sale: async (args: BraintreeTransactionsSaleArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, ...rest } = args;
				return execute({ rail: "braintree", action: "transactions.sale", args: rest, amount, idempotencyKey });
			},
			refund: async (args: BraintreeTransactionsRefundArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, ...rest } = args;
				return execute({ rail: "braintree", action: "transactions.refund", args: rest, amount, idempotencyKey });
			},
			void: async (args: BraintreeTransactionsVoidArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "braintree", action: "transactions.void", args: rest, idempotencyKey });
			},
		},
	};
}
