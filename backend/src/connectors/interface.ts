import type { Rail } from "../policy-engine";

export interface ExecuteRequest {
  action: string;
  args: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ExecuteResult {
  providerTxId?: string;
  raw: unknown;
}

export interface Connector {
  rail: Rail;
  validate(): Promise<void>;
  execute(req: ExecuteRequest): Promise<ExecuteResult>;
  extractRecipientId(req: ExecuteRequest): string | undefined;
}

// ─── Credential shapes (decrypted JSON) ──────────────────────────────────────

export interface StripeCreds {
  accessToken: string;
  refreshToken?: string;
}

export interface CircleCreds {
  apiKey: string;
  entitySecret: string;
}

export interface X402Creds {
  privateKey: `0x${string}`;
  address: string;
  chain: "base" | "base-sepolia";
}

export interface SquareCreds {
  accessToken: string;
  refreshToken?: string;
  locationId: string;
}

export interface BraintreeCreds {
  merchantId: string;
  publicKey: string;
  privateKey: string;
}

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}
