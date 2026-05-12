/**
 * Connector integration tests.
 * Stripe: test mode (real API calls, no charges settle).
 * x402:   base-sepolia (read-only balanceOf — no gas spent).
 * Encryption: pure unit test, no network.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { StripeConnector } from "../src/connectors/stripe";
import { X402Connector } from "../src/connectors/x402";
import { encryptCredentials, decryptCredentials } from "../src/connectors/encryption";
import { privateKeyToAccount } from "viem/accounts";

// Load creds from root .env (Bun auto-loads .env in current dir;
// we read the root one manually since we run from backend/)
import { readFileSync } from "fs";
import { join } from "path";

function loadRootEnv() {
  try {
    const env = readFileSync(join(import.meta.dir, "../../.env"), "utf-8");
    for (const line of env.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key?.trim() && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch {
    // .env not found — rely on environment variables being set externally
  }
}
loadRootEnv();

// Test encryption key — static 32-byte hex for unit tests
const TEST_ENC_KEY = "a".repeat(64); // 32 bytes of 0xaa

// ─── Encryption ───────────────────────────────────────────────────────────────

describe("encryptCredentials / decryptCredentials", () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_ENC_KEY;
  });

  test("round-trips arbitrary JSON", async () => {
    const payload = { accessToken: "sk_test_abc123", extra: { nested: true } };
    const { ciphertext, iv, keyId } = await encryptCredentials(payload);

    expect(ciphertext).toBeInstanceOf(Buffer);
    expect(iv).toBeTypeOf("string");
    expect(keyId).toBe("local");

    const decrypted = await decryptCredentials<typeof payload>(ciphertext, iv);
    expect(decrypted.accessToken).toBe("sk_test_abc123");
    expect(decrypted.extra.nested).toBe(true);
  });

  test("ciphertext differs each call (random IV)", async () => {
    const payload = { key: "same-value" };
    const r1 = await encryptCredentials(payload);
    const r2 = await encryptCredentials(payload);
    expect(r1.iv).not.toBe(r2.iv);
    expect(r1.ciphertext.toString("hex")).not.toBe(r2.ciphertext.toString("hex"));
  });

  test("throws on tampered ciphertext", async () => {
    const { ciphertext, iv } = await encryptCredentials({ secret: "value" });
    ciphertext[0] ^= 0xff; // flip first byte
    expect(decryptCredentials(ciphertext, iv)).rejects.toThrow();
  });

  test("throws on wrong key", async () => {
    const { ciphertext, iv } = await encryptCredentials({ secret: "value" });
    process.env.CREDENTIALS_ENCRYPTION_KEY = "b".repeat(64); // different key
    await expect(decryptCredentials(ciphertext, iv)).rejects.toThrow();
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_ENC_KEY; // restore
  });

  test("throws when key env var is missing", async () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    await expect(encryptCredentials({ x: 1 })).rejects.toThrow("CREDENTIALS_ENCRYPTION_KEY");
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_ENC_KEY; // restore
  });
});

// ─── StripeConnector ──────────────────────────────────────────────────────────

describe("StripeConnector", () => {
  const stripeKey = process.env.STRIPE_TEST_SECRET_KEY;

  if (!stripeKey) {
    test.skip("STRIPE_TEST_SECRET_KEY not set — skipping", () => {});
    // @ts-ignore
    return;
  }

  const connector = new StripeConnector({ accessToken: stripeKey });

  test("validate() succeeds with test key", async () => {
    await expect(connector.validate()).resolves.toBeUndefined();
  });

  test("customers.create creates a test customer", async () => {
    const result = await connector.execute({
      action: "customers.create",
      args: { email: "test-connector@inflection.dev", name: "Connector Test" },
      idempotencyKey: `test-${Date.now()}`,
    });

    expect(result.providerTxId).toMatch(/^cus_/);
    expect((result.raw as any).email).toBe("test-connector@inflection.dev");
  });

  test("paymentIntents.create returns a PaymentIntent", async () => {
    const result = await connector.execute({
      action: "paymentIntents.create",
      args: {
        amount: 1000,      // $10.00
        currency: "usd",
        payment_method_types: ["card"],
      },
      idempotencyKey: `pi-test-${Date.now()}`,
    });

    expect(result.providerTxId).toMatch(/^pi_/);
    expect((result.raw as any).status).toBe("requires_payment_method");
    expect((result.raw as any).amount).toBe(1000);
  });

  test("extractRecipientId returns customer for charges/intents", () => {
    const recipientId = connector.extractRecipientId({
      action: "charges.create",
      args: { customer: "cus_abc123" },
      idempotencyKey: "test",
    });
    expect(recipientId).toBe("cus_abc123");
  });

  test("extractRecipientId returns destination for payouts", () => {
    const recipientId = connector.extractRecipientId({
      action: "payouts.create",
      args: { destination: "ba_abc123", amount: 1000, currency: "usd" },
      idempotencyKey: "test",
    });
    expect(recipientId).toBe("ba_abc123");
  });

  test("throws on unsupported action", async () => {
    await expect(
      connector.execute({ action: "unknown.action", args: {}, idempotencyKey: "test" })
    ).rejects.toThrow("unsupported action");
  });
});

// ─── X402Connector ────────────────────────────────────────────────────────────

describe("X402Connector", () => {
  const privateKey = process.env.WALLET_PRIVATE_KEY as `0x${string}` | undefined;

  if (!privateKey) {
    test.skip("WALLET_PRIVATE_KEY not set — skipping", () => {});
    // @ts-ignore
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const connector = new X402Connector({
    privateKey,
    address: account.address,
    chain: "base-sepolia",
  });

  test("balanceOf reads USDC balance from Base Sepolia", async () => {
    const result = await connector.execute({
      action: "balanceOf",
      args: { address: account.address },
      idempotencyKey: "test",
    });

    const raw = result.raw as { balance: string; address: string };
    expect(raw.address).toBe(account.address);
    expect(parseFloat(raw.balance)).toBeGreaterThanOrEqual(0);
  }, 20_000); // allow time for RPC call

  test("extractRecipientId returns `to` field", () => {
    const recipientId = connector.extractRecipientId({
      action: "transfer",
      args: { to: "0xdeadbeef", amount: "1.00" },
      idempotencyKey: "test",
    });
    expect(recipientId).toBe("0xdeadbeef");
  });

  test("throws on unsupported action", async () => {
    await expect(
      connector.execute({ action: "unknown", args: {}, idempotencyKey: "test" })
    ).rejects.toThrow("unsupported action");
  });
});
