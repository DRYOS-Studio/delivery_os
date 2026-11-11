"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getMeeting } from "@/lib/db/queries/meetings";
import { syncAutoTasksForMeeting } from "@/lib/meetings/meeting-next-step-tasks";
import {
  formDataToMeetingFormInput,
  meetingFormSchema,
  type MeetingFormOutput,
} from "@/lib/validators/meeting-form";

type PostgresError = { code?: string; message: string };

function validate(formData: FormData) {
  const parsed = meetingFormSchema.safeParse(formDataToMeetingFormInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function mapDbError(error: PostgresError) {
  if (error.code === "23503")
    return err("Participante inválido (pessoa removida?).", "invalid_attendee");
  return null;
}

async function insertAttendees(
  meetingId: string,
  attendeeIds: ReadonlyArray<string>,
): Promise<ActionResult<true>> {
  if (attendeeIds.length === 0) return ok(true);
  const supabase = await createServer();
  const rows = attendeeIds.map((person_id) => ({
    meeting_id: meetingId,
    person_id,
  }));
  const { error } = await supabase.from("meeting_attendees").insert(rows);
  if (error) {
    const mapped = mapDbError(error as PostgresError);
    if (mapped) return mapped;
    return dbErr(error, "insertAttendees");
  }
  return ok(true);
}

async function deleteAttendees(meetingId: string): Promise<ActionResult<true>> {
  const supabase = await createServer();
  const { error } = await supabase
    .from("meeting_attendees")
    .delete()
    .eq("meeting_id", meetingId);
  if (error) return dbErr(error, "deleteAttendees");
  return ok(true);
}

export async function createMeetingAction(
  operationId: string,
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    operationId: string;
    nextStepTaskWarnings?: string[];
  }>
> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: MeetingFormOutput = v.data;

  const supabase = await createServer();
  const pasteFlagCreate =
    ((formData.get("granola_has_paste") as string | null) ?? "").trim() === "1";
  const granolaCapturedAt =
    pasteFlagCreate || data.granola_suggestion_text?.trim()
      ? new Date().toISOString()
      : null;

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      operation_id: operationId,
      title: data.title,
      scheduled_at: data.scheduled_at,
      ended_at: data.ended_at ?? null,
      notes: data.notes ?? null,
      visibility: data.visibility,
      kind: data.kind ?? "general",
      granola_suggestion_text: data.granola_suggestion_text?.trim() || null,
      granola_source_ref: data.granola_source_ref?.trim() || null,
      granola_captured_at: granolaCapturedAt,
      auto_create_tasks_from_next_steps:
        data.auto_create_tasks_from_next_steps,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createMeetingAction");
  if (!meeting) return err("Falha ao criar reunião.", "no_data");

  const att = await insertAttendees(meeting.id, data.attendee_ids);
  if (!att.ok) return att;

  if (data.agenda_items.length > 0) {
    const { error: aiErr } = await supabase.from("meeting_agenda_items").insert(
      data.agenda_items.map((row, idx) => ({
        meeting_id: meeting.id,
        sort_order: idx,
        title: row.title.trim(),
        notes: row.notes?.trim() || null,
        source: "manual",
        granola_line: null,
      })),
    );
    if (aiErr) return dbErr(aiErr, "createMeetingAction.agenda_items");
  }

  if (data.next_steps.length > 0) {
    const { error: nsErr } = await supabase
      .from("meeting_agenda_next_steps")
      .insert(
        data.next_steps.map((row, idx) => ({
          meeting_id: meeting.id,
          sort_order: idx,
          description: row.description.trim(),
          due_date: row.due_date ?? null,
          assignee_person_id: row.assignee_person_id ?? null,
          frente_id: row.frente_id ?? null,
          task_id: null,
        })),
      );
    if (nsErr) return dbErr(nsErr, "createMeetingAction.next_steps");
  }

  let nextStepTaskWarnings: string[] | undefined;
  try {
    const sync = await syncAutoTasksForMeeting(supabase, meeting.id);
    if (sync.warnings.length > 0) {
      nextStepTaskWarnings = sync.warnings.map((w) => w.message);
    }
  } catch {
    nextStepTaskWarnings = [
      "Reunião salva, mas a criação automática de tarefas falhou — promova manualmente.",
    ];
  }

  revalidatePath(`/operations/${operationId}`);
  return ok({
    id: meeting.id,
    operationId,
    ...(nextStepTaskWarnings ? { nextStepTaskWarnings } : {}),
  });
}

export async function updateMeetingAction(
  meetingId: string,
  formData: FormData,
): Promise<
  ActionResult<{
    id: string;
    operationId: string;
    nextStepTaskWarnings?: string[];
  }>
> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getMeeting(meetingId);
  if (!current) return err("Reunião não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data: MeetingFormOutput = v.data;

  const supabase = await createServer();
  const pasteFlagUpdate =
    ((formData.get("granola_has_paste") as string | null) ?? "").trim() === "1";
  const granolaCapturedAt = pasteFlagUpdate
    ? new Date().toISOString()
    : (current.granola_captured_at ?? null);

  const { error: upErr } = await supabase
    .from("meetings")
    .update({
      title: data.title,
      scheduled_at: data.scheduled_at,
      ended_at: data.ended_at ?? null,
      notes: data.notes ?? null,
      visibility: data.visibility,
      kind: data.kind ?? "general",
      granola_suggestion_text: data.granola_suggestion_text?.trim() || null,
      granola_source_ref: data.granola_source_ref?.trim() || null,
      granola_captured_at: granolaCapturedAt,
      auto_create_tasks_from_next_steps:
        data.auto_create_tasks_from_next_steps,
    })
    .eq("id", meetingId);
  if (upErr) return dbErr(upErr, "updateMeetingAction");

  const { data: existingNext, error: exErr } = await supabase
    .from("meeting_agenda_next_steps")
    .select("id, task_id")
    .eq("meeting_id", meetingId);
  if (exErr) return dbErr(exErr, "updateMeetingAction.load_next_steps");

  const existingById = new Map(
    (existingNext ?? []).map((r) => [r.id, r.task_id as string | null]),
  );
  const incomingIds = new Set(
    data.next_steps.map((s) => s.id).filter((id): id is string => Boolean(id)),
  );
  const toDeleteNext = (existingNext ?? []).filter(
    (r) => !incomingIds.has(r.id),
  );
  const blockedDelete = toDeleteNext.some((r) => r.task_id);
  if (blockedDelete) {
    return err(
      "Não é possível remover um próximo passo que já virou tarefa.",
      "state_conflict",
    );
  }
  if (toDeleteNext.length > 0) {
    const { error: delNsErr } = await supabase
      .from("meeting_agenda_next_steps")
      .delete()
      .in(
        "id",
        toDeleteNext.map((r) => r.id),
      );
    if (delNsErr) return dbErr(delNsErr, "updateMeetingAction.delete_next_steps");
  }

  const { data: existingAgenda, error: exAgErr } = await supabase
    .from("meeting_agenda_items")
    .select("id")
    .eq("meeting_id", meetingId);
  if (exAgErr) return dbErr(exAgErr, "updateMeetingAction.load_agenda_items");

  const existingAgendaIds = new Set((existingAgenda ?? []).map((r) => r.id));
  const incomingAgendaIds = new Set(
    data.agenda_items.map((a) => a.id).filter((id): id is string => Boolean(id)),
  );
  const { data: decisionsUsingAgenda, error: decErr } = await supabase
    .from("decisions")
    .select("agenda_item_id")
    .eq("meeting_id", meetingId)
    .not("agenda_item_id", "is", null);
  if (decErr) return dbErr(decErr, "updateMeetingAction.decisions_agenda_refs");

  const referencedAgenda = new Set(
    (decisionsUsingAgenda ?? [])
      .map((d) => d.agenda_item_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  for (const oldId of existingAgendaIds) {
    if (incomingAgendaIds.has(oldId)) continue;
    if (referencedAgenda.has(oldId)) {
      return err(
        "Não é possível remover um item de pauta vinculado a uma decisão.",
        "state_conflict",
      );
    }
  }

  const toDeleteAgenda = [...existingAgendaIds].filter(
    (id) => !incomingAgendaIds.has(id),
  );
  if (toDeleteAgenda.length > 0) {
    const { error: delAiErr } = await supabase
      .from("meeting_agenda_items")
      .delete()
      .in("id", toDeleteAgenda);
    if (delAiErr) return dbErr(delAiErr, "updateMeetingAction.delete_agenda_items");
  }

  for (let idx = 0; idx < data.agenda_items.length; idx++) {
    const row = data.agenda_items[idx]!;
    const title = row.title.trim();
    const notes = row.notes?.trim() || null;
    if (row.id && existingAgendaIds.has(row.id)) {
      const { error: upAiErr } = await supabase
        .from("meeting_agenda_items")
        .update({
          sort_order: idx,
          title,
          notes,
          source: "manual",
        })
        .eq("id", row.id)
        .eq("meeting_id", meetingId);
      if (upAiErr) return dbErr(upAiErr, "updateMeetingAction.update_agenda_item");
    } else {
      const { error: insAiErr } = await supabase.from("meeting_agenda_items").insert({
        meeting_id: meetingId,
        sort_order: idx,
        title,
        notes,
        source: "manual",
        granola_line: null,
      });
      if (insAiErr) return dbErr(insAiErr, "updateMeetingAction.insert_agenda_item");
    }
  }

  for (let idx = 0; idx < data.next_steps.length; idx++) {
    const row = data.next_steps[idx]!;
    const desc = row.description.trim();
    const due = row.due_date ?? null;
    if (row.id && existingById.has(row.id)) {
      const taskId = existingById.get(row.id);
      const { error: upNsErr } = await supabase
        .from("meeting_agenda_next_steps")
        .update({
          sort_order: idx,
          description: desc,
          due_date: due,
          assignee_person_id: row.assignee_person_id ?? null,
          frente_id: row.frente_id ?? null,
        })
        .eq("id", row.id)
        .eq("meeting_id", meetingId);
      if (upNsErr) return dbErr(upNsErr, "updateMeetingAction.update_next_step");
      if (taskId) {
        const { error: taskUpErr } = await supabase
          .from("tasks")
          .update({
            title: desc.slice(0, 200),
            description: desc.length > 200 ? desc : null,
            due_date: due,
          })
          .eq("id", taskId);
        if (taskUpErr) return dbErr(taskUpErr, "updateMeetingAction.sync_task");
      }
    } else {
      const { error: insNsErr } = await supabase
        .from("meeting_agenda_next_steps")
        .insert({
          meeting_id: meetingId,
          sort_order: idx,
          description: desc,
          due_date: due,
          assignee_person_id: row.assignee_person_id ?? null,
          frente_id: row.frente_id ?? null,
          task_id: null,
        });
      if (insNsErr) return dbErr(insNsErr, "updateMeetingAction.insert_next_step");
    }
  }

  let nextStepTaskWarnings: string[] | undefined;
  try {
    const sync = await syncAutoTasksForMeeting(supabase, meetingId);
    if (sync.warnings.length > 0) {
      nextStepTaskWarnings = sync.warnings.map((w) => w.message);
    }
  } catch {
    nextStepTaskWarnings = [
      "Reunião salva, mas a criação automática de tarefas falhou — promova manualmente.",
    ];
  }

  // delete+insert attendees (simples; sem diff)
  const del = await deleteAttendees(meetingId);
  if (!del.ok) return del;
  const ins = await insertAttendees(meetingId, data.attendee_ids);
  if (!ins.ok) return ins;

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({
    id: meetingId,
    operationId: current.operation_id,
    ...(nextStepTaskWarnings ? { nextStepTaskWarnings } : {}),
  });
}

export async function deleteMeetingAction(
  meetingId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getMeeting(meetingId);
  if (!current) return err("Reunião não encontrada.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meetingId);
  if (error) return dbErr(error, "deleteMeetingAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}
