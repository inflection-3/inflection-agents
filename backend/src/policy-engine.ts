// ─── Types ────────────────────────────────────────────────────────────────────

export type Rail = "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay";

export type PolicyDecisionType = "ALLOW" | "DENY" | "HOLD";

export interface PolicyDecision {
  decision: PolicyDecisionType;
  reason?: string;
  ruleId?: string;
}

export interface ScheduleWindow {
  daysOfWeek: number[];   // 0=Sun .. 6=Sat
  startHourUtc: number;   // 0-23
  endHourUtc: number;     // 0-23
  timezone?: string;
}

export interface AgentPolicyRules {
  allowedRails?: Rail[];
  blockedCountries?: string[];
  blocklist?: {
    entities?: string[];
    domains?: string[];
  };
  globalVelocityCheck?: {
    maxTransactions: number;
    windowSeconds: number;
  };
  globalDailyLimit?: { amount: string; currency: string };
  globalMonthlyLimit?: { amount: string; currency: string };
}

export interface ActionLimit {
  action: string;
  maxAmount: string;
  currency: string;
}

export interface ConnectorPolicyRules {
  allowedActions?: string[];
  actionLimits?: ActionLimit[];
  maxPerTransaction?: { amount: string; currency: string };
  blockedCountries?: string[];
  allowedCountries?: string[];
  allowedCurrencies?: string[];
  scheduleWindow?: ScheduleWindow;
  velocityCheck?: { maxTransactions: number; windowSeconds: number };
  dailyLimit?: { amount: string; currency: string };
  weeklyLimit?: { amount: string; currency: string };
  monthlyLimit?: { amount: string; currency: string };
  recipientDailyLimit?: { amount: string; currency: string };
  requireHumanApproval?: { thresholdAmount: string; currency: string };
}

export interface EvaluateContext {
  agentId: string;
  userId: string;
  connectorId: string;
  rail: Rail;
  action: string;
  amount: string;
  currency: string;
  recipientId?: string;
  recipientCountry?: string;
  recipientEntity?: string;
  recipientDomain?: string;
  agentPolicyId?: string;
  connectorPolicyId?: string;
  agentPolicy: AgentPolicyRules;
  connectorPolicy: ConnectorPolicyRules | null;
  now?: Date;
}

// ─── LRU Policy Cache ─────────────────────────────────────────────────────────

const CACHE_MAX = 10_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();

  constructor(private max: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}

export const policyCache = new LRUCache<AgentPolicyRules | ConnectorPolicyRules>(CACHE_MAX);

// ─── Redis Key Namespace ──────────────────────────────────────────────────────

export const REDIS_KEYS = {
  globalVelocity:      (agentId: string, userId: string)                  => `inflection:v:global:${agentId}:${userId}`,
  globalDailySpend:    (agentId: string, userId: string)                  => `inflection:spend:global:day:${agentId}:${userId}`,
  globalMonthlySpend:  (agentId: string, userId: string)                  => `inflection:spend:global:month:${agentId}:${userId}`,
  connectorVelocity:   (connectorId: string)                              => `inflection:v:connector:${connectorId}`,
  connectorDailySpend: (connectorId: string)                              => `inflection:spend:connector:day:${connectorId}`,
  connectorWeeklySpend:(connectorId: string)                              => `inflection:spend:connector:week:${connectorId}`,
  connectorMonthlySpend:(connectorId: string)                             => `inflection:spend:connector:month:${connectorId}`,
  recipientDailySpend: (connectorId: string, recipientId: string)         => `inflection:spend:recipient:day:${connectorId}:${recipientId}`,
  policyInvalidate:                                                           "inflection:channel:policy_invalidate",
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

function secondsUntilEndOfDay(now: Date): number {
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}

function secondsUntilEndOfWeek(now: Date): number {
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return Math.floor((nextMonday.getTime() - now.getTime()) / 1000);
}

function secondsUntilEndOfMonth(now: Date): number {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.floor((nextMonth.getTime() - now.getTime()) / 1000);
}

// ─── Lua Scripts ──────────────────────────────────────────────────────────────

// Atomically check velocity limit and add current request to the sorted set.
// Returns 1 if allowed, 0 if limit exceeded.
// KEYS[1]=zset key  ARGV[1]=now_ms  ARGV[2]=window_sec  ARGV[3]=max_tx  ARGV[4]=ttl_sec
export const VELOCITY_CHECK_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2]) * 1000
local max_tx = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window_ms)
local count = redis.call('ZCARD', key)
if count >= max_tx then
  return 0
