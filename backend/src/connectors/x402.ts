import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  erc20Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import type { Connector, ExecuteRequest, ExecuteResult, X402Creds } from "./interface";

const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  base:           "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

export class X402Connector implements Connector {
  readonly rail = "x402" as const;
  // Using `any` for viem clients to avoid dual-version type conflicts
  // (root workspace uses viem 2.21, backend uses viem 2.48)
  private walletClient: any;
  private publicClient: any;
  private usdcAddress: `0x${string}`;
  private address: `0x${string}`;

  constructor(private creds: X402Creds) {
    const account = privateKeyToAccount(creds.privateKey);
    this.address = account.address;
    const chain = creds.chain === "base" ? base : baseSepolia;
    this.walletClient = createWalletClient({ account, chain, transport: http() });
    this.publicClient = createPublicClient({ chain, transport: http() });
    this.usdcAddress = (USDC_ADDRESSES[creds.chain] ?? USDC_ADDRESSES["base-sepolia"]) as `0x${string}`;
  }

  async validate(): Promise<void> {
    const balance = await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.address],
    });
    if (balance === 0n) {
      throw new Error("x402 wallet has zero USDC balance — top up before connecting");
    }
  }

  async execute(req: ExecuteRequest): Promise<ExecuteResult> {
    const { action, args } = req;

    switch (action) {
      case "transfer": {
        const to = args.to as `0x${string}`;
        const amount = parseUnits(args.amount as string, 6);

        const hash = await this.walletClient.writeContract({
          address: this.usdcAddress,
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, amount],
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        return { providerTxId: hash, raw: receipt };
      }

      case "balanceOf": {
        const address = (args.address as `0x${string}`) ?? this.address;
        const balance = await this.publicClient.readContract({
          address: this.usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        return { raw: { balance: formatUnits(balance, 6), address } };
      }

      default:
        throw new Error(`X402Connector: unsupported action "${action}"`);
    }
  }

  extractRecipientId(req: ExecuteRequest): string | undefined {
    return req.args.to as string | undefined;
  }
}
