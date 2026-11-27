import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("operations catalog_group migration fix", () => {
  it("não repete typo plplpgsql e recarrega PostgREST", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261127120000_fix_operations_catalog_group_trigger.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS catalog_group");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION[\s\S]*LANGUAGE plpgsql/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION[\s\S]*LANGUAGE plplpgsql/);
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});