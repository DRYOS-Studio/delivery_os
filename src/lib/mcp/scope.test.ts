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
      }),
    ).toBe(false);
  });

  it("allows writes when write scope present", () => {
    expect(
      mcpHasWriteScope({
        mcpAgent: true,
        profileId: "x",
        scopes: ["read", "write"],
      }),
    ).toBe(true);
  });
});
