import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

export const decisionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  context: optionalText,
  decision: z
    .string()
    .trim()
    .min(3, "Decisão obrigatória (min 3 chars).")
    .max(5000, "Máximo 5000 caracteres."),
  visibility: z.enum(["interno", "cliente"], {
    message: "Visibility obrigatória.",
  }),
  decided_at: z.string().min(1, "Data obrigatória."),
  meeting_id: optionalUuid,
});

export type DecisionInput = z.input<typeof decisionSchema>;
export type DecisionOutput = z.output<typeof decisionSchema>;
