import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().max(5000, "Máximo 5000 caracteres.").optional(),
);

const optionalUuidEmpty = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid("UUID inválido.").optional(),
);

const agendaItemLineSchema = z.object({
  id: optionalUuidEmpty,
  title: z
    .string()
    .trim()
    .min(1, "Item da pauta não pode ser vazio.")
    .max(500, "Máximo 500 caracteres por item."),
  notes: optionalText,
});

const nextStepLineSchema = z.object({
  id: optionalUuidEmpty,
  assignee_person_id: optionalUuidEmpty,
  description: z
    .string()
    .trim()
    .min(1, "Próximo passo não pode ser vazio.")
    .max(2000, "Máximo 2000 caracteres."),
  due_date: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).")
      .optional(),
  ),
});

const optionalEndedAt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().min(1, "Data de término inválida.").optional(),
);

export const meetingFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres.")
      .max(200, "Máximo 200 caracteres."),
    scheduled_at: z.string().min(1, "Data obrigatória."),
    ended_at: optionalEndedAt,
    notes: optionalText,
    visibility: z.enum(["interno", "cliente"], {
      message: "Visibility obrigatória.",
    }),
    kind: z.enum(["general", "onboarding"]).default("general"),
    attendee_ids: z.array(z.string().uuid()).default([]),
    granola_suggestion_text: optionalText,
    granola_source_ref: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.string().max(500, "Máximo 500 caracteres.").optional(),
    ),
    agenda_items: z.array(agendaItemLineSchema).default([]),
    next_steps: z.array(nextStepLineSchema).default([]),
  })
  .refine(
    (d) => !d.ended_at || !d.scheduled_at || d.ended_at >= d.scheduled_at,
    { message: "Término deve ser após o início.", path: ["ended_at"] },
  );

export type MeetingFormOutput = z.output<typeof meetingFormSchema>;

const agendaItemLineClientSchema = z.object({
  id: optionalUuidEmpty,
  title: z.string().max(500, "Máximo 500 caracteres por item."),
  notes: optionalText,
});

const nextStepLineClientSchema = z.object({
  id: optionalUuidEmpty,
  assignee_person_id: optionalUuidEmpty,
  description: z.string().max(2000, "Máximo 2000 caracteres."),
  due_date: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).")
      .optional(),
  ),
});

/** Resolver no cliente: permite linhas vazias; filtrar antes de `meetingFormSchema`. */
export const meetingFormClientSchema = meetingFormSchema.omit({
  agenda_items: true,
  next_steps: true,
}).extend({
  agenda_items: z.array(agendaItemLineClientSchema).default([]),
  next_steps: z.array(nextStepLineClientSchema).default([]),
});

export type MeetingFormClientOutput = z.output<typeof meetingFormClientSchema>;
export type MeetingFormClientInput = z.input<typeof meetingFormClientSchema>;

function splitNonEmptyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function formDataToMeetingFormInput(formData: FormData) {
  const attendeeIds = formData
    .getAll("attendee_ids")
    .map((v) => String(v).trim())
    .filter((id) => id.length > 0);

  const agendaIds = formData.getAll("agenda_item_ids").map((v) => String(v).trim());
  const agendaTitles = formData.getAll("agenda_titles").map((v) => String(v));
  const agendaNotes = formData.getAll("agenda_notes").map((v) => String(v));
  const n = Math.max(agendaIds.length, agendaTitles.length, agendaNotes.length);
  const agenda_items: { id?: string; title: string; notes?: string }[] = [];
  for (let i = 0; i < n; i++) {
    const id = (agendaIds[i] ?? "").trim();
    const title = (agendaTitles[i] ?? "").trim();
    const notesRaw = (agendaNotes[i] ?? "").trim();
    if (!title && !notesRaw && !id) continue;
    agenda_items.push({
      ...(id ? { id } : {}),
      title: title || "—",
      ...(notesRaw ? { notes: notesRaw } : {}),
    });
  }

  const nextIds = formData.getAll("next_step_ids").map((v) => String(v).trim());
  const nextDescriptions = formData
    .getAll("next_step_descriptions")
    .map((v) => String(v));
  const nextDueDates = formData.getAll("next_step_due_dates").map((v) =>
    String(v).trim(),
  );
  const nextAssignees = formData
    .getAll("next_step_assignee_ids")
    .map((v) => String(v).trim());
  const m = Math.max(
    nextIds.length,
    nextDescriptions.length,
    nextDueDates.length,
    nextAssignees.length,
  );
  const next_steps: {
    id?: string;
    description: string;
    due_date?: string;
    assignee_person_id?: string;
  }[] = [];
  for (let i = 0; i < m; i++) {
    const id = (nextIds[i] ?? "").trim();
    const description = (nextDescriptions[i] ?? "").trim();
    const due = (nextDueDates[i] ?? "").trim();
    const assignee = (nextAssignees[i] ?? "").trim();
    if (!description && !due && !id && !assignee) continue;
    next_steps.push({
      ...(id ? { id } : {}),
      description: description || "—",
      ...(due ? { due_date: due } : {}),
      ...(assignee ? { assignee_person_id: assignee } : {}),
    });
  }

  const endedRaw = ((formData.get("ended_at") as string | null) ?? "").trim();

  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    scheduled_at: ((formData.get("scheduled_at") as string | null) ?? "").trim(),
    ...(endedRaw ? { ended_at: endedRaw } : {}),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
    visibility: ((formData.get("visibility") as string | null) ?? "interno").trim(),
    kind:
      ((formData.get("kind") as string | null) ?? "general").trim() === "onboarding"
        ? "onboarding"
        : "general",
    attendee_ids: attendeeIds,
    granola_suggestion_text: (
      (formData.get("granola_suggestion_text") as string | null) ?? ""
    ).trim(),
    granola_source_ref: (
      (formData.get("granola_source_ref") as string | null) ?? ""
    ).trim(),
    agenda_items,
    next_steps,
  };
}

