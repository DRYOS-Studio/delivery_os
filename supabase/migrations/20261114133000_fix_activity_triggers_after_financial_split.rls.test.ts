import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(dir, "20261114133000_fix_activity_triggers_after_financial_split.sql"),
  "utf8",
);

describe("migration 20261114133000_fix_activity_triggers_after_financial_split", () => {
  it("remove referências a colunas financeiras em operations trigger", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.trg_log_activity_operations()");
    expect(sql).not.toMatch(
      /trg_log_activity_operations\(\)[\s\S]*NEW\.recurrence/,
    );
    expect(sql).not.toMatch(
      /trg_log_activity_operations\(\)[\s\S]*NEW\.monthly_recurring_revenue/,
    );
    expect(sql).not.toMatch(
      /trg_log_activity_operations\(\)[\s\S]*NEW\.notification_webhook_url/,
    );
  });

  it("audita financeiro em operation_financials", () => {
    expect(sql).toContain("trg_log_activity_operation_financials");
    expect(sql).toContain("trg_activity_operation_financials_aiu");
    expect(sql).toContain("NEW.tax_rate_pct");
  });
});