end
redis.call('ZADD', key, now, now .. ':' .. redis.call('INCR', key .. ':seq'))
redis.call('EXPIRE', key, ttl)
return 1
`.trim();

// Read-only spend check. Returns 1 if (current + amount) <= limit, else 0.
// KEYS[1]=counter key  ARGV[1]=amount  ARGV[2]=limit
export const SPEND_CHECK_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current + tonumber(ARGV[1]) > tonumber(ARGV[2]) then
  return 0
end
return 1
`.trim();

// Increment spend counter with TTL set only if not already present.
// KEYS[1]=counter key  ARGV[1]=amount  ARGV[2]=ttl_sec
export const SPEND_INCREMENT_SCRIPT = `
local new_val = redis.call('INCRBYFLOAT', KEYS[1], tonumber(ARGV[1]))
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return new_val
`.trim();

// ─── Redis connection ─────────────────────────────────────────────────────────

const redis = Bun.redis;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deny(reason: string, ruleId: string): PolicyDecision {
  return { decision: "DENY", reason, ruleId };
}

// ─── Stateless rule evaluators ────────────────────────────────────────────────

export function evalAllowedRails(rail: Rail, rules: AgentPolicyRules): PolicyDecision | null {
  if (!rules.allowedRails?.length) return null;
  if (!rules.allowedRails.includes(rail)) {
    return deny("POLICY_DENY_RAIL_NOT_ALLOWED", "allowedRails");
  }
  return null;
}

export function evalAgentBlockedCountries(
  recipientCountry: string | undefined,
  rules: AgentPolicyRules
): PolicyDecision | null {
  if (!recipientCountry || !rules.blockedCountries?.length) return null;
  if (rules.blockedCountries.includes(recipientCountry.toUpperCase())) {
    return deny("POLICY_DENY_COUNTRY_BLOCKED", "blockedCountries");
  }
  return null;
}

export function evalAgentBlocklist(
  recipientEntity: string | undefined,
  recipientDomain: string | undefined,
  rules: AgentPolicyRules
): PolicyDecision | null {
  const { blocklist } = rules;
  if (!blocklist) return null;
  if (recipientEntity && blocklist.entities?.includes(recipientEntity)) {
    return deny("POLICY_DENY_BLOCKLIST", "blocklist");
  }
  if (recipientDomain && blocklist.domains?.includes(recipientDomain)) {
    return deny("POLICY_DENY_BLOCKLIST", "blocklist");
  }
  return null;
}

export function evalConnectorPolicyExists(
  policy: ConnectorPolicyRules | null
): PolicyDecision | null {
  if (!policy) {
    return deny("POLICY_DENY_NO_CONNECTOR_POLICY", "connectorPolicyExists");
  }
  if (!policy.allowedActions?.length) {
    return deny("POLICY_DENY_ACTION_NOT_ALLOWED", "connectorPolicyExists");
  }
  return null;
}

export function evalAllowedActions(
  action: string,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.allowedActions?.length || !rules.allowedActions.includes(action)) {
    return deny("POLICY_DENY_ACTION_NOT_ALLOWED", "allowedActions");
  }
  return null;
}

