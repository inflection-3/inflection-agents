import type {
	InflectionClientOptions,
	ExecuteRequest,
	ExecuteResponse,
	Approval,
} from "./types.ts";
import { InflectionHttpError, InflectionNetworkError } from "./errors.ts";
import { createStripeClient } from "./rails/stripe.ts";
import { createCircleClient } from "./rails/circle.ts";
import { createX402Client } from "./rails/x402.ts";
import { createSquareClient } from "./rails/square.ts";
import { createBraintreeClient } from "./rails/braintree.ts";
import { createRazorpayClient } from "./rails/razorpay.ts";

function newRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class InflectionClient {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly timeout: number;

	constructor(options: InflectionClientOptions) {
		if (!options.apiKey) {
			throw new Error("apiKey is required");
		}
		this.apiKey = options.apiKey;
		this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "http://localhost:3001";
		this.timeout = options.timeout ?? 10_000;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: Record<string, unknown>
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const requestId = newRequestId();

		const init: RequestInit = {
			method,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				"X-Request-Id": requestId,
			},
			signal: AbortSignal.timeout(this.timeout),
		};

		if (body) {
			init.body = JSON.stringify(body);
		}

		let response: Response;
		try {
			response = await fetch(url, init);
		} catch (err) {
			throw new InflectionNetworkError(
				`Network error: ${(err as Error).message}`,
				requestId,
				err as Error
			);
		}

		if (!response.ok) {
			let body: unknown;
			try {
				body = await response.json();
			} catch {
				body = await response.text().catch(() => null);
			}
			throw new InflectionHttpError(
				`HTTP ${response.status}: ${response.statusText}`,
				requestId,
				response.status,
				body
			);
		}

		return response.json() as Promise<T>;
	}

	async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
		const url = `${this.baseUrl}/v1/execute`;
		const requestId = newRequestId();
		console.log(`[inflection] execute rail=${req.rail} action=${req.action} amount=${req.amount ?? "-"} idempotencyKey=${req.idempotencyKey}`);

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
					"X-Request-Id": requestId,
				},
				body: JSON.stringify(req),
				signal: AbortSignal.timeout(this.timeout),
			});
		} catch (err) {
			throw new InflectionNetworkError(
				`Network error: ${(err as Error).message}`,
				requestId,
				err as Error
			);
		}

		// 200 = ALLOW, 202 = HOLD, 403 = DENY — all are valid policy decisions, never throw
		if (response.status === 200 || response.status === 202 || response.status === 403) {
			const result = await response.json() as ExecuteResponse;
			console.log(`[inflection] response outcome=${result.outcome}${"ruleId" in result ? ` rule=${result.ruleId}` : ""}${"providerTxId" in result && result.providerTxId ? ` txId=${result.providerTxId}` : ""}`);
			return result;
		}

		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = await response.text().catch(() => null);
		}
		throw new InflectionHttpError(
			`HTTP ${response.status}: ${response.statusText}`,
			requestId,
			response.status,
			body
		);
	}

	async getApproval(approvalId: string): Promise<Approval> {
		return this.request<Approval>("GET", `/v1/approvals/${encodeURIComponent(approvalId)}`);
	}

	get stripe(): ReturnType<typeof createStripeClient> {
		return createStripeClient((req) => this.execute(req as ExecuteRequest));
	}

	get circle(): ReturnType<typeof createCircleClient> {
		return createCircleClient((req) => this.execute(req as ExecuteRequest));
	}

	get x402(): ReturnType<typeof createX402Client> {
		return createX402Client((req) => this.execute(req as ExecuteRequest));
	}

	get square(): ReturnType<typeof createSquareClient> {
		return createSquareClient((req) => this.execute(req as ExecuteRequest));
	}

	get braintree(): ReturnType<typeof createBraintreeClient> {
		return createBraintreeClient((req) => this.execute(req as ExecuteRequest));
	}

	get razorpay(): ReturnType<typeof createRazorpayClient> {
		return createRazorpayClient((req) => this.execute(req as ExecuteRequest));
	}
}
