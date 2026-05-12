import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/connector";
import { agents, agentApiKeys } from "../db/schema";
import { jwtAuth } from "../middleware/auth";
import { newId, generateApiKey, hashApiKey } from "../lib/auth";

const router = new Hono();
router.use("*", jwtAuth);

router.get("/:agentId/api-keys", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const rows = await db
    .select({
      id: agentApiKeys.id,
      agentId: agentApiKeys.agentId,
      keyPrefix: agentApiKeys.keyPrefix,
      mode: agentApiKeys.mode,
      status: agentApiKeys.status,
      lastUsedAt: agentApiKeys.lastUsedAt,
      createdAt: agentApiKeys.createdAt,
    })
    .from(agentApiKeys)
    .where(eq(agentApiKeys.agentId, agentId))
    .orderBy(desc(agentApiKeys.createdAt));

  return c.json(rows);
});

router.post("/:agentId/api-keys", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();
  const body = await c.req.json<{ mode?: "live" | "test" }>().catch(() => ({})) as { mode?: string };
  const mode = body.mode ?? "test";

  if (!["live", "test"].includes(mode))
    throw new HTTPException(400, { message: "mode must be live or test" });

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const { rawKey, prefix } = generateApiKey(mode as "live" | "test");
  const keyHash = await hashApiKey(rawKey);
  const id = newId();

  await db.insert(agentApiKeys).values({
    id,
    agentId,
    keyHash,
    keyPrefix: prefix,
    mode: mode as "live" | "test",
    status: "active",
  });

  return c.json({ id, agentId, keyPrefix: prefix, mode, rawKey }, 201);
});

router.delete("/:agentId/api-keys/:keyId", async (c) => {
  const { userId } = c.get("user");
  const { agentId, keyId } = c.req.param();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const [key] = await db
    .select({ id: agentApiKeys.id })
    .from(agentApiKeys)
    .where(and(eq(agentApiKeys.id, keyId), eq(agentApiKeys.agentId, agentId)))
    .limit(1);
  if (!key) throw new HTTPException(404, { message: "API key not found" });

  await db.update(agentApiKeys).set({ status: "revoked" }).where(eq(agentApiKeys.id, keyId));
  return c.json({ ok: true });
});

export default router;
