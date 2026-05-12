/**
 * Phase 5 — Execute Route tests.
 * Covers: sanitizeArgs, hash-chain, handler DENY/HOLD/ALLOW responses.
 * Uses the real Hono app with a temp SQLite DB and Redis.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import { sanitizeArgs, writeAuditLog, flushAuditLogSync } from "../src/audit-log";
import app from "../src/routes";
import * as schema from "../src/db/schema";
import { hashApiKey, newId } from "../src/lib/auth";
import { policyCache } from "../src/policy-engine";
import { eq } from "drizzle-orm";

// ─── Test DB setup ────────────────────────────────────────────────────────────
// Must be set before db/connector.ts is first imported by the app

const TEST_DB_PATH = `./test-execute-${Date.now()}.db`;
process.env.DATABASE_URL = TEST_DB_PATH;
process.env.CREDENTIALS_ENCRYPTION_KEY = "a".repeat(64);

import { db } from "../src/db/connector";

// Apply migrations using the same DB connection that drizzle uses
function applyMigrations() {
  const raw = (db as any).$client as Database;
  raw.run("PRAGMA foreign_keys=OFF");
  raw.run(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`);

  const applied = new Set(
    (raw.prepare("SELECT hash FROM __drizzle_migrations").all() as { hash: string }[])
      .map((r) => r.hash)
  );

  const dir = join(import.meta.dir, "../src/db/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    raw.transaction(() => {
      for (const stmt of statements) raw.run(stmt);
      raw.run("INSERT INTO __drizzle_migrations (hash) VALUES (?)", [file]);
    })();
  }

  raw.run("PRAGMA foreign_keys=ON");
}

// ─── Global setup ─────────────────────────────────────────────────────────────

const RUN = Date.now().toString(36);

let seeded: { userId: string; agentId: string; connectorId: string; RAW_KEY: string };

beforeAll(async () => {
  applyMigrations();

  const userId = `user-${RUN}`;
  const agentId = `agent-${RUN}`;
  const connectorId = `conn-${RUN}`;
  const RAW_KEY = `infl_test_${RUN}${"x".repeat(20)}`;
  const keyHash = await hashApiKey(RAW_KEY);

  await db.insert(schema.users).values({
    id: userId,
    email: `test-${RUN}@inflection.dev`,
    passwordHash: "dummy",
    role: "developer",
  });

  await db.insert(schema.agents).values({
    id: agentId,
    developerId: userId,
    name: `Test Agent ${RUN}`,
    status: "active",
  });

  await db.insert(schema.agentApiKeys).values({
    id: `key-${RUN}`,
    agentId,
    keyHash,
    keyPrefix: RAW_KEY.slice(0, 16),
    mode: "test",
    status: "active",
  });

  await db.insert(schema.connectors).values({
    id: connectorId,
    agentId,
    userId,
    rail: "stripe",
    authType: "api_key",
    credentialsEncrypted: Buffer.from("fake"),
    credentialsIv: "aaaaaaaaaaaaaaaaaaaaaaaa",
    credentialsKeyId: "local",
    maskedCredential: "sk_test_****",
    status: "active",
  });

  seeded = { userId, agentId, connectorId, RAW_KEY };
});

afterAll(async () => {
  await flushAuditLogSync();
  try { rmSync(TEST_DB_PATH); } catch {}
});

// ─── sanitizeArgs ─────────────────────────────────────────────────────────────

describe("sanitizeArgs", () => {
  test("redacts top-level sensitive keys", () => {
    const result = sanitizeArgs({
      amount: 1000,
      card: "4242424242424242",
      cvv: "123",
      api_key: "sk_live_abc",
      password: "secret",
    });
    expect(result.amount).toBe(1000);
    expect(result.card).toBe("[REDACTED]");
    expect(result.cvv).toBe("[REDACTED]");
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
  });

  test("redacts nested sensitive keys", () => {
    const result = sanitizeArgs({
      metadata: { token: "tok_abc", description: "payment" },
    });
    expect((result.metadata as Record<string, unknown>).token).toBe("[REDACTED]");
    expect((result.metadata as Record<string, unknown>).description).toBe("payment");
  });

  test("redacts private_key and secret", () => {
    const result = sanitizeArgs({ private_key: "0xabc", secret: "shh" });
    expect(result.private_key).toBe("[REDACTED]");
    expect(result.secret).toBe("[REDACTED]");
  });

  test("preserves arrays unchanged", () => {
    const result = sanitizeArgs({ tags: ["a", "b"], count: 3 });
    expect(result.tags).toEqual(["a", "b"]);
    expect(result.count).toBe(3);
  });
});

// ─── writeAuditLog / hash chain ───────────────────────────────────────────────

describe("writeAuditLog", () => {
  test("flushes to DB and chains hashes", async () => {
    const agentId = `al-agent-${RUN}`;
    const userId = `al-user-${RUN}`;

    const id1 = newId();
    const id2 = newId();

    await writeAuditLog({
      id: id1, agentId, userId, rail: "stripe", action: "charges.create",
      outcome: "ALLOW", amount: "100", currency: "usd",
    });
    await writeAuditLog({
      id: id2, agentId, userId, rail: "stripe", action: "charges.create",
      outcome: "DENY", denyRule: "max_per_transaction",
    });

    await flushAuditLogSync();

    const rows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.agentId, agentId));

    expect(rows).toHaveLength(2);
    expect(rows[0]!.outcome).toBe("ALLOW");
    expect(rows[1]!.outcome).toBe("DENY");
    expect(rows[1]!.prevHash).toBe(rows[0]!.rowHash); // hash chain
    expect(rows[0]!.rowHash).toHaveLength(64);
  });
});

// ─── POST /v1/execute ─────────────────────────────────────────────────────────

describe("POST /v1/execute", () => {
  function post(body: object, key = seeded?.RAW_KEY) {
    return app.request("/v1/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  }

  test("401 when no API key", async () => {
    const res = await app.request("/v1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test("400 when required fields missing", async () => {
    const res = await post({ connectorId: seeded.connectorId });
    expect(res.status).toBe(400);
  });

  test("404 for unknown connector", async () => {
    const res = await post({
      connectorId: "nonexistent",
      action: "charges.create",
      args: {},
      idempotencyKey: `idem-404-${RUN}`,
    });
    expect(res.status).toBe(404);
  });

  test("403 DENY when action not in allowedActions", async () => {
    const { userId, connectorId } = seeded;
    const policyId = `pol-deny-${RUN}`;

    await db.insert(schema.connectorPolicies).values({
      id: policyId,
      connectorId,
      userId,
      version: 1,
      rules: JSON.stringify({ allowedActions: ["customers.create"] }),
      createdBy: userId,
    });

    const res = await post({
      connectorId,
      action: "charges.create", // not in allowedActions
      args: { amount: 1000 },
      amount: "10.00",
      currency: "usd",
      idempotencyKey: `idem-deny-${RUN}`,
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { outcome: string; ruleId: string };
    expect(body.outcome).toBe("DENY");
    expect(body.ruleId).toBe("allowedActions");

    await db.delete(schema.connectorPolicies).where(eq(schema.connectorPolicies.id, policyId));
    policyCache.delete(`cp:${connectorId}`); // flush cached policy
  });

  test("202 HOLD when amount exceeds requireHumanApproval threshold", async () => {
    const { userId, connectorId } = seeded;
    const policyId = `pol-hold-${RUN}`;

    await db.insert(schema.connectorPolicies).values({
      id: policyId,
      connectorId,
      userId,
      version: 2,
      rules: JSON.stringify({
        allowedActions: ["charges.create"],
        requireHumanApproval: { thresholdAmount: "5.00", currency: "usd" },
      }),
      createdBy: userId,
    });

    const res = await post({
      connectorId,
      action: "charges.create",
      args: { amount: 1000 },
      amount: "10.00", // > 5.00 threshold
      currency: "usd",
      idempotencyKey: `idem-hold-${RUN}`,
    });

    expect(res.status).toBe(202);
    const body = await res.json() as { outcome: string; approvalId: string };
    expect(body.outcome).toBe("HOLD");
    expect(body.approvalId).toBeTruthy();

    // Verify approval row inserted in DB
    const [approval] = await db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.id, body.approvalId));
    expect(approval!.status).toBe("pending");

    await db.delete(schema.connectorPolicies).where(eq(schema.connectorPolicies.id, policyId));
    policyCache.delete(`cp:${connectorId}`);
  });

  test("idempotency: second identical call returns same cached response", async () => {
    const { connectorId } = seeded;
    const idemKey = `idem-idem-${RUN}`;

    const r1 = await post({
      connectorId,
      action: "charges.create",
      args: {},
      idempotencyKey: idemKey,
    });
    const b1 = await r1.json() as object;

    // Second call — must hit Redis cache and return same body
    const r2 = await post({
      connectorId,
      action: "charges.create",
      args: {},
      idempotencyKey: idemKey,
    });
    const b2 = await r2.json() as object;

    expect(JSON.stringify(b1)).toBe(JSON.stringify(b2));
  });
});
