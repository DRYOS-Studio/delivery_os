import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];

export type TaskRow = {
  id: string;
  frenteId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneePersonId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  tags: string[] | null;
  quickWinId: string | null;
  slaIncidentId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type TaskJoinedRow = {
  id: string;
  frente_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_person_id: string | null;
  due_date: string | null;
  tags: string[] | null;
  quick_win_id: string | null;
  sla_incident_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assignee: { id: string; name: string } | { id: string; name: string }[] | null;
};

function pickAssignee(
  a: TaskJoinedRow["assignee"],
): { id: string; name: string } | null {
  if (!a) return null;
  if (Array.isArray(a)) return a[0] ?? null;
  return a;
}

function mapRow(row: TaskJoinedRow): TaskRow {
  const assignee = pickAssignee(row.assignee);
  return {
    id: row.id,
    frenteId: row.frente_id,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneePersonId: row.assignee_person_id,
    assigneeName: assignee?.name ?? null,
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
  id, frente_id, title, description, status,
  assignee_person_id, due_date, tags,
  quick_win_id, sla_incident_id,
  created_at, updated_at, completed_at,
  assignee:persons!fk_tasks_assignee_person_id (id, name)
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

// ── Minhas Tasks: visão agregada por assignee (cross-Frente) ──────────────

const OPEN_STATUSES: TaskStatus[] = ["todo", "doing", "blocked"];

export type MyTaskFilter = "open" | "done" | "all";

export type MyTaskRow = TaskRow & {
  frenteName: string;
  operationId: string;
  operationName: string;
  clientName: string;
};

type ToOne<T> = T | T[] | null;

type MyTaskJoinedRow = Omit<TaskJoinedRow, "assignee"> & {
  frente: ToOne<{
    name: string;
    operation: ToOne<{
      id: string;
      name: string;
      client: ToOne<{ name: string }>;
    }>;
  }>;
};

function pickOne<T>(v: ToOne<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const MY_TASK_SELECT = `
  id, frente_id, title, description, status,
  assignee_person_id, due_date, tags,
  quick_win_id, sla_incident_id,
  created_at, updated_at, completed_at,
  frente:frentes!fk_tasks_frente_id (
    name,
    operation:operations!fk_frentes_operation_id (
      id, name,
      client:clients!fk_operations_client_id (name)
    )
  )
`;

function mapMyRow(row: MyTaskJoinedRow): MyTaskRow {
  const frente = pickOne(row.frente);
  const operation = pickOne(frente?.operation ?? null);
  const client = pickOne(operation?.client ?? null);
  return {
    id: row.id,
    frenteId: row.frente_id,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneePersonId: row.assignee_person_id,
    assigneeName: null,
    dueDate: row.due_date,
    tags: row.tags,
    quickWinId: row.quick_win_id,
    slaIncidentId: row.sla_incident_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    frenteName: frente?.name ?? "—",
    operationId: operation?.id ?? "",
    operationName: operation?.name ?? "—",
    clientName: client?.name ?? "—",
  };
}

export async function listMyTasks(
  personId: string,
  filter: MyTaskFilter,
): Promise<MyTaskRow[]> {
  const supabase = await createServer();
  let query = supabase
    .from("tasks")
    .select(MY_TASK_SELECT)
    .eq("assignee_person_id", personId);

  if (filter === "open") query = query.in("status", OPEN_STATUSES);
  else if (filter === "done") query = query.eq("status", "done");

  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMyTasks: ${error.message}`);
  if (!data) return [];

  return (data as unknown as MyTaskJoinedRow[])
    .map(mapMyRow)
    .sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      return aDone - bDone;
    });
}

export async function countMyOpenTasks(personId: string): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assignee_person_id", personId)
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(`countMyOpenTasks: ${error.message}`);
  return count ?? 0;
}

export async function countMyTasks(
  personId: string,
): Promise<{ open: number; done: number; all: number }> {
  const supabase = await createServer();
  const base = () =>
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_person_id", personId);
  const [openRes, doneRes, allRes] = await Promise.all([
    base().in("status", OPEN_STATUSES),
    base().eq("status", "done"),
    base(),
  ]);
  const firstErr = openRes.error ?? doneRes.error ?? allRes.error;
  if (firstErr) throw new Error(`countMyTasks: ${firstErr.message}`);
  return {
    open: openRes.count ?? 0,
    done: doneRes.count ?? 0,
    all: allRes.count ?? 0,
  };
}
