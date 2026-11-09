import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
import { mcpUpdateTaskSchema } from "@/lib/mcp/tool-args/task-update";
import { applyClearable } from "@/lib/mcp/tool-args/clearable";
import { taskSchema, taskStatusEnum } from "@/lib/validators/task";
import { z } from "zod";

const TASK_SELECT = `
  id, frente_id, operation_id, area_id, title, description, status, parent_task_id,
  start_date, due_date, tags, quick_win_id, sla_incident_id, created_at, updated_at, completed_at,
  operation:operations!fk_tasks_operation_id (
    id, name, status,
    client:clients!fk_operations_client_id ( id, name, slug )
  ),
  assignees:task_assignees ( person_id, person:persons!fk_task_assignees_person_id ( id, name ) )
`;

const listArgs = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).max(10000).optional(),
  operation_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  status: z.array(taskStatusEnum).max(4).optional(),
  assignee_person_id: z.string().uuid().optional(),
  /** Quando true, só tarefas de área (area_id NOT NULL). Quando false, só entrega. Omitir = ambas (RLS). */
  area_tasks_only: z.boolean().optional(),
});

export async function mcpListTasks(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<{ ok: true; tasks: unknown[] } | { ok: false; message: string }> {
  const parsed = listArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos." };
  }
  const a = parsed.data;
  const limit = a.limit ?? 20;
  const offset = a.offset ?? 0;

  let opFilterIds: string[] | undefined;
  if (a.client_id) {
    const { data: ops, error: opErr } = await supabase
      .from("operations")
      .select("id")
      .eq("client_id", a.client_id);
    if (opErr) return { ok: false, message: opErr.message };
    opFilterIds = (ops ?? []).map((o) => o.id);
    if (opFilterIds.length === 0) return { ok: true, tasks: [] };
  }

  let taskIdFilter: string[] | undefined;
  if (a.assignee_person_id) {
    const { data: tas, error: taErr } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("person_id", a.assignee_person_id);
    if (taErr) return { ok: false, message: taErr.message };
    taskIdFilter = [...new Set((tas ?? []).map((t) => t.task_id))];
    if (taskIdFilter.length === 0) return { ok: true, tasks: [] };
  }

  let q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (a.operation_id) q = q.eq("operation_id", a.operation_id);
  if (opFilterIds) q = q.in("operation_id", opFilterIds);
  if (taskIdFilter) q = q.in("id", taskIdFilter);
  if (a.status && a.status.length > 0) q = q.in("status", a.status);
  if (a.area_tasks_only === true) q = q.not("area_id", "is", null);
  if (a.area_tasks_only === false) q = q.is("area_id", null);

  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, tasks: data ?? [] };
}

const getArgs = z.object({ task_id: z.string().uuid() });

export async function mcpGetTask(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<{ ok: true; task: unknown } | { ok: false; message: string; notFound?: boolean }> {
  const parsed = getArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "task_id inválido." };
  }
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", parsed.data.task_id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Tarefa não encontrada ou sem acesso.", notFound: true };
  return { ok: true, task: data };
}

async function syncAssignees(
  supabase: SupabaseClient<Database>,
  taskId: string,
  personIds: string[],
): Promise<string | null> {
  const { error: delError } = await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (delError) return delError.message;
  const unique = Array.from(new Set(personIds));
  if (unique.length === 0) return null;
  const { error: insError } = await supabase
    .from("task_assignees")
    .insert(unique.map((person_id) => ({ task_id: taskId, person_id })));
  return insError?.message ?? null;
}

