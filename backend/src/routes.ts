import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import agentRoutes from "./routes/agents";
import apiKeyRoutes from "./routes/api-keys";
import connectorRoutes from "./routes/connectors";
import policyRoutes from "./routes/policies";
import auditLogRoutes from "./routes/audit-logs";
import approvalRoutes from "./routes/approvals";
import { apiKeyAuth } from "./middleware/auth";
import { handleExecute } from "./handler";
import { ACTIONS_BY_RAIL, CURRENCIES_BY_RAIL } from "./connectors/action-registry";
import type { Rail } from "./policy-engine";

const app = new Hono();
app.use("*", cors({ origin: "*" }));

app.route("/v1/auth", authRoutes);
app.post("/v1/execute", apiKeyAuth, handleExecute);
app.get("/health", (c) => c.json({ ok: true }));
app.get("/v1/rails", (c) => {
  const registry = Object.fromEntries(
    (Object.keys(ACTIONS_BY_RAIL) as Rail[]).map((rail) => [
      rail,
      { actions: ACTIONS_BY_RAIL[rail], currencies: CURRENCIES_BY_RAIL[rail] },
    ])
  );
  return c.json(registry);
});

// Dashboard CRUD routes (all apply jwtAuth internally)
app.route("/v1/agents", agentRoutes);
app.route("/v1/agents", apiKeyRoutes);
app.route("/v1/connectors", connectorRoutes);
app.route("/v1", policyRoutes);
app.route("/v1/audit-logs", auditLogRoutes);
app.route("/v1/approvals", approvalRoutes);

export default app;
