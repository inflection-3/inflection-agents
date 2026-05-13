import type { ExecuteResponse } from "../types.ts";

export interface CircleTransfersCreateArgs {
	walletId: string;
	tokenId: string;
	destinationAddress: string;
	amount: string;
	fee?: {
		type: "level";
		config: { feeLevel: "MEDIUM" | "HIGH" | "LOW" };
	};
}

export interface CircleWalletsCreateArgs {
	blockchain: "ETH" | "SOL" | "MATIC" | "ARB";
	count?: number;
	walletSetId: string;
}

export interface CircleWalletSetsCreateArgs {
	name: string;
}

export interface CircleBalanceGetArgs {
	walletId: string;
}

type ExecuteFn = (req: {
	rail: string;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
}) => Promise<ExecuteResponse>;

export function createCircleClient(execute: ExecuteFn) {
	return {
		transfers: {
			create: async (args: CircleTransfersCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, amount, ...rest } = args;
				return execute({ rail: "circle", action: "transfers.create", args: rest, amount, currency: "usdc", idempotencyKey });
			},
		},
		wallets: {
			create: async (args: CircleWalletsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "circle", action: "wallets.create", args: rest, idempotencyKey });
			},
		},
		walletSets: {
			create: async (args: CircleWalletSetsCreateArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "circle", action: "walletSets.create", args: rest, idempotencyKey });
			},
		},
		balance: {
			get: async (args: CircleBalanceGetArgs & { idempotencyKey: string }): Promise<ExecuteResponse> => {
				const { idempotencyKey, ...rest } = args;
				return execute({ rail: "circle", action: "balance.get", args: rest, idempotencyKey });
			},
		},
	};
}
