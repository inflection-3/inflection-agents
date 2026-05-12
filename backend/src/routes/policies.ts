import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/connector";
import { agents, connectors, agentPolicies, connectorPolicies } from "../db/schema";
import { jwtAuth } from "../middleware/auth";
import { newId } from "../lib/auth";
import { policyCache } from "../policy-engine";

const router = new Hono();
router.use("*", jwtAuth);

// ─── Agent Policies ───────────────────────────────────────────────────────────

router.get("/agents/:agentId/policies", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const rows = await db
    .select()
    .from(agentPolicies)
    .where(eq(agentPolicies.agentId, agentId))
    .orderBy(desc(agentPolicies.version));

  return c.json(rows.map((r) => ({ ...r, rules: JSON.parse(r.rules) })));
});

router.post("/agents/:agentId/policies", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();
  const { rules } = await c.req.json<{ rules: Record<string, unknown> }>();

  if (!rules) throw new HTTPException(400, { message: "rules is required" });

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const [lastRow] = await db
    .select({ version: agentPolicies.version })
    .from(agentPolicies)
    .where(eq(agentPolicies.agentId, agentId))
    .orderBy(desc(agentPolicies.version))
    .limit(1);

  const version = (lastRow?.version ?? 0) + 1;
  const id = newId();

  await db.insert(agentPolicies).values({
    id,
    agentId,
    userId,
    version,
    rules: JSON.stringify(rules),
    createdBy: userId,
  });

  policyCache.delete(`ap:${agentId}:${userId}`);

  return c.json({ id, agentId, userId, version, rules }, 201);
});

// ─── Connector Policies ───────────────────────────────────────────────────────

router.get("/connectors/:connectorId/policies", async (c) => {
  const { userId } = c.get("user");
  const { connectorId } = c.req.param();

  const [conn] = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, connectorId), eq(connectors.userId, userId)))
    .limit(1);
  if (!conn) throw new HTTPException(404, { message: "Connector not found" });

  const rows = await db
    .select()
    .from(connectorPolicies)
    .where(eq(connectorPolicies.connectorId, connectorId))
    .orderBy(desc(connectorPolicies.version));

  return c.json(rows.map((r) => ({ ...r, rules: JSON.parse(r.rules) })));
});

router.post("/connectors/:connectorId/policies", async (c) => {
  const { userId } = c.get("user");
  const { connectorId } = c.req.param();
  const { rules } = await c.req.json<{ rules: Record<string, unknown> }>();

  if (!rules) throw new HTTPException(400, { message: "rules is required" });

  const [conn] = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, connectorId), eq(connectors.userId, userId)))
    .limit(1);
  if (!conn) throw new HTTPException(404, { message: "Connector not found" });

  const [lastRow] = await db
    .select({ version: connectorPolicies.version })
    .from(connectorPolicies)
    .where(eq(connectorPolicies.connectorId, connectorId))
    .orderBy(desc(connectorPolicies.version))
    .limit(1);

  const version = (lastRow?.version ?? 0) + 1;
  const id = newId();

  await db.insert(connectorPolicies).values({
    id,
    connectorId,
    userId,
    version,
    rules: JSON.stringify(rules),
    createdBy: userId,
  });

  policyCache.delete(`cp:${connectorId}`);

  return c.json({ id, connectorId, userId, version, rules }, 201);
});

export default router;
