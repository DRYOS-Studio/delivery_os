import { createAdmin, createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];

export type AttachmentVisibility =
  Database["public"]["Enums"]["attachment_visibility"];

export type AttachmentListItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  createdAt: string;
  meetingId: string | null;
  visibility: AttachmentVisibility;
  uploaderEmail: string | null;
};

const ATTACHMENT_FIELDS =
  "id, filename, mime_type, size_bytes, description, created_at, meeting_id, visibility, uploaded_by";

async function resolveUploaderEmails(
  ids: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const admin = createAdmin();
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user?.email) return;
      map.set(id, data.user.email);
    }),
  );
  return map;
}

export type MeetingFilter = "none" | "only" | "all";

export async function listAttachmentsByOperation(
  operationId: string,
  meetingFilter: MeetingFilter = "none",
): Promise<AttachmentListItem[]> {
  const supabase = await createServer();
  let query = supabase
    .from("attachments")
    .select(ATTACHMENT_FIELDS)
    .eq("operation_id", operationId);

  if (meetingFilter === "none") query = query.is("meeting_id", null);
  else if (meetingFilter === "only") query = query.not("meeting_id", "is", null);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`listAttachmentsByOperation: ${error.message}`);
  if (!data) return [];

  const ids = data
    .map((r) => r.uploaded_by)
    .filter((id): id is string => id !== null);
  const emails = await resolveUploaderEmails(ids);

  return data.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    description: r.description,
    createdAt: r.created_at,
    meetingId: r.meeting_id,
    visibility: r.visibility,
    uploaderEmail: r.uploaded_by
      ? (emails.get(r.uploaded_by) ?? null)
      : null,
  }));
}

export async function listAttachmentsByMeeting(
  meetingId: string,
): Promise<AttachmentListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("attachments")
    .select(ATTACHMENT_FIELDS)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAttachmentsByMeeting: ${error.message}`);
  if (!data) return [];

  const ids = data
    .map((r) => r.uploaded_by)
    .filter((id): id is string => id !== null);
  const emails = await resolveUploaderEmails(ids);

  return data.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    description: r.description,
    createdAt: r.created_at,
    meetingId: r.meeting_id,
    visibility: r.visibility,
    uploaderEmail: r.uploaded_by
      ? (emails.get(r.uploaded_by) ?? null)
      : null,
  }));
}

// Badge da tab Anexos (op page). Mesma semântica de listAttachmentsByOperation
// com meetingFilter "none": só anexos de nível operação (meeting_id IS NULL).
export async function countOperationAttachments(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .is("meeting_id", null);
  if (error) throw new Error(`countOperationAttachments: ${error.message}`);
  return count ?? 0;
}

export async function countAttachmentsByMeeting(
  operationId: string,
): Promise<Map<string, number>> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("attachments")
    .select("meeting_id")
    .eq("operation_id", operationId)
    .not("meeting_id", "is", null);
  if (error) throw new Error(`countAttachmentsByMeeting: ${error.message}`);
  if (!data) return new Map();

  const map = new Map<string, number>();
  for (const row of data) {
    if (!row.meeting_id) continue;
    map.set(row.meeting_id, (map.get(row.meeting_id) ?? 0) + 1);
  }
  return map;
}

export async function getAttachment(
  id: string,
): Promise<AttachmentRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAttachment: ${error.message}`);
  return data;
}
