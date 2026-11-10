import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { dispatchMcpTool } from "@/lib/mcp/tools/dispatch";
import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";
import { buildPlannedChargesFromContract } from "@/lib/utils/generate-client-charges";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const CONTRACT_ID = "8e79c305-1629-4f82-8dbe-6ce9cbde1369";
const CLIENT_ID = "9af2985d-10c2-4301-99d2-8100e1b36541";

const contractRow = {
  id: CONTRACT_ID,
  client_id: CLIENT_ID,
  status: "vigente",
  monthly_value: 1000,
  implementation_fee: 0,
  implementation_fee_paid: false,
  first_billing_date: "2026-10-26",
  start_date: "2026-10-25",
  end_date: "2027-04-24",
  payment_day_of_month: 26,
  label: "Contrato com PDF",
  storage_path: "client/file.pdf",
  filename: "file.pdf",
};

function adminMcpSupabase(opts?: {
  onUpdate?: (patch: Record<string, unknown>) => void;
  onChargeInsert?: (row: Record<string, unknown>) => void;
}) {
  const client = {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: "admin" }, error: null }),
            }),
          }),
        };
      }
      if (table === "client_contracts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: contractRow, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              opts?.onUpdate?.(patch);
              return { error: null };
            },
          }),
        };
      }
      if (table === "operations") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { id: "op-1" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "client_charges") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              maybeSingle: async () => {
                opts?.onChargeInsert?.(row);
                return { data: { id: "charge-1" }, error: null };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient<Database>;
  return client;
}

const adminMcp: McpAuthContext = {
  scopes: ["read", "write"],
  profileId: ADMIN,
  mcpAgent: true,
};

describe("MCP contratos e cobranças", () => {
  it("update_client_contract não lança com patch mínimo (regressão Zod omit)", async () => {
    let patch: Record<string, unknown> | null = null;
    const supabase = adminMcpSupabase({
      onUpdate: (p) => {
        patch = p;
      },
    });
    const r = await dispatchMcpTool({
      toolName: "update_client_contract",
      args: {
        contract_id: CONTRACT_ID,
        label: "Contrato de infraestrutura Digital e Performance",
        status: "vigente",
        end_date: "2027-04-24",
      },
      ctx: { supabase, callerUserId: ADMIN },
      mcpCtx: adminMcp,
    });
    expect(r).toMatchObject({ ok: true, id: CONTRACT_ID });
    expect(patch).toEqual({
      label: "Contrato de infraestrutura Digital e Performance",
      status: "vigente",
      end_date: "2027-04-24",
    });
  });

  it("generate_client_charges encontra contrato via supabase do MCP", async () => {
    const inserted: Record<string, unknown>[] = [];
    const supabase = adminMcpSupabase({
      onChargeInsert: (row) => inserted.push(row),
    });
    const r = await dispatchMcpTool({
      toolName: "generate_client_charges",
      args: { contract_id: CONTRACT_ID, months_ahead: 6 },
      ctx: { supabase, callerUserId: ADMIN },
      mcpCtx: adminMcp,
    });
    expect(r).toMatchObject({ ok: true, inserted: 6 });
    expect(inserted).toHaveLength(6);
    const dues = inserted
      .filter((row) => row.charge_type === "mensalidade")
      .map((row) => row.due_date);
    expect(dues).toEqual([
      "2026-10-26",
      "2026-11-26",
      "2026-12-26",
      "2027-01-26",
      "2027-02-26",
      "2027-03-26",
    ]);
  });

  it("buildPlannedChargesFromContract alinha vencimentos ao contrato pré-pago", () => {
    const rows = buildPlannedChargesFromContract(
      {
        id: CONTRACT_ID,
        clientId: CLIENT_ID,
        status: "vigente",
        monthlyValue: 1000,
        implementationFee: 0,
        implementationFeePaid: false,
        firstBillingDate: "2026-10-26",
        startDate: "2026-10-25",
        endDate: "2027-04-24",
        paymentDayOfMonth: 26,
      },
      null,
      6,
    );
    expect(rows.filter((r) => r.charge_type === "mensalidade").map((r) => r.due_date)).toEqual(
      [
        "2026-10-26",
        "2026-11-26",
        "2026-12-26",
        "2027-01-26",
        "2027-02-26",
        "2027-03-26",
      ],
    );
  });
});
