import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const amountInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative("Valor não pode ser negativo."));

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).")
    .optional(),
);

const optionalNotes = z.preprocess(
  emptyToUndefined,
  z.string().max(1000, "Máximo 1000 caracteres.").optional(),
);

export const operationCostSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres.")
      .max(150, "Máximo 150 caracteres."),
    amount: amountInput,
    recurrence: z.enum(["mensal", "unica"], {
      message: "Recorrência obrigatória.",
    }),
    started_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida."),
    ended_at: optionalDate,
    notes: optionalNotes,
  })
  .refine(
    (d) => !d.ended_at || d.ended_at >= d.started_at,
    {
      message: "Data de fim deve ser ≥ data de início.",
      path: ["ended_at"],
    },
  );

export type OperationCostInput = z.input<typeof operationCostSchema>;
export type OperationCostOutput = z.output<typeof operationCostSchema>;
