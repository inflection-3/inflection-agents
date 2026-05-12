import Razorpay from "razorpay";
import type { Connector, ExecuteRequest, ExecuteResult, RazorpayCreds } from "./interface";

export class RazorpayConnector implements Connector {
  readonly rail = "razorpay" as const;
  private client: Razorpay;

  constructor(creds: RazorpayCreds) {
    this.client = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
  }

  async validate(): Promise<void> {
    // List payments (limit 1) to confirm credentials work
    await this.client.payments.all({ count: 1 });
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;

    switch (action) {
      case "orders.create": {
        const order = await this.client.orders.create(args as unknown as Parameters<typeof this.client.orders.create>[0]);
        return { providerTxId: order.id as string, raw: order };
      }

      case "payments.capture": {
        const { paymentId, amount, currency } = args as { paymentId: string; amount: number; currency: string };
        const payment = await this.client.payments.capture(paymentId, amount, currency);
        return { providerTxId: (payment as { id: string }).id, raw: payment };
      }

      case "refunds.create": {
        const { paymentId, ...params } = args as { paymentId: string } & Record<string, unknown>;
        const refund = await this.client.payments.refund(paymentId, params as unknown as Parameters<typeof this.client.payments.refund>[1]);
        return { providerTxId: (refund as { id: string }).id, raw: refund };
      }

      default:
        throw new Error(`RazorpayConnector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    return req.args.customerId as string | undefined;
  }
}
