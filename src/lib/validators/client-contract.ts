import { z } from "zod";

export const clientContractStatusSchema = z.enum([
  "rascunho",
  "vigente",
  "encerrada",
]);

function emptyToNull(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

export const clientContractFormSchema = z
  .object({
  label: z.string().trim().min(2, "Rótulo obrigatório.").max(200),
  monthly_value: z
    .string()
    .optional()
    .transform((s) => (s == null || s.trim() === "" ? null : Number(s)))
    .refine((n) => n === null || Number.isFinite(n), "Valor inválido.")
    .refine((n) => n === null || n >= 0, "Valor não pode ser negativo."),
  implementation_fee: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    })
    .refine((n) => n === null || n >= 0, "Taxa de implantação não pode ser negativa."),
  currency: z.string().trim().default("BRL"),
  reajuste_notes: z
    .string()
    .optional()
    .transform(emptyToNull)
    .pipe(z.string().max(2000).nullable()),
  start_date: z
    .string()
    .optional()
    .transform(emptyToNull)
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  end_date: z
    .string()
    .optional()
    .transform(emptyToNull)
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  payment_day_of_month: z
    .string()
    .optional()
    .transform((s) => (s == null || s.trim() === "" ? null : Number(s)))
    .refine(
      (n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 28),
      "Dia de pagamento entre 1 e 28.",
    ),
  status: clientContractStatusSchema,
  notes: z
    .string()
    .optional()
    .transform(emptyToNull)
    .pipe(z.string().max(4000).nullable()),
  })
  .superRefine((val, ctx) => {
    if (val.start_date && val.end_date && val.end_date < val.start_date) {
      ctx.addIssue({
        code: "custom",
        message: "Data fim antes da data início.",
        path: ["end_date"],
      });
    }
  });

export type ClientContractFormOutput = z.infer<typeof clientContractFormSchema>;
