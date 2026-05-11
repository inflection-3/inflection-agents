# Agentic Payments — Provider Docs

A reference for building AI agents that can make autonomous payments using real test environments. No mocks, no fake data — every provider here has a real sandbox or testnet you can use for free.

---

## What Are Agentic Payments?

An agentic payment is when an AI agent autonomously spends money during a task — paying for API calls, data, tools, or services — without stopping to ask the human each time. The agent is pre-authorized with a budget and payment credentials, then acts independently.

### Two Core Patterns

**Push model (pre-fund)** — Human funds a wallet/balance upfront. Agent spends from it autonomously.
- Used by: x402, Coinbase AgentKit, Circle

**Pull model (stored authorization)** — User authorizes a payment method once. Agent charges it on demand.
- Used by: Stripe, Braintree, Square, Razorpay, Google Pay

---

## Providers Covered

| Provider | Type | Best For | Test Environment | Fiat / Crypto |
|---|---|---|---|---|
| [Stripe](./stripe.md) | Pull | Fiat billing, subscriptions | `sk_test_` keys | Fiat |
| [x402](./x402.md) | Push | HTTP micropayments, API access | Base Sepolia testnet | Crypto (USDC) |
| [Coinbase AgentKit](./coinbase-agentkit.md) | Push | Purpose-built agent wallet | Base Sepolia + CDP faucet | Crypto |
| [Braintree](./braintree.md) | Pull | PayPal ecosystem, vaulted cards | Sandbox portal | Fiat |
| [Square](./square.md) | Pull | Retail, general payments | Sandbox portal | Fiat |
| [Circle](./circle.md) | Push | Programmable USDC wallets | Testnet + faucet | USDC |
| [Razorpay](./razorpay.md) | Pull | India / INR payments | `rzp_test_` keys | Fiat (INR) |
| [Google Pay](./google-pay.md) | Pull (tokenizer) | Frontend card auth for agents | Test card suite | Fiat (via processor) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent                             │
│                                                             │
│  "I need to fetch paid data / charge a user / send funds"  │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │  Pull       │  │   Push      │  │ Tokenizer  │
    │  (Stripe,   │  │  (AgentKit, │  │ (Google    │
    │  Braintree, │  │   x402,     │  │  Pay)      │
    │  Square,    │  │   Circle)   │  │            │
    │  Razorpay)  │  │             │  └─────┬──────┘
    └─────────────┘  └─────────────┘        │
                                      passes token to
                                      Stripe/Braintree
```

---

## Choosing a Provider

**I want the simplest setup with fiat** → [Stripe](./stripe.md)

**I want crypto micropayments between services** → [x402](./x402.md)

**I want an agent with its own wallet** → [Coinbase AgentKit](./coinbase-agentkit.md)

**I'm in India / building for INR** → [Razorpay](./razorpay.md)

**Users already use Google Pay** → [Google Pay](./google-pay.md) + [Stripe](./stripe.md)

**I want USDC programmable wallets** → [Circle](./circle.md)

**I'm in the PayPal ecosystem** → [Braintree](./braintree.md)

---

## Common Test Environment Setup Checklist

- [ ] Create a free developer account with the provider
- [ ] Get test/sandbox API keys (never use live keys in dev)
- [ ] Store keys in `.env` file, never commit to git
- [ ] For crypto providers: get testnet funds from a faucet
- [ ] Verify agent can authenticate and make a test transaction
- [ ] Check the provider's dashboard to confirm test transactions appear

---

## Environment Variables Template

```env
# Stripe
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...

# Coinbase AgentKit
CDP_API_KEY_NAME=...
CDP_API_KEY_PRIVATE_KEY=...

# Braintree
BT_MERCHANT_ID=...
BT_PUBLIC_KEY=...
BT_PRIVATE_KEY=...

# Square
SQUARE_SANDBOX_TOKEN=...

# Circle
CIRCLE_API_KEY=...

# Razorpay
RAZORPAY_TEST_KEY_ID=rzp_test_...
RAZORPAY_TEST_KEY_SECRET=...

# Claude (for the agent)
ANTHROPIC_API_KEY=sk-ant-...
```
