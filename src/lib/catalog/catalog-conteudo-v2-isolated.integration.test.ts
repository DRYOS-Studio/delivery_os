import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());
const SCRIPT = join(ROOT, "scripts/catalog-conteudo-v2-isolated-test.sh");

describe("catalog_conteudo_v2 isolated postgres (integration)", () => {
  it("runs scripts/catalog-conteudo-v2-isolated-test.sh", () => {
    let output: string;
    let exit = 0;
    try {
      output = execFileSync("bash", [SCRIPT], {
        encoding: "utf8",
        timeout: 240_000,
        env: { ...process.env, CATALOG_TEST_DB: "dryos_catalog_isolated" },
      });
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      exit = e.status ?? 1;
      output = `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
      if (exit === 2) {
        // postgres not available in CI without local cluster — skip
        return;
      }
      throw new Error(`catalog isolated test failed (exit ${exit}):\n${output}`);
    }
    expect(output).toContain("ALL PASSED");
  });
});
