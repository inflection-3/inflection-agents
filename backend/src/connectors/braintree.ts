import braintree from "braintree";
import type { Connector, ExecuteRequest, ExecuteResult, BraintreeCreds } from "./interface";

export class BraintreeConnector implements Connector {
  readonly rail = "braintree" as const;
  private gateway: braintree.BraintreeGateway;

  constructor(creds: BraintreeCreds) {
    this.gateway = new braintree.BraintreeGateway({
      environment: creds.merchantId.startsWith("sandbox") ? braintree.Environment.Sandbox : braintree.Environment.Production,
      merchantId: creds.merchantId,
      publicKey: creds.publicKey,
      privateKey: creds.privateKey,
    });
  }

  async validate(): Promise<void> {
    // Attempt a client token generation — lightweight auth check
    await this.gateway.clientToken.generate({});
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;

    switch (action) {
      case "transactions.sale": {
        const result = await this.gateway.transaction.sale(args as unknown as braintree.TransactionRequest);
        if (!result.success) throw new Error(`Braintree sale failed: ${result.message}`);
        return { providerTxId: result.transaction.id, raw: result.transaction };
      }

      case "transactions.refund": {
        const { transactionId, amount } = args as { transactionId: string; amount?: string };
        const result = await this.gateway.transaction.refund(transactionId, amount);
        if (!result.success) throw new Error(`Braintree refund failed: ${result.message}`);
        return { providerTxId: result.transaction.id, raw: result.transaction };
      }

      case "transactions.void": {
        const result = await this.gateway.transaction.void(args.transactionId as string);
        if (!result.success) throw new Error(`Braintree void failed: ${result.message}`);
        return { providerTxId: result.transaction.id, raw: result.transaction };
      }

      default:
        throw new Error(`BraintreeConnector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    return req.args.customerId as string | undefined;
  }
}
