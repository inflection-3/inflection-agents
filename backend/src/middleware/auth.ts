import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken, verifyApiKey } from "../lib/auth";
import { db } from "../db/connector";
import { users, agentApiKeys, agents } from "../db/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export interface ApiKeyContext {
  agentId: string;
  developerId: string;
  mode: "live" | "test";
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    apiKeyCtx: ApiKeyContext;
  }
}

// ─── JWT bearer auth (dashboard routes) ─────────────────────────────────────

export const jwtAuth = createMiddleware(async (c: Context, next: Next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }
  const token = header.slice(7);

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  // Check revocation version matches DB
  const [row] = await db
    .select({ rev: users.jwtRevocationVersion, role: users.role, email: users.email })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!row || row.rev !== payload.rev) {
    throw new HTTPException(401, { message: "Token revoked" });
  }

  c.set("user", { userId: payload.sub, email: row.email, role: row.role });
  await next();
});

// ─── API key auth (/v1/execute) ───────────────────────────────────────────────

// Simple in-process cache: keyHash → { agentId, developerId, mode, exp }
const apiKeyCache = new Map<string, { ctx: ApiKeyContext; exp: number }>();

export const apiKeyAuth = createMiddleware(async (c: Context, next: Next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing API key" });
  }
  const rawKey = header.slice(7);

  // Cache lookup by raw key prefix (fast path)
  const cacheEntry = apiKeyCache.get(rawKey);
  if (cacheEntry && cacheEntry.exp > Date.now()) {
    c.set("apiKeyCtx", cacheEntry.ctx);
    await next();
    return;
  }

  // Load all active keys for this prefix and verify hash
  const prefix = rawKey.slice(0, 16);
  const rows = await db
    .select({
      id: agentApiKeys.id,
      agentId: agentApiKeys.agentId,
      keyHash: agentApiKeys.keyHash,
      mode: agentApiKeys.mode,
      developerId: agents.developerId,
    })
    .from(agentApiKeys)
    .innerJoin(agents, eq(agentApiKeys.agentId, agents.id))
    .where(
      and(
        eq(agentApiKeys.keyPrefix, prefix),
        eq(agentApiKeys.status, "active")
      )
    );

  for (const row of rows) {
    const valid = await verifyApiKey(row.keyHash, rawKey);
    if (valid) {
      const ctx: ApiKeyContext = {
        agentId: row.agentId,
        developerId: row.developerId,
        mode: row.mode as "live" | "test",
      };
      apiKeyCache.set(rawKey, { ctx, exp: Date.now() + 60_000 });
      c.set("apiKeyCtx", ctx);
      await next();
      return;
    }
  }

  throw new HTTPException(401, { message: "Invalid API key" });
});

// ─── RBAC ─────────────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }
    await next();
  });
}
