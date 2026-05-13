import { expect, test, describe } from "vitest";
import { vi } from "vitest";
import {
	InflectionClient,
	isAllow,
	isDeny,
	isHold,
	InflectionError,
	InflectionHttpError,
	InflectionNetworkError,
	ACTIONS_BY_RAIL,
	CURRENCIES_BY_RAIL,
	MONETARY_ACTIONS_BY_RAIL,
} from "../src";
import { createMockClient } from "../src/testing";

describe("InflectionClient", () => {
	test("constructor throws without apiKey", () => {
		expect(() => new InflectionClient({ apiKey: "" })).toThrow("apiKey is required");
	});

	test("constructor sets defaults", () => {
		const client = new InflectionClient({ apiKey: "infl_test_123" });
		expect(client).toBeDefined();
	});

	test("execute returns ALLOW response", async () => {
		const client = new InflectionClient({ apiKey: "infl_test_123", baseUrl: "http://localhost:3001" });
		const mockResponse = { outcome: "ALLOW", providerTxId: "tx_123", durationMs: 42 };

		const originalFetch = globalThis.fetch;
				globalThis.fetch = vi.fn(() =>
			Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
		) as unknown as typeof fetch;

		const result = await client.execute({
			rail: "stripe",
			action: "charges.create",
			args: { amount: 5000, currency: "usd" },
			amount: "50.00",
			currency: "usd",
			idempotencyKey: "idem-1",
		});

		expect(result.outcome).toBe("ALLOW");
		expect((result as { providerTxId?: string }).providerTxId).toBe("tx_123");

		globalThis.fetch = originalFetch;
	});

	test("execute throws InflectionHttpError on 4xx", async () => {
		const client = new InflectionClient({ apiKey: "infl_test_123" });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(() =>
			Promise.resolve(new Response(JSON.stringify({ error: "bad request" }), { status: 400 }))
		) as unknown as typeof fetch;

		await expect(
			client.execute({
				rail: "stripe",
				action: "charges.create",
				args: {},
				idempotencyKey: "idem-1",
			})
		).rejects.toBeInstanceOf(InflectionHttpError);

		globalThis.fetch = originalFetch;
	});

	test("execute throws InflectionNetworkError on fetch failure", async () => {
		const client = new InflectionClient({ apiKey: "infl_test_123" });
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(() => Promise.reject(new Error("Connection refused"))) as unknown as typeof fetch;

		await expect(
			client.execute({
				rail: "stripe",
				action: "charges.create",
				args: {},
				idempotencyKey: "idem-1",
			})
		).rejects.toBeInstanceOf(InflectionNetworkError);

		globalThis.fetch = originalFetch;
	});
});

describe("type guards", () => {
	test("isAllow", () => {
		expect(isAllow({ outcome: "ALLOW", durationMs: 0 })).toBe(true);
		expect(isDeny({ outcome: "ALLOW", durationMs: 0 })).toBe(false);
	});

	test("isDeny", () => {
		expect(isDeny({ outcome: "DENY", reason: "nope", ruleId: "r1", durationMs: 0 })).toBe(true);
		expect(isAllow({ outcome: "DENY", reason: "nope", ruleId: "r1", durationMs: 0 })).toBe(false);
	});

	test("isHold", () => {
		expect(isHold({ outcome: "HOLD", approvalId: "a1", reason: "wait", durationMs: 0 })).toBe(true);
		expect(isAllow({ outcome: "HOLD", approvalId: "a1", reason: "wait", durationMs: 0 })).toBe(false);
	});
});

describe("errors", () => {
	test("InflectionError has requestId", () => {
		const err = new InflectionError("boom", "req_1");
		expect(err.requestId).toBe("req_1");
		expect(err.message).toBe("boom");
	});

	test("InflectionHttpError has status and body", () => {
		const err = new InflectionHttpError("boom", "req_1", 500, { detail: "oops" });
		expect(err.status).toBe(500);
		expect(err.body).toEqual({ detail: "oops" });
	});

	test("InflectionNetworkError has cause", () => {
		const cause = new Error("timeout");
		const err = new InflectionNetworkError("boom", "req_1", cause);
		expect(err.cause).toBe(cause);
	});
});

describe("constants", () => {
	test("ACTIONS_BY_RAIL has expected rails", () => {
		expect(Object.keys(ACTIONS_BY_RAIL)).toContain("stripe");
		expect(Object.keys(ACTIONS_BY_RAIL)).toContain("circle");
		expect(ACTIONS_BY_RAIL.stripe).toContain("charges.create");
	});

	test("CURRENCIES_BY_RAIL has currencies", () => {
		expect(CURRENCIES_BY_RAIL.stripe).toContain("usd");
		expect(CURRENCIES_BY_RAIL.circle).toContain("usdc");
	});

	test("MONETARY_ACTIONS_BY_RAIL subset", () => {
		expect(MONETARY_ACTIONS_BY_RAIL.stripe).toContain("charges.create");
		expect(MONETARY_ACTIONS_BY_RAIL.stripe).not.toContain("customers.create");
	});
});

describe("createMockClient", () => {
	test("defaults to ALLOW", async () => {
		const client = createMockClient();
		const result = await client.execute({
			rail: "stripe",
			action: "charges.create",
			args: {},
			idempotencyKey: "idem-1",
		});
		expect(result.outcome).toBe("ALLOW");
		expect(client.calls.length).toBe(1);
	});

	test("supports overrides by rail", async () => {
		const client = createMockClient({
			overrides: [
				{
					rail: "stripe",
					action: "charges.create",
					response: { outcome: "DENY", reason: "nope", ruleId: "r1", durationMs: 0 },
				},
			],
		});
		const result = await client.execute({
			rail: "stripe",
			action: "charges.create",
			args: {},
			idempotencyKey: "idem-1",
		});
		expect(result.outcome).toBe("DENY");
	});

	test("stripe helper works with mock", async () => {
		const client = createMockClient();
		const result = await client.stripe.charges.create({
			amount: 5000,
			currency: "usd",
			source: "tok_visa",
			idempotencyKey: "idem-1",
		});
		expect(result.outcome).toBe("ALLOW");
		expect(client.calls[0].action).toBe("charges.create");
		expect(client.calls[0].amount).toBe("50.00");
		expect(client.calls[0].rail).toBe("stripe");
	});
});
