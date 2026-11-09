import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration profile_display_name", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261109240000_profile_display_name.sql",
    ),
    "utf8",
  );

  it("define resolve_profile_display_name com persons por e-mail", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.resolve_profile_display_name");
    expect(sql).toContain("pe.kind = 'internal'");
    expect(sql).toContain("lower(trim(pe.email)) = lower(trim(v_email))");
  });

  it("resolve_activity_actor_name delega ao resolver de display", () => {
    expect(sql).toContain(
      "SELECT public.resolve_profile_display_name(p_profile_id)",
    );
  });

  it("expõe view profile_display_names para o app", () => {
    expect(sql).toContain("CREATE OR REPLACE VIEW public.profile_display_names");
    expect(sql).toContain("GRANT SELECT ON public.profile_display_names");
  });

  it("backfill actor_name quando valor é só prefixo de e-mail", () => {
    expect(sql).toContain(
      "ae.actor_name = split_part(u.email, '@', 1)",
    );
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
