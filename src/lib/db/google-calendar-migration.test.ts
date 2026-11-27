import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("google calendar migration", () => {
  it("define tabela singleton e colunas em meetings", () => {
    const sql = readFileSync(
      "supabase/migrations/20261126120000_google_calendar_integration.sql",
      "utf8",
    );
    expect(sql).toContain("google_calendar_connections");
    expect(sql).toContain("google_calendar_sync_status");
    expect(sql).toContain("google_meet_link");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("is_admin()");
  });
});