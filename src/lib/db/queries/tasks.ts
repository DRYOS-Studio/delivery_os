import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];

/**
 * Fonte única de "tarefa aberta". `Record<TaskStatus, boolean>` é exaustivo:
 * adicionar um valor a `task_status` quebra o build aqui até alguém
 * classificar o status como aberto ou não. Fail-closed por construção — não
 * existe "default" implícito.
 */
const TASK_STATUS_OPEN: Record<TaskStatus, boolean> = {
  todo: true,
  doing: true,
  blocked: true,
  done: false,
};

/** Statuses considerados abertos, derivados do mapa — usado nos filtros `.in()`. */
export const OPEN_STATUSES = (
  Object.keys(TASK_STATUS_OPEN) as TaskStatus[]
).filter((s) => TASK_STATUS_OPEN[s]);

export function isOpenStatus(status: TaskStatus): boolean {
  return TASK_STATUS_OPEN[status];
}

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

/**
 * Subtarefas de uma tarefa-pai — mesmo padrão/ordenação de `listTasksByFrente`.
 * Alimenta a lista inline de subtarefas na tela de edição do pai (Story2 de
 * tasks-subtask-visibility) e substitui `countSubtasks` (só contava, não
 * listava) como fonte de `childCount`.
 */
export async function listSubtasksOf(parentTaskId: string): Promise<TaskRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("parent_task_id", parentTaskId)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listSubtasksOf: ${error.message}`);
  if (!data) return [];
  const rows = data as unknown as TaskJoinedRow[];
  return rows
    .map(mapRow)
    .sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
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

export async function countAllOpenTasks(): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(`countAllOpenTasks: ${error.message}`);
  return count ?? 0;
}

// ── Tasks: visão agregada cross-Frente, filtrável por assignee ─────────────

export type TaskListFilter = "open" | "done" | "all";

export type CrossFrenteTaskRow = TaskRow & {
  frenteName: string | null;
  operationName: string;
  clientName: string;
};

type ToOne<T> = T | T[] | null;

type AssigneeLink = { person_id: string };

type CrossFrenteJoinedRow = TaskJoinedRow & {
  assigneeLinks: AssigneeLink[] | null;
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
 * Embed de exibição sempre completo (sem `!inner`, sem filtro por pessoa) —
 * a filtragem por responsável não vive mais no embed, vive em `.or()` +
 * `filterInheritedRows` (ver `listTasks`/`countTasks`). `assigneeLinks` é
 * um alias SEPARADO da mesma relação `task_assignees`, só com `person_id`
 * (sem atravessar `persons`) — existe só pra alimentar o teste de
 * "subtarefa órfã de responsável" sem depender da RLS de `persons`, que
 * poderia esconder um responsável de um Membro não-admin e fazer uma
 * subtarefa DELEGADA parecer sem responsável. `withAssigneeLinks` omite
 * esse embed quando não há filtro de responsável ("Todos") — ninguém lê o
 * campo nesse caminho (`filterInheritedRows` não roda, `mapCrossFrenteRow`
 * ignora), então pedir ao banco é payload sem uso.
 */
function crossFrenteSelect(withAssigneeLinks: boolean): string {
  return `
    id, frente_id, operation_id, area_id, title, description, status, parent_task_id,
    start_date, due_date, tags,
    quick_win_id, sla_incident_id,
    created_at, updated_at, completed_at,
    area:areas!fk_tasks_area_id ( id, name ),
    assignees:task_assignees ( person:persons!fk_task_assignees_person_id (id, name) ),
    ${withAssigneeLinks ? "assigneeLinks:task_assignees ( person_id )," : ""}
    frente:frentes!fk_tasks_frente_id ( name ),
    operation:operations!fk_tasks_operation_id!inner (
      id, name, archived_at,
      client:clients!fk_operations_client_id (name)
    )
  `;
}

/**
 * Ids de todas as tasks (qualquer status) atribuídas a `personId` — sem
 * filtro de status: a herança de visibilidade (ver `filterInheritedRows`)
 * não pode depender do status da tarefa-pai, só do status da própria linha
 * decide em qual aba ela cai.
 */
async function resolveAssignedTaskIds(
  supabase: Awaited<ReturnType<typeof createServer>>,
  personId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("person_id", personId);
  if (error) throw new Error(`resolveAssignedTaskIds: ${error.message}`);
  return (data ?? []).map((r) => r.task_id);
}

/**
 * Sob filtro de responsável P, uma linha entra se ELA MESMA está em
 * `assignedIds` (match direto) OU se o PAI está em `assignedIds` e ela não
 * tem NENHUM responsável próprio (herda visibilidade — subtarefa delegada a
 * outra pessoa não herda, só a órfã). `assigneeLinks` nunca atravessa
 * `persons`, então esse teste independe de RLS de `persons`. Fail-closed:
 * chave ausente/malformada conta como "tem responsável" (exclui), nunca
 * como "órfã" (vazaria).
 */
function filterInheritedRows<
  T extends {
    id: string;
    parent_task_id: string | null;
    assigneeLinks: AssigneeLink[] | null | undefined;
  },
>(rows: T[], assignedIds: Set<string>): T[] {
  return rows.filter(
    (r) =>
      assignedIds.has(r.id) ||
      (r.parent_task_id !== null &&
        assignedIds.has(r.parent_task_id) &&
        Array.isArray(r.assigneeLinks) &&
        r.assigneeLinks.length === 0),
  );
}

/**
 * Ids-de-P + o `.or()` de herança prontos — única fonte pra `listTasks` e
 * `countTasks` (achado do `/code-review`: a string `.or()` estava duplicada
 * nas duas, risco de divergirem numa correção futura). `ids` vazio sinaliza
 * pro caller fazer o early-return do seu próprio shape (`listTasks` → `[]`,
 * `countTasks` → `{open:0,done:0,all:0}`) em vez de rodar `.or()` com lista
 * vazia (sintaxe inválida no PostgREST).
 */
async function resolveInheritanceFilter(
  supabase: Awaited<ReturnType<typeof createServer>>,
  assigneePersonId: string,
): Promise<{ ids: string[]; orFilter: string }> {
  const ids = await resolveAssignedTaskIds(supabase, assigneePersonId);
  if (ids.length === 0) return { ids, orFilter: "" };
  return {
    ids,
    orFilter: `id.in.(${ids.join(",")}),parent_task_id.in.(${ids.join(",")})`,
  };
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
/**
 * Teto de linhas do `/tasks`. A página compara `tasks.length` com o total de
 * `countTasks` pra sinalizar truncamento — não há paginação por página ainda.
 */
export const TASKS_PAGE_LIMIT = 200;

export async function listTasks(
  filter: TaskListFilter,
  assigneePersonId?: string,
): Promise<CrossFrenteTaskRow[]> {
  const supabase = await createServer();
  let query = supabase
    .from("tasks")
    .select(crossFrenteSelect(Boolean(assigneePersonId)));

  // Tarefa de Operação arquivada some. Join via OPERAÇÃO, não via Frente:
  // `tasks.operation_id` é NOT NULL (20260610140001:16) e cobre os dois tipos de
  // tarefa, enquanto `frentes!inner` derrubaria toda tarefa de área (`frente_id`
  // nulo, Inv. 15) da tela, em silêncio.
  // O `!inner` no embed é obrigatório: sem ele o supabase-js descarta este filtro.
  query = query.is("operation.archived_at", null);

  // Herança de visibilidade: subtarefa sem responsável próprio aparece
  // quando a tarefa-pai bate o filtro de P, mesmo sem responsável dela
  // mesma (dryos-debug: /tasks perdia subtarefas nascidas sem responsável).
  // Sem `assigneePersonId` ("Todos"), nada disso roda — comportamento
  // preservado.
  let assignedIds: Set<string> | null = null;
  if (assigneePersonId) {
    const { ids, orFilter } = await resolveInheritanceFilter(supabase, assigneePersonId);
    if (ids.length === 0) return [];
    assignedIds = new Set(ids);
    query = query.or(orFilter);
  }

  if (filter === "open") query = query.in("status", OPEN_STATUSES);
  else if (filter === "done") query = query.eq("status", "done");

  // Ordenação toda no banco: com teto, reordenar em JS depois do fetch
  // reordenaria só a fatia trazida, não o conjunto.
  //
  // Em "todas", `completed_at` entra como chave primária com nulos primeiro —
  // o trigger `manage_task_completed_at` garante que ele é NULL exatamente
  // enquanto a tarefa não está `done`, então isso é "aberta antes de
  // concluída". Nas abas "open"/"done" todas as linhas têm a mesma
  // done-ness, então a chave seria inerte e fica de fora.
  if (filter === "all") {
    query = query.order("completed_at", { ascending: true, nullsFirst: true });
  }

  // `filterInheritedRows` roda DEPOIS do `.limit()`: pode descartar linha
  // dentro da janela de 200 (filha delegada que só matchou por
  // `parent_task_id.in`), então a fatia final pode ficar menor que o teto
  // mesmo havendo mais elegíveis logo depois do corte. Aceito pelo volume
  // do produto — não é o defeito que esta função existe pra resolver
  // (ver `.specs/features/tasks-subtask-visibility/design.md`, D2).
  const { data, error } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(TASKS_PAGE_LIMIT);
  if (error) throw new Error(`listTasks: ${error.message}`);
  if (!data) return [];

  const rows = data as unknown as CrossFrenteJoinedRow[];
  const filtered = assignedIds ? filterInheritedRows(rows, assignedIds) : rows;
  return filtered.map(mapCrossFrenteRow);
}

const COUNT_SELECT = `
  id, parent_task_id, status,
  assigneeLinks:task_assignees ( person_id ),
  operation:operations!fk_tasks_operation_id!inner ( archived_at )
