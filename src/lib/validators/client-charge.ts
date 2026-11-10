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

export type MarkClientChargePaidInput = z.infer<typeof markClientChargePaidSchema>;

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
