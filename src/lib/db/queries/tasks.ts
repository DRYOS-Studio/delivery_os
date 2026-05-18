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
