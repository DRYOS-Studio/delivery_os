import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];

export type AttendeeRef = {
  id: string;
  name: string;
  kind: Database["public"]["Enums"]["person_kind"];
};

export type MeetingListItem = {
  id: string;
  title: string;
  scheduledAt: string;
  visibility: Database["public"]["Enums"]["meeting_visibility"];
  notes: string | null;
  attendees: AttendeeRef[];
};

export type MeetingWithAttendees = MeetingRow & {
  attendees: AttendeeRef[];
};

export async function listMeetingsByOperation(
  operationId: string,
  limit = 20,
): Promise<MeetingListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("meetings")
    .select(
      `
      id, title, scheduled_at, visibility, notes,
      meeting_attendees!fk_meeting_attendees_meeting_id (
        person:persons!fk_meeting_attendees_person_id (
          id, name, kind, archived_at
        )
      )
      `,
    )
    .eq("operation_id", operationId)
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listMeetingsByOperation: ${error.message}`);
  if (!data) return [];

  return data.map((m): MeetingListItem => ({
    id: m.id,
    title: m.title,
    scheduledAt: m.scheduled_at,
    visibility: m.visibility,
    notes: m.notes,
    attendees: (m.meeting_attendees ?? [])
      .map((row) => row.person)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
  }));
}

export async function getMeeting(
  id: string,
): Promise<MeetingWithAttendees | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      meeting_attendees!fk_meeting_attendees_meeting_id (
        person:persons!fk_meeting_attendees_person_id (id, name, kind)
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getMeeting: ${error.message}`);
  if (!data) return null;

  const { meeting_attendees, ...meeting } = data;
  return {
    ...meeting,
    attendees: (meeting_attendees ?? [])
      .map((row) => row.person)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
  };
}

export async function listAttendeeCandidates(
  clientId: string,
): Promise<AttendeeRef[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name, kind, client_id")
    .or(`kind.eq.internal,and(kind.eq.external,client_id.eq.${clientId})`)
    .is("archived_at", null)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listAttendeeCandidates: ${error.message}`);
  if (!data) return [];
  return data.map((p) => ({ id: p.id, name: p.name, kind: p.kind }));
}
