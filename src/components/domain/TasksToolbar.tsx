"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TaskScopeFilterOptions } from "@/lib/db/queries/task-scope-filters";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import type { TaskListFilter } from "@/lib/db/queries/tasks";
import {
  hasTaskListScope,
  type TaskListScope,
} from "@/lib/tasks/task-list-scope";
import { cn } from "@/lib/utils/cn";

const BASE_PATH = "/tasks";

const TABS: Array<{ key: TaskListFilter; label: string }> = [
  { key: "open", label: "Abertas" },
  { key: "done", label: "Concluídas" },
  { key: "all", label: "Todas" },
];

type Props = {
  filter: TaskListFilter;
  counts: { open: number; done: number; all: number };
  persons: InternalPersonItem[];
  /** "all" ou um personId — qual opção está selecionada no dropdown */
  selectedAssignee: string;
  /** Pessoa do usuário logado, pra canonicalizar a URL (default = sem param) */
  myPersonId: string | null;
  scope: TaskListScope;
  scopeOptions: TaskScopeFilterOptions;
};

const EMPTY = "";

export function TasksToolbar({
  filter,
  counts,
  persons,
  selectedAssignee,
  myPersonId,
  scope,
  scopeOptions,
}: Props): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientOptions = scopeOptions.clients;
  const operationOptions = useMemo(() => {
    if (!scope.clientId) return scopeOptions.operations;
    return scopeOptions.operations.filter(
      (o) => o.clientId === scope.clientId,
    );
  }, [scope.clientId, scopeOptions.operations]);

  const frenteOptions = useMemo(() => {
    if (scope.operationId) {
      return scopeOptions.frentes.filter(
        (f) => f.operationId === scope.operationId,
      );
    }
    if (scope.clientId) {
      const opIds = new Set(
        scopeOptions.operations
          .filter((o) => o.clientId === scope.clientId)
          .map((o) => o.id),
      );
      return scopeOptions.frentes.filter((f) => opIds.has(f.operationId));
    }
    return scopeOptions.frentes;
  }, [
    scope.clientId,
    scope.operationId,
    scopeOptions.frentes,
    scopeOptions.operations,
  ]);

  function pushWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  function goToTab(key: TaskListFilter) {
    pushWith((params) => {
      if (key === "open") params.delete("filter");
      else params.set("filter", key);
    });
  }

  function changeAssignee(value: string) {
    pushWith((params) => {
      if (value === myPersonId) params.delete("assignee");
      else params.set("assignee", value);
    });
  }

  function setScope(next: TaskListScope) {
    pushWith((params) => {
      if (next.clientId) params.set("client_id", next.clientId);
      else params.delete("client_id");
      if (next.operationId) params.set("operation_id", next.operationId);
      else params.delete("operation_id");
      if (next.frenteId) params.set("frente_id", next.frenteId);
      else params.delete("frente_id");
    });
  }

  function changeClient(clientId: string) {
    const next: TaskListScope = {};
    if (clientId) next.clientId = clientId;
    setScope(next);
  }

  function changeOperation(operationId: string) {
    if (!operationId) {
      setScope(scope.clientId ? { clientId: scope.clientId } : {});
      return;
    }
    const op = scopeOptions.operations.find((o) => o.id === operationId);
    if (!op) return;
    setScope({
      clientId: op.clientId,
      operationId: op.id,
    });
  }

  function changeFrente(frenteId: string) {
    if (!frenteId) {
      const next: TaskListScope = {};
      if (scope.clientId) next.clientId = scope.clientId;
      if (scope.operationId) next.operationId = scope.operationId;
      setScope(next);
      return;
    }
    const frente = scopeOptions.frentes.find((f) => f.id === frenteId);
    if (!frente) return;
    const op = scopeOptions.operations.find((o) => o.id === frente.operationId);
    if (!op) return;
    setScope({
      clientId: op.clientId,
      operationId: op.id,
      frenteId: frente.id,
    });
  }

  function clearScopeFilters() {
    pushWith((params) => {
      params.delete("client_id");
      params.delete("operation_id");
      params.delete("frente_id");
    });
  }

  const selectClass =
    "bg-card border border-line rounded px-2 py-1.5 text-sm font-body normal-case tracking-normal text-ink-soft focus:outline-none focus:border-line-strong max-w-[14rem] truncate";

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const isActive = tab.key === filter;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => goToTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-mono uppercase tracking-wide transition-colors",
                  isActive
                    ? "bg-ink text-bg"
                    : "bg-surface text-mute hover:text-ink",
                )}
              >
                {tab.label}
                <span className="text-[10px] opacity-70">{counts[tab.key]}</span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-mute">
          Responsável
          <select
            value={selectedAssignee}
            onChange={(e) => changeAssignee(e.target.value)}
            className={selectClass}
          >
            <option value="all">Todos</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wide text-mute">
          Cliente
          <select
            value={scope.clientId ?? EMPTY}
            onChange={(e) => changeClient(e.target.value)}
            className={selectClass}
          >
            <option value={EMPTY}>Todos</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wide text-mute">
          Operação
          <select
            value={scope.operationId ?? EMPTY}
            onChange={(e) => changeOperation(e.target.value)}
            className={selectClass}
            disabled={clientOptions.length > 0 && operationOptions.length === 0}
          >
            <option value={EMPTY}>Todas</option>
            {operationOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wide text-mute">
          Frente
          <select
            value={scope.frenteId ?? EMPTY}
            onChange={(e) => changeFrente(e.target.value)}
            className={selectClass}
            disabled={frenteOptions.length === 0}
          >
            <option value={EMPTY}>Todas</option>
            {frenteOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        {hasTaskListScope(scope) ? (
          <button
            type="button"
            onClick={clearScopeFilters}
            className="text-xs font-mono uppercase tracking-wide text-mute hover:text-ink px-2 py-1.5"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}