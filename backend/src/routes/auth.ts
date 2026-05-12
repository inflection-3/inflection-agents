import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { db } from "../db/connector";
import { users } from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newId,
} from "../lib/auth";
import { jwtAuth } from "../middleware/auth";

const app = new Hono();

// ─── POST /v1/auth/register ───────────────────────────────────────────────────

app.post(
  "/register",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
    })
  ),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTPException(409, { message: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const id = newId();

    await db.insert(users).values({
      id,
      email: email.toLowerCase(),
      passwordHash,
      role: "developer",
    });

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role, rev: users.jwtRevocationVersion })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.id, email: user.email, role: user.role, rev: user.rev }),
      signRefreshToken({ sub: user.id, rev: user.rev }),
    ]);

    return c.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } }, 201);
  }
);

// ─── POST /v1/auth/login ──────────────────────────────────────────────────────

app.post(
  "/login",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  ),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Constant-time failure path: always verify even if user not found
    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$dummydummydummy$dummydummydummydummydummydummydummy";
    const passwordOk = user
      ? await verifyPassword(user.passwordHash, password)
      : await verifyPassword(dummyHash, password).catch(() => false);

    if (!user || !passwordOk) {
      throw new HTTPException(401, { message: "Invalid email or password" });
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.id, email: user.email, role: user.role, rev: user.jwtRevocationVersion }),
      signRefreshToken({ sub: user.id, rev: user.jwtRevocationVersion }),
    ]);

    return c.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  }
);

// ─── POST /v1/auth/refresh ────────────────────────────────────────────────────

app.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      throw new HTTPException(401, { message: "Invalid or expired refresh token" });
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role, rev: users.jwtRevocationVersion })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.rev !== payload.rev) {
      throw new HTTPException(401, { message: "Refresh token revoked" });
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      rev: user.rev,
    });

    return c.json({ accessToken });
  }
);

// ─── POST /v1/auth/logout ─────────────────────────────────────────────────────
// Increments jwtRevocationVersion, invalidating all issued tokens for this user.

app.post("/logout", jwtAuth, async (c) => {
  const { userId } = c.get("user");

  const [user] = await db
    .select({ rev: users.jwtRevocationVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user) {
    await db
      .update(users)
      .set({ jwtRevocationVersion: user.rev + 1, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  return c.json({ ok: true });
});

export default app;
