import { z } from "zod";

export const villainNarrativeSchema = z.object({
  narrative_text: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 20, {
      message: "Mínimo 20 caracteres.",
    })
    .refine((s) => s.length <= 4000, {
      message: "Máximo 4000 caracteres.",
    }),
  period_yyyymm: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (formato YYYY-MM)."),
});

export type VillainNarrativeInput = z.infer<typeof villainNarrativeSchema>;
