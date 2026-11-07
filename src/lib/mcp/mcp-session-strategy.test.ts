import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveMcpSessionStrategy } from "@/lib/mcp/mcp-session-strategy";

describe("resolveMcpSessionStrategy", () => {
  const prevSecret = process.env.SUPABASE_JWT_SECRET;
  const prevStrategy = process.env.MCP_SESSION_STRATEGY;

  beforeEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.MCP_SESSION_STRATEGY;
  });

  afterEach(() => {
    process.env.SUPABASE_JWT_SECRET = prevSecret;
    process.env.MCP_SESSION_STRATEGY = prevStrategy;
  });

  it("defaults to gotrue when no legacy JWT secret", () => {
    expect(resolveMcpSessionStrategy()).toBe("gotrue");
  });

  it("uses hs256 when SUPABASE_JWT_SECRET is set and no override", () => {
    process.env.SUPABASE_JWT_SECRET = "legacy-shared-secret";
    expect(resolveMcpSessionStrategy()).toBe("hs256");
  });

  it("honors MCP_SESSION_STRATEGY=gotrue over legacy secret", () => {
    process.env.SUPABASE_JWT_SECRET = "legacy-shared-secret";
    process.env.MCP_SESSION_STRATEGY = "gotrue";
    expect(resolveMcpSessionStrategy()).toBe("gotrue");
  });
});
