import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const dateString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional(),
);

const recurrenceEnum = z.preprocess(
  emptyToUndefined,
  z.enum(["mensal", "trimestral", "anual", "unica"]).optional(),
);

const mrrInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative("MRR não pode ser negativo.").nullable());

const monthlyFixedCostInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative("Custo fixo não pode ser negativo.").nullable());

const optionalIntHours = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "number") return Math.trunc(v);
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? Math.trunc(n) : v;
    }
    return v;
  },
  z
    .number()
    .int("Use horas inteiras.")
    .min(0, "Não pode ser negativo.")
    .max(720, "Máximo 720h (30d).")
    .optional(),
);

export const operationSchema = z
  .object({
    client_id: z.string().uuid("Cliente obrigatório."),
    product_line: z.enum(["core", "spark", "studio"], {
      message: "Linha obrigatória.",
    }),
    name: z
      .string()
      .trim()
      .min(1, "Nome obrigatório.")
      .max(160, "Nome muito longo (máx 160)."),
    status: z.enum(["em_construcao", "em_operacao", "janela_critica"], {
      message: "Status inválido.",
    }),
    recurrence: recurrenceEnum,
    monthly_recurring_revenue: mrrInput,
    start_date: dateString,
    end_date: dateString,
    response_hours: optionalIntHours,
    resolution_hours: optionalIntHours,
    monthly_fixed_cost: monthlyFixedCostInput,
    diagnostic_id: z.preprocess(
      emptyToUndefined,
      z.string().uuid().optional(),
    ),
    notification_webhook_url: z.preprocess(
      emptyToUndefined,
      z.string().url("URL inválida.").max(500, "URL muito longa.").optional(),
    ),
  })
  .refine(
    (data) =>
      !data.start_date ||
      !data.end_date ||
      data.start_date <= data.end_date,
    {
      message: "Data de fim deve ser ≥ data de início.",
      path: ["end_date"],
    },
  );

export type OperationInput = z.input<typeof operationSchema>;
export type OperationOutput = z.output<typeof operationSchema>;
