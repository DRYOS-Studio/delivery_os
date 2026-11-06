"use server";

import { type ActionResult, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { listAgendaItemsByMeeting } from "@/lib/db/queries/meetings";

export async function listAgendaItemsForMeetingAction(
  meetingId: string,
): Promise<ActionResult<{ id: string; title: string }[]>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const items = await listAgendaItemsByMeeting(meetingId);
  return ok(items.map((i) => ({ id: i.id, title: i.title })));
}
