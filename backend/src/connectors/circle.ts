import { initiateUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";
import crypto from "crypto";
import type { Connector, ExecuteRequest, ExecuteResult, CircleCreds } from "./interface";

// The Circle SDK types don't always match the runtime API (version drift).
// We cast to `any` where needed and keep the logic aligned with the working
// usage in the existing circle-agent.ts.
type CircleClient = ReturnType<typeof initiateUserControlledWalletsClient>;

export class CircleConnector implements Connector {
  readonly rail = "circle" as const;
  private client: CircleClient;

  constructor(private creds: CircleCreds) {
    this.client = initiateUserControlledWalletsClient({ apiKey: creds.apiKey });
  }

  async validate(): Promise<void> {
    // Verify credentials by fetching wallet list (lightweight auth ping)
    await (this.client as any).listWallets({ pageSize: 1 });
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;
    const entitySecretCiphertext = this.creds.entitySecret;
    const idempotencyKey = req.idempotencyKey ?? crypto.randomUUID();
    const c = this.client as any;

    switch (action) {
      case "transfers.create": {
        const { data } = await c.createTransaction({
          idempotencyKey,
          entitySecretCiphertext,
          walletId: args.walletId,
          tokenId: args.tokenId,
          destinationAddress: args.destinationAddress,
          amounts: [args.amount],
          fee: args.fee ?? { type: "level", config: { feeLevel: "MEDIUM" } },
        });
        return { providerTxId: data?.transaction?.id, raw: data };
      }

      case "wallets.create": {
        const { data } = await c.createWallets({
          idempotencyKey,
          entitySecretCiphertext,
          blockchains: [args.blockchain],
          count: args.count ?? 1,
          walletSetId: args.walletSetId,
        });
        return { raw: data };
      }

      case "walletSets.create": {
        const { data } = await c.createWalletSet({
          idempotencyKey,
          entitySecretCiphertext,
          name: args.name,
        });
        return { raw: data };
      }

      case "balance.get": {
        const { data } = await c.getWalletTokenBalance({ id: args.walletId });
        return { raw: data };
      }

      default:
        throw new Error(`CircleConnector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    return req.args.destinationAddress as string | undefined;
  }
}
