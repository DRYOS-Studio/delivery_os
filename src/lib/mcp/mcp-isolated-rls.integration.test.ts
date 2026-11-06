import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function canRunIsolatedPostgres(): boolean {
  try {
    execFileSync("bash", ["-c", "sudo -u postgres psql -tAc 'SELECT 1'"], {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Integration: all repo migrations on disposable local Postgres (not Supabase cloud).
 * Requires `postgresql` + `scripts/mcp-isolated-rls-test.sh`.
 */
describe("mcp isolated postgres RLS (integration)", () => {
  it.skipIf(!canRunIsolatedPostgres())("runs scripts/mcp-isolated-rls-test.sh", () => {
    const script = join(process.cwd(), "scripts/mcp-isolated-rls-test.sh");
    let out: string;
    try {
      out = execFileSync(script, [], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120_000,
      });
    } catch (e) {
      const err = e as { status?: number; stderr?: string; stdout?: string };
      throw new Error(
        `isolated test failed (exit ${err.status ?? "?"}):\n${err.stderr ?? ""}\n${err.stdout ?? ""}`,
      );
    }
    expect(out).toContain("ALL_MCP_ISOLATED_TESTS_PASSED");
  });
});
