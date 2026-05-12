CREATE TABLE `agent_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`mode` text DEFAULT 'test' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_api_keys_agent_id_idx` ON `agent_api_keys` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_api_keys_key_hash_idx` ON `agent_api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `agent_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`rules` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_policies_agent_id_idx` ON `agent_policies` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_policies_agent_version_idx` ON `agent_policies` (`agent_id`,`version`);--> statement-breakpoint
CREATE TABLE `agent_registry_listings` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`tagline` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`deployer_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_registry_listings_slug_unique` ON `agent_registry_listings` (`slug`);--> statement-breakpoint
CREATE TABLE `agent_user_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`connected_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_user_connections_agent_id_idx` ON `agent_user_connections` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_user_connections_user_id_idx` ON `agent_user_connections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_user_connections_unique_idx` ON `agent_user_connections` (`agent_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`developer_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`webhook_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`developer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agents_developer_id_idx` ON `agents` (`developer_id`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` text NOT NULL,
	`audit_log_id` text,
	`args_snapshot` text NOT NULL,
	`amount` text,
	`currency` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by` text,
	`rejection_reason` text,
	`expires_at` integer NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audit_log_id`) REFERENCES `audit_logs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approvals_agent_id_idx` ON `approvals` (`agent_id`);--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `approvals_expires_at_idx` ON `approvals` (`expires_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` text NOT NULL,
	`connector_id` text,
	`rail` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`deny_rule` text,
	`amount` text,
	`currency` text,
	`recipient_id` text,
	`policy_id` text,
	`connector_policy_id` text,
	`args_hash` text,
	`provider_tx_id` text,
	`approval_id` text,
	`duration_ms` integer,
	`prev_hash` text NOT NULL,
	`row_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_agent_id_idx` ON `audit_logs` (`agent_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_outcome_idx` ON `audit_logs` (`outcome`);--> statement-breakpoint
CREATE TABLE `connector_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`rules` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connector_id`) REFERENCES `connectors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `connector_policies_connector_id_idx` ON `connector_policies` (`connector_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connector_policies_connector_version_idx` ON `connector_policies` (`connector_id`,`version`);--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rail` text NOT NULL,
	`auth_type` text NOT NULL,
	`credentials_encrypted` blob NOT NULL,
	`credentials_iv` text NOT NULL,
	`credentials_key_id` text NOT NULL,
	`masked_credential` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `connectors_agent_id_idx` ON `connectors` (`agent_id`);--> statement-breakpoint
CREATE INDEX `connectors_user_id_idx` ON `connectors` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connectors_agent_rail_user_idx` ON `connectors` (`agent_id`,`rail`,`user_id`);--> statement-breakpoint
CREATE TABLE `notification_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`slack_webhook_url_enc` blob,
	`slack_webhook_iv` text,
	`email_addresses` text DEFAULT '[]' NOT NULL,
	`approval_timeout_seconds` integer DEFAULT 3600 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_configs_agent_id_unique` ON `notification_configs` (`agent_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'developer' NOT NULL,
	`mfa_secret` text,
	`jwt_revocation_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: updates are not allowed');
END;--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: deletes are not allowed');
END;