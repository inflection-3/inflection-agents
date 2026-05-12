import { Hono } from "hono";
import authRoutes from "./routes/auth";
import agentRoutes from "./routes/agents";
import apiKeyRoutes from "./routes/api-keys";
import connectorRoutes from "./routes/connectors";
import policyRoutes from "./routes/policies";
import auditLogRoutes from "./routes/audit-logs";
import approvalRoutes from "./routes/approvals";
import { apiKeyAuth } from "./middleware/auth";
import { handleExecute } from "./handler";

const app = new Hono();

app.route("/v1/auth", authRoutes);
app.post("/v1/execute", apiKeyAuth, handleExecute);
app.get("/health", (c) => c.json({ ok: true }));

// Dashboard CRUD routes (all apply jwtAuth internally)
app.route("/v1/agents", agentRoutes);
app.route("/v1/agents", apiKeyRoutes);
app.route("/v1/connectors", connectorRoutes);
app.route("/v1", policyRoutes);
app.route("/v1/audit-logs", auditLogRoutes);
app.route("/v1/approvals", approvalRoutes);

export default app;
