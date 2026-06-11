import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];

export type TaskAssignee = { id: string; name: string };
/** Área da tarefa (FK areas) embedada pra exibição. null = tarefa de entrega. */
export type TaskAreaRef = { id: string; name: string };

export type TaskRow = {
  id: string;
  frenteId: string | null;
  operationId: string;
  areaId: string | null;
  area: TaskAreaRef | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignees: TaskAssignee[];
  parentTaskId: string | null;
  startDate: string | null;
  dueDate: string | null;
  tags: string[] | null;
  quickWinId: string | null;
  slaIncidentId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type AssigneeJoin = { person: TaskAssignee | TaskAssignee[] | null };

type TaskJoinedRow = {
  id: string;
  frente_id: string | null;
  operation_id: string;
  area_id: string | null;
  area: TaskAreaRef | TaskAreaRef[] | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  parent_task_id: string | null;
  start_date: string | null;
  due_date: string | null;
  tags: string[] | null;
  quick_win_id: string | null;
  sla_incident_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assignees: AssigneeJoin[] | null;
};

function mapAssignees(rows: AssigneeJoin[] | null): TaskAssignee[] {
  if (!rows) return [];
  return rows
    .map((r) => (Array.isArray(r.person) ? (r.person[0] ?? null) : r.person))
    .filter((p): p is TaskAssignee => p != null);
}

function mapRow(row: TaskJoinedRow): TaskRow {
  return {
    id: row.id,
    frenteId: row.frente_id,
    operationId: row.operation_id,
    areaId: row.area_id,
    area: pickOne(row.area),
    title: row.title,
    description: row.description,
    status: row.status,
    assignees: mapAssignees(row.assignees),
    parentTaskId: row.parent_task_id,
    startDate: row.start_date,
    dueDate: row.due_date,
    tags: row.tags,
    quickWinId: row.quick_win_id,
    slaIncidentId: row.sla_incident_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

const TASK_SELECT = `
  id, frente_id, operation_id, area_id, title, description, status, parent_task_id,
  start_date, due_date, tags,
  quick_win_id, sla_incident_id,
  created_at, updated_at, completed_at,
  area:areas!fk_tasks_area_id ( id, name ),
  assignees:task_assignees ( person:persons!fk_task_assignees_person_id (id, name) )
`;

export async function listTasksByFrente(frenteId: string): Promise<TaskRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("frente_id", frenteId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listTasksByFrente: ${error.message}`);
  if (!data) return [];
  const rows = data as unknown as TaskJoinedRow[];
  return rows
    .map(mapRow)
    .sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      return aDone - bDone;
    });
}

/**
 * Tarefas top-level (parent_task_id NULL) de uma Frente, candidatas a pai.
 * Exclui a própria task (em edição) pra não oferecer self-parent.
 */
export async function listEligibleParents(
  frenteId: string,
  excludeTaskId?: string,
): Promise<Array<{ id: string; title: string }>> {
  const supabase = await createServer();
  let query = supabase
    .from("tasks")
    .select("id, title")
    .eq("frente_id", frenteId)
    .is("parent_task_id", null)
    .order("created_at", { ascending: false });
  if (excludeTaskId) query = query.neq("id", excludeTaskId);
  const { data, error } = await query;
  if (error) throw new Error(`listEligibleParents: ${error.message}`);
  return data ?? [];
}

export async function countSubtasks(parentId: string): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("parent_task_id", parentId);
  if (error) throw new Error(`countSubtasks: ${error.message}`);
  return count ?? 0;
}

/**
 * Tarefas de ÁREA de uma Operação (area IS NOT NULL). RLS já esconde as áreas
 * que o usuário não pode ver (can_see_area).
 */
export async function listAreaTasksByOperation(
  operationId: string,
): Promise<TaskRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("operation_id", operationId)
    .not("area_id", "is", null)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAreaTasksByOperation: ${error.message}`);
  if (!data) return [];
  return (data as unknown as TaskJoinedRow[])
    .map(mapRow)
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
}

/**
 * Count das tarefas de área de uma Operação — gate `showAreaTab` + badge da
 * op page sem buscar a lista inteira (#131). Mesmos filtros declarativos da
 * lista acima (RLS idêntica, sem pós-filtro JS): count e lista nunca divergem.
 */
export async function countAreaTasksByOperation(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .not("area_id", "is", null);
  if (error) throw new Error(`countAreaTasksByOperation: ${error.message}`);
  return count ?? 0;
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getTask: ${error.message}`);
  if (!data) return null;
  return mapRow(data as unknown as TaskJoinedRow);
}

export async function countOpenTasksByFrente(
  frenteId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("frente_id", frenteId)
    .in("status", ["todo", "doing", "blocked"]);
  if (error) throw new Error(`countOpenTasksByFrente: ${error.message}`);
  return count ?? 0;
}

export async function countAllOpenTasks(): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["todo", "doing", "blocked"]);
  if (error) throw new Error(`countAllOpenTasks: ${error.message}`);
  return count ?? 0;
}

// ── Tasks: visão agregada cross-Frente, filtrável por assignee ─────────────

const OPEN_STATUSES: TaskStatus[] = ["todo", "doing", "blocked"];

export type TaskListFilter = "open" | "done" | "all";

export type CrossFrenteTaskRow = TaskRow & {
  frenteName: string | null;
  operationName: string;
  clientName: string;
};

type ToOne<T> = T | T[] | null;

type CrossFrenteJoinedRow = TaskJoinedRow & {
  frente: ToOne<{ name: string }>;
  operation: ToOne<{
    id: string;
    name: string;
    client: ToOne<{ name: string }>;
  }>;
};

function pickOne<T>(v: ToOne<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * `inner` = true poda as tasks pras que têm a pessoa filtrada entre os
 * responsáveis (e o array `assignees` vem restrito a ela — aceitável, é o
 * filtro). false embeda todos os responsáveis pra exibição.
 */
function crossFrenteSelect(inner: boolean): string {
  const join = inner ? "task_assignees!inner" : "task_assignees";
  return `
    id, frente_id, operation_id, area_id, title, description, status, parent_task_id,
    start_date, due_date, tags,
    quick_win_id, sla_incident_id,
    created_at, updated_at, completed_at,
    area:areas!fk_tasks_area_id ( id, name ),
    assignees:${join} ( person:persons!fk_task_assignees_person_id (id, name) ),
    frente:frentes!fk_tasks_frente_id ( name ),
    operation:operations!fk_tasks_operation_id (
      id, name,
      client:clients!fk_operations_client_id (name)
    )
  `;
}

function mapCrossFrenteRow(row: CrossFrenteJoinedRow): CrossFrenteTaskRow {
  const frente = pickOne(row.frente);
  const operation = pickOne(row.operation);
  const client = pickOne(operation?.client ?? null);
  return {
    id: row.id,
    frenteId: row.frente_id,
    operationId: row.operation_id,
    areaId: row.area_id,
    area: pickOne(row.area),
    title: row.title,
    description: row.description,
    status: row.status,
    assignees: mapAssignees(row.assignees),
    parentTaskId: row.parent_task_id,
    startDate: row.start_date,
    dueDate: row.due_date,
    tags: row.tags,
    quickWinId: row.quick_win_id,
    slaIncidentId: row.sla_incident_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    frenteName: frente?.name ?? null,
    operationName: operation?.name ?? "—",
    clientName: client?.name ?? "—",
  };
}

/**
 * Lista tasks agregadas de todas as Frentes visíveis (RLS aplica o gating por
 * Operação). `assigneePersonId` undefined = todas; informado = só daquela pessoa.
 */
export async function listTasks(
  filter: TaskListFilter,
  assigneePersonId?: string,
): Promise<CrossFrenteTaskRow[]> {
  const supabase = await createServer();
  let query = supabase
    .from("tasks")
    .select(crossFrenteSelect(Boolean(assigneePersonId)));

  if (assigneePersonId)
    query = query.eq("assignees.person_id", assigneePersonId);
  if (filter === "open") query = query.in("status", OPEN_STATUSES);
  else if (filter === "done") query = query.eq("status", "done");

  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listTasks: ${error.message}`);
  if (!data) return [];

  return (data as unknown as CrossFrenteJoinedRow[])
    .map(mapCrossFrenteRow)
    .sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      return aDone - bDone;
    });
}

export async function countTasks(
  assigneePersonId?: string,
): Promise<{ open: number; done: number; all: number }> {
  const supabase = await createServer();
  const base = () => {
    if (assigneePersonId) {
      return supabase
        .from("tasks")
        .select("id, task_assignees!inner(person_id)", {
          count: "exact",
          head: true,
        })
        .eq("task_assignees.person_id", assigneePersonId);
    }
    return supabase.from("tasks").select("id", { count: "exact", head: true });
  };
  const [openRes, doneRes, allRes] = await Promise.all([
    base().in("status", OPEN_STATUSES),
    base().eq("status", "done"),
    base(),
  ]);
  const firstErr = openRes.error ?? doneRes.error ?? allRes.error;
  if (firstErr) throw new Error(`countTasks: ${firstErr.message}`);
  return {
    open: openRes.count ?? 0,
    done: doneRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}

export async function countMyOpenTasks(personId: string): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id, task_assignees!inner(person_id)", {
      count: "exact",
      head: true,
    })
    .eq("task_assignees.person_id", personId)
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(`countMyOpenTasks: ${error.message}`);
  return count ?? 0;
}
