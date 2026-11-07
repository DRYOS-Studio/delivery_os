import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS, mcpToolAccess } from "@/lib/mcp/tools/registry";

describe("MCP tool registry", () => {
  it("exposes expanded tool surface (>8)", () => {
    expect(MCP_TOOL_DEFINITIONS.length).toBeGreaterThan(65);
  });

  it("tags every tool with access level", () => {
    for (const t of MCP_TOOL_DEFINITIONS) {
      expect(["read", "write", "admin"]).toContain(t.access);
      expect(mcpToolAccess(t.name)).toBe(t.access);
    }
  });

  it("does not expose sensitive admin surfaces", () => {
    const names = MCP_TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).not.toContain("issue_mcp_token");
    expect(names).not.toContain("list_credentials");
    expect(names).not.toContain("execute_sql");
  });
});
