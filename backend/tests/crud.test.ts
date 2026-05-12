/**
 * Phase 6 — CRUD API Route tests.
 * Covers: agents, api-keys, connectors, policies, audit-logs, approvals.
 * Uses the real Hono app with a temp SQLite DB.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import app from "../src/routes";
import * as schema from "../src/db/schema";
import { hashPassword, signAccessToken, newId } from "../src/lib/auth";

// ─── Test DB setup ────────────────────────────────────────────────────────────

const TEST_DB_PATH = `./test-crud-${Date.now()}.db`;
process.env.DATABASE_URL = TEST_DB_PATH;
process.env.CREDENTIALS_ENCRYPTION_KEY = "b".repeat(64);

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
let agentId: string;    // pre-seeded agent for shared use
let connectorId: string; // pre-seeded connector for policies/approvals

beforeAll(async () => {
  applyMigrations();

  userId = `user-crud-${RUN}`;
  const passwordHash = await hashPassword("test-password");

  await db.insert(schema.users).values({
    id: userId,
    email: `crud-${RUN}@inflection.dev`,
    passwordHash,
    role: "developer",
  });

  token = await signAccessToken({
    sub: userId,
    email: `crud-${RUN}@inflection.dev`,
    role: "developer",
    rev: 0,
  });

  // Pre-seed agent and connector so audit-logs / approvals seeding can reference them
  agentId = newId();
  await db.insert(schema.agents).values({
    id: agentId,
    developerId: userId,
    name: `Seed Agent ${RUN}`,
    status: "active",
  });

  connectorId = newId();
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

  // Seed audit logs
  await db.insert(schema.auditLogs).values([
    {
      id: newId(), agentId, userId, rail: "stripe", action: "charges.create",
      outcome: "ALLOW", amount: "10.00", currency: "usd",
      prevHash: "0".repeat(64), rowHash: "a".repeat(64),
    },
    {
      id: newId(), agentId, userId, rail: "stripe", action: "charges.create",
      outcome: "DENY", denyRule: "max_per_transaction",
      prevHash: "a".repeat(64), rowHash: "b".repeat(64),
    },
  ]);

  // Seed approvals
  const expiresAt = new Date(Date.now() + 3_600_000);
  await db.insert(schema.approvals).values([
    {
      id: `apr-approve-${RUN}`, agentId, userId,
      argsSnapshot: JSON.stringify({ amount: 100 }),
      amount: "100", currency: "usd", status: "pending", expiresAt,
    },
    {
      id: `apr-reject-${RUN}`, agentId, userId,
      argsSnapshot: JSON.stringify({ amount: 200 }),
      amount: "200", currency: "usd", status: "pending", expiresAt,
    },
  ]);
});

afterAll(() => {
  try { rmSync(TEST_DB_PATH); } catch {}
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function req(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

// ─── Agents ───────────────────────────────────────────────────────────────────

describe("agents", () => {
  let createdAgentId: string;

  test("POST /v1/agents creates an agent", async () => {
    const res = await req("POST", "/v1/agents", { name: `API Agent ${RUN}`, description: "test" });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; name: string };
    expect(body.name).toBe(`API Agent ${RUN}`);
    createdAgentId = body.id;
  });

  test("GET /v1/agents lists agents (includes seeded + created)", async () => {
    const res = await req("GET", "/v1/agents");
    expect(res.status).toBe(200);
    const rows = await res.json() as { id: string }[];
    expect(rows.some((r) => r.id === agentId)).toBe(true);
  });

  test("GET /v1/agents/:id returns single agent", async () => {
    const res = await req("GET", `/v1/agents/${agentId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(agentId);
  });

  test("PATCH /v1/agents/:id updates agent", async () => {
    const res = await req("PATCH", `/v1/agents/${agentId}`, { description: "updated" });
    expect(res.status).toBe(200);
    const body = await res.json() as { description: string };
    expect(body.description).toBe("updated");
  });

  test("DELETE /v1/agents/:id soft-deletes", async () => {
    const res = await req("DELETE", `/v1/agents/${createdAgentId}`);
    expect(res.status).toBe(200);
    const check = await req("GET", `/v1/agents/${createdAgentId}`);
    expect(check.status).toBe(404);
  });

  test("GET /v1/agents/:id returns 404 for unknown agent", async () => {
    const res = await req("GET", "/v1/agents/nonexistent");
    expect(res.status).toBe(404);
  });

  test("401 without token", async () => {
    const res = await app.request("/v1/agents", { method: "GET" });
    expect(res.status).toBe(401);
  });
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

describe("api-keys", () => {
  let keyId: string;

  test("POST creates an API key and returns rawKey once", async () => {
    const res = await req("POST", `/v1/agents/${agentId}/api-keys`, { mode: "test" });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; rawKey: string; mode: string };
    expect(body.rawKey).toMatch(/^infl_test_/);
    expect(body.mode).toBe("test");
    keyId = body.id;
  });

  test("GET lists API keys without rawKey field", async () => {
    const res = await req("GET", `/v1/agents/${agentId}/api-keys`);
    expect(res.status).toBe(200);
    const rows = await res.json() as { id: string; rawKey?: string }[];
    const found = rows.find((r) => r.id === keyId);
    expect(found).toBeDefined();
    expect(found!.rawKey).toBeUndefined();
  });

  test("DELETE revokes API key", async () => {
    const res = await req("DELETE", `/v1/agents/${agentId}/api-keys/${keyId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("DELETE returns 404 for unknown key", async () => {
    const res = await req("DELETE", `/v1/agents/${agentId}/api-keys/nope`);
    expect(res.status).toBe(404);
  });
});

// ─── Connectors ───────────────────────────────────────────────────────────────

describe("connectors", () => {
  let apiConnectorId: string;

  test("POST /v1/connectors creates a connector with encrypted creds", async () => {
    const res = await req("POST", "/v1/connectors", {
      agentId,
      rail: "circle",
      authType: "api_key",
      credentials: { api_key: "circle_test_fake123" },
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; rail: string; maskedCredential: string };
    expect(body.rail).toBe("circle");
    expect(body.maskedCredential).not.toContain("fake123");
    apiConnectorId = body.id;
  });

  test("GET /v1/connectors lists connectors", async () => {
    const res = await req("GET", "/v1/connectors");
    expect(res.status).toBe(200);
    const rows = await res.json() as { id: string }[];
    expect(rows.some((r) => r.id === connectorId)).toBe(true);
  });

  test("GET /v1/connectors/:id returns connector without raw credentials", async () => {
    const res = await req("GET", `/v1/connectors/${connectorId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; credentialsEncrypted?: unknown };
    expect(body.id).toBe(connectorId);
    expect(body.credentialsEncrypted).toBeUndefined();
  });

  test("PATCH /v1/connectors/:id updates status", async () => {
    const res = await req("PATCH", `/v1/connectors/${apiConnectorId}`, { status: "revoked" });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("revoked");
  });

  test("POST rejects invalid rail", async () => {
    const res = await req("POST", "/v1/connectors", {
      agentId,
      rail: "paypal",
      authType: "api_key",
      credentials: { api_key: "tok" },
    });
    expect(res.status).toBe(400);
  });
});

// ─── Policies ─────────────────────────────────────────────────────────────────

describe("policies", () => {
  test("POST agent policy creates v1", async () => {
    const res = await req("POST", `/v1/agents/${agentId}/policies`, {
      rules: { maxDailySpend: { amount: "1000", currency: "usd" } },
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { version: number; rules: object };
    expect(body.version).toBe(1);
  });

  test("POST agent policy creates v2", async () => {
    const res = await req("POST", `/v1/agents/${agentId}/policies`, {
      rules: { maxDailySpend: { amount: "2000", currency: "usd" } },
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(2);
  });

  test("GET agent policies lists all versions descending", async () => {
    const res = await req("GET", `/v1/agents/${agentId}/policies`);
    expect(res.status).toBe(200);
    const rows = await res.json() as { version: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]!.version).toBeGreaterThan(rows[1]!.version);
  });

  test("POST connector policy creates v1", async () => {
    const res = await req("POST", `/v1/connectors/${connectorId}/policies`, {
      rules: { allowedActions: ["charges.create"] },
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(1);
  });

  test("GET connector policies returns list", async () => {
    const res = await req("GET", `/v1/connectors/${connectorId}/policies`);
    expect(res.status).toBe(200);
    const rows = await res.json() as { version: number; rules: object }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(typeof rows[0]!.rules).toBe("object"); // parsed from JSON
  });

  test("POST agent policy returns 404 for unknown agent", async () => {
    const res = await req("POST", "/v1/agents/nope/policies", { rules: {} });
    expect(res.status).toBe(404);
  });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

describe("audit-logs", () => {
  test("GET /v1/audit-logs returns paginated results", async () => {
    const res = await req("GET", "/v1/audit-logs");
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect("nextCursor" in body).toBe(true);
  });

  test("GET /v1/audit-logs?outcome=ALLOW filters correctly", async () => {
    const res = await req("GET", "/v1/audit-logs?outcome=ALLOW");
    const body = await res.json() as { items: { outcome: string }[] };
    expect(body.items.every((r) => r.outcome === "ALLOW")).toBe(true);
  });

  test("GET /v1/audit-logs?agentId= filters by agent", async () => {
    const res = await req("GET", `/v1/audit-logs?agentId=${agentId}`);
    const body = await res.json() as { items: { agentId: string }[] };
    expect(body.items.every((r) => r.agentId === agentId)).toBe(true);
  });

  test("GET /v1/audit-logs respects limit param", async () => {
    const res = await req("GET", "/v1/audit-logs?limit=1");
    const body = await res.json() as { items: unknown[]; nextCursor: string | null };
    expect(body.items.length).toBeLessThanOrEqual(1);
  });
});

// ─── Approvals ────────────────────────────────────────────────────────────────

describe("approvals", () => {
  const approveId = `apr-approve-${RUN}`;
  const rejectId = `apr-reject-${RUN}`;

  test("GET /v1/approvals lists approvals", async () => {
    const res = await req("GET", "/v1/approvals");
    expect(res.status).toBe(200);
    const rows = await res.json() as { id: string }[];
    expect(rows.some((r) => r.id === approveId)).toBe(true);
  });

  test("GET /v1/approvals?status=pending filters correctly", async () => {
    const res = await req("GET", "/v1/approvals?status=pending");
    const rows = await res.json() as { status: string }[];
    expect(rows.every((r) => r.status === "pending")).toBe(true);
  });

  test("GET /v1/approvals/:id returns single approval", async () => {
    const res = await req("GET", `/v1/approvals/${approveId}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; status: string };
    expect(body.id).toBe(approveId);
    expect(body.status).toBe("pending");
  });

  test("POST /v1/approvals/:id/approve sets status to approved", async () => {
    const res = await req("POST", `/v1/approvals/${approveId}/approve`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("approved");
  });

  test("POST /v1/approvals/:id/approve returns 409 when already approved", async () => {
    const res = await req("POST", `/v1/approvals/${approveId}/approve`);
    expect(res.status).toBe(409);
  });

  test("POST /v1/approvals/:id/reject sets status to rejected with reason", async () => {
    const res = await req("POST", `/v1/approvals/${rejectId}/reject`, {
      reason: "amount too large",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.status).toBe("rejected");
  });

  test("POST /v1/approvals/:id/reject returns 409 when already resolved", async () => {
    const res = await req("POST", `/v1/approvals/${rejectId}/reject`);
    expect(res.status).toBe(409);
  });

  test("GET /v1/approvals/:id returns 404 for unknown approval", async () => {
    const res = await req("GET", "/v1/approvals/nope");
    expect(res.status).toBe(404);
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────

describe("notifications", () => {
  test("PUT /v1/agents/:agentId/notifications upserts config", async () => {
    const res = await req("PUT", `/v1/agents/${agentId}/notifications`, {
      emailAddresses: ["ops@example.com"],
      approvalTimeoutSeconds: 1800,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { emailAddresses: string; approvalTimeoutSeconds: number };
    expect(body.approvalTimeoutSeconds).toBe(1800);
  });

  test("GET /v1/agents/:agentId/notifications returns config", async () => {
    const res = await req("GET", `/v1/agents/${agentId}/notifications`);
    expect(res.status).toBe(200);
    const body = await res.json() as { approvalTimeoutSeconds: number };
    expect(body.approvalTimeoutSeconds).toBe(1800);
  });

  test("PUT again updates existing config", async () => {
    const res = await req("PUT", `/v1/agents/${agentId}/notifications`, {
      approvalTimeoutSeconds: 900,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { approvalTimeoutSeconds: number };
    expect(body.approvalTimeoutSeconds).toBe(900);
  });
});
