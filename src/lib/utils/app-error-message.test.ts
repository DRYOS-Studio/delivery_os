import { describe, expect, it } from "vitest";
import {
  appErrorDetail,
  isSafeAppErrorMessage,
} from "@/lib/utils/app-error-message";

describe("app-error-message", () => {
  it("aceita prefixo de query da app", () => {
    expect(
      isSafeAppErrorMessage("listAttendeeCandidates.external: invalid input"),
    ).toBe(true);
    expect(isSafeAppErrorMessage("secret stack trace")).toBe(false);
  });

  it("expõe mensagens prefixadas de query", () => {
    expect(
      appErrorDetail("listAttendeeCandidates: failed to parse filter", undefined),
    ).toContain("listAttendeeCandidates");
  });
});
