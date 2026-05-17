"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getMeeting } from "@/lib/db/queries/meetings";
import {
  meetingSchema,
  type MeetingOutput,
} from "@/lib/validators/meeting";

type PostgresError = { code?: string; message: string };

function parseFormData(formData: FormData) {
  const attendeeIds = formData.getAll("attendee_ids").map((v) => String(v));
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    scheduled_at: ((formData.get("scheduled_at") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
    visibility: ((formData.get("visibility") as string | null) ?? "interno").trim(),
    attendee_ids: attendeeIds.filter((id) => id.length > 0),
  };
}

function validate(formData: FormData) {
  const parsed = meetingSchema.safeParse(parseFormData(formData));
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
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: MeetingOutput = v.data;

  const supabase = await createServer();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      operation_id: operationId,
      title: data.title,
      scheduled_at: data.scheduled_at,
      notes: data.notes ?? null,
      visibility: data.visibility,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createMeetingAction");
  if (!meeting) return err("Falha ao criar reunião.", "no_data");

  const att = await insertAttendees(meeting.id, data.attendee_ids);
  if (!att.ok) return att;

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: meeting.id, operationId });
}

export async function updateMeetingAction(
  meetingId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getMeeting(meetingId);
  if (!current) return err("Reunião não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data: MeetingOutput = v.data;

  const supabase = await createServer();
  const { error: upErr } = await supabase
    .from("meetings")
    .update({
      title: data.title,
      scheduled_at: data.scheduled_at,
      notes: data.notes ?? null,
      visibility: data.visibility,
    })
    .eq("id", meetingId);
  if (upErr) return dbErr(upErr, "updateMeetingAction");

  // delete+insert attendees (simples; sem diff)
  const del = await deleteAttendees(meetingId);
  if (!del.ok) return del;
  const ins = await insertAttendees(meetingId, data.attendee_ids);
  if (!ins.ok) return ins;

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ id: meetingId, operationId: current.operation_id });
}

export async function deleteMeetingAction(
  meetingId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

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
