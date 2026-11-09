import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing required env var: SUPABASE_SECRET_KEY");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptRegistrationToken(rawToken: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptRegistrationToken(encrypted: string): string | null {
  try {
    const key = encryptionKey();
    const buf = Buffer.from(encrypted, "base64url");
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
