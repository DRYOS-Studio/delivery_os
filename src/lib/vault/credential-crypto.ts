import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_KEY_VERSION = 1;

export class VaultEncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultEncryptionConfigError";
  }
}

export function vaultEncryptionConfigured(): boolean {
  return loadVaultKeyBytes(DEFAULT_KEY_VERSION) !== null;
}

function loadVaultKeyBytes(keyVersion: number): Buffer | null {
  if (keyVersion !== DEFAULT_KEY_VERSION) {
    throw new VaultEncryptionConfigError(
      `Versão de chave não suportada: ${keyVersion}`,
    );
  }
  const b64 = process.env.VAULT_ENCRYPTION_KEY;
  if (!b64 || b64.trim() === "") return null;
  const key = Buffer.from(b64.trim(), "base64");
  if (key.length !== 32) {
    throw new VaultEncryptionConfigError(
      "VAULT_ENCRYPTION_KEY deve decodificar para 32 bytes (AES-256).",
    );
  }
  return key;
}

export function requireVaultKey(): Buffer {
  const key = loadVaultKeyBytes(DEFAULT_KEY_VERSION);
  if (!key) {
    throw new VaultEncryptionConfigError(
      "Cofre indisponível: defina VAULT_ENCRYPTION_KEY (32 bytes em base64).",
    );
  }
  return key;
}

export function encryptCredentialSecret(plaintext: string): {
  ciphertext: string;
  keyVersion: number;
} {
  const key = requireVaultKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]).toString("base64url");
  return { ciphertext: packed, keyVersion: DEFAULT_KEY_VERSION };
}

export function decryptCredentialSecret(
  ciphertext: string,
  keyVersion: number,
): string {
  const key = loadVaultKeyBytes(keyVersion);
  if (!key) {
    throw new VaultEncryptionConfigError(
      "Cofre indisponível: defina VAULT_ENCRYPTION_KEY (32 bytes em base64).",
    );
  }
  const buf = Buffer.from(ciphertext, "base64url");
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("Payload cifrado inválido.");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}
