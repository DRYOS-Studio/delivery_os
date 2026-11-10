import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";

describe("MCP client credential vault tools", () => {
  it("registra ferramentas do cofre", () => {
    const names = MCP_TOOL_DEFINITIONS.map((t) => t.name);
    for (const name of [
      "list_client_credentials",
      "create_client_credential",
      "update_client_credential",
      "archive_client_credential",
      "reveal_client_credential",
      "list_client_credential_audit_logs",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("reveal é ferramenta isolada (não list)", () => {
    const list = MCP_TOOL_DEFINITIONS.find(
      (t) => t.name === "list_client_credentials",
    );
    const reveal = MCP_TOOL_DEFINITIONS.find(
      (t) => t.name === "reveal_client_credential",
    );
    expect(list?.description?.toLowerCase()).toContain("sem senha");
    expect(reveal?.name).toBe("reveal_client_credential");
  });
});
