import { createHash } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "./db/connector";
import { auditLogs } from "./db/schema";

// ─── Args Sanitizer ───────────────────────────────────────────────────────────

const SENSITIVE_PATTERN = /card|cvv|api_key|secret|token|password|private_key/i;

export function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SENSITIVE_PATTERN.test(k)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeArgs(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Hash Chain ───────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// Per-process cache of last rowHash per agentId
const lastHashCache = new Map<string, string>();

async function getPrevHash(agentId: string, userId: string): Promise<string> {
  const cached = lastHashCache.get(agentId);
  if (cached) return cached;

  const [row] = await db
    .select({ rowHash: auditLogs.rowHash })
    .from(auditLogs)
    .where(eq(auditLogs.agentId, agentId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  return row?.rowHash ?? sha256(`INFLECTION_GENESIS:${agentId}:${userId}`);
}

// ─── Entry Type ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  agentId: string;
  userId: string;
  connectorId?: string;
  rail: string;
  action: string;
  outcome: "ALLOW" | "DENY" | "HOLD";
  denyRule?: string;
  amount?: string;
  currency?: string;
  recipientId?: string;
  policyId?: string;
  connectorPolicyId?: string;
  argsHash?: string;
  providerTxId?: string;
  approvalId?: string;
  durationMs?: number;
}

// ─── Batch Buffer ─────────────────────────────────────────────────────────────

const BATCH_MAX = 100;
const BATCH_INTERVAL_MS = 50;
const buffer: AuditEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const rows: Parameters<typeof db.insert>[0] extends never ? never : {
    id: string; agentId: string; userId: string; connectorId?: string; rail: string;
    action: string; outcome: "ALLOW" | "DENY" | "HOLD"; denyRule?: string;
    amount?: string; currency?: string; recipientId?: string; policyId?: string;
    connectorPolicyId?: string; argsHash?: string; providerTxId?: string;
    approvalId?: string; durationMs?: number; prevHash: string; rowHash: string;
  }[] = [];

  for (const entry of entries) {
    const prevHash = await getPrevHash(entry.agentId, entry.userId);
    const rowHash = sha256(
      `${entry.id}|${entry.agentId}|${entry.userId}|${entry.outcome}|${entry.amount ?? ""}|${prevHash}`
    );
    lastHashCache.set(entry.agentId, rowHash);
    rows.push({ ...entry, prevHash, rowHash });
  }

  await db.insert(auditLogs).values(rows as any);
}

// ─── Public Write API ─────────────────────────────────────────────────────────

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  buffer.push(entry);

  if (buffer.length >= BATCH_MAX) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const batch = buffer.splice(0);
    await flushBatch(batch);
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = buffer.splice(0);
      flushBatch(batch).catch((err) => console.error("[audit-log] flush error:", err));
    }, BATCH_INTERVAL_MS);
  }
}

export function flushAuditLogSync(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = buffer.splice(0);
  return flushBatch(batch);
}
