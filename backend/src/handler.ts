import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "./db/connector";
import { connectors, agentPolicies, connectorPolicies, approvals } from "./db/schema";
import { evaluate, incrementSpendCounters, policyCache } from "./policy-engine";
import type { EvaluateContext, AgentPolicyRules, ConnectorPolicyRules, Rail } from "./policy-engine";
import { ConnectorExecutor } from "./connectors/executor";
import { writeAuditLog, sanitizeArgs } from "./audit-log";
import { newId } from "./lib/auth";
import { dispatchHoldNotification } from "./notifications";

const redis = Bun.redis;
const IDEM_TTL_SECS = 86400; // 24 h

// ─── Policy loaders (cached) ──────────────────────────────────────────────────

async function loadAgentPolicy(
  agentId: string,
  userId: string
): Promise<{ id: string; rules: AgentPolicyRules } | null> {
  const cacheKey = `ap:${agentId}:${userId}`;
  const cached = policyCache.get(cacheKey) as AgentPolicyRules | undefined;
  if (cached) return { id: cacheKey, rules: cached };

  const [row] = await db
    .select({ id: agentPolicies.id, rules: agentPolicies.rules })
    .from(agentPolicies)
    .where(and(eq(agentPolicies.agentId, agentId), eq(agentPolicies.userId, userId)))
    .orderBy(desc(agentPolicies.version))
    .limit(1);

  if (!row) return null;
  const rules = JSON.parse(row.rules) as AgentPolicyRules;
  policyCache.set(cacheKey, rules, 30_000);
  return { id: row.id, rules };
}

async function loadConnectorPolicy(
  connectorId: string
): Promise<{ id: string; rules: ConnectorPolicyRules } | null> {
  const cacheKey = `cp:${connectorId}`;
  const cached = policyCache.get(cacheKey) as ConnectorPolicyRules | undefined;
  if (cached) return { id: cacheKey, rules: cached };

  const [row] = await db
    .select({ id: connectorPolicies.id, rules: connectorPolicies.rules })
    .from(connectorPolicies)
    .where(eq(connectorPolicies.connectorId, connectorId))
    .orderBy(desc(connectorPolicies.version))
    .limit(1);

  if (!row) return null;
  const rules = JSON.parse(row.rules) as ConnectorPolicyRules;
  policyCache.set(cacheKey, rules, 30_000);
  return { id: row.id, rules };
}

// ─── Request body ─────────────────────────────────────────────────────────────

