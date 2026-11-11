import { describe, expect, it } from "vitest";
import {
  buildClaudeMcpAddCommand,
  buildMcpRemoteClaudeDesktopConfig,
} from "@/lib/mcp/mcp-connect-snippets";

describe("mcp-connect-snippets", () => {
  it("gera JSON mcp-remote e comando claude mcp add", () => {
    const json = buildMcpRemoteClaudeDesktopConfig(
      "https://app.example.com",
      "mcp_agt_secret",
    );
    expect(json).toContain("mcp-remote");
    expect(json).toContain("https://app.example.com/api/mcp");
    expect(json).toContain("mcp_agt_secret");

    const cli = buildClaudeMcpAddCommand(
      "https://app.example.com/",
      "mcp_agt_secret",
    );
    expect(cli).toContain("claude mcp add");
    expect(cli).toContain("--transport http");
  });
});