export function evalActionLimits(
  action: string,
  amount: string,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.actionLimits?.length) return null;
  const limit = rules.actionLimits.find((l) => l.action === action);
  if (limit && parseFloat(amount) > parseFloat(limit.maxAmount)) {
    return deny("POLICY_DENY_ACTION_LIMIT_EXCEEDED", "actionLimits");
  }
  return null;
}

export function evalMaxPerTransaction(
  amount: string,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.maxPerTransaction) return null;
  if (parseFloat(amount) > parseFloat(rules.maxPerTransaction.amount)) {
    return deny("POLICY_DENY_MAX_PER_TX", "maxPerTransaction");
  }
  return null;
}

export function evalConnectorBlockedCountries(
  recipientCountry: string | undefined,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!recipientCountry || !rules.blockedCountries?.length) return null;
  if (rules.blockedCountries.includes(recipientCountry.toUpperCase())) {
    return deny("POLICY_DENY_COUNTRY_BLOCKED", "blockedCountries");
  }
  return null;
}

export function evalAllowedCountries(
  recipientCountry: string | undefined,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.allowedCountries?.length) return null;
  if (!recipientCountry || !rules.allowedCountries.includes(recipientCountry.toUpperCase())) {
    return deny("POLICY_DENY_COUNTRY_NOT_ALLOWED", "allowedCountries");
  }
  return null;
}

export function evalAllowedCurrencies(
  currency: string,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.allowedCurrencies?.length) return null;
  if (!rules.allowedCurrencies.includes(currency.toUpperCase())) {
    return deny("POLICY_DENY_CURRENCY_NOT_ALLOWED", "allowedCurrencies");
  }
  return null;
}

export function evalScheduleWindow(
  now: Date,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.scheduleWindow) return null;
  const { daysOfWeek, startHourUtc, endHourUtc } = rules.scheduleWindow;
  const dayOfWeek = now.getUTCDay();
  const hour = now.getUTCHours();

  if (!daysOfWeek.includes(dayOfWeek)) {
    return deny("POLICY_DENY_OUTSIDE_SCHEDULE", "scheduleWindow");
  }

  // Support overnight windows (e.g., 22:00–06:00)
  const inWindow =
    startHourUtc <= endHourUtc
      ? hour >= startHourUtc && hour < endHourUtc
      : hour >= startHourUtc || hour < endHourUtc;

  if (!inWindow) {
    return deny("POLICY_DENY_OUTSIDE_SCHEDULE", "scheduleWindow");
  }
  return null;
}

// ─── Stateful rule evaluators ─────────────────────────────────────────────────

async function evalVelocity(
  key: string,
  windowSeconds: number,
  maxTx: number,
  denyCode: string,
  ruleId: string
): Promise<PolicyDecision | null> {
  const result = await redis.send("EVAL", [
    VELOCITY_CHECK_SCRIPT,
    "1",
    key,
    String(Date.now()),
    String(windowSeconds),
    String(maxTx),
    String(windowSeconds + 10),
  ]);
  return result === 0 ? deny(denyCode, ruleId) : null;
}

async function evalSpend(
  key: string,
  amount: string,
  limit: string,
  denyCode: string,
  ruleId: string
): Promise<PolicyDecision | null> {
  const result = await redis.send("EVAL", [SPEND_CHECK_SCRIPT, "1", key, amount, limit]);
  return result === 0 ? deny(denyCode, ruleId) : null;
}

export function evalGlobalVelocity(
  agentId: string,
  userId: string,
  windowSeconds: number,
  maxTx: number
): Promise<PolicyDecision | null> {
  return evalVelocity(
    REDIS_KEYS.globalVelocity(agentId, userId),
    windowSeconds,
    maxTx,
    "POLICY_DENY_GLOBAL_VELOCITY",
    "globalVelocityCheck"
  );
}

