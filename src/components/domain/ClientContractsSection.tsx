"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { deleteClientContractAction } from "@/lib/actions/client-contracts";
import type { ClientContractRow } from "@/lib/db/queries/client-contracts";
import { Button } from "@/components/ui/Button";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  clientId: string;
  contracts: ClientContractRow[];
};

const STATUS_LABEL: Record<ClientContractRow["status"], string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  encerrada: "Encerrada",
};

export function ClientContractsSection({ clientId, contracts }: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (
      !globalThis.confirm(
        "Remover este contrato e o arquivo? Cobranças vinculadas podem ser afetadas.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    const res = await deleteClientContractAction(id, clientId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-9" data-testid="client-contracts-section">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg text-ink font-semibold">Contratos</h2>
          <p className="text-sm text-mute">
            Dados financeiros sensíveis — visível só para admin.
          </p>
        </div>
        <Link href={`/clients/${clientId}/contratos/new`}>
          <Button variant="sage" className="min-h-[44px]">
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            Adicionar contrato
          </Button>
        </Link>
      </div>
      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}
      {contracts.length === 0 ? (
        <p className="text-sm text-mute">Nenhum contrato cadastrado.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded bg-card">
          {contracts.map((c) => (
            <li key={c.id} className="px-4 py-3 flex flex-wrap justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{c.label}</p>
                <p className="text-xs text-mute mt-1">
                  {STATUS_LABEL[c.status]}
                  {c.monthlyValue !== null && c.monthlyValue !== undefined && (
                    <> · {formatMoneyBR(c.monthlyValue)} / mês</>
                  )}
                  {c.paymentDayOfMonth != null && <> · dia {c.paymentDayOfMonth}</>}
                  {c.implementationFee != null && c.implementationFee > 0 && (
                    <> · impl. {formatMoneyBR(c.implementationFee)}</>
                  )}
                </p>
                <p className="text-xs text-mute">
                  {formatDateBR(c.startDate)} → {formatDateBR(c.endDate)}
                  {c.firstBillingDate && (
                    <> · 1ª cobr. {formatDateBR(c.firstBillingDate)}</>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {c.filename && c.storagePath && (
                  <Link
                    href={`/api/client-contracts/${c.id}/download`}
                    className="text-sm text-oak hover:underline font-mono"
                  >
                    Baixar {c.filename}
                  </Link>
                )}
                <Link
                  href={`/clients/${clientId}/contratos/${c.id}/edit`}
                  className="text-sm text-oak hover:underline"
                >
                  Editar
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-critical"
                  disabled={busy}
                  onClick={() => void onDelete(c.id)}
                >
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
