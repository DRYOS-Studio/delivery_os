import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import { isOpenStatus, OPEN_STATUSES, type TaskStatus } from "@/lib/db/queries/tasks";

const TASK_SELECT = `
  id,
  title,
  status,
  due_date,
  operation_id,
  frente_id,
  area_id,
  operation:operations!fk_tasks_operation_id!inner (
    id,
    name,
    client_id,
    archived_at
  ),
  frente:frentes ( id, name ),
  area:areas ( id, name ),
  assignees:task_assignees ( person:persons!fk_task_assignees_person_id (id, name) )
`;

type AssigneeJoin = { person: { id: string; name: string } | { id: string; name: string }[] | null };

type HubTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  operation_id: string;
  frente_id: string | null;
  area_id: string | null;
  operation:
    | {
        id: string;
        name: string;
        client_id: string;
        archived_at: string | null;
      }
    | null;
  frente: { id: string; name: string } | { id: string; name: string }[] | null;
  area: { id: string; name: string } | { id: string; name: string }[] | null;
  assignees: AssigneeJoin[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function mapAssignees(rows: AssigneeJoin[] | null): string[] {
  if (!rows) return [];
  return rows
    .map((r) => pickOne(r.person)?.name)
    .filter((n): n is string => Boolean(n && n.trim()));
}

export type ClientHubTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  operationId: string;
  operationName: string;
  frenteId: string | null;
  frenteName: string | null;
  areaId: string | null;
  areaName: string | null;
  assigneeNames: string[];
  kind: "entrega" | "area";
};

export async function listOpenTasksForClient(
  clientId: string,
): Promise<ClientHubTask[]> {
  const supabase = await createServer();

  const { data: opRows, error: opErr } = await supabase
    .from("operations")
    .select("id")
    .eq("client_id", clientId)
    .is("archived_at", null);
  if (opErr) {
    throw new Error(`listOpenTasksForClient.operations: ${opErr.message}`);
  }
  const opIds = (opRows ?? []).map((r) => r.id);
  if (opIds.length === 0) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .in("status", OPEN_STATUSES)
    .in("operation_id", opIds)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`listOpenTasksForClient: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as HubTaskRow[];

  return rows
    .map((row): ClientHubTask | null => {
      const op = row.operation;
      if (!op) return null;
      const frente = pickOne(row.frente);
      const area = pickOne(row.area);
      const kind: "entrega" | "area" = row.area_id ? "area" : "entrega";
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        dueDate: row.due_date,
        operationId: op.id,
        operationName: op.name,
        frenteId: row.frente_id,
        frenteName: frente?.name ?? null,
        areaId: row.area_id,
        areaName: area?.name ?? null,
        assigneeNames: mapAssignees(row.assignees),
        kind,
      };
    })
    .filter((t): t is ClientHubTask => t !== null && isOpenStatus(t.status));
}
