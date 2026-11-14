import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(dir, "20261113163000_member_access_hardening.sql"),
  "utf8",
);

describe("migration 20261113163000_member_access_hardening", () => {
  it("restringe área a operation_members", () => {
    expect(sql).toContain("public.can_see_operation(p_op_id)");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_area_granted/);
  });

  it("cofre só com membership", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.can_access_client_vault/);
    expect(sql).toContain("public.can_see_operation(o.id)");
  });

  it("operation_costs admin-only", () => {
    expect(sql).toContain("operation_costs_admin_select");
    expect(sql).toContain("USING (public.is_admin())");
  });

  it("financeiro em tabelas admin-only", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.operation_financials");
    expect(sql).toContain("DROP COLUMN IF EXISTS monthly_recurring_revenue");
    expect(sql).toContain("person_compensation");
    expect(sql).toContain("allocation_cost_metrics");
  });

  it("catálogo picker RPC sem política team-wide", () => {
    expect(sql).toContain("catalog_picker_villains");
    expect(sql).not.toContain("villains_member_operation_team");
  });

  it("link público insert admin", () => {
    expect(sql).toContain("public_links_admin_insert");
  });

  it("webhook resolve + notify pgrst", () => {
    expect(sql).toContain("resolve_operation_notification_webhook");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
