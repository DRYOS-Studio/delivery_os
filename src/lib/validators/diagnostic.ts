import { z } from "zod";

const optionalProduct = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.enum(["core", "spark", "studio"]).optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional(),
);

export const diagnosticSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(10, "Mínimo 10 caracteres.")
    .max(10000, "Máximo 10000 caracteres."),
  recommended_product: optionalProduct,
  conducted_at: optionalDate,
});

export type DiagnosticInput = z.input<typeof diagnosticSchema>;
export type DiagnosticOutput = z.output<typeof diagnosticSchema>;
