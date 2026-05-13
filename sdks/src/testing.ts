import type { ExecuteRequest, ExecuteResponse, Approval } from "./types.ts";
import { InflectionClient } from "./client.ts";

interface OverrideEntry {
	rail?: string;
	action?: string;
	response: ExecuteResponse;
}

interface MockClientOptions {
	defaultOutcome?: "ALLOW" | "DENY" | "HOLD";
	overrides?: OverrideEntry[];
}

class MockInflectionClient extends InflectionClient {
	calls: ExecuteRequest[] = [];
	private readonly defaultOutcome: "ALLOW" | "DENY" | "HOLD";
	private readonly overrides: OverrideEntry[];

	constructor(options: MockClientOptions = {}) {
		super({ apiKey: "mock_key", baseUrl: "http://mock" });
		this.defaultOutcome = options.defaultOutcome ?? "ALLOW";
		this.overrides = options.overrides ?? [];
	}

	override async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
		this.calls.push(req);

		for (const override of this.overrides) {
			if (
				(override.rail === undefined || override.rail === req.rail) &&
				(override.action === undefined || override.action === req.action)
			) {
				return override.response;
			}
		}

		switch (this.defaultOutcome) {
			case "ALLOW":
				return { outcome: "ALLOW", durationMs: 0 };
			case "DENY":
				return { outcome: "DENY", reason: "Mock deny", ruleId: "mock", durationMs: 0 };
			case "HOLD":
				return { outcome: "HOLD", approvalId: "mock_approval", reason: "Mock hold", durationMs: 0 };
		}
	}

	override async getApproval(_approvalId: string): Promise<Approval> {
		return {
			id: "mock_approval",
			agentId: "mock_agent",
			userId: "mock_user",
			auditLogId: null,
			argsSnapshot: "{}",
			amount: null,
			currency: null,
			status: "pending",
			approvedBy: null,
			rejectionReason: null,
			expiresAt: new Date(Date.now() + 3600_000).toISOString(),
			resolvedAt: null,
			createdAt: new Date().toISOString(),
		};
	}
}

export function createMockClient(options?: MockClientOptions): MockInflectionClient {
	return new MockInflectionClient(options);
}
