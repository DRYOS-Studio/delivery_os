import type { TaskScopeFilterOptions } from "@/lib/db/queries/task-scope-filters";
import { isUuid } from "@/lib/utils/uuid";

export type TaskListScope = {
  clientId?: string;
  operationId?: string;
  frenteId?: string;
};

export type RawTaskListScopeSearchParams = {
  client_id?: string | string[] | undefined;
  operation_id?: string | string[] | undefined;
  frente_id?: string | string[] | undefined;
};

function parseUuidSearchParam(
  v: string | string[] | undefined,
): string | undefined {
  if (v === undefined) return undefined;
  const parts = Array.isArray(v) ? v : [v];
  for (const p of parts) {
    const t = p.trim();
    if (t && isUuid(t)) return t;
  }
  return undefined;
}

export function parseTaskListScopeParams(
  raw: RawTaskListScopeSearchParams,
): TaskListScope {
  const scope: TaskListScope = {};
  const c = parseUuidSearchParam(raw.client_id);
  const o = parseUuidSearchParam(raw.operation_id);
  const f = parseUuidSearchParam(raw.frente_id);
  if (c) scope.clientId = c;
  if (o) scope.operationId = o;
  if (f) scope.frenteId = f;
  return scope;
}

/**
 * Corrige combinações inválidas (cascata + ids fora do conjunto visível ao usuário).
 */
export function resolveTaskListScope(
  scope: TaskListScope,
  options: TaskScopeFilterOptions,
): TaskListScope {
  const opById = new Map(options.operations.map((o) => [o.id, o]));
  const frenteById = new Map(options.frentes.map((f) => [f.id, f]));
  const clientIds = new Set(options.clients.map((c) => c.id));

  let clientId = scope.clientId;
  let operationId = scope.operationId;
  let frenteId = scope.frenteId;

  if (frenteId) {
    const frente = frenteById.get(frenteId);
    if (!frente) {
      frenteId = undefined;
    } else {
      operationId = frente.operationId;
      const op = opById.get(frente.operationId);
      if (!op) frenteId = undefined;
      else clientId = op.clientId;
    }
  }

  if (operationId) {
    const op = opById.get(operationId);
    if (!op) {
      operationId = undefined;
      frenteId = undefined;
    } else if (clientId && op.clientId !== clientId) {
      operationId = undefined;
      frenteId = undefined;
    } else {
      clientId = op.clientId;
    }
  }

  if (clientId && !clientIds.has(clientId)) {
    clientId = undefined;
    operationId = undefined;
    frenteId = undefined;
  }

  if (frenteId && operationId) {
    const frente = frenteById.get(frenteId);
    if (!frente || frente.operationId !== operationId) frenteId = undefined;
  }

  const resolved: TaskListScope = {};
  if (clientId) resolved.clientId = clientId;
  if (operationId) resolved.operationId = operationId;
  if (frenteId) resolved.frenteId = frenteId;
  return resolved;
}

export function hasTaskListScope(scope: TaskListScope): boolean {
  return Boolean(scope.clientId || scope.operationId || scope.frenteId);
}