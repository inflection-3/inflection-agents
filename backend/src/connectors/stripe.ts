import Stripe from "stripe";
import type { Connector, ExecuteRequest, ExecuteResult, StripeCreds } from "./interface";

export class StripeConnector implements Connector {
  readonly rail = "stripe" as const;
  private client: Stripe;

  constructor(private creds: StripeCreds) {
    this.client = new Stripe(creds.accessToken);
  }

  async validate(): Promise<void> {
    // balance.retrieve() works for all key types (direct + OAuth)
    await this.client.balance.retrieve();
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;

    switch (action) {
      case "charges.create": {
        const charge = await this.client.charges.create(args as unknown as Stripe.ChargeCreateParams);
        return { providerTxId: charge.id, raw: charge };
      }
      case "paymentIntents.create": {
        const intent = await this.client.paymentIntents.create(args as unknown as Stripe.PaymentIntentCreateParams);
        return { providerTxId: intent.id, raw: intent };
      }
      case "paymentIntents.confirm": {
        const { id, ...params } = args as unknown as { id: string } & Stripe.PaymentIntentConfirmParams;
        const intent = await this.client.paymentIntents.confirm(id, params);
        return { providerTxId: intent.id, raw: intent };
      }
      case "refunds.create": {
        const refund = await this.client.refunds.create(args as unknown as Stripe.RefundCreateParams);
        return { providerTxId: refund.id, raw: refund };
      }
      case "customers.create": {
        const customer = await this.client.customers.create(args as unknown as Stripe.CustomerCreateParams);
        return { providerTxId: customer.id, raw: customer };
      }
      case "payouts.create": {
        const payout = await this.client.payouts.create(args as unknown as Stripe.PayoutCreateParams);
        return { providerTxId: payout.id, raw: payout };
      }
      case "transfers.create": {
        const transfer = await this.client.transfers.create(args as unknown as Stripe.TransferCreateParams);
        return { providerTxId: transfer.id, raw: transfer };
      }
      default:
        throw new Error(`StripeConnector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    const { action, args } = req;
    if (action === "payouts.create" || action === "transfers.create") {
      return (args.destination as string) ?? undefined;
    }
    return (args.customer as string) ?? undefined;
  }
}
