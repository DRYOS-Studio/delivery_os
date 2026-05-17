import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

export const briefingSchema = z.object({
  contexto: optionalText,
  objetivos: optionalText,
  escopo_incluido: optionalText,
  escopo_excluido: optionalText,
  premissas: optionalText,
  riscos: optionalText,
  stakeholders: optionalText,
  observacoes: optionalText,
});

export type BriefingInput = z.input<typeof briefingSchema>;
export type BriefingOutput = z.output<typeof briefingSchema>;
