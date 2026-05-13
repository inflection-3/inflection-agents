import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc, SQL } from "drizzle-orm";
import { db } from "../db/connector";
import { approvals, auditLogs } from "../db/schema";
import { jwtAuth, apiKeyAuth } from "../middleware/auth";
import { newId } from "../lib/auth";
import { ConnectorExecutor } from "../connectors/executor";
import { writeAuditLog, flushAuditLogSync } from "../audit-log";
import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";

const router = new Hono();

// ─── Combined auth: tries JWT (dashboard) then falls back to API key (SDK) ───

const combinedAuth = createMiddleware(async (c: Context, next: Next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }
  const token = header.slice(7);

  // API keys start with infl_live_ or infl_test_
  if (token.startsWith("infl_")) {
    try {
      await apiKeyAuth(c, async () => {
        await next();
      });
      return;
    } catch {
      // fall through to JWT
    }
  }

  try {
    await jwtAuth(c, async () => {
      await next();
    });
    return;
  } catch {
    throw new HTTPException(401, { message: "Invalid authentication" });
  }
});

function authFilter(c: Context): SQL {
  const user = c.get("user");
  const apiKeyCtx = c.get("apiKeyCtx");
  if (user) return eq(approvals.userId, user.userId);
  if (apiKeyCtx) return eq(approvals.agentId, apiKeyCtx.agentId);
  throw new HTTPException(401, { message: "Unauthorized" });
}

// GET /v1/approvals?status=pending&agentId=
router.get("/", combinedAuth, async (c) => {
  const { status, agentId } = c.req.query();

  const VALID_STATUSES = ["pending", "approved", "rejected", "expired", "executed", "execution_failed"];

  const conditions = [authFilter(c)];
  if (status) {
    if (!VALID_STATUSES.includes(status))
      throw new HTTPException(400, { message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    conditions.push(eq(approvals.status, status as any));
  }
  if (agentId) conditions.push(eq(approvals.agentId, agentId));

  const rows = await db
    .select()
    .from(approvals)
    .where(and(...conditions))
    .orderBy(desc(approvals.createdAt));

  return c.json(rows);
});

router.get("/:id", combinedAuth, async (c) => {
  const { id } = c.req.param();
  if (!id) throw new HTTPException(400, { message: "Missing approval id" });

  const [row] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), authFilter(c)))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Approval not found" });
  return c.json(row);
});

router.post("/:id/approve", jwtAuth, async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();
  if (!id) throw new HTTPException(400, { message: "Missing approval id" });

  const [row] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Approval not found" });
  if (row.status !== "pending")
    throw new HTTPException(409, { message: `Approval is already ${row.status}` });
  if (row.expiresAt < new Date())
    throw new HTTPException(410, { message: "Approval has expired" });

  await db.update(approvals).set({
    status: "approved",
    approvedBy: userId,
    resolvedAt: new Date(),
  }).where(eq(approvals.id, id));

  // Look up original execution context from the triggering audit log
  const [log] = await db
    .select({
      connectorId: auditLogs.connectorId,
      action: auditLogs.action,
      rail: auditLogs.rail,
    })
    .from(auditLogs)
    .where(eq(auditLogs.approvalId, id))
    .limit(1);

  if (!log?.connectorId) {
    // No context to re-execute — approval recorded, connector is gone or log is missing
    return c.json({ ok: true, status: "approved" });
  }

  // Re-execute the original request with a fresh idempotency key
  const args = JSON.parse(row.argsSnapshot) as Record<string, unknown>;

  let execStatus: "executed" | "execution_failed" = "executed";
  let providerTxId: string | undefined;
  let execError: string | undefined;

  try {
    const result = await ConnectorExecutor.execute(log.connectorId, {
      action: log.action,
      args,
      idempotencyKey: newId(),
    });
    providerTxId = result.providerTxId;
  } catch (err) {
    execStatus = "execution_failed";
    execError = (err as Error).message;
  }

  await db.update(approvals).set({ status: execStatus }).where(eq(approvals.id, id));

  await writeAuditLog({
    id: newId(),
    agentId: row.agentId,
    userId: row.userId,
    connectorId: log.connectorId,
    rail: log.rail,
    action: log.action,
    outcome: execStatus === "executed" ? "ALLOW" : "DENY",
    denyRule: execStatus === "execution_failed" ? "execution_error_after_approval" : undefined,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    approvalId: id,
    providerTxId,
  });
  await flushAuditLogSync();

  return c.json({ ok: true, status: execStatus, providerTxId, error: execError });
});

router.post("/:id/reject", jwtAuth, async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();
  if (!id) throw new HTTPException(400, { message: "Missing approval id" });
  const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));

  const [row] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Approval not found" });
  if (row.status !== "pending")
    throw new HTTPException(409, { message: `Approval is already ${row.status}` });

  await db.update(approvals).set({
    status: "rejected",
    rejectionReason: reason ?? null,
    resolvedAt: new Date(),
  }).where(eq(approvals.id, id));

  return c.json({ ok: true, status: "rejected" });
});

export default router;
