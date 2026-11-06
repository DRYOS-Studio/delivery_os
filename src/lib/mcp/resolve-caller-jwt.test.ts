import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockRpc, mockMint, mockCreateServiceRole } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockMint = vi.fn();
  const mockCreateServiceRole = vi.fn(() => ({ rpc: mockRpc }));
  return { mockRpc, mockMint, mockCreateServiceRole };
});

vi.mock("@/lib/db/service-role", () => ({
  createServiceRole: mockCreateServiceRole,
}));

vi.mock("@/lib/mcp/supabase-session-jwt", () => ({
  mintSupabaseUserAccessToken: mockMint,
}));

import { resolveMcpCallerJwt } from "./resolve-caller-jwt";

describe("resolveMcpCallerJwt", () => {
  const mcpBearer = "mcp_agt_x".repeat(10);

  beforeEach(() => {
    mockRpc.mockReset();
    mockMint.mockReset();
    mockCreateServiceRole.mockReset();
    mockCreateServiceRole.mockImplementation(() => ({ rpc: mockRpc }));
  });

  it("returns direct Supabase JWT unchanged when not MCP prefix", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x.y";
    await expect(resolveMcpCallerJwt(jwt)).resolves.toEqual({ ok: true, jwt });
  });

  it("exchanges MCP secret for minted JWT and scopes context", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        profile_id: "00000000-0000-4000-8000-000000000001",
        scopes: ["read", "write"],
      },
      error: null,
    });
    mockMint.mockResolvedValue("minted-access-token");

    await expect(resolveMcpCallerJwt(mcpBearer)).resolves.toEqual({
      ok: true,
      jwt: "minted-access-token",
      ctx: {
        mcpAgent: true,
        profileId: "00000000-0000-4000-8000-000000000001",
        scopes: ["read", "write"],
      },
    });

    expect(mockRpc).toHaveBeenCalledWith("verify_mcp_agent_token", {
      p_token_plaintext: mcpBearer,
    });
    expect(mockMint).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      15 * 60,
    );
  });

  it("defaults empty RPC scopes to read-only", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        profile_id: "00000000-0000-4000-8000-000000000002",
        scopes: [],
      },
      error: null,
    });
    mockMint.mockResolvedValue("minted");

    const r = await resolveMcpCallerJwt(mcpBearer);
    expect(r.ok).toBe(true);
    if (r.ok && "ctx" in r && r.ctx) {
      expect(r.ctx.scopes).toEqual(["read"]);
    }
  });

  it("maps failed verify to error code from RPC", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, code: "invalid_or_expired" },
      error: null,
    });

    await expect(resolveMcpCallerJwt(mcpBearer)).resolves.toEqual({
      ok: false,
      code: "invalid_or_expired",
    });
    expect(mockMint).not.toHaveBeenCalled();
  });

  it("returns server_misconfigured when service role client cannot be created", async () => {
    mockCreateServiceRole.mockImplementation(() => {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    });

    await expect(resolveMcpCallerJwt(mcpBearer)).resolves.toEqual({
      ok: false,
      code: "server_misconfigured",
    });
  });

  it("returns server_misconfigured when mint fails", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        profile_id: "00000000-0000-4000-8000-000000000001",
        scopes: ["read"],
      },
      error: null,
    });
    mockMint.mockRejectedValue(new Error("no SUPABASE_JWT_SECRET"));

    await expect(resolveMcpCallerJwt(mcpBearer)).resolves.toEqual({
      ok: false,
      code: "server_misconfigured",
    });
  });
});
