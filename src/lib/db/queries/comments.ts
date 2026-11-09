import { createServer } from "@/lib/db/client";
import {
  pickProfileDisplayName,
  resolveProfileDisplayNames,
} from "@/lib/db/queries/profile-display-names";

export type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string | null;
};

type RawTaskComment = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_profile_id: string;
};

export async function listTaskComments(taskId: string): Promise<CommentRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, body, created_at, updated_at, author_profile_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listTaskComments", error.message);
    return [];
  }
  const rows = data as RawTaskComment[];
  const names = await resolveProfileDisplayNames(
    rows.map((r) => r.author_profile_id),
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorId: r.author_profile_id,
    authorName: pickProfileDisplayName(names, r.author_profile_id),
  }));
}

export async function listOperationComments(
  operationId: string,
): Promise<CommentRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_comments")
    .select("id, body, created_at, updated_at, author_profile_id")
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listOperationComments", error.message);
    return [];
  }
  const rows = data as RawTaskComment[];
  const names = await resolveProfileDisplayNames(
    rows.map((r) => r.author_profile_id),
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorId: r.author_profile_id,
    authorName: pickProfileDisplayName(names, r.author_profile_id),
  }));
}
