import { describe, expect, it } from "vitest";
import { resolveGitRepositoryUrl } from "@/lib/utils/resolve-git-repository-url";

describe("resolveGitRepositoryUrl", () => {
  it("prefers frente, then operation, then client", () => {
    expect(
      resolveGitRepositoryUrl({
        frente: "https://f",
        operation: "https://o",
        client: "https://c",
      }),
    ).toEqual({ url: "https://f", scope: "frente" });

    expect(
      resolveGitRepositoryUrl({
        frente: null,
        operation: "https://o",
        client: "https://c",
      }),
    ).toEqual({ url: "https://o", scope: "operation" });

    expect(
      resolveGitRepositoryUrl({
        client: "https://c",
      }),
    ).toEqual({ url: "https://c", scope: "client" });

    expect(resolveGitRepositoryUrl({})).toBeNull();
  });
});
