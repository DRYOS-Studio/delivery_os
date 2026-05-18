import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("E-mail inválido.").optional(),
);

const hourlyRateInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative("Taxa horária não pode ser negativa.").nullable());

const monthlyCompInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative("Salário não pode ser negativo.").nullable());

const contractedHoursInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().positive("Horas contratadas devem ser > 0.").nullable());

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
  hourly_rate: hourlyRateInput,
  monthly_compensation: monthlyCompInput,
  contracted_weekly_hours: contractedHoursInput,
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
  hourly_rate: hourlyRateInput,
  monthly_compensation: monthlyCompInput,
  contracted_weekly_hours: contractedHoursInput,
});

export const personSchema = z.discriminatedUnion("kind", [
  internalSchema,
  externalSchema,
]);

export type PersonInput = z.input<typeof personSchema>;
export type PersonOutput = z.output<typeof personSchema>;
