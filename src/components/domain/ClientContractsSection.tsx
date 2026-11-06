"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClientContractAction, deleteClientContractAction } from "@/lib/actions/client-contracts";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await createClientContractAction(clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!globalThis.confirm("Remover este contrato e o arquivo?")) return;
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
    <section className="mb-9">
      <h2 className="font-display text-lg text-ink font-semibold mb-4">
        Contratos
      </h2>
      <p className="text-sm text-mute mb-4">
        Dados financeiros sensíveis — visível só para admin. Arquivo no Storage
        privado (`contracts`).
      </p>
      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}
      <div className="border border-line rounded p-4 bg-card mb-6">
        <h3 className="text-sm font-semibold text-ink mb-3">Novo contrato</h3>
        <form ref={formRef} action={onUpload} className="grid gap-3 max-w-xl">
          <div>
            <label htmlFor="cc_label" className="block text-xs text-mute mb-1">
              Nome / referência
            </label>
            <input
              id="cc_label"
              name="label"
              required
              className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc_mrr" className="block text-xs text-mute mb-1">
                Valor mensal (BRL)
              </label>
              <input
                id="cc_mrr"
                name="monthly_value"
                type="number"
                step="0.01"
                className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cc_pay" className="block text-xs text-mute mb-1">
                Dia pagamento (1–28)
              </label>
              <input
                id="cc_pay"
                name="payment_day_of_month"
                type="number"
                min={1}
                max={28}
                className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc_start" className="block text-xs text-mute mb-1">
                Início
              </label>
              <input
                id="cc_start"
                name="start_date"
                type="date"
                className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cc_end" className="block text-xs text-mute mb-1">
                Fim / vencimento
              </label>
              <input
                id="cc_end"
                name="end_date"
                type="date"
                className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cc_reaj" className="block text-xs text-mute mb-1">
              Reajustes (texto)
            </label>
            <textarea
              id="cc_reaj"
              name="reajuste_notes"
              rows={2}
              className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cc_status" className="block text-xs text-mute mb-1">
              Status
            </label>
            <select
              id="cc_status"
              name="status"
              className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
              defaultValue="rascunho"
            >
              <option value="rascunho">Rascunho</option>
              <option value="vigente">Vigente</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </div>
          <div>
            <label htmlFor="cc_notes" className="block text-xs text-mute mb-1">
              Observações
            </label>
            <textarea
              id="cc_notes"
              name="notes"
              rows={2}
              className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cc_file" className="block text-xs text-mute mb-1">
              Arquivo (PDF ou outro)
            </label>
            <input
              id="cc_file"
              name="file"
              type="file"
              required
              className="text-sm w-full"
            />
          </div>
          <Button type="submit" disabled={busy}>
            Enviar contrato
          </Button>
        </form>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-mute">Nenhum contrato cadastrado.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded bg-card">
          {contracts.map((c) => (
            <li key={c.id} className="px-4 py-3 flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{c.label}</p>
                <p className="text-xs text-mute mt-1">
                  {STATUS_LABEL[c.status]}
                  {c.monthlyValue !== null && c.monthlyValue !== undefined && (
                    <> · {formatMoneyBR(c.monthlyValue)} / mês</>
                  )}
                  {c.paymentDayOfMonth != null && (
                    <> · dia {c.paymentDayOfMonth}</>
                  )}
                </p>
                <p className="text-xs text-mute">
                  {formatDateBR(c.startDate)} → {formatDateBR(c.endDate)}
                </p>
                {c.reajusteNotes && (
                  <p className="text-sm text-ink-soft mt-2 whitespace-pre-wrap">
                    {c.reajusteNotes}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/api/client-contracts/${c.id}/download`}
                  className="text-sm text-oak hover:underline font-mono"
                >
                  Baixar {c.filename}
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
