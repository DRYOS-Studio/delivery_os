import { createServer } from "@/lib/db/client";

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
  author: { name: string | null } | { name: string | null }[] | null;
};

function mapAuthor(
  author: RawTaskComment["author"],
): string | null {
  if (!author) return null;
  return Array.isArray(author) ? (author[0]?.name ?? null) : author.name;
}

export async function listTaskComments(taskId: string): Promise<CommentRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, body, created_at, updated_at, author_profile_id, author:profiles!fk_task_comments_author(name)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listTaskComments", error.message);
    return [];
  }
  return (data as RawTaskComment[]).map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorId: r.author_profile_id,
    authorName: mapAuthor(r.author),
  }));
}

type RawOpComment = RawTaskComment;

export async function listOperationComments(
  operationId: string,
): Promise<CommentRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_comments")
    .select(
      "id, body, created_at, updated_at, author_profile_id, author:profiles!fk_operation_comments_author(name)",
    )
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listOperationComments", error.message);
    return [];
  }
  return (data as RawOpComment[]).map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorId: r.author_profile_id,
    authorName: mapAuthor(r.author),
  }));
}
