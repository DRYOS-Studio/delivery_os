"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import {
  archiveClientCredentialAction,
  deleteClientCredentialAction,
  revealClientCredentialAction,
} from "@/lib/actions/client-credentials";
import type {
  ClientCredentialAuditRow,
  ClientCredentialListRow,
} from "@/lib/db/queries/client-credentials";
import { Button } from "@/components/ui/Button";
import { RowDeleteButton } from "@/components/domain/RowDeleteButton";
import { RowEditLink } from "@/components/domain/RowEditLink";
import { formatDateTimeBR } from "@/lib/utils/date";

type Props = {
  clientId: string;
  credentials: ClientCredentialListRow[];
  auditLogs: ClientCredentialAuditRow[];
};

function auditActionLabel(action: ClientCredentialAuditRow["action"]): string {
  switch (action) {
    case "create":
      return "Criação";
    case "update":
      return "Edição";
    case "archive":
      return "Arquivamento";
    case "delete":
      return "Exclusão";
    case "reveal":
      return "Revelação";
    case "copy":
      return "Cópia";
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function ClientVaultSection({
  clientId,
  credentials,
  auditLogs,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function onReveal(id: string) {
    setBusy(id);
    setError(null);
    const res = await revealClientCredentialAction(clientId, id, "reveal");
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRevealed((prev) => ({ ...prev, [id]: res.data.password }));
    router.refresh();
  }

  async function onCopy(id: string) {
    setBusy(id);
    setError(null);
    const res = await revealClientCredentialAction(clientId, id, "copy");
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      await navigator.clipboard.writeText(res.data.password);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
      return;
    }
    router.refresh();
  }

  async function onArchive(id: string) {
    setBusy(id);
    setError(null);
    const res = await archiveClientCredentialAction(clientId, id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  async function onDelete(id: string) {
    setBusy(id);
    setError(null);
    const res = await deleteClientCredentialAction(clientId, id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <section className="mb-9" data-testid="client-vault-section">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg text-ink font-semibold">Cofre</h2>
          <p className="text-sm text-mute">
            Senhas e segredos do cliente. A senha nunca aparece na listagem até você
            revelar ou copiar.
          </p>
        </div>
        <Link href={`/clients/${clientId}/cofre/new`}>
          <Button variant="sage" className="min-h-[44px]">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Nova credencial
          </Button>
        </Link>
      </div>

      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}

      {credentials.length === 0 ? (
        <p className="text-sm text-mute mb-8">Nenhuma credencial cadastrada.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded bg-card mb-8">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="px-4 py-3 flex flex-wrap justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-ink">{c.serviceName}</p>
                <p className="text-xs text-mute">
                  {c.loginUsername ? `Login: ${c.loginUsername}` : "Sem login"}
                  {c.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-oak hover:underline break-all"
                      >
                        {c.url}
                      </a>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-mute">
                  Atualizado {formatDateTimeBR(c.updatedAt)}
                  {c.updatedByLabel ? ` · ${c.updatedByLabel}` : ""}
                </p>
                {revealed[c.id] && (
                  <p className="text-sm font-mono text-ink bg-cream-paper border border-line rounded px-2 py-1 mt-2">
                    {revealed[c.id]}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[36px] text-sm"
                    disabled={busy !== null}
                    onClick={() => void onReveal(c.id)}
                  >
                    {revealed[c.id] ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                    )}
                    Revelar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[36px] text-sm"
                    disabled={busy !== null}
                    onClick={() => void onCopy(c.id)}
                  >
                    <Copy className="w-4 h-4" strokeWidth={1.75} />
                    Copiar senha
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RowEditLink
                    href={`/clients/${clientId}/cofre/${c.id}/edit`}
                    data-testid={`client-vault-edit-${c.id}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-sm text-mute"
                    disabled={busy === c.id}
                    onClick={() => void onArchive(c.id)}
                  >
                    Arquivar
                  </Button>
                  <RowDeleteButton
                    label={c.serviceName}
                    busy={busy === c.id}
                    disabled={busy !== null && busy !== c.id}
                    confirmMessage="Excluir esta credencial permanentemente?"
                    onClick={() => void onDelete(c.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-display text-base text-ink font-semibold mb-2">
        Auditoria
      </h3>
      {auditLogs.length === 0 ? (
        <p className="text-sm text-mute">Nenhum evento registrado.</p>
      ) : (
        <ul className="text-sm border border-line rounded divide-y divide-line bg-card">
          {auditLogs.map((e) => (
            <li key={e.id} className="px-3 py-2 flex flex-wrap gap-2 justify-between">
              <span>
                <span className="text-ink font-medium">
                  {auditActionLabel(e.action)}
                </span>
                {e.reason ? (
                  <span className="text-mute"> — {e.reason}</span>
                ) : null}
              </span>
              <span className="text-mute text-xs">
                {formatDateTimeBR(e.createdAt)}
                {e.actorLabel ? ` · ${e.actorLabel}` : ""}
                {e.actorMcp ? " · MCP" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
