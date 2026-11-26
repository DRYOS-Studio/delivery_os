import { describe, expect, it } from "vitest";
import {
  appErrorDetail,
  buildAppErrorDisplay,
  isClientOrHydrationError,
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

  it("sempre expõe digest em produção", () => {
    const display = buildAppErrorDisplay("segredo", "abc123digest", undefined, {
      isAdmin: false,
    });
    expect(display.digestLine).toBe("Referência: abc123digest");
    expect(display.detailLine).toBeNull();
  });

  it("admin vê mensagem e stack sanitizada", () => {
    const display = buildAppErrorDisplay(
      "boom",
      "dig1",
      "Error: boom\n    at Page",
      { isAdmin: true },
    );
    expect(display.detailLine).toBe("boom");
    expect(display.technicalBlock).toContain("Error: boom");
  });

  it("hidratação expõe mensagem mesmo sem admin", () => {
    expect(isClientOrHydrationError("Hydration failed because")).toBe(true);
    const display = buildAppErrorDisplay(
      "Hydration failed because",
      "d2",
      "Error: Hydration\n    at div",
      { isAdmin: false },
    );
    expect(display.detailLine).toContain("Hydration");
    expect(display.technicalBlock).toBeTruthy();
  });
});
