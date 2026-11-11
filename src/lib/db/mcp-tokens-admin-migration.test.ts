import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mcp tokens admin migration", () => {
  it("é idempotente e notifica PostgREST", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261111180000_mcp_tokens_admin_vault_audit.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("token_prefix");
    expect(sql).toContain("actor_mcp_token_id");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
