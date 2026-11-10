"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import {
  createOperationNtfyTopicAction,
  deleteOperationNtfyTopicAction,
} from "@/lib/actions/operation-ntfy-topics";
import type { OperationNtfyTopicRow } from "@/lib/db/queries/operation-ntfy-topics";

const ORIGIN_LABEL: Record<
  OperationNtfyTopicRow["default_problem_origin"],
  string
> = {
  dryos: "Dryos",
  client: "Cliente",
  vendor: "Fornecedor",
  unclassified: "A classificar",
};

type Props = {
  operationId: string;
  topics: OperationNtfyTopicRow[];
};

export function OperationNtfyTopicsPanel({
  operationId,
  topics,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await createOperationNtfyTopicAction(operationId, fd);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function onDelete(id: string, topic: string) {
    if (!window.confirm(`Remover mapeamento do tópico "${topic}"?`)) return;
    setPending(true);
    const res = await deleteOperationNtfyTopicAction(id, operationId);
    setPending(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-ink-soft mb-4">
          Cada tópico ntfy pertence a <strong>uma</strong> Operação. Alertas
          sem mapeamento entram na fila de triagem (não são descartados).
        </p>
        {topics.length === 0 ? (
          <p className="text-sm text-mute">Nenhum tópico cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border border-line rounded px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink truncate">{t.topic}</p>
                  <p className="text-xs text-mute">
                    {t.label ? `${t.label} · ` : ""}
                    Origem padrão: {ORIGIN_LABEL[t.default_problem_origin]} ·
                    Recovery: {(t.recovery_tags ?? []).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill variant="neutral">mapeado</Pill>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDelete(t.id, t.topic)}
                    className="text-xs text-critical hover:underline disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-base font-semibold text-ink mb-3">
          Adicionar tópico
        </h2>
        {error && (
          <p className="text-sm text-critical mb-3" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={onCreate} className="space-y-3 max-w-lg">
          <label className="block text-sm">
            <span className="text-mute text-xs uppercase tracking-wide font-mono">
              Tópico ntfy
            </span>
            <input
              name="topic"
              required
              disabled={pending}
              className="mt-1 w-full border border-line rounded px-3 py-2 text-sm bg-card"
              placeholder="ex: alerts-cliente-x"
            />
          </label>
          <label className="block text-sm">
            <span className="text-mute text-xs uppercase tracking-wide font-mono">
              Rótulo (opcional)
            </span>
            <input
              name="label"
              disabled={pending}
              className="mt-1 w-full border border-line rounded px-3 py-2 text-sm bg-card"
            />
          </label>
          <label className="block text-sm">
            <span className="text-mute text-xs uppercase tracking-wide font-mono">
              Tags de recovery (vírgula)
            </span>
            <input
              name="recovery_tags"
              disabled={pending}
              defaultValue="resolved, recovery"
              className="mt-1 w-full border border-line rounded px-3 py-2 text-sm bg-card"
            />
          </label>
          <label className="block text-sm">
            <span className="text-mute text-xs uppercase tracking-wide font-mono">
              Origem do problema (padrão)
            </span>
            <select
              name="default_problem_origin"
              defaultValue="unclassified"
              disabled={pending}
              className="mt-1 w-full border border-line rounded px-3 py-2 text-sm bg-card"
            >
              <option value="unclassified">A classificar</option>
              <option value="dryos">Dryos</option>
              <option value="client">Cliente</option>
              <option value="vendor">Fornecedor (fora SLA Dryos)</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded px-3 py-2 text-sm bg-sage text-bg font-medium disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar mapeamento"}
          </button>
        </form>
      </Card>
    </div>
  );
}
