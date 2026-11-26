"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getMeeting } from "@/lib/db/queries/meetings";
import { syncMeetingWithGoogleCalendar } from "@/lib/google-calendar/sync-meeting";

export async function retryMeetingGoogleCalendarSyncAction(
  meetingId: string,
  options?: { sendInvites?: boolean },
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const meeting = await getMeeting(meetingId);
  if (!meeting) return err("Reunião não encontrada.", "not_found");

  const sendInvites =
    options?.sendInvites ?? meeting.google_calendar_send_invites ?? true;

  const attendeeIds = meeting.attendees.map((a) => a.id);
  const mode = meeting.google_event_id ? "update" : "create";

  await syncMeetingWithGoogleCalendar({
    meetingId,
    mode,
    sendInvites,
    attendeeIds,
  });

  revalidatePath(`/operations/${meeting.operation_id}/meetings/${meetingId}`);
  revalidatePath(`/operations/${meeting.operation_id}`);
  return ok({ operationId: meeting.operation_id });
}