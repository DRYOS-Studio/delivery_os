import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration activity_events_actor_name", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261109140000_activity_events_actor_name.sql",
    ),
    "utf8",
  );

  it("adiciona coluna actor_name de forma idempotente", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS actor_name");
  });

  it("popula actor_name em log_activity_event_system", () => {
    expect(sql).toContain("resolve_activity_actor_name(v_actor)");
    expect(sql).toMatch(/INSERT INTO public\.activity_events[\s\S]*actor_name/);
  });

  it("faz backfill idempotente", () => {
    expect(sql).toContain(
      "SET actor_name = public.resolve_activity_actor_name(ae.actor_profile_id)",
    );
  });
});
