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

const percentInput = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z
  .number()
  .positive("Informe um percentual maior que zero.")
  .max(100, "Percentual não pode passar de 100."));

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

const costCore = z.object({
  category: categoryEnum,
  label: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres.")
    .max(150, "Máximo 150 caracteres."),
  recurrence: z.enum(["mensal", "unica"], {
    message: "Recorrência obrigatória.",
  }),
  started_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida."),
  ended_at: optionalDate,
  notes: optionalNotes,
});

const dateRangeCheck = (d: {
  ended_at?: string | undefined;
  started_at: string;
}): boolean => !d.ended_at || d.ended_at >= d.started_at;

const dateRangeIssue = {
  message: "Data de fim deve ser ≥ data de início.",
  path: ["ended_at" as const],
};

const fixedAmountCost = costCore
  .extend({
    amount: amountInput,
    commission_percent: z.preprocess(emptyToUndefined, z.never().optional()),
  })
  .refine((d) => d.category !== "comissoes", {
    message: "Comissões usam percentual (%).",
    path: ["category"],
  });

const commissionCost = costCore
  .extend({
    category: z.literal("comissoes"),
    commission_percent: percentInput,
    amount: z.preprocess(emptyToUndefined, z.never().optional()),
  });

/** Edição de comissão legada ainda em R$ (sem commission_percent). */
const legacyCommissionCost = costCore
  .extend({
    category: z.literal("comissoes"),
    amount: amountInput,
    commission_percent: z.preprocess(emptyToUndefined, z.never().optional()),
  });

export const operationCostSchema = z
  .union([fixedAmountCost, commissionCost, legacyCommissionCost])
  .refine(dateRangeCheck, dateRangeIssue);

const createCommissionCost = commissionCost.extend({
  category: z.literal("comissoes"),
});

export const operationCostCreateSchema = z
  .union([
    createCommissionCost,
    costCore.extend({
      category: z.enum(["servicos_terceiros", "time", "infra"]),
      amount: amountInput,
    }),
  ])
  .refine(dateRangeCheck, dateRangeIssue);

export type OperationCostInput = z.input<typeof operationCostSchema>;
export type OperationCostOutput = z.output<typeof operationCostSchema>;

export const mcpUpdateOperationCostSchema = costCore
  .partial()
  .extend({
    cost_id: z.string().uuid(),
    amount: amountInput.optional(),
    commission_percent: percentInput.optional(),
    notes: z.union([z.string().max(1000), z.null()]).optional(),
    ended_at: z
      .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null(),
      ])
      .optional(),
  })
  .superRefine((d, ctx) => {
    const cat = d.category;
    const hasPct = d.commission_percent !== undefined;
    const hasAmt = d.amount !== undefined;
    if (cat === "comissoes" || (hasPct && !cat)) {
      if (hasPct && hasAmt) {
        ctx.addIssue({
          code: "custom",
          message: "Comissão: informe commission_percent ou amount, não ambos.",
          path: ["commission_percent"],
        });
      }
    } else if (hasPct) {
      ctx.addIssue({
        code: "custom",
        message: "Percentual só para comissões.",
        path: ["commission_percent"],
      });
    }
  });
