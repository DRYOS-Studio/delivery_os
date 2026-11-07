import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";

/** Fingerprints the pre-PR#183 inline catalog in `src/app/api/mcp/route.ts` (server v0.2.0). */
export const LEGACY_MCP_TOOL_NAMES = [
  "list_operations",
  "get_operation",
  "list_tasks",
  "get_task",
  "create_task",
  "update_task",
  "change_task_status",
  "add_task_comment",
] as const;

describe("MCP tools/list server catalog (registry)", () => {
  it("exposes the full registry, not the legacy 8-tool subset", () => {
    expect(MCP_TOOL_DEFINITIONS.length).toBeGreaterThan(LEGACY_MCP_TOOL_NAMES.length);
    const names = new Set(MCP_TOOL_DEFINITIONS.map((t) => t.name));
    for (const legacy of LEGACY_MCP_TOOL_NAMES) {
      expect(names.has(legacy)).toBe(true);
    }
    expect(names.has("create_client_contract")).toBe(true);
    expect(names.has("list_clients")).toBe(true);
  });

  it("list_operations schema matches expanded registry (not legacy limit-only)", () => {
    const def = MCP_TOOL_DEFINITIONS.find((t) => t.name === "list_operations");
    expect(def).toBeDefined();
    const props = def!.inputSchema.properties as Record<string, unknown> | undefined;
    expect(props).toBeDefined();
    expect(props).toHaveProperty("client_id");
    expect(props).toHaveProperty("limit");
    expect(Object.keys(props ?? {})).not.toEqual(["limit"]);
  });
});
