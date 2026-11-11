import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client credentials vault migration", () => {
  it("define RLS e função de acesso", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261110500000_client_credentials_vault.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("can_access_client_vault");
    expect(sql).toContain("client_credentials_scoped_all");
    expect(sql).toContain("client_credential_audit_insert");
    expect(sql).not.toContain("password text");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
