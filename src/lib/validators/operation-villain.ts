import { z } from "zod";

const progressInput = z.preprocess(
  (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : v;
    }
    return v;
  },
  z
    .number()
    .int("Use número inteiro.")
    .min(0, "Mínimo 0.")
    .max(100, "Máximo 100."),
);

const optionalEvidence = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(1000, "Máximo 1000 caracteres.").optional(),
);

export const assignVillainSchema = z.object({
  villain_id: z.string().uuid("Vilão obrigatório."),
  initial_severity: z.enum(["low", "medium", "high", "critical"], {
    message: "Severidade obrigatória.",
  }),
  progress_pct: progressInput,
  evidence: optionalEvidence,
});

// progress_pct é derivado dos Quick Wins (trigger sync_operation_villain_progress).
// Edit manual permite apenas evidence.
export const editOperationVillainSchema = z.object({
  evidence: optionalEvidence,
});

export type AssignVillainInput = z.input<typeof assignVillainSchema>;
export type AssignVillainOutput = z.output<typeof assignVillainSchema>;

export type EditOperationVillainInput = z.input<
  typeof editOperationVillainSchema
>;
export type EditOperationVillainOutput = z.output<
  typeof editOperationVillainSchema
>;
