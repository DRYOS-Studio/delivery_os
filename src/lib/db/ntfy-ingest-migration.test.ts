import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migrations ntfy integration", () => {
  const enumSql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261110200000_ntfy_sla_enums.sql"),
    "utf8",
  );
  const activityEnumSql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261110200001_activity_sla_incident_enum.sql",
    ),
    "utf8",
  );
  const mainSql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261110200002_ntfy_integration.sql"),
    "utf8",
  );

  it("enum migration é separada do activity ADD VALUE", () => {
    expect(activityEnumSql).toContain("sla_incident");
    expect(enumSql).not.toContain("activity_subject_type");
  });

  it("cria tabelas de idempotência e mapeamento", () => {
    expect(mainSql).toContain("operation_ntfy_topics");
    expect(mainSql).toContain("ntfy_message_receipts");
    expect(mainSql).toContain("ntfy_unmapped_alerts");
  });

  it("registra activity para sla_incident", () => {
    expect(mainSql).toContain("trg_log_activity_sla_incidents");
    expect(mainSql).toContain("WHEN 'sla_incident'");
  });
});
