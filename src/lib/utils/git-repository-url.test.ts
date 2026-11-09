import { describe, expect, it } from "vitest";
import {
  checkGitRepositoryUrl,
  formatGitRepositoryLinkLabel,
  isSafeGitRepositoryUrl,
} from "@/lib/utils/git-repository-url";

describe("checkGitRepositoryUrl", () => {
  it("accepts common https repo links", () => {
    expect(checkGitRepositoryUrl("https://github.com/org/repo")).toBeNull();
    expect(checkGitRepositoryUrl("https://gitlab.com/group/proj.git")).toBeNull();
    expect(
      checkGitRepositoryUrl("https://bitbucket.org/workspace/repo/src/main/"),
    ).toBeNull();
  });

  it("rejects non-https schemes", () => {
    expect(checkGitRepositoryUrl("http://github.com/org/repo")).toBe("scheme");
    expect(checkGitRepositoryUrl("git@github.com:org/repo.git")).toBe(
      "invalid_url",
    );
    expect(checkGitRepositoryUrl("ssh://git@github.com/org/repo")).toBe(
      "scheme",
    );
  });

  it("rejects embedded credentials", () => {
    expect(
      checkGitRepositoryUrl("https://user:pass@github.com/org/repo"),
    ).toBe("credentials");
    expect(checkGitRepositoryUrl("https://token@gitlab.com/g/p")).toBe(
      "credentials",
    );
  });

  it("rejects credential-like fragments", () => {
    expect(
      checkGitRepositoryUrl("https://github.com/org/repo#access_token=abc"),
    ).toBe("fragment_credentials");
  });
});

describe("isSafeGitRepositoryUrl", () => {
  it("mirrors checkGitRepositoryUrl", () => {
    expect(isSafeGitRepositoryUrl("https://example.com/a/b")).toBe(true);
    expect(isSafeGitRepositoryUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("formatGitRepositoryLinkLabel", () => {
  it("shortens to host and path", () => {
    expect(
      formatGitRepositoryLinkLabel("https://github.com/acme/app/tree/main"),
    ).toBe("github.com/acme/app/tree/main");
  });
});
