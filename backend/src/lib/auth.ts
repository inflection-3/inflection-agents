import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify, generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import { randomBytes } from "crypto";

// ─── Argon2id ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return verify(hash, password);
}

// ─── JWT RS256 ───────────────────────────────────────────────────────────────

export interface JwtKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

let _keys: JwtKeyPair | null = null;

export async function getJwtKeys(): Promise<JwtKeyPair> {
  if (_keys) return _keys;
  // In production: load from env/KMS. In dev: generate on startup.
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  _keys = { privateKey, publicKey };
  return _keys;
}

export interface AccessTokenPayload {
  sub: string;       // userId
  email: string;
  role: string;
  rev: number;       // jwtRevocationVersion — must match DB
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  rev: number;
  type: "refresh";
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">
): Promise<string> {
  const { privateKey } = await getJwtKeys();
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "type">
): Promise<string> {
  const { privateKey } = await getJwtKeys();
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(privateKey);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { publicKey } = await getJwtKeys();
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });
  if (payload.type !== "access") throw new Error("not an access token");
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { publicKey } = await getJwtKeys();
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });
  if (payload.type !== "refresh") throw new Error("not a refresh token");
  return payload as unknown as RefreshTokenPayload;
}

// ─── API key generation ───────────────────────────────────────────────────────

const PREFIX = {
  live: "infl_live_",
  test: "infl_test_",
} as const;

export function generateApiKey(mode: "live" | "test"): {
  rawKey: string;
  prefix: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const rawKey = `${PREFIX[mode]}${secret}`;
  const prefix = rawKey.slice(0, 16);
  return { rawKey, prefix };
}

export async function hashApiKey(rawKey: string): Promise<string> {
  return hash(rawKey, {
    algorithm: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyApiKey(storedHash: string, rawKey: string): Promise<boolean> {
  return verify(storedHash, rawKey);
}

// ─── Nano ID ─────────────────────────────────────────────────────────────────

export function newId(): string {
  return randomBytes(16).toString("hex");
}
