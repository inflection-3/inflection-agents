import { describe, test, expect, afterAll } from "bun:test";
import {
  evaluate,
  incrementSpendCounters,
  evalAllowedRails,
  evalAgentBlockedCountries,
  evalAgentBlocklist,
  evalConnectorPolicyExists,
  evalAllowedActions,
  evalActionLimits,
  evalMaxPerTransaction,
  evalConnectorBlockedCountries,
  evalAllowedCountries,
  evalAllowedCurrencies,
  evalScheduleWindow,
  evalRequireHumanApproval,
  REDIS_KEYS,
  type AgentPolicyRules,
  type ConnectorPolicyRules,
  type EvaluateContext,
} from "../src/policy-engine";

// Unique prefix per test run to avoid key collisions
const RUN = Date.now().toString(36);
const agentId = `test-agent-${RUN}`;
const userId = `test-user-${RUN}`;
const connectorId = `test-connector-${RUN}`;

// Baseline context for full evaluate() tests
function ctx(
  overrides: Partial<EvaluateContext> & {
    ap?: AgentPolicyRules;
    cp?: ConnectorPolicyRules | null;
  } = {}
): EvaluateContext {
  const { ap, cp, ...rest } = overrides;
  return {
    agentId,
    userId,
    connectorId,
    rail: "stripe",
    action: "charges.create",
    amount: "50.00",
    currency: "USD",
    agentPolicy: ap ?? {},
    connectorPolicy: cp !== undefined ? cp : {
      allowedActions: ["charges.create"],
    },
    ...rest,
  };
}

// Clean up all Redis keys created during tests
afterAll(async () => {
  const keys = [
    REDIS_KEYS.globalVelocity(agentId, userId),
    REDIS_KEYS.globalVelocity(`${agentId}-vel`, userId),
    REDIS_KEYS.globalDailySpend(agentId, userId),
    REDIS_KEYS.globalMonthlySpend(agentId, userId),
    REDIS_KEYS.connectorVelocity(connectorId),
    REDIS_KEYS.connectorDailySpend(connectorId),
    REDIS_KEYS.connectorWeeklySpend(connectorId),
    REDIS_KEYS.connectorMonthlySpend(connectorId),
    REDIS_KEYS.recipientDailySpend(connectorId, "recipient-1"),
    `${REDIS_KEYS.connectorVelocity(connectorId)}:seq`,
    `${REDIS_KEYS.globalVelocity(agentId, userId)}:seq`,
    `${REDIS_KEYS.globalVelocity(`${agentId}-vel`, userId)}:seq`,
  ];
  await Promise.all(keys.map((k) => Bun.redis.send("DEL", [k])));
});

// ─── Stateless: evalAllowedRails ──────────────────────────────────────────────

