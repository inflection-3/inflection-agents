// AES-256-GCM envelope encryption for connector credentials.
// Dev mode: 32-byte key from CREDENTIALS_ENCRYPTION_KEY env var (hex).
// Prod: swap getDataKey() to call KMS and store encrypted data key alongside IV.

const IV_BYTES = 12;

function getDataKey(): Uint8Array {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  // Uint8Array.from ensures a clean ArrayBuffer (not SharedArrayBuffer) for SubtleCrypto
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export interface EncryptResult {
  ciphertext: Buffer;   // stored in credentials_encrypted (BLOB)
  iv: string;           // base64 — stored in credentials_iv
  keyId: string;        // stored in credentials_key_id ('local' in dev)
}

export async function encryptCredentials(plainJson: object): Promise<EncryptResult> {
  const key = getDataKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const encoded = new TextEncoder().encode(JSON.stringify(plainJson));
  const cryptoKey = await crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);

  return {
    ciphertext: Buffer.from(encrypted),
    iv: Buffer.from(iv).toString("base64"),
    keyId: "local",
  };
}

export async function decryptCredentials<T>(
  ciphertext: Buffer | Uint8Array,
  iv: string
): Promise<T> {
  const key = getDataKey();
  const ivBytes = Uint8Array.from(Buffer.from(iv, "base64"));
  const ct = Uint8Array.from(ciphertext instanceof Buffer ? ciphertext : Buffer.from(ciphertext));

  const cryptoKey = await crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, cryptoKey, ct);

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
