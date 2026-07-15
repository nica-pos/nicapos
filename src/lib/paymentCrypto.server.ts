import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// Derive a 32-byte key from PAYMENT_CREDENTIALS_SECRET (any length string) via SHA-256.
function key(): Buffer {
  const raw = process.env.PAYMENT_CREDENTIALS_SECRET;
  if (!raw) throw new Error("PAYMENT_CREDENTIALS_SECRET no está configurado");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function maskSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const plain = decryptSecret(stored);
    if (plain.length <= 6) return "••••";
    return `••••${plain.slice(-4)}`;
  } catch {
    return "••••";
  }
}
