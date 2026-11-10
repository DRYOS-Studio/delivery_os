import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  VaultEncryptionConfigError,
} from "@/lib/vault/credential-crypto";

const VALID_KEY = Buffer.alloc(32, 7).toString("base64");

describe("credential-crypto", () => {
  beforeEach(() => {
    process.env.VAULT_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.VAULT_ENCRYPTION_KEY;
  });

  it("ida e volta AES-256-GCM", () => {
    const { ciphertext, keyVersion } = encryptCredentialSecret("hunter2");
    expect(ciphertext).not.toContain("hunter2");
    expect(decryptCredentialSecret(ciphertext, keyVersion)).toBe("hunter2");
  });

  it("falha sem env", () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    expect(() => encryptCredentialSecret("x")).toThrow(VaultEncryptionConfigError);
  });
});
