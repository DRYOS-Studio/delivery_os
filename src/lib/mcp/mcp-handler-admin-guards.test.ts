import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { mcpCreateClientContract } from "@/lib/mcp/tools/contracts-tools";
import {
  mcpEndOperationCost,
  mcpVoidOperationCost,
} from "@/lib/mcp/tools/delivery-ops-tools";
import { mcpCreateServiceProduct } from "@/lib/mcp/tools/catalog-admin-tools";
import { mcpArchivePerson } from "@/lib/mcp/tools/parity-tools";
import { dispatchMcpTool } from "@/lib/mcp/tools/dispatch";
import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";

const MEMBER = "22222222-2222-4222-8222-222222222222";

function memberSupabase(): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: "member" }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

const ctx = { supabase: memberSupabase(), callerUserId: MEMBER };

const readToken: McpAuthContext = {
  scopes: ["read"],
  profileId: MEMBER,
  mcpAgent: true,
};

describe("MCP handler admin guards", () => {
  it("mcpCreateClientContract denies non-admin", async () => {
    const r = await mcpCreateClientContract(ctx, { client_id: "00000000-0000-4000-8000-000000000001", label: "X" });
    expect(r).toMatchObject({ ok: false, forbidden: true });
  });

  it("mcpCreateServiceProduct denies non-admin", async () => {
    const r = await mcpCreateServiceProduct(ctx, { name: "T", slug: "t" });
    expect(r).toMatchObject({ ok: false, forbidden: true });
  });

  it("mcpEndOperationCost denies non-admin", async () => {
    const r = await mcpEndOperationCost(ctx, {
      cost_id: "00000000-0000-4000-8000-000000000002",
      ended_at: "2026-11-07",
    });
    expect(r).toMatchObject({ ok: false, forbidden: true });
  });

  it("mcpVoidOperationCost denies non-admin", async () => {
    const r = await mcpVoidOperationCost(ctx, {
      cost_id: "00000000-0000-4000-8000-000000000002",
    });
    expect(r).toMatchObject({ ok: false, forbidden: true });
  });

  it("mcpArchivePerson denies non-admin", async () => {
    const r = await mcpArchivePerson(ctx, {
      person_id: "00000000-0000-4000-8000-000000000003",
    });
    expect(r).toMatchObject({ ok: false, forbidden: true });
  });

  it("dispatch blocks write tools for read-only token before handler", async () => {
    const r = await dispatchMcpTool({
      toolName: "create_client_contract",
      args: { client_id: "00000000-0000-4000-8000-000000000001", label: "X" },
      ctx,
      mcpCtx: readToken,
    });
    expect(r).toEqual({ ok: false, error: "Token somente leitura (read)." });
  });
});
