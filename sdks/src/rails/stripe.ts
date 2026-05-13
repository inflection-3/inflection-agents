import type { ExecuteResponse } from "../types.ts";

export interface StripeChargesCreateArgs {
	amount: number;
	currency: string;
	source: string;
	description?: string;
	customer?: string;
}

export interface StripePaymentIntentsCreateArgs {
	amount: number;
	currency: string;
	payment_method?: string;
	confirm?: boolean;
	customer?: string;
}

export interface StripePaymentIntentsConfirmArgs {
	id: string;
	payment_method?: string;
	return_url?: string;
}

export interface StripeRefundsCreateArgs {
	charge?: string;
	payment_intent?: string;
	amount?: number;
	reason?: string;
}

export interface StripeCustomersCreateArgs {
	email?: string;
	name?: string;
	description?: string;
	metadata?: Record<string, string>;
}

export interface StripePayoutsCreateArgs {
	amount: number;
	currency: string;
	method?: "standard" | "instant";
}

export interface StripeTransfersCreateArgs {
	amount: number;
	currency: string;
	destination: string;
	description?: string;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

function stripeAmount(amount: number): string {
	return (amount / 100).toFixed(2);
}

export function createStripeClient(execute: ExecuteFn) {
	return {
		charges: {
			create: async (args: StripeChargesCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				// amount/currency stay in args for the Stripe API; top-level amount/currency are for policy evaluation
				return execute({ rail: "stripe", action: "charges.create", args: { amount, currency, ...rest }, amount: stripeAmount(amount), currency, idempotencyKey });
			},
		},
		paymentIntents: {
			create: async (args: StripePaymentIntentsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				return execute({ rail: "stripe", action: "paymentIntents.create", args: { amount, currency, ...rest }, amount: stripeAmount(amount), currency, idempotencyKey });
			},
			confirm: async (args: StripePaymentIntentsConfirmArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "stripe", action: "paymentIntents.confirm", args: rest, idempotencyKey });
			},
		},
		refunds: {
			create: async (args: StripeRefundsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, ...rest } = args;
				return execute({ rail: "stripe", action: "refunds.create", args: { ...rest, ...(amount !== undefined && { amount }) }, amount: amount ? stripeAmount(amount) : undefined, idempotencyKey });
			},
		},
		customers: {
			create: async (args: StripeCustomersCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "stripe", action: "customers.create", args: rest, idempotencyKey });
			},
		},
		payouts: {
			create: async (args: StripePayoutsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				return execute({ rail: "stripe", action: "payouts.create", args: { amount, currency, ...rest }, amount: stripeAmount(amount), currency, idempotencyKey });
			},
		},
		transfers: {
			create: async (args: StripeTransfersCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, currency, ...rest } = args;
				return execute({ rail: "stripe", action: "transfers.create", args: { amount, currency, ...rest }, amount: stripeAmount(amount), currency, idempotencyKey });
			},
		},
	};
}
