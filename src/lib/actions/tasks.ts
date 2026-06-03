"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getFrente } from "@/lib/db/queries/frentes";
import { getTask } from "@/lib/db/queries/tasks";
import { taskSchema, taskStatusEnum } from "@/lib/validators/task";

function parseTags(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  return Array.from(new Set(parts));
}

function parseFormData(formData: FormData) {
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    status: ((formData.get("status") as string | null) ?? "todo").trim(),
    assignee_person_id: ((formData.get("assignee_person_id") as string | null) ?? "").trim(),
    start_date: ((formData.get("start_date") as string | null) ?? "").trim(),
    due_date: ((formData.get("due_date") as string | null) ?? "").trim(),
    tags: parseTags(formData.get("tags") as string | null),
    quick_win_id: ((formData.get("quick_win_id") as string | null) ?? "").trim(),
    sla_incident_id: ((formData.get("sla_incident_id") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = taskSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

async function revalidateForFrente(frenteId: string) {
  const frente = await getFrente(frenteId);
  if (frente) {
    revalidatePath(`/operations/${frente.operation_id}/frentes/${frenteId}`);
    revalidatePath(`/operations/${frente.operation_id}`);
  }
  revalidatePath("/admin/dashboard");
}

export async function createTaskAction(
  frenteId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; frenteId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("tasks")
    .insert({
      frente_id: frenteId,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      assignee_person_id: data.assignee_person_id ?? null,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      tags: data.tags ?? null,
      quick_win_id: data.quick_win_id ?? null,
      sla_incident_id: data.sla_incident_id ?? null,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createTaskAction");
  if (!row) return err("Falha ao criar tarefa.", "no_data");

  await revalidateForFrente(frenteId);
  return ok({ id: row.id, frenteId });
}

export async function updateTaskAction(
  taskId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; frenteId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getTask(taskId);
  if (!current) return err("Tarefa não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { error } = await supabase
    .from("tasks")
    .update({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      assignee_person_id: data.assignee_person_id ?? null,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      tags: data.tags ?? null,
      quick_win_id: data.quick_win_id ?? null,
      sla_incident_id: data.sla_incident_id ?? null,
    })
    .eq("id", taskId);
  if (error) return dbErr(error, "updateTaskAction");

  await revalidateForFrente(current.frenteId);
  return ok({ id: taskId, frenteId: current.frenteId });
}

export async function changeTaskStatusAction(
  taskId: string,
  newStatus: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const parsed = taskStatusEnum.safeParse(newStatus);
  if (!parsed.success) return err("Status inválido.", "validation_status");

  const current = await getTask(taskId);
  if (!current) return err("Tarefa não encontrada.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data })
    .eq("id", taskId);
  if (error) return dbErr(error, "changeTaskStatusAction");

  await revalidateForFrente(current.frenteId);
  return ok({ id: taskId });
}

export async function deleteTaskAction(
  taskId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getTask(taskId);
  if (!current) return err("Tarefa não encontrada.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return dbErr(error, "deleteTaskAction");

  await revalidateForFrente(current.frenteId);
  return ok({ id: taskId });
}
