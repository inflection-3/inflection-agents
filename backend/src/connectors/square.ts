import { SquareClient, SquareEnvironment } from "square";
import type { Connector, ExecuteRequest, ExecuteResult, SquareCreds } from "./interface";

export class SquareConnector implements Connector {
  readonly rail = "square" as const;
  private client: SquareClient;

  constructor(private creds: SquareCreds) {
    this.client = new SquareClient({
      token: creds.accessToken,
      environment: creds.accessToken.startsWith("EAAAlive")
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });
  }

  async validate(): Promise<void> {
    const response = await this.client.locations.get({ locationId: this.creds.locationId });
    if (!response.location) throw new Error("Square location not found");
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;

    switch (action) {
      case "payments.create": {
        const response = await this.client.payments.create({
          ...(args as object),
          locationId: this.creds.locationId,
        } as Parameters<typeof this.client.payments.create>[0]);
        return { providerTxId: response.payment?.id, raw: response };
      }

      case "refunds.create": {
        const response = await this.client.refunds.refundPayment(
          args as unknown as Parameters<typeof this.client.refunds.refundPayment>[0]
        );
        return { providerTxId: response.refund?.id, raw: response };
      }

      default:
        throw new Error(`SquareConnector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    return req.args.customerId as string | undefined;
  }
}
