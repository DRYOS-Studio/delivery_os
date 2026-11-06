import { describe, expect, it } from "vitest";
import { toolText } from "@/lib/mcp/jsonrpc";

describe("toolText", () => {
  it("uses compact JSON (fewer tokens)", () => {
    const t = toolText({ a: 1 });
    const text = t.content[0]?.text;
    expect(text).toBeDefined();
    expect(text).not.toContain("\n");
  });
});
