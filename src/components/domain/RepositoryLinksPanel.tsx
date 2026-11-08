"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { RepositoryLinksList } from "@/components/domain/RepositoryLinksList";
import { Button } from "@/components/ui/Button";
import {
  createClientRepositoryLinkAction,
  createFrenteRepositoryLinkAction,
  createOperationRepositoryLinkAction,
  deleteRepositoryLinkAction,
} from "@/lib/actions/repository-links";
import type { RepositoryLinkRow } from "@/lib/db/queries/repository-links";
import { repositoryLinkScope } from "@/lib/utils/repository-link-scope";

type Scope =
  | { kind: "client"; clientId: string }
  | { kind: "operation"; clientId: string; operationId: string }
  | { kind: "frente"; clientId: string; operationId: string; frenteId: string };

type Props = {
  title?: string | undefined;
  hint?: string | undefined;
  scope: Scope;
  /** Links já filtrados para exibição (pode incluir herdados). */
  displayLinks: RepositoryLinkRow[];
  /** Links editáveis neste painel (só o escopo local). */
  manageableLinks: RepositoryLinkRow[];
  canManageLocal: boolean;
};

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm text-ink disabled:opacity-50";

export function RepositoryLinksPanel({
  title = "Repositórios Git",
  hint,
  scope,
  displayLinks,
  manageableLinks,
  canManageLocal,
}: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(formData: FormData) {
    setError(null);
    setBusy(true);
    const res =
      scope.kind === "client"
        ? await createClientRepositoryLinkAction(scope.clientId, formData)
        : scope.kind === "operation"
          ? await createOperationRepositoryLinkAction(
              scope.clientId,
              scope.operationId,
              formData,
            )
          : await createFrenteRepositoryLinkAction(
              scope.clientId,
              scope.operationId,
              scope.frenteId,
              formData,
            );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  async function onDelete(link: RepositoryLinkRow) {
    const linkScope = repositoryLinkScope(link);
    const localOnly =
      (scope.kind === "client" && linkScope === "client") ||
      (scope.kind === "operation" && linkScope === "operation") ||
      (scope.kind === "frente" && linkScope === "frente");
    if (!localOnly) return;
    if (!globalThis.confirm(`Remover o repositório "${link.label}"?`)) return;
    setBusy(true);
    const res = await deleteRepositoryLinkAction(link.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Fragment>
      <h3 className="font-mono text-[10px] uppercase tracking-wide text-mute mb-2">
        {title}
      </h3>
      {hint && <p className="text-xs text-mute mb-3">{hint}</p>}
      {error && (
        <p className="text-sm text-critical mb-2" role="alert">
          {error}
        </p>
      )}
      <RepositoryLinksList
        links={displayLinks}
        emptyMessage="Nenhum repositório cadastrado neste contexto."
      />
      {canManageLocal && (
        <div className="mt-4 border border-line rounded p-3 bg-card">
          <p className="text-xs text-mute mb-2">
            Adicionar neste escopo (
            {scope.kind === "client"
              ? "Cliente"
              : scope.kind === "operation"
                ? "Operação"
                : "Frente"}
            )
          </p>
          <form ref={formRef} action={onCreate} className="grid gap-2 max-w-xl">
            <input
              name="label"
              required
              placeholder="Nome / finalidade (ex: App principal)"
              className={inputCn}
              disabled={busy}
            />
            <input
              name="url"
              required
              type="url"
              placeholder="https://github.com/org/repo"
              className={inputCn}
              disabled={busy}
            />
            <input
              name="notes"
              placeholder="Notas (opcional)"
              className={inputCn}
              disabled={busy}
            />
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              Adicionar repositório
            </Button>
          </form>
          {manageableLinks.length > 0 && (
            <ul className="mt-3 space-y-1">
              {manageableLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-soft truncate">{link.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onDelete(link)}
                    className="text-critical"
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Fragment>
  );
}