export function appendMeetingOutputToFormData(
  fd: FormData,
  data: MeetingFormOutput,
  opts: { granolaHasPaste: boolean },
): void {
  fd.set("title", data.title);
  fd.set("scheduled_at", data.scheduled_at);
  fd.set("ended_at", data.ended_at ?? "");
  fd.set("notes", data.notes ?? "");
  fd.set("visibility", data.visibility);
  fd.set("kind", data.kind ?? "general");
  for (const id of data.attendee_ids) {
    fd.append("attendee_ids", id);
  }
  fd.set("granola_suggestion_text", data.granola_suggestion_text ?? "");
  fd.set("granola_source_ref", data.granola_source_ref ?? "");
  fd.set("granola_has_paste", opts.granolaHasPaste ? "1" : "");

  for (const row of data.agenda_items) {
    if (row.id) fd.append("agenda_item_ids", row.id);
    else fd.append("agenda_item_ids", "");
    fd.append("agenda_titles", row.title);
    fd.append("agenda_notes", row.notes ?? "");
  }
  for (const row of data.next_steps) {
    if (row.id) fd.append("next_step_ids", row.id);
    else fd.append("next_step_ids", "");
    fd.append("next_step_descriptions", row.description);
    fd.append("next_step_due_dates", row.due_date ?? "");
    fd.append("next_step_assignee_ids", row.assignee_person_id ?? "");
  }
}

type MeetingFormBuildError = { ok: false; message: string };

export function buildMeetingFormPayload(
  clientData: MeetingFormClientOutput,
  granolaPasteRaw: string,
):
  | { ok: true; data: MeetingFormOutput; granolaPasteForSubmit: string }
  | MeetingFormBuildError {
  const pasteLines = splitNonEmptyLines(granolaPasteRaw);
  const agendaFromRows = clientData.agenda_items.filter(
    (r) =>
      r.title.trim().length > 0 ||
      (r.notes && r.notes.trim().length > 0) ||
      Boolean(r.id),
  );
  const mergedAgenda = [
    ...agendaFromRows.map((r) => ({
      id: r.id,
      title: r.title.trim() || "—",
      notes: r.notes,
    })),
    ...pasteLines.map((line) => ({
      title: line.slice(0, 500),
      notes: undefined as string | undefined,
    })),
  ];
  const nextFromRows = clientData.next_steps.filter(
    (r) =>
      r.description.trim().length > 0 ||
      Boolean(r.due_date) ||
      Boolean(r.assignee_person_id) ||
      Boolean(r.id),
  );
  const suggestionText =
    clientData.granola_suggestion_text?.trim() ||
    (pasteLines.length > 0 ? pasteLines.join("\n") : undefined);

  const candidate = {
    ...clientData,
    agenda_items: mergedAgenda,
    next_steps: nextFromRows.map((r) => ({
      id: r.id,
      description: r.description.trim() || "—",
      due_date: r.due_date,
      assignee_person_id: r.assignee_person_id,
    })),
    granola_suggestion_text: suggestionText,
  };

  const parsed = meetingFormSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Dados inválidos." };
  }
  return {
    ok: true,
    data: parsed.data,
    granolaPasteForSubmit: granolaPasteRaw.trim(),
  };
}
