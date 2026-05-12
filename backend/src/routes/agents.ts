import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "../db/connector";
import { agents, notificationConfigs } from "../db/schema";
import { jwtAuth } from "../middleware/auth";
import { newId } from "../lib/auth";
import { encryptCredentials } from "../connectors/encryption";

const router = new Hono();
router.use("*", jwtAuth);

// ─── Agent CRUD ───────────────────────────────────────────────────────────────

router.get("/", async (c) => {
  const { userId } = c.get("user");
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.developerId, userId), ne(agents.status, "deleted")))
    .orderBy(desc(agents.createdAt));
  return c.json(rows);
});

router.post("/", async (c) => {
  const { userId } = c.get("user");
  const { name, description, webhookUrl } = await c.req.json<{
    name: string;
    description?: string;
    webhookUrl?: string;
  }>();

  if (!name) throw new HTTPException(400, { message: "name is required" });

  const id = newId();
  await db.insert(agents).values({ id, developerId: userId, name, description, webhookUrl });

  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return c.json(row, 201);
});

router.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.developerId, userId), ne(agents.status, "deleted")))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Agent not found" });
  return c.json(row);
});

router.patch("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();
  const body = await c.req.json<{
    name?: string;
    description?: string;
    webhookUrl?: string;
    status?: "active" | "suspended";
  }>();

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.developerId, userId), ne(agents.status, "deleted")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "Agent not found" });

  if (body.status && !["active", "suspended"].includes(body.status))
    throw new HTTPException(400, { message: "status must be active or suspended" });

  await db.update(agents).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.webhookUrl !== undefined && { webhookUrl: body.webhookUrl }),
    ...(body.status !== undefined && { status: body.status }),
    updatedAt: new Date(),
  }).where(eq(agents.id, id));

  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return c.json(row);
});

router.delete("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.developerId, userId), ne(agents.status, "deleted")))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "Agent not found" });

  await db.update(agents).set({ status: "deleted", updatedAt: new Date() }).where(eq(agents.id, id));
  return c.json({ ok: true });
});

// ─── Notification config ──────────────────────────────────────────────────────

router.get("/:agentId/notifications", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const [row] = await db
    .select({
      agentId: notificationConfigs.agentId,
      emailAddresses: notificationConfigs.emailAddresses,
      approvalTimeoutSeconds: notificationConfigs.approvalTimeoutSeconds,
      updatedAt: notificationConfigs.updatedAt,
    })
    .from(notificationConfigs)
    .where(eq(notificationConfigs.agentId, agentId))
    .limit(1);

  return c.json(row ?? { agentId, emailAddresses: "[]", approvalTimeoutSeconds: 3600 });
});

router.put("/:agentId/notifications", async (c) => {
  const { userId } = c.get("user");
  const { agentId } = c.req.param();
  const body = await c.req.json<{
    emailAddresses?: string[];
    approvalTimeoutSeconds?: number;
    slackWebhookUrl?: string;
  }>();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.emailAddresses !== undefined)
    updates.emailAddresses = JSON.stringify(body.emailAddresses);
  if (body.approvalTimeoutSeconds !== undefined)
    updates.approvalTimeoutSeconds = body.approvalTimeoutSeconds;
  if (body.slackWebhookUrl) {
    const { ciphertext, iv } = await encryptCredentials({ url: body.slackWebhookUrl });
    updates.slackWebhookUrlEnc = ciphertext;
    updates.slackWebhookIv = iv;
  }

  const [existing] = await db
    .select({ agentId: notificationConfigs.agentId })
    .from(notificationConfigs)
    .where(eq(notificationConfigs.agentId, agentId))
    .limit(1);

  if (existing) {
    await db.update(notificationConfigs).set(updates as any).where(eq(notificationConfigs.agentId, agentId));
  } else {
    const insertValues: Parameters<typeof db.insert>[0] extends never ? never : {
      id: string; agentId: string; emailAddresses: string;
      approvalTimeoutSeconds: number; slackWebhookUrlEnc?: Buffer; slackWebhookIv?: string;
    } = {
      id: newId(),
      agentId,
      emailAddresses: JSON.stringify(body.emailAddresses ?? []),
      approvalTimeoutSeconds: body.approvalTimeoutSeconds ?? 3600,
    };
    if (updates.slackWebhookUrlEnc) {
      insertValues.slackWebhookUrlEnc = updates.slackWebhookUrlEnc as Buffer;
      insertValues.slackWebhookIv = updates.slackWebhookIv as string;
    }
    await db.insert(notificationConfigs).values(insertValues as any);
  }

  const [row] = await db
    .select({
      agentId: notificationConfigs.agentId,
      emailAddresses: notificationConfigs.emailAddresses,
      approvalTimeoutSeconds: notificationConfigs.approvalTimeoutSeconds,
      updatedAt: notificationConfigs.updatedAt,
    })
    .from(notificationConfigs)
    .where(eq(notificationConfigs.agentId, agentId))
    .limit(1);

  return c.json(row);
});

export default router;