interface ExecuteBody {
  rail: string;
  action: string;
  args: Record<string, unknown>;
  amount?: string;
  currency?: string;
  recipientId?: string;
  recipientCountry?: string;
  recipientEntity?: string;
  recipientDomain?: string;
  idempotencyKey: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleExecute(c: Context): Promise<Response> {
  const { agentId } = c.get("apiKeyCtx");
  const body = await c.req.json<ExecuteBody>();

  const {
    rail, action, args = {}, amount, currency,
    recipientId, recipientCountry, recipientEntity, recipientDomain,
    idempotencyKey,
  } = body;

  console.log(`[execute] agent=${agentId} rail=${rail} action=${action} amount=${amount ?? "-"} currency=${currency ?? "-"}`);

  if (!rail || !action || !idempotencyKey) {
    throw new HTTPException(400, { message: "rail, action, and idempotencyKey are required" });
  }

  const startMs = Date.now();

  // Idempotency guard
  const idemKey = `inflection:idem:${agentId}:${idempotencyKey}`;
  const prior = await redis.get(idemKey) as string | null;
  if (prior) return c.json(JSON.parse(prior));

  // Resolve active connector for this agent + rail
  const [connRow] = await db
    .select({ id: connectors.id, userId: connectors.userId })
    .from(connectors)
    .where(
      and(
        eq(connectors.agentId, agentId),
        eq(connectors.rail, rail as Rail),
        eq(connectors.status, "active")
      )
    )
    .limit(1);

  if (!connRow) {
    throw new HTTPException(404, { message: `No active ${rail} connector found for this agent` });
  }

  const { id: connectorId, userId } = connRow;

  // Load policies (parallel)
  const [agentPolicyRow, connectorPolicyRow] = await Promise.all([
    loadAgentPolicy(agentId, userId),
    loadConnectorPolicy(connectorId),
  ]);

  const ctx: EvaluateContext = {
    agentId,
    userId,
    connectorId,
    rail: rail as Rail,
    action,
    amount: amount ?? "0",
    currency: currency ?? "usd",
    recipientId,
    recipientCountry,
    recipientEntity,
    recipientDomain,
    agentPolicyId: agentPolicyRow?.id,
    connectorPolicyId: connectorPolicyRow?.id,
    agentPolicy: agentPolicyRow?.rules ?? {},
    connectorPolicy: connectorPolicyRow?.rules ?? null,
    now: new Date(),
  };

  const decision = await evaluate(ctx);
  console.log(`[execute] decision=${decision.decision}${decision.decision !== "ALLOW" ? ` rule=${decision.ruleId}` : ""}`);

  const argsHash = createHash("sha256")
    .update(JSON.stringify(sanitizeArgs(args)), "utf8")
    .digest("hex");

  // ── ALLOW ─────────────────────────────────────────────────────────────────

  if (decision.decision === "ALLOW") {
    let providerTxId: string | undefined;
    try {
      console.log(`[execute] calling connector=${connectorId} action=${action} args=${JSON.stringify(args)}`);
      const result = await ConnectorExecutor.execute(connectorId, { action, args, idempotencyKey });
      providerTxId = result.providerTxId;
      console.log(`[execute] connector ok providerTxId=${providerTxId}`);
    } catch (err) {
      console.error(`[execute] connector error: ${(err as Error).message}`);
      const durationMs = Date.now() - startMs;
      await writeAuditLog({
        id: newId(), agentId, userId, connectorId, rail, action,
        outcome: "DENY", denyRule: "execution_error",
        amount, currency, recipientId, argsHash, durationMs,
      });
      throw new HTTPException(502, { message: `Connector error: ${(err as Error).message}` });
    }

    await incrementSpendCounters(ctx);

    const durationMs = Date.now() - startMs;
    await writeAuditLog({
      id: newId(), agentId, userId, connectorId, rail, action,
      outcome: "ALLOW", amount, currency, recipientId,
      policyId: agentPolicyRow?.id, connectorPolicyId: connectorPolicyRow?.id,
      argsHash, providerTxId, durationMs,
    });

    const resp = { outcome: "ALLOW", providerTxId, durationMs };
    await redis.send("SETEX", [idemKey, String(IDEM_TTL_SECS), JSON.stringify(resp)]);
    return c.json(resp, 200);
  }

  // ── HOLD ──────────────────────────────────────────────────────────────────

  if (decision.decision === "HOLD") {
    const approvalId = newId();
    const expiresAt = new Date(Date.now() + 3_600_000); // 1 h

    await db.insert(approvals).values({
      id: approvalId,
      agentId,
      userId,
      argsSnapshot: JSON.stringify(sanitizeArgs(args)),
      amount,
      currency,
      status: "pending",
      expiresAt,
    });

    const durationMs = Date.now() - startMs;
    await writeAuditLog({
      id: newId(), agentId, userId, connectorId, rail, action,
      outcome: "HOLD", denyRule: decision.ruleId,
      amount, currency, recipientId,
      policyId: agentPolicyRow?.id, connectorPolicyId: connectorPolicyRow?.id,
      argsHash, approvalId, durationMs,
    });

    dispatchHoldNotification({
      approvalId,
      agentId,
      action,
      amount,
      currency,
      reason: decision.reason,
    }).catch((err) => console.error("[handler] notification error:", (err as Error).message));

    return c.json({ outcome: "HOLD", approvalId, reason: decision.reason }, 202);
  }

  // ── DENY ──────────────────────────────────────────────────────────────────

  const durationMs = Date.now() - startMs;
  await writeAuditLog({
    id: newId(), agentId, userId, connectorId, rail, action,
    outcome: "DENY", denyRule: decision.ruleId,
    amount, currency, recipientId,
    policyId: agentPolicyRow?.id, connectorPolicyId: connectorPolicyRow?.id,
    argsHash, durationMs,
  });

  return c.json({ outcome: "DENY", reason: decision.reason, ruleId: decision.ruleId }, 403);
}
