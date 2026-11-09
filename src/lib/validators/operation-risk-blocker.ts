import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid("UUID inválido.").optional(),
);

export const operationRiskBlockerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  description: optionalText,
  kind: z.enum(["risk", "blocker"], { message: "Tipo obrigatório." }),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["open", "mitigated", "resolved"]).default("open"),
  origin: z.enum(["dryos", "client", "vendor"]).default("dryos"),
  responsible_person_id: optionalUuid,
  meeting_id: optionalUuid,
  decision_id: optionalUuid,
  task_id: optionalUuid,
});

export type OperationRiskBlockerInput = z.infer<typeof operationRiskBlockerSchema>;
