import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");

export const markClientChargePaidSchema = z.object({
  paid_at: isoDate,
  paid_amount: z.coerce.number().positive("Valor pago deve ser positivo."),
  payment_method: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const generateClientChargesSchema = z.object({
  contract_id: z.string().uuid(),
  months_ahead: z.coerce
    .number()
    .int()
    .min(1)
    .max(36)
    .optional()
    .default(12),
});

const discountKind = z.enum(["none", "fixed", "percent"]);

export const updateClientChargeSchema = z
  .object({
    amount: z.coerce.number().positive("Valor bruto deve ser positivo."),
    due_date: isoDate,
    notes: z
      .string()
      .max(4000)
      .optional()
      .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
    discount_kind: discountKind,
    discount_input: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : null;
      }),
    status: z.enum(["prevista", "emitida"]).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.discount_kind !== "none" && (val.discount_input === null || val.discount_input <= 0)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o valor do desconto.",
        path: ["discount_input"],
      });
    }
  });

export const undoClientChargePaymentSchema = z.object({
  clear_all: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
  new_paid_amount: z.coerce.number().min(0).optional(),
});
