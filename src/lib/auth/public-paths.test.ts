import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath (proxy auth bypass)", () => {
  it("treats /cadastro/[token] as public", () => {
    expect(isPublicPath("/cadastro/abc123token")).toBe(true);
  });

  it("keeps app routes protected", () => {
    expect(isPublicPath("/clients")).toBe(false);
    expect(isPublicPath("/clients/registration-invites")).toBe(false);
  });

  it("matches existing public prefixes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/public/some-uuid")).toBe(true);
  });
});
