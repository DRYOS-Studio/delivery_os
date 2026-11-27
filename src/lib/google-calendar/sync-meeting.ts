import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import { GoogleCalendarApiClient } from "@/lib/google-calendar/api-client";
import {
  buildMeetingCalendarDescription,
  defaultMeetingEndIso,
} from "@/lib/google-calendar/build-event";
import { googleOAuthConfigured } from "@/lib/google-calendar/config";
import { getValidGoogleCalendarAccessToken } from "@/lib/google-calendar/token-access";
import { logRouteError } from "@/lib/utils/log-route-error";

export type MeetingGoogleSyncMode = "create" | "update" | "cancel";

const SYNC_ERROR_MAX = 500;

function truncateError(message: string): string {
  return message.slice(0, SYNC_ERROR_MAX);
}

type MeetingSyncRow = {
  id: string;
  title: string;
  scheduled_at: string;
  ended_at: string | null;
  notes: string | null;
  kind: Database["public"]["Enums"]["meeting_kind"];
  operation_id: string;
  google_event_id: string | null;
  google_calendar_send_invites: boolean;
};

async function loadMeetingForSync(
  meetingId: string,
): Promise<MeetingSyncRow | null> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("meetings")
    .select(
      "id, title, scheduled_at, ended_at, notes, kind, operation_id, google_event_id, google_calendar_send_invites",
    )
    .eq("id", meetingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadAttendeeEmails(personIds: string[]): Promise<string[]> {
  if (personIds.length === 0) return [];
  const admin = createAdmin();
  const { data, error } = await admin
    .from("persons")
    .select("email")
    .in("id", personIds)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  const emails = (data ?? [])
    .map((p) => p.email?.trim())
    .filter((e): e is string => Boolean(e && e.includes("@")));
  return [...new Set(emails)];
}

async function loadOperationContext(operationId: string): Promise<{
  clientName: string;
  operationName: string;
}> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("operations")
    .select("name, client:clients!fk_operations_client_id ( name )")
    .eq("id", operationId)
    .maybeSingle();
  if (error || !data) {
    return { clientName: "Cliente", operationName: "Operação" };
  }
  const client = data.client as { name: string } | null;
  return {
    clientName: client?.name ?? "Cliente",
    operationName: data.name,
  };
}

async function loadAgendaTitles(meetingId: string): Promise<string[]> {
  const admin = createAdmin();
  const { data } = await admin
    .from("meeting_agenda_items")
    .select("title")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => r.title).filter(Boolean);
}

async function markMeetingGoogleSync(
  meetingId: string,
  patch: Database["public"]["Tables"]["meetings"]["Update"],
): Promise<void> {
  const admin = createAdmin();
  await admin.from("meetings").update(patch).eq("id", meetingId);
}

export async function syncMeetingWithGoogleCalendar(input: {
  meetingId: string;
  mode: MeetingGoogleSyncMode;
  sendInvites: boolean;
  attendeeIds: string[];
}): Promise<void> {
  const route = "syncMeetingWithGoogleCalendar";
  try {
    if (!googleOAuthConfigured()) {
      await markMeetingGoogleSync(input.meetingId, {
        google_calendar_sync_status: "skipped",
        google_calendar_send_invites: input.sendInvites,
      });
      return;
    }

    const auth = await getValidGoogleCalendarAccessToken();
    if (!auth) {
      await markMeetingGoogleSync(input.meetingId, {
        google_calendar_sync_status: "skipped",
        google_calendar_send_invites: input.sendInvites,
      });
      return;
    }

    const meeting = await loadMeetingForSync(input.meetingId);
    if (!meeting) return;

    const client = new GoogleCalendarApiClient(
      auth.accessToken,
      auth.calendarId,
    );

    if (input.mode === "cancel") {
      if (!meeting.google_event_id) {
        await markMeetingGoogleSync(input.meetingId, {
          google_calendar_sync_status: "synced",
          google_calendar_sync_error: null,
        });
        return;
      }
      await client.cancelEvent(meeting.google_event_id, input.sendInvites);
      await markMeetingGoogleSync(input.meetingId, {
        google_event_id: null,
        google_event_html_link: null,
        google_meet_link: null,
        google_calendar_sync_status: "synced",
        google_calendar_sync_error: null,
        google_calendar_send_invites: input.sendInvites,
      });
      return;
    }

    const [{ clientName, operationName }, attendeeEmails, agendaTitles] =
      await Promise.all([
        loadOperationContext(meeting.operation_id),
        loadAttendeeEmails(input.attendeeIds),
        loadAgendaTitles(input.meetingId),
      ]);

    const description = buildMeetingCalendarDescription({
      title: meeting.title,
      scheduledAt: meeting.scheduled_at,
      endedAt: meeting.ended_at,
      notes: meeting.notes,
      kind: meeting.kind,
      clientName,
      operationName,
      operationId: meeting.operation_id,
      agendaTitles,
    });

    const eventInput = {
      summary: meeting.title,
      description,
      startIso: meeting.scheduled_at,
      endIso: defaultMeetingEndIso(meeting.scheduled_at, meeting.ended_at),
      attendeeEmails,
      sendInvites: input.sendInvites,
    };

    const result =
      input.mode === "update" && meeting.google_event_id
        ? await client.updateEvent(meeting.google_event_id, eventInput)
        : await client.createEvent(eventInput);

    await markMeetingGoogleSync(input.meetingId, {
      google_event_id: result.id,
      google_event_html_link: result.htmlLink,
      google_meet_link: result.meetLink,
      google_calendar_sync_status: "synced",
      google_calendar_sync_error: null,
      google_calendar_send_invites: input.sendInvites,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    logRouteError(route, e, {
      meetingId: input.meetingId,
      mode: input.mode,
    });
    await markMeetingGoogleSync(input.meetingId, {
      google_calendar_sync_status: "pending",
      google_calendar_sync_error: truncateError(message),
      google_calendar_send_invites: input.sendInvites,
    });
  }
}

/** Salva send_invites no meeting antes do sync (create/update). */
export async function persistMeetingSendInvites(
  supabase: SupabaseClient<Database>,
  meetingId: string,
  sendInvites: boolean,
): Promise<void> {
  await supabase
    .from("meetings")
    .update({ google_calendar_send_invites: sendInvites })
    .eq("id", meetingId);
}