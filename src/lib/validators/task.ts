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

const optionalUuidArray = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr.filter((x) => x !== "" && x !== null && x !== undefined);
  },
  z.array(z.string().uuid("UUID inválido.")).default([]),
);

const optionalTags = z.preprocess(
  (v) => (v === undefined || v === null ? undefined : v),
  z.array(z.string().trim().min(1).max(30, "Tag máx 30 caracteres.")).optional(),
);

export const taskStatusEnum = z.enum(["todo", "doing", "blocked", "done"], {
  message: "Status obrigatório.",
});

const taskDateOrderMessage = {
  message: "A data de início não pode ser depois do prazo.",
  path: ["start_date" as const],
};

/** Campos de tarefa sem refinamento — use para `.partial()` em updates (Zod proíbe `.partial()` em schemas com `.refine`). */
export const taskFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(200, "Máximo 200 caracteres."),
  description: optionalText,
  status: taskStatusEnum,
  area_id: optionalUuid,
  assignee_person_ids: optionalUuidArray,
  parent_task_id: optionalUuid,
  start_date: optionalDate,
  due_date: optionalDate,
  tags: optionalTags,
  quick_win_id: optionalUuid,
  sla_incident_id: optionalUuid,
});

export const taskSchema = taskFieldsSchema.refine(
  (d) => !d.start_date || !d.due_date || d.start_date <= d.due_date,
  taskDateOrderMessage,
);

/** Update parcial: todos os campos opcionais, mesma regra de datas quando ambas presentes. */
export const taskUpdateFieldsSchema = taskFieldsSchema.partial().refine(
  (d) => !d.start_date || !d.due_date || d.start_date <= d.due_date,
  taskDateOrderMessage,
);

/** Update MCP/UI: mesmos campos parciais, sem `assignee_person_ids` (lista de assignees vem em campo separado). */
export const taskUpdateFieldsWithoutAssigneesSchema = taskFieldsSchema
  .omit({ assignee_person_ids: true })
  .partial()
  .refine(
    (d) => !d.start_date || !d.due_date || d.start_date <= d.due_date,
    taskDateOrderMessage,
  );

export type TaskInput = z.infer<typeof taskSchema>;
