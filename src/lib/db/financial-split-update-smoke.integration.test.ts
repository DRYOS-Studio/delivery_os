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

const ISOLATED_SCRIPT_MS = 120_000;

describe("financial split UPDATE smoke (integration)", () => {
  it.skipIf(!canRunIsolatedPostgres())(
    "runs scripts/financial-split-update-smoke-test.sh",
    () => {
      const script = join(
        process.cwd(),
        "scripts/financial-split-update-smoke-test.sh",
      );
      let out: string;
      try {
        out = execFileSync(script, [], {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: ISOLATED_SCRIPT_MS,
        });
      } catch (e) {
        const err = e as { status?: number; stderr?: string; stdout?: string };
        throw new Error(
          `smoke test failed (exit ${err.status ?? "?"}):\n${err.stderr ?? ""}\n${err.stdout ?? ""}`,
        );
      }
      expect(out).toContain("ALL PASS: financial-split UPDATE smoke");
    },
    ISOLATED_SCRIPT_MS,
  );
});
