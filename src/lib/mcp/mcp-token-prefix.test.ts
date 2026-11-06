import { describe, expect, it } from "vitest";
import { isMcpAgentTokenSecret, MCP_AGENT_TOKEN_PREFIX } from "@/lib/mcp/mcp-token-prefix";

describe("mcp token prefix", () => {
  it("detects mcp static secrets", () => {
    expect(isMcpAgentTokenSecret(`${MCP_AGENT_TOKEN_PREFIX}abc`)).toBe(true);
    expect(isMcpAgentTokenSecret("eyJhbG")).toBe(false);
  });
});
