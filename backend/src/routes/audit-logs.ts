import { Hono } from "hono";
import { eq, and, lt, desc, gte, lte } from "drizzle-orm";
import { db } from "../db/connector";
import { auditLogs } from "../db/schema";
import { jwtAuth } from "../middleware/auth";

const router = new Hono();
router.use("*", jwtAuth);

// GET /v1/audit-logs?agentId=&outcome=&from=&to=&limit=50&cursor=
router.get("/", async (c) => {
  const { userId } = c.get("user");
  const {
    agentId,
    outcome,
    from: fromStr,
    to: toStr,
    limit: limitStr = "50",
    cursor,
  } = c.req.query();

  const limit = Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 200);

  const conditions = [eq(auditLogs.userId, userId)];

  if (agentId) conditions.push(eq(auditLogs.agentId, agentId));
  if (outcome && ["ALLOW", "DENY", "HOLD"].includes(outcome))
    conditions.push(eq(auditLogs.outcome, outcome as "ALLOW" | "DENY" | "HOLD"));

  if (fromStr) {
    const d = new Date(fromStr);
    if (!isNaN(d.getTime())) conditions.push(gte(auditLogs.createdAt, d));
  }
  if (toStr) {
    const d = new Date(toStr);
    if (!isNaN(d.getTime())) conditions.push(lte(auditLogs.createdAt, d));
  }
  if (cursor) {
    const d = new Date(parseInt(cursor, 10) * 1000);
    if (!isNaN(d.getTime())) conditions.push(lt(auditLogs.createdAt, d));
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastCreatedAt = items.at(-1)?.createdAt;
  const nextCursor = hasMore && lastCreatedAt
    ? Math.floor(lastCreatedAt.getTime() / 1000).toString()
    : null;

  return c.json({ items, nextCursor });
});

export default router;
