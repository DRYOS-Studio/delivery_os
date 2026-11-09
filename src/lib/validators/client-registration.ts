import { z } from "zod";
import { isValidCnpj, isValidCpf, stripDocumentDigits } from "@/lib/utils/br-document";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} obrigatório.`).max(max, `Máximo ${max} caracteres.`);

const requiredEmail = z
  .string()
  .trim()
  .min(1, "E-mail obrigatório.")
  .email("E-mail inválido.")
  .max(150);

const requiredPhone = z
  .string()
  .trim()
  .min(8, "Telefone inválido.")
  .max(30);

const requiredState = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "UF deve ter 2 letras.");

const requiredZip = z.preprocess(
  (v) => stripDocumentDigits(String(v ?? "")),
  z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos."),
);

const addressSchema = z.object({
  address_street: requiredText(150, "Logradouro"),
  address_number: requiredText(20, "Número"),
  address_complement: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional(),
  ),
  address_district: requiredText(100, "Bairro"),
  address_city: requiredText(100, "Cidade"),
  address_state: requiredState,
  address_zip: requiredZip,
});

const softwareItemSchema = z.object({
  name: requiredText(120, "Nome da ferramenta"),
  url: z.preprocess(
    emptyToUndefined,
    z.string().url("URL inválida.").max(500).optional(),
  ),
  purpose: requiredText(500, "Finalidade"),
});

const contactsSchema = z.object({
  focal_point_name: requiredText(120, "Nome do ponto focal"),
  focal_point_email: requiredEmail,
  focal_point_phone: requiredPhone,
  financial_contact_name: requiredText(120, "Nome do contato financeiro"),
  financial_contact_email: requiredEmail,
  financial_contact_phone: requiredPhone,
});

const cpfField = z.preprocess(
  (v) => stripDocumentDigits(String(v ?? "")),
  z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter 11 dígitos.")
    .refine(isValidCpf, "CPF inválido."),
);

const cnpjField = z.preprocess(
  (v) => stripDocumentDigits(String(v ?? "")),
  z
    .string()
    .regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos.")
    .refine(isValidCnpj, "CNPJ inválido."),
);

const pfSchema = z
  .object({
    person_type: z.literal("pf"),
    full_name: requiredText(200, "Nome completo"),
    profession: requiredText(120, "Profissão"),
    marital_status: requiredText(60, "Estado civil"),
    cpf: cpfField,
    formal_email: requiredEmail,
  })
  .merge(addressSchema)
  .merge(contactsSchema)
  .extend({
    software_items: z.array(softwareItemSchema).default([]),
    lgpd_consent: z.preprocess(
      (v) => v === true || v === "on",
      z.literal(true, {
        error: "É necessário aceitar o termo de privacidade.",
      }),
    ),
  });

const pjSchema = z
  .object({
    person_type: z.literal("pj"),
    legal_name: requiredText(200, "Razão social"),
    trade_name: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(200).optional(),
    ),
    cnpj: cnpjField,
    legal_representative_name: requiredText(120, "Nome do representante"),
    legal_representative_role: requiredText(80, "Cargo do representante"),
    legal_representative_cpf: cpfField,
    legal_representative_email: requiredEmail,
  })
  .merge(addressSchema)
  .merge(contactsSchema)
  .extend({
    software_items: z.array(softwareItemSchema).default([]),
    lgpd_consent: z.preprocess(
      (v) => v === true || v === "on",
      z.literal(true, {
        error: "É necessário aceitar o termo de privacidade.",
      }),
    ),
  });

export const clientRegistrationSubmissionSchema = z.discriminatedUnion(
  "person_type",
  [pfSchema, pjSchema],
);

export type ClientRegistrationSubmission = z.infer<
  typeof clientRegistrationSubmissionSchema
>;

export const createInvitationSchema = z.object({
  prefill_contact_name: requiredText(120, "Nome do contato"),
  prefill_contact_phone: requiredPhone,
  invite_note: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500).optional(),
  ),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
