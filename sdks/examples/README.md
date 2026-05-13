# SDK Examples

## `stripe-agent.ts`

Real-world Stripe agent that connects to a live Inflection backend.

```bash
# Set credentials
export INFLECTION_API_KEY=infl_test_...
export STRIPE_CONNECTOR_ID=conn_...
export INFLECTION_BASE_URL=http://localhost:3001

# Run
bun run examples/stripe-agent.ts
```

Demonstrates:
- `inflection.stripe(connectorId).charges.create(...)`
- `inflection.stripe(connectorId).paymentIntents.create(...)`
- `inflection.stripe(connectorId).refunds.create(...)`
- `inflection.execute({ ... })` raw call
- Polling `getApproval()` on HOLD
- Idempotency key generation
- `isAllow`, `isDeny`, `isHold` guards

## `mock-agent.ts`

Test agent using `createMockClient` — no backend needed.

```bash
bun run examples/mock-agent.ts
```

Demonstrates:
- `createMockClient({ defaultOutcome, overrides })`
- Per-action override responses
- Recording calls for assertions
- Type guard usage
