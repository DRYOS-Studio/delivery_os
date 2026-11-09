import { z } from "zod";
import { OPERATION_COST_CATEGORIES_UI } from "@/lib/utils/operation-cost-category";

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

const categoryEnum = z.enum([
  "comissoes",
  "servicos_terceiros",
  "time",
  "infra",
  "a_classificar",
]);

const operationCostBase = z.object({
  category: categoryEnum,
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
});

function withDateRefine<T extends z.ZodType>(
  schema: T,
): z.ZodType<z.infer<T>, z.infer<T>, z.input<T>> {
  return schema.refine(
    (d: { ended_at?: string | undefined; started_at?: string }) =>
      !d.ended_at || !d.started_at || d.ended_at >= d.started_at,
    {
      message: "Data de fim deve ser ≥ data de início.",
      path: ["ended_at"],
    },
  ) as z.ZodType<z.infer<T>, z.infer<T>, z.input<T>>;
}

export const operationCostSchema = withDateRefine(operationCostBase);

export const operationCostCreateSchema = withDateRefine(
  operationCostBase.extend({
    category: z.enum(OPERATION_COST_CATEGORIES_UI),
  }),
);

export type OperationCostInput = z.input<typeof operationCostSchema>;
export type OperationCostOutput = z.output<typeof operationCostSchema>;

export const mcpUpdateOperationCostSchema = operationCostBase
  .partial()
  .extend({
    cost_id: z.string().uuid(),
    notes: z.union([z.string().max(1000), z.null()]).optional(),
    ended_at: z
      .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null(),
      ])
      .optional(),
  });
