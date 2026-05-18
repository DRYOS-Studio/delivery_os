import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid("UUID inválido.").optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).")
    .optional(),
);

const optionalTags = z.preprocess(
  (v) => (v === undefined || v === null ? undefined : v),
  z.array(z.string().trim().min(1).max(30, "Tag máx 30 caracteres.")).optional(),
);

export const taskStatusEnum = z.enum(["todo", "doing", "blocked", "done"], {
  message: "Status obrigatório.",
});

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  description: optionalText,
  status: taskStatusEnum,
  assignee_person_id: optionalUuid,
  due_date: optionalDate,
  tags: optionalTags,
  quick_win_id: optionalUuid,
  sla_incident_id: optionalUuid,
});

export type TaskInput = z.infer<typeof taskSchema>;
