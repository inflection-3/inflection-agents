import type { ExecuteResponse } from "../types.ts";

export interface X402TransferArgs {
	to: string;
	amount: string;
}

export interface X402BalanceOfArgs {
	address?: string;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

export function createX402Client(execute: ExecuteFn) {
	return {
		transfer: async (args: X402TransferArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
			const { idempotencyKey, amount, ...rest } = args;
			return execute({ rail: "x402", action: "transfer", args: rest, amount, currency: "usdc", idempotencyKey });
		},
		balanceOf: async (args: X402BalanceOfArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
			const { idempotencyKey, ...rest } = args;
			return execute({ rail: "x402", action: "balanceOf", args: rest, idempotencyKey });
		},
	};
}
