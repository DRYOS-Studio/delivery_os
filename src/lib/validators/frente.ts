import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

// Espelha o CHECK do DB (chk_frentes_actionable_status_not_generic).
export const FORBIDDEN_STATUS = [
  "em andamento",
  "em revisão",
  "pendente",
  "a fazer",
  "em progresso",
];

const dateString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional(),
);

const optionalUuid = z.preprocess(
  emptyToUndefined,
  z.string().uuid("Responsável inválido.").optional(),
);

export const frenteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Nome obrigatório.")
      .max(120, "Nome muito longo (máx 120)."),
    cycle_type: z.enum(["a", "b", "c", "d", "e"], {
      message: "Tipo de ciclo obrigatório.",
    }),
    domain: z.enum(["infra", "dados_analiticos", "dados_tecnicos"], {
      message: "Domínio obrigatório.",
    }),
    phase: z.enum(["descoberta", "execucao", "entrega", "encerrada"], {
      message: "Fase inválida.",
    }),
    actionable_status: z
      .string()
      .trim()
      .min(15, "Mínimo 15 caracteres.")
      .refine(
        (s) => !FORBIDDEN_STATUS.includes(s.toLowerCase()),
        'Status muito genérico. Use o formato "aguardando X de Y desde Z".',
      ),
    responsible_person_id: optionalUuid,
    start_date: dateString,
    end_date: dateString,
  })
  .refine((data) => !["c", "e"].includes(data.cycle_type) || !data.end_date, {
    message: "Ciclo C/E é contínuo — não pode ter data de fim.",
    path: ["end_date"],
  })
  .refine(
    (data) =>
      !data.start_date ||
      !data.end_date ||
      data.start_date <= data.end_date,
    {
      message: "Data de fim deve ser ≥ data de início.",
      path: ["end_date"],
    },
  );

export type FrenteInput = z.input<typeof frenteSchema>;
export type FrenteOutput = z.output<typeof frenteSchema>;
