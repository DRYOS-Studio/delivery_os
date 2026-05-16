import { z } from "zod";

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome obrigatório.")
    .max(120, "Nome muito longo (máx 120 caracteres)."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug obrigatório.")
    .max(60, "Slug muito longo (máx 60 caracteres).")
    .regex(/^[a-z0-9-]+$/, "Slug só pode ter minúsculas, números e hífens."),
  notes: z
    .string()
    .max(1000, "Notas muito longas (máx 1000 caracteres).")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ClientInput = z.infer<typeof clientSchema>;
