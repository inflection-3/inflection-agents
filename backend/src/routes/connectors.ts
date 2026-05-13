import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "../db/connector";
import { agents, connectors } from "../db/schema";
import { jwtAuth } from "../middleware/auth";
import { newId } from "../lib/auth";
import { encryptCredentials } from "../connectors/encryption";
import { invalidateConnectorCache } from "../connectors/executor";
import type { Rail } from "../policy-engine";

const RAILS = ["stripe", "circle", "x402", "square", "braintree", "razorpay"] as const;
const AUTH_TYPES = ["oauth", "api_key", "wallet"] as const;

const SELECTED_COLS = {
  id: connectors.id,
  agentId: connectors.agentId,
  userId: connectors.userId,
  rail: connectors.rail,
  authType: connectors.authType,
  maskedCredential: connectors.maskedCredential,
  status: connectors.status,
  createdAt: connectors.createdAt,
  updatedAt: connectors.updatedAt,
} as const;

const router = new Hono();
router.use("*", jwtAuth);

router.get("/", async (c) => {
  const { userId } = c.get("user");
  const rows = await db
    .select(SELECTED_COLS)
    .from(connectors)
    .where(and(eq(connectors.userId, userId), ne(connectors.status, "revoked")))
    .orderBy(desc(connectors.createdAt));
  return c.json(rows);
});

router.post("/", async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json<{
    agentId: string;
    rail: string;
    authType: string;
    credentials: Record<string, string>;
  }>();

  const { agentId, rail, authType, credentials } = body;
  if (!agentId || !rail || !authType || !credentials)
    throw new HTTPException(400, { message: "agentId, rail, authType, and credentials are required" });

  if (!RAILS.includes(rail as Rail))
    throw new HTTPException(400, { message: `rail must be one of: ${RAILS.join(", ")}` });
  if (!AUTH_TYPES.includes(authType as (typeof AUTH_TYPES)[number]))
    throw new HTTPException(400, { message: `authType must be one of: ${AUTH_TYPES.join(", ")}` });

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.developerId, userId)))
    .limit(1);
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });

  const { ciphertext, iv, keyId } = await encryptCredentials(credentials);

  const firstVal = String(Object.values(credentials)[0] ?? "");
  const maskedCredential = firstVal.length > 8
    ? `${firstVal.slice(0, 8)}****`
    : `${firstVal.slice(0, 4)}****`;

  // Check if a connector already exists for this (agent, rail, user) combo
  const [existing] = await db
    .select({ id: connectors.id, status: connectors.status })
    .from(connectors)
    .where(and(eq(connectors.agentId, agentId), eq(connectors.rail, rail as Rail), eq(connectors.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      throw new HTTPException(409, { message: `A ${rail} connector is already active for this agent. Revoke it first before reconnecting.` });
    }
    // Re-activate with new credentials
    await db.update(connectors).set({
      authType: authType as (typeof AUTH_TYPES)[number],
      credentialsEncrypted: ciphertext,
      credentialsIv: iv,
      credentialsKeyId: keyId,
      maskedCredential,
      status: "active",
      updatedAt: new Date(),
    }).where(eq(connectors.id, existing.id));
    invalidateConnectorCache(existing.id);

    const [row] = await db.select(SELECTED_COLS).from(connectors).where(eq(connectors.id, existing.id)).limit(1);
    return c.json(row, 200);
  }

  const id = newId();
  await db.insert(connectors).values({
    id,
    agentId,
    userId,
    rail: rail as Rail,
    authType: authType as (typeof AUTH_TYPES)[number],
    credentialsEncrypted: ciphertext,
    credentialsIv: iv,
    credentialsKeyId: keyId,
    maskedCredential,
    status: "active",
  });

  const [row] = await db.select(SELECTED_COLS).from(connectors).where(eq(connectors.id, id)).limit(1);
  return c.json(row, 201);
});

router.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

  const [row] = await db
    .select(SELECTED_COLS)
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
    .limit(1);

  if (!row) throw new HTTPException(404, { message: "Connector not found" });
  return c.json(row);
});

router.patch("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();
  const { status } = await c.req.json<{ status?: "active" | "revoked" | "error" }>();

  const [existing] = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "Connector not found" });

  if (status && !["active", "revoked", "error"].includes(status))
    throw new HTTPException(400, { message: "Invalid status" });

  await db.update(connectors).set({
    ...(status && { status }),
    updatedAt: new Date(),
  }).where(eq(connectors.id, id));

  if (status) invalidateConnectorCache(id);

  const [row] = await db.select(SELECTED_COLS).from(connectors).where(eq(connectors.id, id)).limit(1);
  return c.json(row);
});

router.delete("/:id", async (c) => {
  const { userId } = c.get("user");
  const { id } = c.req.param();

  const [existing] = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.userId, userId)))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: "Connector not found" });

  await db.update(connectors).set({ status: "revoked", updatedAt: new Date() }).where(eq(connectors.id, id));
  invalidateConnectorCache(id);
  return c.json({ ok: true });
});

export default router;
