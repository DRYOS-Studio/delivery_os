import { describe, expect, it } from "vitest";
import {
  clientRegistrationSubmissionSchema,
  createInvitationSchema,
} from "@/lib/validators/client-registration";

describe("createInvitationSchema", () => {
  const base = {
    prefill_contact_name: "Maria",
    prefill_contact_phone: "21999998888",
  };

  it("accepts invite_note as null (FormData sem chave)", () => {
    const parsed = createInvitationSchema.safeParse({
      ...base,
      invite_note: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.invite_note).toBeUndefined();
    }
  });

  it("accepts invite_note as empty string", () => {
    const parsed = createInvitationSchema.safeParse({
      ...base,
      invite_note: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.invite_note).toBeUndefined();
    }
  });

  it("rejects missing contact name with PT-BR message", () => {
    const parsed = createInvitationSchema.safeParse({
      prefill_contact_name: null,
      prefill_contact_phone: "21999998888",
      invite_note: null,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/Nome do contato obrigatório/);
    }
  });
});

const pfBase = {
  person_type: "pf" as const,
  full_name: "Maria Silva",
  profession: "Médica",
  marital_status: "Solteiro(a)",
  cpf: "154.778.507-10",
  formal_email: "maria@example.com",
  address_street: "Rua A",
  address_number: "10",
  address_complement: null,
  address_district: "Centro",
  address_city: "Rio de Janeiro",
  address_state: "RJ",
  address_zip: "20040-020",
  focal_point_name: "Maria Silva",
  focal_point_email: "maria@example.com",
  focal_point_phone: "21999998888",
  financial_contact_name: "Financeiro",
  financial_contact_email: "fin@example.com",
  financial_contact_phone: "21988887777",
  software_items: [] as { name: string; purpose: string; url: null | string }[],
  lgpd_consent: true,
};

describe("clientRegistrationSubmissionSchema — PF", () => {
  it("accepts optional address_complement as null", () => {
    const parsed = clientRegistrationSubmissionSchema.safeParse(pfBase);
    expect(parsed.success).toBe(true);
  });

  it("accepts software item with null url", () => {
    const parsed = clientRegistrationSubmissionSchema.safeParse({
      ...pfBase,
      software_items: [
        { name: "Google Drive", purpose: "Arquivos", url: null },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

const pjBase = {
  person_type: "pj" as const,
  legal_name: "Empresa LTDA",
  trade_name: null,
  cnpj: "36.862.199/0001-04",
  legal_representative_name: "João",
  legal_representative_role: "Sócio",
  legal_representative_cpf: "713.843.082-53",
  legal_representative_marital_status: "Casado(a)",
  legal_representative_email: "joao@empresa.com",
  address_street: "Rua B",
  address_number: "20",
  address_complement: "",
  address_district: "Bairro",
  address_city: "Niterói",
  address_state: "RJ",
  address_zip: "24020125",
  focal_point_name: "João",
  focal_point_email: "joao@empresa.com",
  focal_point_phone: "21999998888",
  financial_contact_name: "Fin",
  financial_contact_email: "fin@empresa.com",
  financial_contact_phone: "21988887777",
  software_items: [],
  lgpd_consent: true,
};

describe("clientRegistrationSubmissionSchema — PJ", () => {
  it("accepts null trade_name and empty complement", () => {
    const parsed = clientRegistrationSubmissionSchema.safeParse(pjBase);
    expect(parsed.success).toBe(true);
  });
});
