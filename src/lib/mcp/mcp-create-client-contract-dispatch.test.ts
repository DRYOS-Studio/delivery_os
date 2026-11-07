import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { dispatchMcpTool } from "@/lib/mcp/tools/dispatch";
import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const assisArgs = {
  client_id: CLIENT_ID,
  label: "DRYOS OS Basic — aceite WhatsApp",
  monthly_value: 397,
  implementation_fee: 1000,
  implementation_fee_paid: true,
  currency: "BRL",
  start_date: "2026-11-04",
  first_billing_date: "2026-12-14",
  payment_day_of_month: 14,
  status: "vigente",
  notes: "Aceite por WhatsApp, sem assinatura formal.",
  idempotency_key: "assis-sat-metadata-0001",
} as const;

function adminSupabaseWithContractCapture() {
  let inserted: Record<string, unknown> | null = null;
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
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                inserted = row;
                return { data: { id: "11111111-1111-4111-8111-222222222222" }, error: null };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
    get lastInsert() {
      return inserted;
    },
  } as unknown as SupabaseClient<Database> & { lastInsert: Record<string, unknown> | null };
  return client;
}

const adminMcp: McpAuthContext = {
  scopes: ["read", "write"],
  profileId: ADMIN,
  mcpAgent: true,
};

describe("create_client_contract via dispatch (tools/list-shaped args)", () => {
  it("persists metadata-only contract row when admin token and args match published schema", async () => {
    const supabase = adminSupabaseWithContractCapture();
    const ctx = { supabase, callerUserId: ADMIN };

    const listProps =
      MCP_TOOL_DEFINITIONS.find((t) => t.name === "create_client_contract")?.inputSchema
        .properties ?? {};
    for (const key of Object.keys(assisArgs)) {
      expect(listProps, `tools/list missing property ${key}`).toHaveProperty(key);
    }

    const r = await dispatchMcpTool({
      toolName: "create_client_contract",
      args: { ...assisArgs },
      ctx,
      mcpCtx: adminMcp,
    });

    expect(r).toMatchObject({
      ok: true,
      id: "11111111-1111-4111-8111-222222222222",
    });

    const row = (supabase as ReturnType<typeof adminSupabaseWithContractCapture>).lastInsert;
    expect(row).toMatchObject({
      client_id: CLIENT_ID,
      label: assisArgs.label,
      monthly_value: 397,
      implementation_fee: 1000,
      implementation_fee_paid: true,
      start_date: "2026-11-04",
      first_billing_date: "2026-12-14",
      payment_day_of_month: 14,
      status: "vigente",
      notes: assisArgs.notes,
      storage_path: null,
      filename: null,
      mime_type: null,
      size_bytes: 0,
    });
    expect(row).not.toHaveProperty("implementation_fee_paid_at");
  });
});
