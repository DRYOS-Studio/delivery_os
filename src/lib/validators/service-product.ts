import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(max))
    .optional()
    .or(z.literal("").transform(() => undefined));

export const serviceProductSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2, "Mínimo 2 caracteres.").max(80, "Máximo 80 caracteres.")),
  slug: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(
      z
        .string()
        .regex(
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
          "Slug inválido (use minúsculas, dígitos e hífens).",
        ),
    ),
  description: optionalString(1000),
  default_cycle_type: z
    .enum(["a", "b", "c", "d", "e"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ServiceProductInput = z.input<typeof serviceProductSchema>;
export type ServiceProductOutput = z.output<typeof serviceProductSchema>;
