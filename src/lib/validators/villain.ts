import { z } from "zod";

export const PILL_VARIANTS = [
  "neutral",
  "oak",
  "sage",
  "ok",
  "warning",
  "critical",
] as const;

const orderInput = z.preprocess(
  (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : v;
    }
    return v;
  },
  z.number().int().min(1, "Mínimo 1.").max(99, "Máximo 99."),
);

export const villainSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(120, "Máximo 120 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Apenas a-z, 0-9 e hífen.")
    .min(2, "Mínimo 2 caracteres.")
    .max(60, "Máximo 60 caracteres."),
  quote: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Mínimo 10 caracteres.")
    .max(500, "Máximo 500 caracteres."),
  icon_name: z
    .string()
    .trim()
    .min(1, "Ícone obrigatório.")
    .max(50, "Nome de ícone muito longo."),
  pill_variant: z.enum(PILL_VARIANTS, {
    message: "Variante inválida.",
  }),
  display_order: orderInput,
});

export type VillainInput = z.input<typeof villainSchema>;
export type VillainOutput = z.output<typeof villainSchema>;
