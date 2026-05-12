import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/connector";
import { approvals } from "../db/schema";
import { jwtAuth } from "../middleware/auth";

const router = new Hono();
router.use("*", jwtAuth);

// GET /v1/approvals?status=pending&agentId=
router.get("/", async (c) => {
  const { userId } = c.get("user");
  const { status, agentId } = c.req.query();

  const VALID_STATUSES = ["pending", "approved", "rejected", "expired", "executed", "execution_failed"];

  const conditions = [eq(approvals.userId, userId)];
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

router.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

  const [row] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Approval not found" });
  return c.json(row);
});

router.post("/:id/approve", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

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

  return c.json({ ok: true, status: "approved" });
});

router.post("/:id/reject", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();
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
