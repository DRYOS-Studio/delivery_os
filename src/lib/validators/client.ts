import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalText = (max: number, msg?: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, msg ?? `Máximo ${max} caracteres.`)
      .optional(),
  );

const optionalDigits = (len: number, msg: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(new RegExp(`^\\d{${len}}$`), msg)
      .optional(),
  );

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .email("E-mail inválido.")
    .max(150, "E-mail muito longo (máx 150 caracteres).")
    .optional(),
);

const optionalState = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^[A-Z]{2}$/, "UF deve ter 2 letras maiúsculas.")
    .optional(),
);

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Nome muito longo (máx 120 caracteres)."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug obrigatório.")
    .max(60, "Slug muito longo (máx 60 caracteres).")
    .regex(/^[a-z0-9-]+$/, "Slug só pode ter minúsculas, números e hífens."),
  notes: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(1000, "Notas muito longas (máx 1000 caracteres).")
      .optional(),
  ),
  legal_name: optionalText(200),
  cnpj: optionalDigits(14, "CNPJ deve ter 14 dígitos."),
  inscricao_estadual: optionalText(30),
  primary_contact_name: optionalText(120),
  primary_contact_email: optionalEmail,
  primary_contact_phone: optionalText(30),
  address_street: optionalText(150),
  address_number: optionalText(20),
  address_complement: optionalText(100),
  address_district: optionalText(100),
  address_city: optionalText(100),
  address_state: optionalState,
  address_zip: optionalDigits(8, "CEP deve ter 8 dígitos."),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientOutput = z.output<typeof clientSchema>;
