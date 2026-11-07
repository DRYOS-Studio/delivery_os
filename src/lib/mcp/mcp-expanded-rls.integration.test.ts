import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "scripts/mcp-expanded-rls-isolated.sh");

describe("mcp expanded RLS (integration)", () => {
  it("runs scripts/mcp-expanded-rls-isolated.sh", () => {
    try {
      const out = execFileSync("bash", [SCRIPT], {
        encoding: "utf8",
        timeout: 240_000,
      });
      expect(out).toContain("ALL PASSED");
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      if (e.status === 2) return;
      throw new Error(`${e.stdout ?? ""}\n${e.stderr ?? ""}`);
    }
  });
});
