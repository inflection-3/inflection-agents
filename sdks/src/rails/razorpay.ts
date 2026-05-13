import type { ExecuteResponse } from "../types.ts";

export interface RazorpayOrdersCreateArgs {
	amount: number;
	currency: string;
	receipt?: string;
	notes?: Record<string, string>;
}

export interface RazorpayPaymentsCaptureArgs {
	paymentId: string;
	amount: number;
	currency: string;
}

export interface RazorpayRefundsCreateArgs {
	paymentId: string;
	amount?: number;
	notes?: Record<string, string>;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

function rpAmount(amount: number): string {
	return (amount / 100).toFixed(2);
}

export function createRazorpayClient(execute: ExecuteFn) {
	return {
		orders: {
			create: async (args: RazorpayOrdersCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				return execute({ rail: "razorpay", action: "orders.create", args: rest, amount: rpAmount(amount), currency: currency.toLowerCase(), idempotencyKey });
			},
		},
		payments: {
			capture: async (args: RazorpayPaymentsCaptureArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				return execute({ rail: "razorpay", action: "payments.capture", args: rest, amount: rpAmount(amount), currency: currency.toLowerCase(), idempotencyKey });
			},
		},
		refunds: {
			create: async (args: RazorpayRefundsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, ...rest } = args;
				return execute({ rail: "razorpay", action: "refunds.create", args: rest, amount: amount ? rpAmount(amount) : undefined, idempotencyKey });
			},
		},
	};
}
