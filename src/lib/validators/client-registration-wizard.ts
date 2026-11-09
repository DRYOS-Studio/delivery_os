import type { FieldPath } from "react-hook-form";
import type { z } from "zod";
import type { clientRegistrationSubmissionSchema } from "@/lib/validators/client-registration";

export type RegistrationFormInput = z.input<
  typeof clientRegistrationSubmissionSchema
>;

export type WizardStepId =
  | "qualification"
  | "address"
  | "legal_rep"
  | "focal"
  | "financial"
  | "tools"
  | "review";

export function wizardStepsForPersonType(
  personType: "pf" | "pj",
): WizardStepId[] {
  if (personType === "pf") {
    return [
      "qualification",
      "address",
      "focal",
      "financial",
      "tools",
      "review",
    ];
  }
  return [
    "qualification",
    "address",
    "legal_rep",
    "focal",
    "financial",
    "tools",
    "review",
  ];
}

export const WIZARD_STEP_LABELS: Record<WizardStepId, string> = {
  qualification: "Qualificação",
  address: "Endereço",
  legal_rep: "Representante legal",
  focal: "Ponto focal",
  financial: "Contato financeiro",
  tools: "Ferramentas",
  review: "Revisão",
};

type Path = FieldPath<RegistrationFormInput>;

export function fieldsForWizardStep(
  step: WizardStepId,
  personType: "pf" | "pj",
): Path[] {
  switch (step) {
    case "qualification":
      if (personType === "pf") {
        return [
          "full_name",
          "profession",
          "marital_status",
          "cpf",
          "formal_email",
        ];
      }
      return ["legal_name", "trade_name", "cnpj"];
    case "address":
      return [
        "address_zip",
        "address_street",
        "address_number",
        "address_complement",
        "address_district",
        "address_city",
        "address_state",
      ];
    case "legal_rep":
      return [
        "legal_representative_name",
        "legal_representative_role",
        "legal_representative_cpf",
        "legal_representative_marital_status",
        "legal_representative_email",
      ];
    case "focal":
      return ["focal_point_name", "focal_point_email", "focal_point_phone"];
    case "financial":
      return [
        "financial_contact_name",
        "financial_contact_email",
        "financial_contact_phone",
      ];
    case "tools":
      return ["software_items"];
    case "review":
      return ["lgpd_consent"];
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