export function evalGlobalDailyLimit(
  agentId: string,
  userId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.globalDailySpend(agentId, userId),
    amount,
    limit,
    "POLICY_DENY_GLOBAL_DAILY_LIMIT",
    "globalDailyLimit"
  );
}

export function evalGlobalMonthlyLimit(
  agentId: string,
  userId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.globalMonthlySpend(agentId, userId),
    amount,
    limit,
    "POLICY_DENY_GLOBAL_MONTHLY_LIMIT",
    "globalMonthlyLimit"
  );
}

export function evalConnectorVelocity(
  connectorId: string,
  windowSeconds: number,
  maxTx: number
): Promise<PolicyDecision | null> {
  return evalVelocity(
    REDIS_KEYS.connectorVelocity(connectorId),
    windowSeconds,
    maxTx,
    "POLICY_DENY_VELOCITY",
    "velocityCheck"
  );
}

export function evalConnectorDailyLimit(
  connectorId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.connectorDailySpend(connectorId),
    amount,
    limit,
    "POLICY_DENY_DAILY_LIMIT_EXCEEDED",
    "dailyLimit"
  );
}

export function evalConnectorWeeklyLimit(
  connectorId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.connectorWeeklySpend(connectorId),
    amount,
    limit,
    "POLICY_DENY_WEEKLY_LIMIT_EXCEEDED",
    "weeklyLimit"
  );
}

export function evalConnectorMonthlyLimit(
  connectorId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.connectorMonthlySpend(connectorId),
    amount,
    limit,
    "POLICY_DENY_MONTHLY_LIMIT_EXCEEDED",
    "monthlyLimit"
  );
}

export function evalRecipientDailyLimit(
  connectorId: string,
  recipientId: string,
  amount: string,
  limit: string
): Promise<PolicyDecision | null> {
  return evalSpend(
    REDIS_KEYS.recipientDailySpend(connectorId, recipientId),
    amount,
    limit,
    "POLICY_DENY_RECIPIENT_DAILY_LIMIT",
    "recipientDailyLimit"
  );
}

// ─── HOLD check ───────────────────────────────────────────────────────────────

export function evalRequireHumanApproval(
  amount: string,
  rules: ConnectorPolicyRules
): PolicyDecision | null {
  if (!rules.requireHumanApproval) return null;
  if (parseFloat(amount) >= parseFloat(rules.requireHumanApproval.thresholdAmount)) {
    return {
      decision: "HOLD",
      reason: "HOLD_HUMAN_APPROVAL_REQUIRED",
      ruleId: "requireHumanApproval",
    };
  }
  return null;
}

// ─── Main evaluate ────────────────────────────────────────────────────────────

