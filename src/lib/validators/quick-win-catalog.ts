import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max))
    .optional()
    .or(z.literal("").transform(() => undefined));

export const quickWinCatalogSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(3, "Mínimo 3 caracteres.").max(120, "Máximo 120 caracteres.")),
  description: optionalString(2000),
  suggested_villain_id: z
    .string()
    .uuid("Vilão inválido.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  default_impact_pct: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().int("Use número inteiro.").min(1, "Mínimo 1%.").max(100, "Máximo 100%.").optional(),
    ),
});

export type QuickWinCatalogInput = z.input<typeof quickWinCatalogSchema>;
export type QuickWinCatalogOutput = z.output<typeof quickWinCatalogSchema>;
