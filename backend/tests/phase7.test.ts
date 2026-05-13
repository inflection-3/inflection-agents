/**
 * Phase 7 — Approval Service & Notification Worker tests.
 * Covers: expiry sweeper, notification dispatcher, re-execute on approve.
 * Uses the real Hono app with a temp SQLite DB.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import app from "../src/routes";
import * as schema from "../src/db/schema";
import { hashPassword, signAccessToken, newId } from "../src/lib/auth";
import { sweepExpiredApprovals } from "../src/workers/expiry-sweeper";
import { dispatchHoldNotification } from "../src/notifications";
import { eq } from "drizzle-orm";

// ─── Test DB setup ────────────────────────────────────────────────────────────

const TEST_DB_PATH = `./test-phase7-${Date.now()}.db`;
process.env.DATABASE_URL = TEST_DB_PATH;
process.env.CREDENTIALS_ENCRYPTION_KEY = "c".repeat(64);

import { db } from "../src/db/connector";

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

// ─── Global state ─────────────────────────────────────────────────────────────

const RUN = Date.now().toString(36);

let token: string;
let userId: string;
let agentId: string;

// Approval IDs for various test scenarios
let approvalExpired1: string;   // already-expired — for sweeper
let approvalExpired2: string;   // already-expired — for sweeper
let approvalFuture: string;     // not expired — should not be swept
let approvalNoCtx: string;      // pending, no audit log → approve returns "approved"
let approvalWithCtx: string;    // pending, has audit log → approve returns "execution_failed"
let approvalPreRejected: string; // already-rejected — for 409 test

function req(method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  applyMigrations();

  userId = `user-p7-${RUN}`;
  const passwordHash = await hashPassword("test-password");

  await db.insert(schema.users).values({
    id: userId,
    email: `p7-${RUN}@inflection.dev`,
    passwordHash,
    role: "developer",
  });

  token = await signAccessToken({
    sub: userId,
    email: `p7-${RUN}@inflection.dev`,
    role: "developer",
    rev: 0,
  });

  // Create agent
  agentId = `agent-p7-${RUN}`;
  await db.insert(schema.agents).values({
    id: agentId,
    developerId: userId,
    name: "Phase 7 Test Agent",
  });

  // Expired approvals (expiresAt in the past)
  const past = new Date(Date.now() - 10_000);
  approvalExpired1 = `appr-exp1-${RUN}`;
  approvalExpired2 = `appr-exp2-${RUN}`;
  approvalFuture = `appr-future-${RUN}`;
  approvalNoCtx = `appr-noctx-${RUN}`;
  approvalWithCtx = `appr-ctx-${RUN}`;
  approvalPreRejected = `appr-rejected-${RUN}`;

  const future = new Date(Date.now() + 3_600_000);

  await db.insert(schema.approvals).values([
    {
      id: approvalExpired1,
      agentId,
      userId,
      argsSnapshot: "{}",
      status: "pending",
      expiresAt: past,
    },
    {
      id: approvalExpired2,
      agentId,
      userId,
      argsSnapshot: "{}",
      status: "pending",
      expiresAt: past,
    },
    {
      id: approvalFuture,
      agentId,
      userId,
      argsSnapshot: "{}",
      status: "pending",
      expiresAt: future,
    },
    {
      id: approvalNoCtx,
      agentId,
      userId,
      argsSnapshot: JSON.stringify({ customerId: "cus_test" }),
      amount: "50.00",
      currency: "usd",
      status: "pending",
      expiresAt: future,
    },
    {
      id: approvalWithCtx,
      agentId,
      userId,
      argsSnapshot: JSON.stringify({ customerId: "cus_test" }),
      amount: "200.00",
      currency: "usd",
      status: "pending",
      expiresAt: future,
    },
    {
      id: approvalPreRejected,
      agentId,
      userId,
      argsSnapshot: "{}",
      status: "rejected",
      rejectionReason: "pre-seeded rejection",
      expiresAt: future,
      resolvedAt: new Date(),
    },
  ]);

  // Seed an audit log row that points to approvalWithCtx
  // connectorId is a fake ID that won't exist in the connectors table
  // — triggers "execution_failed" path in re-execute
  const fakeConnectorId = `conn-nonexistent-${RUN}`;
  await db.insert(schema.auditLogs).values({
    id: `log-p7-${RUN}`,
    agentId,
    userId,
    connectorId: fakeConnectorId,
    rail: "stripe",
    action: "charge",
    outcome: "HOLD",
    denyRule: "requires_approval",
    amount: "200.00",
    currency: "usd",
    approvalId: approvalWithCtx,
    prevHash: "genesis",
    rowHash: "testhash",
  });
});

afterAll(() => {
  try { rmSync(TEST_DB_PATH); } catch {}
  try { rmSync(`${TEST_DB_PATH}-wal`); } catch {}
  try { rmSync(`${TEST_DB_PATH}-shm`); } catch {}
});

// ─── Expiry Sweeper ───────────────────────────────────────────────────────────

describe("expiry sweeper", () => {
  test("marks expired pending approvals as expired", async () => {
    await sweepExpiredApprovals();

    const [a1] = await db
      .select({ status: schema.approvals.status })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalExpired1))
      .limit(1);
    const [a2] = await db
      .select({ status: schema.approvals.status })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalExpired2))
      .limit(1);

    expect(a1.status).toBe("expired");
    expect(a2.status).toBe("expired");
  });

  test("does not expire approvals that have not yet expired", async () => {
    const [row] = await db
      .select({ status: schema.approvals.status })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalFuture))
      .limit(1);

    expect(row.status).toBe("pending");
  });

  test("is idempotent — re-running does not throw", async () => {
    await expect(sweepExpiredApprovals()).resolves.toBeUndefined();
  });
});

// ─── Notification Dispatcher ──────────────────────────────────────────────────

describe("notification dispatcher", () => {
  test("returns without error when agent has no notification config", async () => {
    await expect(
      dispatchHoldNotification({
        approvalId: approvalNoCtx,
        agentId,
        action: "charge",
        amount: "50.00",
        currency: "usd",
        reason: "test",
      })
    ).resolves.toBeUndefined();
  });

  test("returns without error when RESEND_API_KEY is absent and email addresses set", async () => {
    // Upsert notification config with email addresses but no Resend key in env
    const configId = newId();
    await db.insert(schema.notificationConfigs).values({
      id: configId,
      agentId,
      emailAddresses: JSON.stringify(["dev@example.com"]),
      approvalTimeoutSeconds: 3600,
    });

    delete process.env.RESEND_API_KEY;

    await expect(
      dispatchHoldNotification({
        approvalId: approvalNoCtx,
        agentId,
        action: "charge",
        amount: "50.00",
        currency: "usd",
      })
    ).resolves.toBeUndefined();
  });
});

// ─── Approve — Re-execution ───────────────────────────────────────────────────

describe("approve re-execution", () => {
  test("404 for unknown approval", async () => {
    const res = await req("POST", `/v1/approvals/nonexistent-id/approve`);
    expect(res.status).toBe(404);
  });

  test("409 when approval is already rejected", async () => {
    const res = await req("POST", `/v1/approvals/${approvalPreRejected}/approve`);
    expect(res.status).toBe(409);
  });

  test("approve with no audit log context → status stays 'approved'", async () => {
    const res = await req("POST", `/v1/approvals/${approvalNoCtx}/approve`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("approved");

    const [row] = await db
      .select({ status: schema.approvals.status })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalNoCtx))
      .limit(1);
    expect(row.status).toBe("approved");
  });

  test("409 when trying to approve an already-approved approval", async () => {
    const res = await req("POST", `/v1/approvals/${approvalNoCtx}/approve`);
    expect(res.status).toBe(409);
  });

  test("approve with audit log context → connector not found → 'execution_failed'", async () => {
    const res = await req("POST", `/v1/approvals/${approvalWithCtx}/approve`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string; error?: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("execution_failed");
    expect(body.error).toContain("not found");

    const [row] = await db
      .select({ status: schema.approvals.status })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalWithCtx))
      .limit(1);
    expect(row.status).toBe("execution_failed");
  });

  test("approve leaves a DENY audit log entry on execution failure", async () => {
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.approvalId, approvalWithCtx));

    // Original HOLD log + new DENY log from re-execution
    expect(logs.length).toBe(2);
    const reExecLog = logs.find((l) => l.outcome === "DENY");
    expect(reExecLog).toBeDefined();
    expect(reExecLog!.denyRule).toBe("execution_error_after_approval");
  });

  test("reject writes reason and sets status", async () => {
    const res = await req("POST", `/v1/approvals/${approvalFuture}/reject`, {
      reason: "Amount too large for this vendor",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.status).toBe("rejected");

    const [row] = await db
      .select({ status: schema.approvals.status, rejectionReason: schema.approvals.rejectionReason })
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalFuture))
      .limit(1);
    expect(row.status).toBe("rejected");
    expect(row.rejectionReason).toBe("Amount too large for this vendor");
  });
});