export async function evaluate(ctx: EvaluateContext): Promise<PolicyDecision> {
  const now = ctx.now ?? new Date();
  const { agentId, userId, connectorId, rail, action, amount, currency } = ctx;
  const ap = ctx.agentPolicy;
  const cp = ctx.connectorPolicy;

  // Steps 1–3: agent stateless
  let d: PolicyDecision | null;

  d = evalAllowedRails(rail, ap);
  if (d) return d;

  d = evalAgentBlockedCountries(ctx.recipientCountry, ap);
  if (d) return d;

  d = evalAgentBlocklist(ctx.recipientEntity, ctx.recipientDomain, ap);
  if (d) return d;

  // Steps 4–6: agent stateful — fire in parallel, return first DENY in order
  const [globalVel, globalDay, globalMonth] = await Promise.all([
    ap.globalVelocityCheck
      ? evalGlobalVelocity(agentId, userId, ap.globalVelocityCheck.windowSeconds, ap.globalVelocityCheck.maxTransactions)
      : null,
    ap.globalDailyLimit
      ? evalGlobalDailyLimit(agentId, userId, amount, ap.globalDailyLimit.amount)
      : null,
    ap.globalMonthlyLimit
      ? evalGlobalMonthlyLimit(agentId, userId, amount, ap.globalMonthlyLimit.amount)
      : null,
  ]);
  d = globalVel ?? globalDay ?? globalMonth ?? null;
  if (d) return d;

  // Step 7: connector policy existence
  d = evalConnectorPolicyExists(cp);
  if (d) return d;

  // Steps 8–14: connector stateless
  d = evalAllowedActions(action, cp!);
  if (d) return d;

  d = evalActionLimits(action, amount, cp!);
  if (d) return d;

  d = evalMaxPerTransaction(amount, cp!);
  if (d) return d;

  d = evalConnectorBlockedCountries(ctx.recipientCountry, cp!);
  if (d) return d;

  d = evalAllowedCountries(ctx.recipientCountry, cp!);
  if (d) return d;

  d = evalAllowedCurrencies(currency, cp!);
  if (d) return d;

  d = evalScheduleWindow(now, cp!);
  if (d) return d;

  // Steps 15–19: connector stateful — fire in parallel, return first DENY in order
  const [conVel, conDay, conWeek, conMonth, recipDay] = await Promise.all([
    cp!.velocityCheck
      ? evalConnectorVelocity(connectorId, cp!.velocityCheck.windowSeconds, cp!.velocityCheck.maxTransactions)
      : null,
    cp!.dailyLimit
      ? evalConnectorDailyLimit(connectorId, amount, cp!.dailyLimit.amount)
      : null,
    cp!.weeklyLimit
      ? evalConnectorWeeklyLimit(connectorId, amount, cp!.weeklyLimit.amount)
      : null,
    cp!.monthlyLimit
      ? evalConnectorMonthlyLimit(connectorId, amount, cp!.monthlyLimit.amount)
      : null,
    cp!.recipientDailyLimit && ctx.recipientId
      ? evalRecipientDailyLimit(connectorId, ctx.recipientId, amount, cp!.recipientDailyLimit.amount)
      : null,
  ]);
  d = conVel ?? conDay ?? conWeek ?? conMonth ?? recipDay ?? null;
  if (d) return d;

  // Step 20: HOLD check
  d = evalRequireHumanApproval(amount, cp!);
  if (d) return d;

  // Step 21: ALLOW
  return { decision: "ALLOW" };
}

// ─── incrementSpendCounters ───────────────────────────────────────────────────
// Called after provider success. Increments all active spend counters.

export async function incrementSpendCounters(ctx: EvaluateContext): Promise<void> {
  const { agentId, userId, connectorId, amount } = ctx;
  const now = ctx.now ?? new Date();
  const ap = ctx.agentPolicy;
  const cp = ctx.connectorPolicy;

  const tasks: Promise<unknown>[] = [];

  const inc = (key: string, ttl: string) =>
    redis.send("EVAL", [SPEND_INCREMENT_SCRIPT, "1", key, amount, ttl]);

  const eod = String(secondsUntilEndOfDay(now));
  const eom = String(secondsUntilEndOfMonth(now));
  const eow = String(secondsUntilEndOfWeek(now));

  if (ap.globalDailyLimit)
    tasks.push(inc(REDIS_KEYS.globalDailySpend(agentId, userId), eod));
  if (ap.globalMonthlyLimit)
    tasks.push(inc(REDIS_KEYS.globalMonthlySpend(agentId, userId), eom));
  if (cp?.dailyLimit)
    tasks.push(inc(REDIS_KEYS.connectorDailySpend(connectorId), eod));
  if (cp?.weeklyLimit)
    tasks.push(inc(REDIS_KEYS.connectorWeeklySpend(connectorId), eow));
  if (cp?.monthlyLimit)
    tasks.push(inc(REDIS_KEYS.connectorMonthlySpend(connectorId), eom));
  if (cp?.recipientDailyLimit && ctx.recipientId)
    tasks.push(inc(REDIS_KEYS.recipientDailySpend(connectorId, ctx.recipientId), eod));

  await Promise.all(tasks);
}
