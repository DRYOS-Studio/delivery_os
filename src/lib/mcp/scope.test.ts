import { describe, expect, it } from "vitest";
import { mcpHasWriteScope } from "@/lib/mcp/scope";

describe("mcpHasWriteScope", () => {
  it("allows writes when no mcp context (plain JWT)", () => {
    expect(mcpHasWriteScope(undefined)).toBe(true);
  });

  it("denies writes for read-only token", () => {
    expect(
      mcpHasWriteScope({
        mcpAgent: true,
        profileId: "x",
        scopes: ["read"],
        tokenId: "50000000-0000-4000-8000-000000000001",
        tokenName: null,
      }),
    ).toBe(false);
  });

  it("allows writes when write scope present", () => {
    expect(
      mcpHasWriteScope({
        mcpAgent: true,
        profileId: "x",
        scopes: ["read", "write"],
        tokenId: "50000000-0000-4000-8000-000000000002",
        tokenName: null,
      }),
    ).toBe(true);
  });
});
