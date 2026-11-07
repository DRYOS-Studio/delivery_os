import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockExchange = vi.fn();
const mockMint = vi.fn();

vi.mock("@/lib/mcp/exchange-gotrue-session", () => ({
  exchangeProfileForGoTrueAccessToken: (...args: unknown[]) => mockExchange(...args),
}));

vi.mock("@/lib/mcp/supabase-session-jwt", () => ({
  mintSupabaseUserAccessToken: (...args: unknown[]) => mockMint(...args),
}));

import { issueMcpAccessTokenForProfile } from "@/lib/mcp/issue-mcp-access-token";

describe("issueMcpAccessTokenForProfile", () => {
  const profileId = "00000000-0000-4000-8000-000000000099";
  const prevSecret = process.env.SUPABASE_JWT_SECRET;
  const prevStrategy = process.env.MCP_SESSION_STRATEGY;

  beforeEach(() => {
    mockExchange.mockReset();
    mockMint.mockReset();
    delete process.env.MCP_SESSION_STRATEGY;
    delete process.env.SUPABASE_JWT_SECRET;
  });

  afterEach(() => {
    process.env.SUPABASE_JWT_SECRET = prevSecret;
    process.env.MCP_SESSION_STRATEGY = prevStrategy;
  });

  it("uses GoTrue exchange by default", async () => {
    mockExchange.mockResolvedValue("es256-access");
    const r = await issueMcpAccessTokenForProfile(profileId);
    expect(r).toEqual({ ok: true, jwt: "es256-access" });
    expect(mockExchange).toHaveBeenCalledWith(profileId);
    expect(mockMint).not.toHaveBeenCalled();
  });

  it("uses HS256 mint when legacy secret is set", async () => {
    process.env.SUPABASE_JWT_SECRET = "legacy";
    mockMint.mockResolvedValue("hs256-access");
    const r = await issueMcpAccessTokenForProfile(profileId);
    expect(r).toEqual({ ok: true, jwt: "hs256-access" });
    expect(mockMint).toHaveBeenCalled();
    expect(mockExchange).not.toHaveBeenCalled();
  });
});
