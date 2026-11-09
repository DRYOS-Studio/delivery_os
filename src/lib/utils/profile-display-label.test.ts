import { describe, expect, it } from "vitest";
import { profileDisplayLabel } from "@/lib/utils/profile-display-label";

describe("profileDisplayLabel", () => {
  it("usa nome resolvido quando presente", () => {
    expect(profileDisplayLabel("Jack Silva", "uuid")).toBe("Jack Silva");
  });

  it("não cai em Usuário genérico quando há profileId", () => {
    expect(profileDisplayLabel(null, "uuid")).toBe("Colega");
  });

  it("só usa Usuário removido sem profileId", () => {
    expect(profileDisplayLabel(null, null)).toBe("Usuário removido");
  });
});
