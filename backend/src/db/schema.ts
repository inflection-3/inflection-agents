import {
  sqliteTable,
  text,
  integer,
  blob,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", {
    enum: ["developer", "user", "admin", "approver", "read_only"],
  })
    .notNull()
    .default("developer"),
  mfaSecret: text("mfa_secret"),
  jwtRevocationVersion: integer("jwt_revocation_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─── agents ───────────────────────────────────────────────────────────────────

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey(),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    webhookUrl: text("webhook_url"),
    status: text("status", { enum: ["active", "suspended", "deleted"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("agents_developer_id_idx").on(t.developerId)]
);

// ─── agent_api_keys ───────────────────────────────────────────────────────────

export const agentApiKeys = sqliteTable(
  "agent_api_keys",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    mode: text("mode", { enum: ["live", "test"] })
      .notNull()
      .default("test"),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("agent_api_keys_agent_id_idx").on(t.agentId),
    uniqueIndex("agent_api_keys_key_hash_idx").on(t.keyHash),
  ]
);

// ─── agent_registry_listings ──────────────────────────────────────────────────

export const agentRegistryListings = sqliteTable("agent_registry_listings", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline"),
  tags: text("tags").notNull().default("[]"), // JSON array stored as TEXT
  listed: integer("listed", { mode: "boolean" }).notNull().default(false),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  deployerCount: integer("deployer_count").notNull().default(0),
});

// ─── agent_user_connections ───────────────────────────────────────────────────

export const agentUserConnections = sqliteTable(
  "agent_user_connections",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    connectedAt: integer("connected_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("agent_user_connections_agent_id_idx").on(t.agentId),
    index("agent_user_connections_user_id_idx").on(t.userId),
    uniqueIndex("agent_user_connections_unique_idx").on(t.agentId, t.userId),
  ]
);

// ─── connectors ───────────────────────────────────────────────────────────────

export const connectors = sqliteTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rail: text("rail", {
      enum: ["stripe", "circle", "x402", "square", "braintree", "razorpay"],
    }).notNull(),
    authType: text("auth_type", {
      enum: ["oauth", "api_key", "wallet"],
    }).notNull(),
    credentialsEncrypted: blob("credentials_encrypted").notNull(), // AES-256-GCM ciphertext
    credentialsIv: text("credentials_iv").notNull(),               // base64 IV
    credentialsKeyId: text("credentials_key_id").notNull(),        // KMS key ref (or 'local' in dev)
    maskedCredential: text("masked_credential").notNull(),         // safe display string
    status: text("status", { enum: ["active", "revoked", "error"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("connectors_agent_id_idx").on(t.agentId),
    index("connectors_user_id_idx").on(t.userId),
    uniqueIndex("connectors_agent_rail_user_idx").on(t.agentId, t.rail, t.userId),
  ]
);

// ─── agent_policies ───────────────────────────────────────────────────────────

export const agentPolicies = sqliteTable(
  "agent_policies",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    version: integer("version").notNull().default(1),
    rules: text("rules").notNull(), // JSON stored as TEXT
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("agent_policies_agent_id_idx").on(t.agentId),
    uniqueIndex("agent_policies_agent_version_idx").on(t.agentId, t.version),
  ]
);

// ─── connector_policies ───────────────────────────────────────────────────────

export const connectorPolicies = sqliteTable(
  "connector_policies",
  {
    id: text("id").primaryKey(),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectors.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    version: integer("version").notNull().default(1),
    rules: text("rules").notNull(), // JSON stored as TEXT
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("connector_policies_connector_id_idx").on(t.connectorId),
    uniqueIndex("connector_policies_connector_version_idx").on(
      t.connectorId,
      t.version
    ),
  ]
);

// ─── audit_logs ───────────────────────────────────────────────────────────────
// Append-only. BEFORE UPDATE and BEFORE DELETE triggers (in migration) raise
// an error to prevent any modification after insert.

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    userId: text("user_id").notNull(),
    connectorId: text("connector_id"),
    rail: text("rail").notNull(),
    action: text("action").notNull(),
    outcome: text("outcome", { enum: ["ALLOW", "DENY", "HOLD"] }).notNull(),
    denyRule: text("deny_rule"),
    amount: text("amount"),       // TEXT to avoid float rounding
    currency: text("currency"),
    recipientId: text("recipient_id"),
    policyId: text("policy_id"),
    connectorPolicyId: text("connector_policy_id"),
    argsHash: text("args_hash"),  // SHA-256 of sanitized args
    providerTxId: text("provider_tx_id"),
    approvalId: text("approval_id"),
    durationMs: integer("duration_ms"),
    prevHash: text("prev_hash").notNull(), // hash of previous row (genesis for first)
    rowHash: text("row_hash").notNull(),   // SHA-256(id|agentId|userId|outcome|amount|prevHash)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("audit_logs_agent_id_idx").on(t.agentId),
    index("audit_logs_user_id_idx").on(t.userId),
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_outcome_idx").on(t.outcome),
  ]
);

// ─── approvals ────────────────────────────────────────────────────────────────

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    auditLogId: text("audit_log_id").references(() => auditLogs.id),
    argsSnapshot: text("args_snapshot").notNull(), // sanitized JSON
    amount: text("amount"),
    currency: text("currency"),
    status: text("status", {
      enum: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "executed",
        "execution_failed",
      ],
    })
      .notNull()
      .default("pending"),
    approvedBy: text("approved_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("approvals_agent_id_idx").on(t.agentId),
    index("approvals_status_idx").on(t.status),
    index("approvals_expires_at_idx").on(t.expiresAt),
  ]
);

// ─── notification_configs ─────────────────────────────────────────────────────

export const notificationConfigs = sqliteTable("notification_configs", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .unique()
    .references(() => agents.id),
  slackWebhookUrlEnc: blob("slack_webhook_url_enc"), // AES-256-GCM encrypted
  slackWebhookIv: text("slack_webhook_iv"),
  emailAddresses: text("email_addresses").notNull().default("[]"), // JSON array
  approvalTimeoutSeconds: integer("approval_timeout_seconds")
    .notNull()
    .default(3600),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
