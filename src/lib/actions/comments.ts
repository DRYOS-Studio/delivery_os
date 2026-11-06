"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import {
  getProfile,
  requireAdminAction,
  requireUserAction,
} from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getTask } from "@/lib/db/queries/tasks";
import { z } from "zod";

const bodySchema = z
  .string()
  .trim()
  .min(1, "Comentário vazio.")
  .max(8000, "Comentário muito longo (máx. 8000 caracteres).");

function revalidateTaskPaths(
  operationId: string,
  frenteId: string | null,
  taskId: string,
) {
  revalidatePath(`/operations/${operationId}`);
  if (frenteId) {
    revalidatePath(
      `/operations/${operationId}/frentes/${frenteId}/tasks/${taskId}/edit`,
    );
  } else {
    revalidatePath(`/operations/${operationId}/areas/${taskId}/edit`);
  }
}

export async function createTaskCommentAction(
  taskId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const raw = ((formData.get("body") as string | null) ?? "").trim();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Texto inválido.", "validation_body");
  }

  const task = await getTask(taskId);
  if (!task) return err("Tarefa não encontrada.", "not_found");

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, body: parsed.data })
    .select("id")
    .single();

  if (error) return dbErr(error, "createTaskCommentAction");
  if (!data) return err("Falha ao criar comentário.", "no_data");

  revalidateTaskPaths(task.operationId, task.frenteId, taskId);
  return ok({ id: data.id });
}

export async function updateTaskCommentAction(
  commentId: string,
  taskId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const raw = ((formData.get("body") as string | null) ?? "").trim();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Texto inválido.", "validation_body");
  }

  const task = await getTask(taskId);
  if (!task) return err("Tarefa não encontrada.", "not_found");

  const profile = await getProfile();
  if (!profile) return err("Sessão expirada.", "unauthenticated");

  const supabase = await createServer();
  const { data: existing } = await supabase
    .from("task_comments")
    .select("author_profile_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return err("Comentário não encontrado.", "not_found");
  if (
    existing.author_profile_id !== profile.user.id &&
    profile.role !== "admin"
  ) {
    return err("Você não pode editar este comentário.", "forbidden");
  }

  const { error } = await supabase
    .from("task_comments")
    .update({ body: parsed.data })
    .eq("id", commentId);
  if (error) return dbErr(error, "updateTaskCommentAction");

  revalidateTaskPaths(task.operationId, task.frenteId, taskId);
  return ok({ id: commentId });
}

export async function deleteTaskCommentAction(
  commentId: string,
  taskId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const task = await getTask(taskId);
  if (!task) return err("Tarefa não encontrada.", "not_found");

  const profile = await getProfile();
  if (!profile) return err("Sessão expirada.", "unauthenticated");

  const supabase = await createServer();
  const { data: existing } = await supabase
    .from("task_comments")
    .select("author_profile_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return err("Comentário não encontrado.", "not_found");
  if (existing.author_profile_id !== profile.user.id) {
    const adminGuard = await requireAdminAction();
    if (!adminGuard.ok) {
      return err("Você não pode apagar este comentário.", "forbidden");
    }
  }

  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  if (error) return dbErr(error, "deleteTaskCommentAction");

  revalidateTaskPaths(task.operationId, task.frenteId, taskId);
  return ok({ id: commentId });
}

export async function createOperationCommentAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const raw = ((formData.get("body") as string | null) ?? "").trim();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Texto inválido.", "validation_body");
  }

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_comments")
    .insert({ operation_id: operationId, body: parsed.data })
    .select("id")
    .single();
  if (error) return dbErr(error, "createOperationCommentAction");
  if (!data) return err("Falha ao criar comentário.", "no_data");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: data.id });
}

export async function updateOperationCommentAction(
  commentId: string,
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const raw = ((formData.get("body") as string | null) ?? "").trim();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Texto inválido.", "validation_body");
  }

  const profile = await getProfile();
  if (!profile) return err("Sessão expirada.", "unauthenticated");

  const supabase = await createServer();
  const { data: existing } = await supabase
    .from("operation_comments")
    .select("author_profile_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return err("Comentário não encontrado.", "not_found");
  if (
    existing.author_profile_id !== profile.user.id &&
    profile.role !== "admin"
  ) {
    return err("Você não pode editar este comentário.", "forbidden");
  }

  const { error } = await supabase
    .from("operation_comments")
    .update({ body: parsed.data })
    .eq("id", commentId);
  if (error) return dbErr(error, "updateOperationCommentAction");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: commentId });
}

export async function deleteOperationCommentAction(
  commentId: string,
  operationId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const profile = await getProfile();
  if (!profile) return err("Sessão expirada.", "unauthenticated");

  const supabase = await createServer();
  const { data: existing } = await supabase
    .from("operation_comments")
    .select("author_profile_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return err("Comentário não encontrado.", "not_found");
  if (
    existing.author_profile_id !== profile.user.id &&
    profile.role !== "admin"
  ) {
    const adminGuard = await requireAdminAction();
    if (!adminGuard.ok) {
      return err("Você não pode apagar este comentário.", "forbidden");
    }
  }

  const { error } = await supabase
    .from("operation_comments")
    .delete()
    .eq("id", commentId);
  if (error) return dbErr(error, "deleteOperationCommentAction");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: commentId });
}
