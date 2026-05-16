import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("E-mail inválido.").optional(),
);

const internalSchema = z.object({
  kind: z.literal("internal"),
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Nome muito longo (máx 120)."),
  email: optionalEmail,
  specialty: z
    .string()
    .trim()
    .min(1, "Especialidade obrigatória.")
    .max(80, "Especialidade muito longa (máx 80)."),
  external_role: z.preprocess(
    emptyToUndefined,
    z.undefined().optional(),
  ),
  client_id: z.preprocess(emptyToUndefined, z.undefined().optional()),
});

const externalSchema = z.object({
  kind: z.literal("external"),
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Nome muito longo (máx 120)."),
  email: optionalEmail,
  specialty: z.preprocess(emptyToUndefined, z.undefined().optional()),
  external_role: z
    .string()
    .trim()
    .min(1, "Papel externo obrigatório.")
    .max(80, "Papel muito longo (máx 80)."),
  client_id: z.string().uuid("Cliente obrigatório."),
});

export const personSchema = z.discriminatedUnion("kind", [
  internalSchema,
  externalSchema,
]);

export type PersonInput = z.input<typeof personSchema>;
export type PersonOutput = z.output<typeof personSchema>;
