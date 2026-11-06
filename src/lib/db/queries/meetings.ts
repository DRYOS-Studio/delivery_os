import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];

export type AgendaItemRow =
  Database["public"]["Tables"]["meeting_agenda_items"]["Row"];
export type NextStepRow =
  Database["public"]["Tables"]["meeting_agenda_next_steps"]["Row"];

export type NextStepWithTask = NextStepRow & {
  task: { id: string; frente_id: string | null } | null;
};

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
  agenda_items: AgendaItemRow[];
  next_steps: NextStepWithTask[];
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

// Badge da tab Eventos (op page): count uncapped — a lista acima tem limit 20,
// derivar badge de lista.length flip-flopa quando há >20 registros (#131).
export async function countMeetingsByOperation(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId);
  if (error) throw new Error(`countMeetingsByOperation: ${error.message}`);
  return count ?? 0;
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
      ),
      meeting_agenda_items!fk_meeting_agenda_items_meeting (
        id, meeting_id, sort_order, title, notes, source, granola_line, created_at, updated_at
      ),
      meeting_agenda_next_steps!fk_meeting_agenda_next_steps_meeting (
        id, meeting_id, sort_order, description, due_date, task_id, created_at, updated_at,
        task:tasks!fk_meeting_agenda_next_steps_task ( id, frente_id )
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getMeeting: ${error.message}`);
  if (!data) return null;

  const {
    meeting_attendees,
    meeting_agenda_items,
    meeting_agenda_next_steps,
    ...meeting
  } = data;
  const agendaItems = (meeting_agenda_items ?? []) as AgendaItemRow[];
  agendaItems.sort((a, b) => a.sort_order - b.sort_order);
  const rawNext = (meeting_agenda_next_steps ?? []) as (NextStepRow & {
    task: { id: string; frente_id: string | null } | null;
  })[];
  rawNext.sort((a, b) => a.sort_order - b.sort_order);
  const nextSteps: NextStepWithTask[] = rawNext.map((row) => {
    const { task, ...rest } = row;
    return {
      ...rest,
      task: task ?? null,
    };
  });
  return {
    ...meeting,
    attendees: (meeting_attendees ?? [])
      .map((row) => row.person)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
    agenda_items: agendaItems,
    next_steps: nextSteps,
  };
}

export async function listAgendaItemsByMeeting(
  meetingId: string,
): Promise<{ id: string; title: string }[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("meeting_agenda_items")
    .select("id, title, sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listAgendaItemsByMeeting: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title }));
}

export type MeetingNextStepDetail = NextStepRow & {
  operation_id: string;
};

export async function getMeetingNextStep(
  id: string,
): Promise<MeetingNextStepDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("meeting_agenda_next_steps")
    .select(
      `
      *,
      meeting:meetings!fk_meeting_agenda_next_steps_meeting (operation_id)
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getMeetingNextStep: ${error.message}`);
  if (!data) return null;
  const row = data as NextStepRow & {
    meeting: { operation_id: string } | null;
  };
  if (!row.meeting?.operation_id) return null;
  const { meeting: _m, ...step } = row;
  return { ...step, operation_id: row.meeting.operation_id };
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
