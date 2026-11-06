import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: profiles UPDATE policy must not subquery `profiles` — that
 * re-enters RLS on SELECT (profiles_scoped_select) → infinite recursion in production.
 */
describe("migration profiles_admin_update_no_recursion", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261106210000_profiles_admin_update_no_recursion.sql",
    ),
    "utf8",
  );

  it("uses public.is_admin() for USING and WITH CHECK", () => {
    expect(sql).toContain("USING (public.is_admin())");
    expect(sql).toContain("WITH CHECK (public.is_admin())");
  });

  it("CREATE POLICY body does not SELECT from profiles (recursion hazard)", () => {
    const block = sql.match(
      /CREATE POLICY profiles_admin_update[\s\S]*?\);/,
    )?.[0];
    expect(block).toBeDefined();
    expect(block).not.toMatch(/SELECT\s+role\s+FROM/i);
  });
});
