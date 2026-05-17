import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

const impactPct = z.preprocess(
  (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : v;
    }
    return v;
  },
  z.number().int().min(1, "Mínimo 1.").max(100, "Máximo 100."),
);

export const impactSchema = z.object({
  operation_villain_id: z.string().uuid(),
  impact_pct: impactPct,
});

export const quickWinSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  description: optionalText,
  happened_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data obrigatória."),
  frente_id: optionalUuid,
  impacts: z.array(impactSchema).max(7, "Máximo 7 impactos.").default([]),
});

export type QuickWinInput = z.input<typeof quickWinSchema>;
export type QuickWinOutput = z.output<typeof quickWinSchema>;
export type ImpactInput = z.input<typeof impactSchema>;
export type ImpactOutput = z.output<typeof impactSchema>;
