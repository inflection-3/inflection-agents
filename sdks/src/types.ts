// ─── Core types ───────────────────────────────────────────────────────────────

export type Rail = "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay";

export interface ExecuteRequest {
	rail: Rail;
	action: string;
	args: Record<string, unknown>;
	amount?: string;
	currency?: string;
	idempotencyKey: string;
	recipientId?: string;
	recipientCountry?: string;
	recipientEntity?: string;
	recipientDomain?: string;
}

export type ExecuteResponse = AllowResponse | DenyResponse | HoldResponse;

export interface AllowResponse {
	outcome: "ALLOW";
	providerTxId?: string;
	durationMs: number;
}

export interface DenyResponse {
	outcome: "DENY";
	reason: string;
	ruleId: string;
	durationMs: number;
}

export interface HoldResponse {
	outcome: "HOLD";
	approvalId: string;
	reason: string;
	durationMs: number;
}

// ─── Resource types ───────────────────────────────────────────────────────────

export interface Agent {
	id: string;
	developerId: string;
	name: string;
	description: string | null;
	webhookUrl: string | null;
	status: "active" | "suspended" | "deleted";
	createdAt: string;
	updatedAt: string;
}

export interface Connector {
	id: string;
	agentId: string;
	userId: string;
	rail: Rail;
	authType: "oauth" | "api_key" | "wallet";
	maskedCredential: string;
	status: "active" | "revoked" | "error";
	createdAt: string;
	updatedAt: string;
}

export interface AgentPolicy {
	id: string;
	agentId: string;
	userId: string;
	version: number;
	rules: AgentPolicyRules;
	createdBy: string;
	createdAt: string;
}

export interface ConnectorPolicy {
	id: string;
	connectorId: string;
	userId: string;
	version: number;
	rules: ConnectorPolicyRules;
	createdBy: string;
	createdAt: string;
}

export interface AuditLog {
	id: string;
	agentId: string;
	userId: string;
	connectorId: string | null;
	rail: string;
	action: string;
	outcome: "ALLOW" | "DENY" | "HOLD";
	denyRule: string | null;
	amount: string | null;
	currency: string | null;
	recipientId: string | null;
	policyId: string | null;
	connectorPolicyId: string | null;
	argsHash: string | null;
	providerTxId: string | null;
	approvalId: string | null;
	durationMs: number | null;
	prevHash: string;
	rowHash: string;
	createdAt: string;
}

export interface Approval {
	id: string;
	agentId: string;
	userId: string;
	auditLogId: string | null;
	argsSnapshot: string;
	amount: string | null;
	currency: string | null;
	status: "pending" | "approved" | "rejected" | "expired" | "executed" | "execution_failed";
	approvedBy: string | null;
	rejectionReason: string | null;
	expiresAt: string;
	resolvedAt: string | null;
	createdAt: string;
}

// ─── Policy rule shapes ───────────────────────────────────────────────────────

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
	scheduleWindow?: {
		daysOfWeek: number[];
		startHourUtc: number;
		endHourUtc: number;
	};
	velocityCheck?: { maxTransactions: number; windowSeconds: number };
	dailyLimit?: { amount: string; currency: string };
	weeklyLimit?: { amount: string; currency: string };
	monthlyLimit?: { amount: string; currency: string };
	recipientDailyLimit?: { amount: string; currency: string };
	requireHumanApproval?: { above: number; currency: string };
}

// ─── Client options ───────────────────────────────────────────────────────────

export interface InflectionClientOptions {
	apiKey: string;
	baseUrl?: string;
	timeout?: number;
}
