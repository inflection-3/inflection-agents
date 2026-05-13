#!/usr/bin/env bun
/**
 * Mock Agent Example
 *
 * Demonstrates how to test an agent locally using createMockClient.
 * No backend required — policies are simulated.
 *
 * Usage:
 *   bun run examples/mock-agent.ts
 */

import { createMockClient } from "../src/testing";
import { isAllow, isDeny, isHold } from "../src";
import type { ExecuteResponse } from "../src";

// ─── Configure mock client ─────────────────────────────────────────────────────

const inflection = createMockClient({
	defaultOutcome: "ALLOW",
	overrides: [
		{
			connectorId: "conn_demo",
			action: "charges.create",
			response: {
				outcome: "DENY",
				reason: "Daily limit exceeded",
				ruleId: "dailyLimit",
				durationMs: 5,
			},
		},
		{
			connectorId: "conn_demo",
			action: "payouts.create",
			response: {
				outcome: "HOLD",
				approvalId: "appr_demo_1",
				reason: "Human approval required",
				durationMs: 3,
			},
		},
	],
});

// ─── Helper ────────────────────────────────────────────────────────────────────

function printResult(label: string, result: ExecuteResponse) {
	if (isAllow(result)) console.log(`✅ ${label}: ALLOW`);
	else if (isDeny(result)) console.log(`❌ ${label}: DENY — ${result.reason}`);
	else if (isHold(result)) console.log(`⏳ ${label}: HOLD — ${result.approvalId}`);
}

// ─── Scenarios ─────────────────────────────────────────────────────────────────

async function main() {
	console.log("🧪 Mock Agent Example\n");

	// This will match the override → DENY
	const denyResult = await inflection.stripe("conn_demo").charges.create({
		amount: 10_000,
		currency: "usd",
		source: "tok_visa",
		idempotencyKey: "mock-1",
	});
	printResult("Overage charge", denyResult);

	// This will match the override → HOLD
	const holdResult = await inflection.stripe("conn_demo").payouts.create({
		amount: 50_000,
		currency: "usd",
		idempotencyKey: "mock-2",
	});
	printResult("Large payout", holdResult);

	// This will fall through to defaultOutcome → ALLOW
	const allowResult = await inflection.stripe("conn_demo").customers.create({
		email: "test@example.com",
		name: "Test Customer",
		idempotencyKey: "mock-3",
	});
	printResult("Create customer", allowResult);

	// Inspect all calls made
	console.log("\n📋 All calls recorded:");
	for (const call of inflection.calls) {
		console.log(`   ${call.action} → amount: ${call.amount ?? "n/a"}`);
	}
}

main();
