import { z } from "zod";
import {
  CATALOG_OFFER_GROUPS,
  CATALOG_OFFER_KINDS,
} from "@/lib/catalog/catalog-offer";

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
  catalog_group: z
    .enum(CATALOG_OFFER_GROUPS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  catalog_kind: z
    .enum(CATALOG_OFFER_KINDS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  content_ref: optionalString(500),
  sort_order: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : Number.parseInt(v, 10);
      return Number.isFinite(n) ? Math.max(0, Math.min(32767, n)) : undefined;
    }),
});

export type ServiceProductInput = z.input<typeof serviceProductSchema>;
export type ServiceProductOutput = z.output<typeof serviceProductSchema>;
