import { describe, expect, it } from "vitest";
import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";
import { mcpAccessDenied } from "@/lib/mcp/tools/dispatch";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";

const readOnlyCtx: McpAuthContext = {
  scopes: ["read"],
  profileId: "00000000-0000-4000-8000-000000000099",
  mcpAgent: true,
  tokenId: "40000000-0000-4000-8000-000000000099",
  tokenName: null,
};

describe("MCP dispatch access", () => {
  it("blocks write/admin tools for read-only agent tokens", () => {
    for (const t of MCP_TOOL_DEFINITIONS) {
      if (t.access === "read") continue;
      const denied = mcpAccessDenied(t.name, readOnlyCtx);
      expect(denied, t.name).toEqual({
        ok: false,
        error: "Token somente leitura (read).",
      });
    }
  });

  it("allows read tools with read scope", () => {
    const denied = mcpAccessDenied("list_operations", readOnlyCtx);
    expect(denied).toBeNull();
  });
});
