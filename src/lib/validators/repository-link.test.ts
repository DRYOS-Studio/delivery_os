import { describe, expect, it } from "vitest";
import { repositoryLinkBodySchema } from "@/lib/validators/repository-link";

describe("repositoryLinkBodySchema", () => {
  it("accepts valid https repo", () => {
    const parsed = repositoryLinkBodySchema.safeParse({
      label: "App principal",
      url: "https://github.com/acme/app",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects credentials in url", () => {
    const parsed = repositoryLinkBodySchema.safeParse({
      label: "x",
      url: "https://user:pass@github.com/a/b",
    });
    expect(parsed.success).toBe(false);
  });
});
