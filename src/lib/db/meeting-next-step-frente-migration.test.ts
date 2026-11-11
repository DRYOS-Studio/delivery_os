import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("meeting next step frente migration", () => {
  it("é idempotente e notifica PostgREST", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261111150000_meeting_next_step_frente_auto_tasks.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
