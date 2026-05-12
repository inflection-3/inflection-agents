import { eq, and } from "drizzle-orm";
import { db } from "../db/connector";
import { connectors } from "../db/schema";
import { decryptCredentials } from "./encryption";
import { StripeConnector } from "./stripe";
import { CircleConnector } from "./circle";
import { X402Connector } from "./x402";
import { SquareConnector } from "./square";
import { BraintreeConnector } from "./braintree";
import { RazorpayConnector } from "./razorpay";
import type { Connector, ExecuteRequest, ExecuteResult } from "./interface";
import type {
  StripeCreds, CircleCreds, X402Creds,
  SquareCreds, BraintreeCreds, RazorpayCreds,
} from "./interface";
import type { Rail } from "../policy-engine";

// ─── In-process cache for encrypted connector records (TTL 5 min) ─────────────

interface CachedRecord {
  credentialsEncrypted: Buffer;
  credentialsIv: string;
  rail: Rail;
  expiresAt: number;
}

const connectorCache = new Map<string, CachedRecord>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateConnectorCache(connectorId: string): void {
  connectorCache.delete(connectorId);
}

async function loadConnectorRecord(connectorId: string): Promise<CachedRecord> {
  const cached = connectorCache.get(connectorId);
  if (cached && Date.now() < cached.expiresAt) return cached;

  const row = await db
    .select({
      credentialsEncrypted: connectors.credentialsEncrypted,
      credentialsIv: connectors.credentialsIv,
      rail: connectors.rail,
      status: connectors.status,
    })
    .from(connectors)
    .where(eq(connectors.id, connectorId))
    .get();

  if (!row) throw new Error(`Connector ${connectorId} not found`);
  if (row.status !== "active") throw new Error(`Connector ${connectorId} is ${row.status}`);

  const record: CachedRecord = {
    credentialsEncrypted: Buffer.from(row.credentialsEncrypted as unknown as ArrayBuffer),
    credentialsIv: row.credentialsIv,
    rail: row.rail as Rail,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  connectorCache.set(connectorId, record);
  return record;
}

// ─── Instantiate connector from decrypted creds ───────────────────────────────

async function buildConnector(record: CachedRecord): Promise<Connector> {
  const { rail, credentialsEncrypted, credentialsIv } = record;

  switch (rail) {
    case "stripe": {
      const creds = await decryptCredentials<StripeCreds>(credentialsEncrypted, credentialsIv);
      return new StripeConnector(creds);
    }
    case "circle": {
      const creds = await decryptCredentials<CircleCreds>(credentialsEncrypted, credentialsIv);
      return new CircleConnector(creds);
    }
    case "x402": {
      const creds = await decryptCredentials<X402Creds>(credentialsEncrypted, credentialsIv);
      return new X402Connector(creds);
    }
    case "square": {
      const creds = await decryptCredentials<SquareCreds>(credentialsEncrypted, credentialsIv);
      return new SquareConnector(creds);
    }
    case "braintree": {
      const creds = await decryptCredentials<BraintreeCreds>(credentialsEncrypted, credentialsIv);
      return new BraintreeConnector(creds);
    }
    case "razorpay": {
      const creds = await decryptCredentials<RazorpayCreds>(credentialsEncrypted, credentialsIv);
      return new RazorpayConnector(creds);
    }
    default:
      throw new Error(`Unknown rail: ${rail}`);
  }
}

// ─── ConnectorExecutor ────────────────────────────────────────────────────────

export const ConnectorExecutor = {
  async execute(connectorId: string, req: ExecuteRequest): Promise<ExecuteResult> {
    const record = await loadConnectorRecord(connectorId);
    const connector = await buildConnector(record);
    try {
      return await connector.execute(req);
    } finally {
      // Zero credential references from the connector instance
      zeroConnector(connector);
    }
  },

  async validate(connectorId: string): Promise<void> {
    const record = await loadConnectorRecord(connectorId);
    const connector = await buildConnector(record);
    try {
      await connector.validate();
    } finally {
      zeroConnector(connector);
    }
  },

  extractRecipientId(connectorId: string, req: ExecuteRequest): string | undefined {
    // Synchronous helper — only works if record is already cached
    const cached = connectorCache.get(connectorId);
    if (!cached) return undefined;
    // We can't decrypt synchronously, so return undefined — caller falls back to args directly
    return req.args.recipientId as string | undefined;
  },

  invalidateCache: invalidateConnectorCache,
};

// ─── Zero credentials from memory ────────────────────────────────────────────
// Best-effort: overwrite known credential string fields before GC

function zeroConnector(connector: Connector): void {
  const c = connector as unknown as Record<string, unknown>;
  const creds = c.creds as Record<string, unknown> | undefined;
  if (!creds) return;
  for (const key of Object.keys(creds)) {
    if (typeof creds[key] === "string") {
      creds[key] = "\0".repeat((creds[key] as string).length);
    }
  }
}
