import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalIso = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().min(1).optional(),
);

export const incidentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres.")
      .max(200, "Máximo 200 caracteres."),
    description: optionalText,
    severity: z.enum(["low", "medium", "high"], {
      message: "Severidade obrigatória.",
    }),
    status: z.enum(["open", "responded", "resolved", "cancelled"], {
      message: "Status obrigatório.",
    }),
    opened_at: z.string().min(1, "Data de abertura obrigatória."),
    responded_at: optionalIso,
    resolved_at: optionalIso,
  })
  .refine(
    (d) =>
      !["responded", "resolved"].includes(d.status) || !!d.responded_at,
    {
      message: "Status responded/resolved exige data de resposta.",
      path: ["responded_at"],
    },
  )
  .refine((d) => d.status !== "resolved" || !!d.resolved_at, {
    message: "Status resolved exige data de resolução.",
    path: ["resolved_at"],
  })
  .refine(
    (d) =>
      !d.responded_at ||
      new Date(d.responded_at).getTime() >= new Date(d.opened_at).getTime(),
    {
      message: "Resposta deve ser após abertura.",
      path: ["responded_at"],
    },
  )
  .refine(
    (d) =>
      !d.resolved_at ||
      !d.responded_at ||
      new Date(d.resolved_at).getTime() >=
        new Date(d.responded_at).getTime(),
    {
      message: "Resolução deve ser após resposta.",
      path: ["resolved_at"],
    },
  );

export type IncidentInput = z.input<typeof incidentSchema>;
export type IncidentOutput = z.output<typeof incidentSchema>;
