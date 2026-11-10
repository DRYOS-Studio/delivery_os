"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { deleteClientAcquisitionCostAction } from "@/lib/actions/client-acquisition-costs";
import type { ClientAcquisitionCostRow } from "@/lib/db/queries/client-acquisition-costs";
import { Button } from "@/components/ui/Button";
import { RowDeleteButton } from "@/components/domain/RowDeleteButton";
import { RowEditLink } from "@/components/domain/RowEditLink";
import { clientCacCategoryLabel } from "@/lib/utils/client-cac-category";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  clientId: string;
  items: ClientAcquisitionCostRow[];
  totalCac: number;
};

export function ClientCacSection({
  clientId,
  items,
  totalCac,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: string) {
    setBusy(id);
    setError(null);
    const res = await deleteClientAcquisitionCostAction(clientId, id);
    setBusy(null);
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <section className="mb-9" data-testid="client-cac-section">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg text-ink font-semibold">CAC</h2>
          <p className="text-sm text-mute">
            Custo de aquisição do cliente (soma dos lançamentos abaixo).
          </p>
        </div>
        <Link href={`/clients/${clientId}/cac/new`}>
          <Button variant="sage" className="min-h-[44px]">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Adicionar custo
          </Button>
        </Link>
      </div>

      <p className="text-sm text-mute mb-4">
        Total CAC:{" "}
        <span className="font-mono text-ink font-semibold">
          {formatMoneyBR(totalCac)}
        </span>
      </p>

      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-mute">Nenhum custo de aquisição cadastrado.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded bg-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="px-4 py-3 flex flex-wrap justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{item.description}</p>
                <p className="text-xs text-mute mt-1">
                  {clientCacCategoryLabel(item.category)} ·{" "}
                  {formatDateBR(item.spentOn)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="font-mono text-sm text-ink">
                  {formatMoneyBR(item.amount)}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RowEditLink
                    href={`/clients/${clientId}/cac/${item.id}/edit`}
                    data-testid={`client-cac-edit-${item.id}`}
                  />
                  <RowDeleteButton
                    label={item.description}
                    busy={busy === item.id}
                    disabled={busy !== null && busy !== item.id}
                    confirmMessage="Excluir este custo de aquisição? O total de CAC será recalculado."
                    onClick={() => void onDelete(item.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
