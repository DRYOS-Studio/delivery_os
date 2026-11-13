"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { upsertOperationN8nWebhookAction } from "@/lib/actions/client-n8n-webhook";

type OperationRow = { id: string; name: string };

type Props = {
  clientId: string;
  isAdmin: boolean;
  operations: OperationRow[];
  webhookByOperationId: Record<string, string | null>;
};

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm text-ink disabled:opacity-50";

export function ClientN8nWebhooksPanel({
  clientId,
  isAdmin,
  operations,
  webhookByOperationId,
}: Props): React.JSX.Element | null {
  if (operations.length === 0) return null;

  return (
    <section className="mb-9 border border-line rounded-lg p-4 bg-card">
      <h2 className="font-display text-lg text-ink font-semibold mb-1">
        Webhooks n8n (notificações)
      </h2>
      <p className="text-sm text-mute mb-4">
        Um endpoint por Operação. O sistema lê da stack técnica (categoria{" "}
        <span className="font-mono text-xs">n8n_webhook</span>) e mantém a coluna
        legada em sincronia até a limpeza do schema.
      </p>
      <ul className="space-y-4">
        {operations.map((op) => (
          <N8nWebhookRow
            key={op.id}
            clientId={clientId}
            operation={op}
            initialUrl={webhookByOperationId[op.id] ?? ""}
            isAdmin={isAdmin}
          />
        ))}
      </ul>
    </section>
  );
}

function N8nWebhookRow({
  clientId,
  operation,
  initialUrl,
  isAdmin,
}: {
  clientId: string;
  operation: OperationRow;
  initialUrl: string;
  isAdmin: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("url", url);
    const result = await upsertOperationN8nWebhookAction(
      clientId,
      operation.id,
      fd,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium text-ink mb-2">{operation.name}</p>
      {isAdmin ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n…/webhook/…"
            disabled={saving}
            className={inputCn}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-mute font-mono break-all">
          {initialUrl.length > 0 ? initialUrl : "— não configurado —"}
        </p>
      )}
      {error ? <p className="text-sm text-critical mt-1">{error}</p> : null}
    </li>
  );
}