const createDeliveryArgs = z
  .object({
    frente_id: z.string().uuid(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .merge(taskSchema);

export async function mcpCreateDeliveryTask(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<
  { ok: true; id: string; operation_id: string } | { ok: false; message: string }
> {
  const parsed = createDeliveryArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { idempotency_key: _ik, ...data } = parsed.data;
  void _ik;

  const { data: frenteRow, error: frenteErr } = await supabase
    .from("frentes")
    .select("operation_id")
    .eq("id", data.frente_id)
    .maybeSingle();
  if (frenteErr) return { ok: false, message: frenteErr.message };
  if (!frenteRow) return { ok: false, message: "Frente não encontrada." };

  if (data.area_id) {
    return { ok: false, message: "Tarefa de entrega não deve ter area_id." };
  }

  const { data: row, error } = await supabase
    .from("tasks")
    .insert({
      frente_id: data.frente_id,
      operation_id: frenteRow.operation_id,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      parent_task_id: data.parent_task_id ?? null,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      tags: data.tags ?? null,
      quick_win_id: data.quick_win_id ?? null,
      sla_incident_id: data.sla_incident_id ?? null,
    })
    .select("id, operation_id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Falha ao criar." };

  const syncErr = await syncAssignees(supabase, row.id, data.assignee_person_ids);
  if (syncErr) return { ok: false, message: syncErr };

  return { ok: true, id: row.id, operation_id: row.operation_id };
}

const createAreaArgs = z
  .object({
    operation_id: z.string().uuid(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .merge(taskSchema)
  .refine((d) => Boolean(d.area_id), { message: "area_id obrigatório.", path: ["area_id"] });

export async function mcpCreateAreaTask(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<
  { ok: true; id: string; operation_id: string } | { ok: false; message: string }
> {
  const parsed = createAreaArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { idempotency_key: _ik, operation_id, ...data } = parsed.data;
  void _ik;
  if (data.area_id) {
    // XOR: entrega vs área — já validado
  }
  const { data: row, error } = await supabase
    .from("tasks")
    .insert({
      operation_id,
      frente_id: null,
      area_id: data.area_id!,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      start_date: data.start_date ?? null,
      due_date: data.due_date ?? null,
      tags: data.tags ?? null,
    })
    .select("id, operation_id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Falha ao criar." };
  const syncErr = await syncAssignees(supabase, row.id, data.assignee_person_ids);
  if (syncErr) return { ok: false, message: syncErr };
  return { ok: true, id: row.id, operation_id: row.operation_id };
}

export async function mcpUpdateTask(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; message: string; notFound?: boolean }> {
  const parsed = mcpUpdateTaskSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { task_id: taskId, idempotency_key: _ik, assignee_person_ids, ...rest } = parsed.data;
  void _ik;

  const { data: existing, error: exErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();
  if (exErr) return { ok: false, message: exErr.message };
  if (!existing) return { ok: false, message: "Tarefa não encontrada.", notFound: true };

  const patch: TaskUpdate = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.area_id !== undefined) patch.area_id = rest.area_id;
  applyClearable(patch, "description", rest.description);
  applyClearable(patch, "parent_task_id", rest.parent_task_id);
  applyClearable(patch, "start_date", rest.start_date);
  applyClearable(patch, "due_date", rest.due_date);
  applyClearable(patch, "tags", rest.tags);
  applyClearable(patch, "quick_win_id", rest.quick_win_id);
  applyClearable(patch, "sla_incident_id", rest.sla_incident_id);

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) return { ok: false, message: error.message };
  }

  if (assignee_person_ids !== undefined) {
    const ids = assignee_person_ids === null ? [] : assignee_person_ids;
    const syncErr = await syncAssignees(supabase, taskId, ids);
    if (syncErr) return { ok: false, message: syncErr };
  }

  return { ok: true, id: taskId };
}

const statusArgs = z.object({
  task_id: z.string().uuid(),
  status: taskStatusEnum,
  idempotency_key: z.string().min(8).max(200).optional(),
});

export async function mcpChangeTaskStatus(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; message: string; notFound?: boolean }> {
  const parsed = statusArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.task_id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!updated) return { ok: false, message: "Tarefa não encontrada.", notFound: true };
  return { ok: true, id: parsed.data.task_id };
}

const commentArgs = z.object({
  task_id: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export async function mcpAddTaskComment(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
  userId: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string; notFound?: boolean }> {
  const parsed = commentArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  void parsed.data.idempotency_key;
  const { data: row, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: parsed.data.task_id,
      body: parsed.data.body,
      author_profile_id: userId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501" || error.message.includes("violates row-level security")) {
      return { ok: false, message: "Sem acesso à tarefa.", notFound: true };
    }
    return { ok: false, message: error.message };
  }
  if (!row) return { ok: false, message: "Falha ao comentar." };
  return { ok: true, id: row.id };
}
