import { z } from "zod";
import { isValidCnpj, isValidCpf, stripDocumentDigits } from "@/lib/utils/br-document";
import { nullishToEmptyString, nullishToUndefined } from "@/lib/validators/nullish";

const requiredText = (max: number, label: string) =>
  z.preprocess(
    nullishToEmptyString,
    z
      .string()
      .trim()
      .min(1, `${label} obrigatório.`)
      .max(max, `Máximo ${max} caracteres.`),
  );

const requiredEmail = z.preprocess(
  nullishToEmptyString,
  z
    .string()
    .trim()
    .min(1, "E-mail obrigatório.")
    .email("E-mail inválido.")
    .max(150, "E-mail muito longo (máx 150 caracteres)."),
);

const requiredPhone = z.preprocess(
  nullishToEmptyString,
  z
    .string()
    .trim()
    .min(8, "Telefone inválido.")
    .max(30, "Telefone muito longo (máx 30 caracteres)."),
);

const requiredState = z.preprocess(
  nullishToEmptyString,
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF deve ter 2 letras."),
);

const requiredZip = z.preprocess(
  (v) => stripDocumentDigits(String(v ?? "")),
  z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos."),
);

const optionalText = (max: number) =>
  z.preprocess(
    nullishToUndefined,
    z.string().trim().max(max, `Máximo ${max} caracteres.`).optional(),
  );

const optionalUrl = z.preprocess(
  nullishToUndefined,
  z.string().url("URL inválida.").max(500, "URL muito longa.").optional(),
);

const addressSchema = z.object({
  address_street: requiredText(150, "Logradouro"),
  address_number: requiredText(20, "Número"),
  address_complement: optionalText(100),
  address_district: requiredText(100, "Bairro"),
  address_city: requiredText(100, "Cidade"),
  address_state: requiredState,
  address_zip: requiredZip,
});

const softwareItemSchema = z.object({
  name: requiredText(120, "Nome da ferramenta"),
  url: optionalUrl,
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

const lgpdConsentField = z.preprocess(
  (v) => v === true || v === "on",
  z.literal(true, {
    error: "É necessário aceitar o termo de privacidade.",
  }),
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
    lgpd_consent: lgpdConsentField,
  });

const pjSchema = z
  .object({
    person_type: z.literal("pj"),
    legal_name: requiredText(200, "Razão social"),
    trade_name: optionalText(200),
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
    lgpd_consent: lgpdConsentField,
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
  invite_note: optionalText(500),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Primeira mensagem amigável (evita vazar erro cru do Zod). */
export function firstClientRegistrationValidationMessage(
  error: z.ZodError,
): string {
  const issue = error.issues[0];
  if (!issue) return "Dados inválidos.";
  const msg = issue.message;
  if (
    msg.includes("expected string, received null") ||
    msg.includes("Expected string, received null")
  ) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "campo";
    return `O campo "${field}" está inválido. Se for opcional, deixe em branco.`;
  }
  return msg;
}
