import { describe, expect, it } from "vitest";
import {
  fieldsForWizardStep,
  wizardStepsForPersonType,
} from "@/lib/validators/client-registration-wizard";

describe("client registration wizard", () => {
  it("PJ includes legal_rep step with marital status field", () => {
    const steps = wizardStepsForPersonType("pj");
    expect(steps).toContain("legal_rep");
    expect(fieldsForWizardStep("legal_rep", "pj")).toContain(
      "legal_representative_marital_status",
    );
  });

  it("PF has six steps ending in review", () => {
    const steps = wizardStepsForPersonType("pf");
    expect(steps).toHaveLength(6);
    expect(steps[steps.length - 1]).toBe("review");
  });
});