describe("evalAllowedRails", () => {
  test("returns null when no rule defined", () => {
    expect(evalAllowedRails("stripe", {})).toBeNull();
  });

  test("returns null when rail is in allowedRails", () => {
    expect(evalAllowedRails("stripe", { allowedRails: ["stripe", "circle"] })).toBeNull();
  });

  test("returns DENY when rail not in allowedRails", () => {
    const d = evalAllowedRails("circle", { allowedRails: ["stripe"] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_RAIL_NOT_ALLOWED");
  });
});

// ─── Stateless: evalAgentBlockedCountries ─────────────────────────────────────

describe("evalAgentBlockedCountries", () => {
  test("returns null when no blockedCountries", () => {
    expect(evalAgentBlockedCountries("US", {})).toBeNull();
  });

  test("returns null when recipientCountry is undefined", () => {
    expect(evalAgentBlockedCountries(undefined, { blockedCountries: ["RU"] })).toBeNull();
  });

  test("returns DENY for blocked country (case-insensitive)", () => {
    const d = evalAgentBlockedCountries("ru", { blockedCountries: ["RU", "KP"] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_COUNTRY_BLOCKED");
  });

  test("returns null for non-blocked country", () => {
    expect(evalAgentBlockedCountries("US", { blockedCountries: ["RU"] })).toBeNull();
  });
});

// ─── Stateless: evalAgentBlocklist ────────────────────────────────────────────

describe("evalAgentBlocklist", () => {
  const rules: AgentPolicyRules = {
    blocklist: { entities: ["bad-corp"], domains: ["fraud.io"] },
  };

  test("returns null when no blocklist", () => {
    expect(evalAgentBlocklist("bad-corp", "fraud.io", {})).toBeNull();
  });

  test("returns DENY for blocked entity", () => {
    const d = evalAgentBlocklist("bad-corp", undefined, rules);
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_BLOCKLIST");
  });

  test("returns DENY for blocked domain", () => {
    const d = evalAgentBlocklist(undefined, "fraud.io", rules);
    expect(d?.decision).toBe("DENY");
  });

  test("returns null for non-blocked entity and domain", () => {
    expect(evalAgentBlocklist("good-corp", "safe.com", rules)).toBeNull();
  });
});

// ─── Stateless: evalConnectorPolicyExists ─────────────────────────────────────

describe("evalConnectorPolicyExists", () => {
  test("returns DENY when policy is null", () => {
    const d = evalConnectorPolicyExists(null);
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_NO_CONNECTOR_POLICY");
  });

  test("returns DENY when allowedActions is empty", () => {
    const d = evalConnectorPolicyExists({ allowedActions: [] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_ACTION_NOT_ALLOWED");
  });

  test("returns null for valid policy", () => {
    expect(evalConnectorPolicyExists({ allowedActions: ["charges.create"] })).toBeNull();
  });
});

// ─── Stateless: evalAllowedActions ────────────────────────────────────────────

describe("evalAllowedActions", () => {
  test("returns null when action is allowed", () => {
    expect(evalAllowedActions("charges.create", { allowedActions: ["charges.create", "refunds.create"] })).toBeNull();
  });

  test("returns DENY when action not in list", () => {
    const d = evalAllowedActions("payouts.create", { allowedActions: ["charges.create"] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_ACTION_NOT_ALLOWED");
  });
});

// ─── Stateless: evalActionLimits ──────────────────────────────────────────────

describe("evalActionLimits", () => {
  const rules: ConnectorPolicyRules = {
    actionLimits: [{ action: "charges.create", maxAmount: "100.00", currency: "USD" }],
  };

  test("returns null when no actionLimits", () => {
    expect(evalActionLimits("charges.create", "500.00", {})).toBeNull();
  });

  test("returns null when action has no specific limit", () => {
    expect(evalActionLimits("refunds.create", "500.00", rules)).toBeNull();
  });

  test("returns null when amount is within limit", () => {
    expect(evalActionLimits("charges.create", "100.00", rules)).toBeNull();
  });

  test("returns DENY when amount exceeds limit", () => {
    const d = evalActionLimits("charges.create", "100.01", rules);
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_ACTION_LIMIT_EXCEEDED");
  });
});

// ─── Stateless: evalMaxPerTransaction ─────────────────────────────────────────

describe("evalMaxPerTransaction", () => {
  test("returns null when no rule", () => {
    expect(evalMaxPerTransaction("9999.00", {})).toBeNull();
  });

  test("returns null when amount is at limit", () => {
    expect(evalMaxPerTransaction("500.00", { maxPerTransaction: { amount: "500.00", currency: "USD" } })).toBeNull();
  });

  test("returns DENY when amount exceeds max", () => {
    const d = evalMaxPerTransaction("500.01", { maxPerTransaction: { amount: "500.00", currency: "USD" } });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_MAX_PER_TX");
  });
});

// ─── Stateless: country / currency ────────────────────────────────────────────

describe("evalConnectorBlockedCountries", () => {
  test("returns DENY for blocked country", () => {
    const d = evalConnectorBlockedCountries("IR", { blockedCountries: ["IR"] });
    expect(d?.decision).toBe("DENY");
  });

  test("returns null when not blocked", () => {
    expect(evalConnectorBlockedCountries("US", { blockedCountries: ["IR"] })).toBeNull();
  });
});

describe("evalAllowedCountries", () => {
  test("returns null when no allowedCountries rule", () => {
    expect(evalAllowedCountries("ZZ", {})).toBeNull();
  });

  test("returns DENY when country not in allowedCountries", () => {
    const d = evalAllowedCountries("MX", { allowedCountries: ["US", "CA"] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_COUNTRY_NOT_ALLOWED");
  });

  test("returns DENY when recipientCountry is undefined and rule exists", () => {
    const d = evalAllowedCountries(undefined, { allowedCountries: ["US"] });
    expect(d?.decision).toBe("DENY");
  });

  test("returns null when country is allowed (case-insensitive)", () => {
    expect(evalAllowedCountries("us", { allowedCountries: ["US"] })).toBeNull();
  });
});

describe("evalAllowedCurrencies", () => {
  test("returns null when no rule", () => {
    expect(evalAllowedCurrencies("EUR", {})).toBeNull();
  });

  test("returns DENY for disallowed currency", () => {
    const d = evalAllowedCurrencies("EUR", { allowedCurrencies: ["USD"] });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_CURRENCY_NOT_ALLOWED");
  });

  test("returns null for allowed currency (case-insensitive)", () => {
    expect(evalAllowedCurrencies("usd", { allowedCurrencies: ["USD"] })).toBeNull();
  });
});

// ─── Stateless: evalScheduleWindow ────────────────────────────────────────────

describe("evalScheduleWindow", () => {
  test("returns null when no scheduleWindow", () => {
    expect(evalScheduleWindow(new Date(), {})).toBeNull();
  });

  test("returns null when inside window on allowed day", () => {
    // Wednesday UTC at 14:00
    const now = new Date("2026-01-07T14:00:00Z"); // Wednesday
    const d = evalScheduleWindow(now, {
      scheduleWindow: { daysOfWeek: [1, 2, 3, 4, 5], startHourUtc: 9, endHourUtc: 17 },
    });
    expect(d).toBeNull();
  });

  test("returns DENY on wrong day of week", () => {
    // Saturday
    const now = new Date("2026-01-10T14:00:00Z");
    const d = evalScheduleWindow(now, {
      scheduleWindow: { daysOfWeek: [1, 2, 3, 4, 5], startHourUtc: 9, endHourUtc: 17 },
    });
    expect(d?.decision).toBe("DENY");
    expect(d?.reason).toBe("POLICY_DENY_OUTSIDE_SCHEDULE");
  });

  test("returns DENY outside hour range", () => {
    // Wednesday at 08:00 UTC (before 09:00 window)
    const now = new Date("2026-01-07T08:00:00Z");
    const d = evalScheduleWindow(now, {
      scheduleWindow: { daysOfWeek: [1, 2, 3, 4, 5], startHourUtc: 9, endHourUtc: 17 },
    });
    expect(d?.decision).toBe("DENY");
  });

  test("handles overnight windows (22:00–06:00) — inside window", () => {
    // Wednesday at 23:00 UTC
    const now = new Date("2026-01-07T23:00:00Z");
    const d = evalScheduleWindow(now, {
      scheduleWindow: { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startHourUtc: 22, endHourUtc: 6 },
    });
    expect(d).toBeNull();
  });

  test("handles overnight windows — outside window (daytime)", () => {
    // Wednesday at 12:00 UTC
    const now = new Date("2026-01-07T12:00:00Z");
    const d = evalScheduleWindow(now, {
      scheduleWindow: { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startHourUtc: 22, endHourUtc: 6 },
    });
    expect(d?.decision).toBe("DENY");
  });
});

// ─── Stateless: evalRequireHumanApproval ──────────────────────────────────────

describe("evalRequireHumanApproval", () => {
  const rules: ConnectorPolicyRules = {
    requireHumanApproval: { thresholdAmount: "1000.00", currency: "USD" },
  };

  test("returns null when no rule", () => {
    expect(evalRequireHumanApproval("9999.00", {})).toBeNull();
  });

  test("returns null when amount is below threshold", () => {
    expect(evalRequireHumanApproval("999.99", rules)).toBeNull();
  });

  test("returns HOLD when amount meets threshold exactly", () => {
    const d = evalRequireHumanApproval("1000.00", rules);
    expect(d?.decision).toBe("HOLD");
    expect(d?.reason).toBe("HOLD_HUMAN_APPROVAL_REQUIRED");
    expect(d?.ruleId).toBe("requireHumanApproval");
  });

  test("returns HOLD when amount exceeds threshold", () => {
    const d = evalRequireHumanApproval("1500.00", rules);
    expect(d?.decision).toBe("HOLD");
  });
});

// ─── Full evaluate() — stateless paths ───────────────────────────────────────

describe("evaluate() — stateless", () => {
  test("ALLOW when all rules pass (no stateful rules configured)", async () => {
    const result = await evaluate(ctx());
    expect(result.decision).toBe("ALLOW");
  });

  test("DENY at rail check", async () => {
    const result = await evaluate(ctx({ ap: { allowedRails: ["circle"] }, rail: "stripe" }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_RAIL_NOT_ALLOWED");
  });

  test("DENY at agent blocked country", async () => {
    const result = await evaluate(ctx({
      ap: { blockedCountries: ["RU"] },
      recipientCountry: "RU",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_COUNTRY_BLOCKED");
  });

  test("DENY at agent blocklist (domain match)", async () => {
    const result = await evaluate(ctx({
      ap: { blocklist: { domains: ["scam.io"] } },
      recipientDomain: "scam.io",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_BLOCKLIST");
  });

  test("DENY when connector policy is null (default-deny)", async () => {
    const result = await evaluate(ctx({ cp: null }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_NO_CONNECTOR_POLICY");
  });

  test("DENY when action not in allowedActions", async () => {
    const result = await evaluate(ctx({
      cp: { allowedActions: ["refunds.create"] },
      action: "charges.create",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_ACTION_NOT_ALLOWED");
  });

  test("DENY when amount exceeds per-action limit", async () => {
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        actionLimits: [{ action: "charges.create", maxAmount: "10.00", currency: "USD" }],
      },
      amount: "10.01",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_ACTION_LIMIT_EXCEEDED");
  });

  test("DENY when amount exceeds maxPerTransaction", async () => {
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        maxPerTransaction: { amount: "99.99", currency: "USD" },
      },
      amount: "100.00",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_MAX_PER_TX");
  });

  test("DENY at connector blocked country", async () => {
    const result = await evaluate(ctx({
      cp: { allowedActions: ["charges.create"], blockedCountries: ["CN"] },
      recipientCountry: "CN",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_COUNTRY_BLOCKED");
  });

  test("DENY when currency not allowed", async () => {
    const result = await evaluate(ctx({
      cp: { allowedActions: ["charges.create"], allowedCurrencies: ["USD"] },
      currency: "EUR",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_CURRENCY_NOT_ALLOWED");
  });

  test("DENY outside schedule window", async () => {
    // Fix time to Saturday
    const now = new Date("2026-01-10T14:00:00Z");
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        scheduleWindow: { daysOfWeek: [1, 2, 3, 4, 5], startHourUtc: 9, endHourUtc: 17 },
      },
      now,
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_OUTSIDE_SCHEDULE");
  });

  test("HOLD when amount meets requireHumanApproval threshold", async () => {
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        requireHumanApproval: { thresholdAmount: "500.00", currency: "USD" },
      },
      amount: "500.00",
    }));
    expect(result.decision).toBe("HOLD");
    expect(result.reason).toBe("HOLD_HUMAN_APPROVAL_REQUIRED");
  });

  test("ALLOW when HOLD threshold is not reached", async () => {
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        requireHumanApproval: { thresholdAmount: "500.00", currency: "USD" },
      },
      amount: "499.99",
    }));
    expect(result.decision).toBe("ALLOW");
  });
});

// ─── Stateful: velocity ───────────────────────────────────────────────────────

describe("evaluate() — global velocity (Redis)", () => {
  const velKey = (id: string) => REDIS_KEYS.globalVelocity(id, userId);
  const flush = (id: string) => Promise.all([
    Bun.redis.send("DEL", [velKey(id)]),
    Bun.redis.send("DEL", [`${velKey(id)}:seq`]),
  ]);

  test("ALLOW under velocity limit", async () => {
    const id = `${agentId}-vel-a`;
    await flush(id);
    const result = await evaluate(ctx({
      agentId: id,
      ap: { globalVelocityCheck: { maxTransactions: 5, windowSeconds: 60 } },
    }));
    expect(result.decision).toBe("ALLOW");
    await flush(id);
  });

  test("DENY when velocity limit is 1 and already consumed", async () => {
    const id = `${agentId}-vel-b`;
    await flush(id);
    const velCtx = ctx({
      agentId: id,
      ap: { globalVelocityCheck: { maxTransactions: 1, windowSeconds: 60 } },
    });

    const first = await evaluate(velCtx);
    expect(first.decision).toBe("ALLOW");

    const second = await evaluate(velCtx);
    expect(second.decision).toBe("DENY");
    expect(second.reason).toBe("POLICY_DENY_GLOBAL_VELOCITY");
    await flush(id);
  });
});

describe("evaluate() — connector velocity (Redis)", () => {
  test("DENY when connector velocity limit exceeded", async () => {
    const velConnectorId = `${connectorId}-vel`;
    const velCtx = ctx({
      connectorId: velConnectorId,
      cp: {
        allowedActions: ["charges.create"],
        velocityCheck: { maxTransactions: 2, windowSeconds: 60 },
      },
    });

    await Bun.redis.send("DEL", [REDIS_KEYS.connectorVelocity(velConnectorId)]);
    await Bun.redis.send("DEL", [`${REDIS_KEYS.connectorVelocity(velConnectorId)}:seq`]);

    const r1 = await evaluate(velCtx);
    expect(r1.decision).toBe("ALLOW");

    const r2 = await evaluate(velCtx);
    expect(r2.decision).toBe("ALLOW");

    const r3 = await evaluate(velCtx);
    expect(r3.decision).toBe("DENY");
    expect(r3.reason).toBe("POLICY_DENY_VELOCITY");

    await Bun.redis.send("DEL", [REDIS_KEYS.connectorVelocity(velConnectorId)]);
    await Bun.redis.send("DEL", [`${REDIS_KEYS.connectorVelocity(velConnectorId)}:seq`]);
  });
});

// ─── Stateful: spend limits ───────────────────────────────────────────────────

describe("evaluate() — global daily spend limit (Redis)", () => {
  test("ALLOW when under daily limit", async () => {
    await Bun.redis.send("DEL", [REDIS_KEYS.globalDailySpend(agentId, userId)]);
    const result = await evaluate(ctx({
      ap: { globalDailyLimit: { amount: "1000.00", currency: "USD" } },
      amount: "100.00",
    }));
    expect(result.decision).toBe("ALLOW");
  });

  test("DENY when over daily limit", async () => {
    await Bun.redis.send("SET", [REDIS_KEYS.globalDailySpend(agentId, userId), "950.00"]);
    const result = await evaluate(ctx({
      ap: { globalDailyLimit: { amount: "1000.00", currency: "USD" } },
      amount: "100.00",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_GLOBAL_DAILY_LIMIT");
    await Bun.redis.send("DEL", [REDIS_KEYS.globalDailySpend(agentId, userId)]);
  });
});

describe("evaluate() — connector daily spend limit (Redis)", () => {
  test("ALLOW when under connector daily limit", async () => {
    await Bun.redis.send("DEL", [REDIS_KEYS.connectorDailySpend(connectorId)]);
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        dailyLimit: { amount: "500.00", currency: "USD" },
      },
      amount: "100.00",
    }));
    expect(result.decision).toBe("ALLOW");
  });

  test("DENY when connector daily spend exceeded", async () => {
    await Bun.redis.send("SET", [REDIS_KEYS.connectorDailySpend(connectorId), "450.00"]);
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        dailyLimit: { amount: "500.00", currency: "USD" },
      },
      amount: "100.00",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_DAILY_LIMIT_EXCEEDED");
    await Bun.redis.send("DEL", [REDIS_KEYS.connectorDailySpend(connectorId)]);
  });
});

describe("evaluate() — recipient daily spend limit (Redis)", () => {
  const recipientId = "recipient-1";

  test("ALLOW when under recipient daily limit", async () => {
    await Bun.redis.send("DEL", [REDIS_KEYS.recipientDailySpend(connectorId, recipientId)]);
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        recipientDailyLimit: { amount: "200.00", currency: "USD" },
      },
      recipientId,
      amount: "100.00",
    }));
    expect(result.decision).toBe("ALLOW");
  });

  test("DENY when recipient daily limit exceeded", async () => {
    await Bun.redis.send("SET", [REDIS_KEYS.recipientDailySpend(connectorId, recipientId), "190.00"]);
    const result = await evaluate(ctx({
      cp: {
        allowedActions: ["charges.create"],
        recipientDailyLimit: { amount: "200.00", currency: "USD" },
      },
      recipientId,
      amount: "15.00",
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reason).toBe("POLICY_DENY_RECIPIENT_DAILY_LIMIT");
    await Bun.redis.send("DEL", [REDIS_KEYS.recipientDailySpend(connectorId, recipientId)]);
  });
});

// ─── incrementSpendCounters ───────────────────────────────────────────────────

describe("incrementSpendCounters", () => {
  const incConnectorId = `${connectorId}-inc`;
  const incAgentId = `${agentId}-inc`;

  afterAll(async () => {
    await Promise.all([
      Bun.redis.send("DEL", [REDIS_KEYS.globalDailySpend(incAgentId, userId)]),
      Bun.redis.send("DEL", [REDIS_KEYS.connectorDailySpend(incConnectorId)]),
      Bun.redis.send("DEL", [REDIS_KEYS.connectorWeeklySpend(incConnectorId)]),
      Bun.redis.send("DEL", [REDIS_KEYS.connectorMonthlySpend(incConnectorId)]),
    ]);
  });

  test("increments all active spend counters after execution", async () => {
    const incCtx: EvaluateContext = {
      agentId: incAgentId,
      userId,
      connectorId: incConnectorId,
      rail: "stripe",
      action: "charges.create",
      amount: "75.50",
      currency: "USD",
      agentPolicy: {
        globalDailyLimit: { amount: "1000.00", currency: "USD" },
      },
      connectorPolicy: {
        allowedActions: ["charges.create"],
        dailyLimit: { amount: "500.00", currency: "USD" },
        weeklyLimit: { amount: "2000.00", currency: "USD" },
        monthlyLimit: { amount: "5000.00", currency: "USD" },
      },
    };

    await incrementSpendCounters(incCtx);

    const [globalDay, conDay, conWeek, conMonth] = await Promise.all([
      Bun.redis.send("GET", [REDIS_KEYS.globalDailySpend(incAgentId, userId)]),
      Bun.redis.send("GET", [REDIS_KEYS.connectorDailySpend(incConnectorId)]),
      Bun.redis.send("GET", [REDIS_KEYS.connectorWeeklySpend(incConnectorId)]),
      Bun.redis.send("GET", [REDIS_KEYS.connectorMonthlySpend(incConnectorId)]),
    ]);

    expect(parseFloat(globalDay as string)).toBeCloseTo(75.5, 2);
    expect(parseFloat(conDay as string)).toBeCloseTo(75.5, 2);
    expect(parseFloat(conWeek as string)).toBeCloseTo(75.5, 2);
    expect(parseFloat(conMonth as string)).toBeCloseTo(75.5, 2);
  });

  test("accumulates across multiple increments", async () => {
    await incrementSpendCounters({
      agentId: incAgentId,
      userId,
      connectorId: incConnectorId,
      rail: "stripe",
      action: "charges.create",
      amount: "24.50",
      currency: "USD",
      agentPolicy: { globalDailyLimit: { amount: "1000.00", currency: "USD" } },
      connectorPolicy: { allowedActions: ["charges.create"], dailyLimit: { amount: "500.00", currency: "USD" } },
    });

    const val = await Bun.redis.send("GET", [REDIS_KEYS.globalDailySpend(incAgentId, userId)]);
    // 75.50 from previous test + 24.50 = 100.00
    expect(parseFloat(val as string)).toBeCloseTo(100.0, 2);
  });
});