`;

type CountJoinedRow = {
  id: string;
  parent_task_id: string | null;
  status: TaskStatus;
  assigneeLinks: AssigneeLink[] | null;
};

/**
 * "Todos" (sem `assigneePersonId`) não precisa de herança — mantém o
 * caminho original: 3 `count:'exact', head:true` em paralelo, sem
 * materializar linha nenhuma. Com responsável, precisa aplicar a MESMA
 * `resolveInheritanceFilter` + `filterInheritedRows` de `listTasks` (o
 * Postgres não sabe filtrar "subtarefa sem responsável" sozinho) — isso
 * exige buscar linhas de verdade (sem `head:true`), então esse branch fica
 * mais caro que o de "Todos", mas só ele. Achado do `/code-review`: uma v1
 * deste fix trocava os dois branches por um único fetch sem `head:true`,
 * varrendo toda task não-arquivada do sistema mesmo em "Todos" — regressão
 * de performance que este split evita. Sem teto no branch com responsável:
 * `truncated = counts[filter] > tasks.length` (`TasksList.tsx`) continua
 * comparando "total elegível" com "o que a página mostra".
 */
export async function countTasks(
  assigneePersonId?: string,
): Promise<{ open: number; done: number; all: number }> {
  const supabase = await createServer();

  if (!assigneePersonId) {
    const base = () =>
      supabase
        .from("tasks")
        .select(
          "id, operation:operations!fk_tasks_operation_id!inner(archived_at)",
          { count: "exact", head: true },
        )
        .is("operation.archived_at", null);
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

  const { ids, orFilter } = await resolveInheritanceFilter(supabase, assigneePersonId);
  if (ids.length === 0) return { open: 0, done: 0, all: 0 };
  const assignedIds = new Set(ids);

  const { data, error } = await supabase
    .from("tasks")
    .select(COUNT_SELECT)
    .is("operation.archived_at", null)
    .or(orFilter);
  if (error) throw new Error(`countTasks: ${error.message}`);
  if (!data) return { open: 0, done: 0, all: 0 };
  const filtered = filterInheritedRows(data as unknown as CountJoinedRow[], assignedIds);
  const open = filtered.filter((r) => isOpenStatus(r.status)).length;
  const done = filtered.filter((r) => r.status === "done").length;
  return { open, done, all: filtered.length };
}

export async function countMyOpenTasks(personId: string): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("tasks")
    .select(
      "id, task_assignees!inner(person_id), operation:operations!fk_tasks_operation_id!inner(archived_at)",
      { count: "exact", head: true },
    )
    .eq("task_assignees.person_id", personId)
    .is("operation.archived_at", null)
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(`countMyOpenTasks: ${error.message}`);
  return count ?? 0;
}
