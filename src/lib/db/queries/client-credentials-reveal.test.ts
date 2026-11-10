import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { revealClientCredentialSecrets } from "@/lib/db/queries/client-credentials";
import { encryptCredentialSecret } from "@/lib/vault/credential-crypto";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const CRED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR = "22222222-2222-4222-8222-222222222222";

describe("revealClientCredentialSecrets", () => {
  it("grava log de reveal", async () => {
    process.env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const { ciphertext, keyVersion } = encryptCredentialSecret("secret-pass");
    const auditRows: Record<string, unknown>[] = [];

    const supabase = {
      from(table: string) {
        if (table === "client_credentials") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: CRED_ID,
                    client_id: CLIENT_ID,
                    key_version: keyVersion,
                    password_ciphertext: ciphertext,
                    notes_ciphertext: null,
                    two_factor_ciphertext: null,
                    archived_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "client_credential_audit_logs") {
          return {
            insert: (row: Record<string, unknown>) => {
              auditRows.push(row);
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "profile_display_names") {
          return {
            select: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const out = await revealClientCredentialSecrets(
      CRED_ID,
      ACTOR,
      { action: "reveal", reason: "teste automatizado" },
      supabase,
    );
    expect(out.password).toBe("secret-pass");
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      credential_id: CRED_ID,
      client_id: CLIENT_ID,
      action: "reveal",
      reason: "teste automatizado",
    });
    delete process.env.VAULT_ENCRYPTION_KEY;
  });
});
