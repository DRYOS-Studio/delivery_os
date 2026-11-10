"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientContractRow } from "@/lib/db/queries/client-contracts";
import type { ClientChargeRow } from "@/lib/db/queries/client-charges";
import {
  generateClientChargesAction,
  markClientChargePaidAction,
} from "@/lib/actions/client-charges";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { clientChargeStatusLabel } from "@/lib/utils/client-charge-status";
import { summarizeClientCash } from "@/lib/utils/client-cash-summary";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  clientId: string;
  charges: ClientChargeRow[];
  contracts: ClientContractRow[];
  registeredMrr: number;
};

const TYPE_LABEL: Record<ClientChargeRow["chargeType"], string> = {
  mensalidade: "Mensalidade",
  implantacao: "Implantação",
  avulsa: "Avulsa",
};

function statusVariant(
  status: ClientChargeRow["effectiveStatus"],
): "sage" | "warning" | "critical" | "neutral" | "oak" {
  switch (status) {
    case "paga":
      return "sage";
    case "atrasada":
      return "critical";
    case "emitida":
      return "warning";
    case "cancelada":
      return "neutral";
    default:
      return "oak";
  }
}

export function ClientChargesSection({
  clientId,
  charges,
  contracts,
  registeredMrr,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = summarizeClientCash(charges);

  const vigenteContracts = contracts.filter((c) => c.status === "vigente");

  async function onGenerate(contractId: string) {
    setError(null);
    setBusy(`gen-${contractId}`);
    const res = await generateClientChargesAction(clientId, contractId, 12);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function onMarkPaid(chargeId: string, form: HTMLFormElement) {
    setError(null);
    setBusy(`pay-${chargeId}`);
    const res = await markClientChargePaidAction(
      clientId,
      chargeId,
      new FormData(form),
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-9" data-testid="client-charges-section">
      <h2 className="font-display text-lg text-ink font-semibold mb-4">
        Cobranças
      </h2>
      <p className="text-sm text-mute mb-4">
        Caixa previsto/recebido a partir dos contratos (sem gateway nesta fase).
      </p>
      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <span className="bg-card border border-line rounded p-4">
          <p className="font-mono text-[10px] uppercase text-mute">A receber no mês</p>
          <p className="font-display text-2xl font-semibold text-ink">
            {formatMoneyBR(summary.toReceiveThisMonth)}
          </p>
        </span>
        <span className="bg-card border border-line rounded p-4">
          <p className="font-mono text-[10px] uppercase text-mute">Recebido no mês</p>
          <p className="font-display text-2xl font-semibold text-ink">
            {formatMoneyBR(summary.receivedThisMonth)}
          </p>
        </span>
        <span className="bg-card border border-line rounded p-4">
          <p className="font-mono text-[10px] uppercase text-mute">Em atraso</p>
          <p className="font-display text-2xl font-semibold text-critical">
            {formatMoneyBR(summary.overdueTotal)}
          </p>
        </span>
      </div>

      <p className="text-xs text-mute mb-4">
        MRR cadastrado nas operações ativas:{" "}
        <span className="font-mono text-ink">{formatMoneyBR(registeredMrr)}</span>
      </p>

      {vigenteContracts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {vigenteContracts.map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              disabled={busy !== null}
              onClick={() => onGenerate(c.id)}
            >
              {busy === `gen-${c.id}` ? "Gerando…" : `Gerar previstas · ${c.label}`}
            </Button>
          ))}
        </div>
      )}

      {charges.length === 0 ? (
        <p className="text-sm text-mute">Nenhuma cobrança registrada.</p>
      ) : (
        <div className="border border-line rounded bg-card overflow-hidden">
          <ul className="divide-y divide-line">
            {charges.map((c) => (
              <li key={c.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {TYPE_LABEL[c.chargeType]} · {formatMoneyBR(c.amount)}
                    </p>
                    <p className="font-mono text-[10px] text-mute">
                      Venc. {formatDateBR(c.dueDate)} · competência{" "}
                      {formatDateBR(c.competence)}
                    </p>
                  </div>
                  <Pill variant={statusVariant(c.effectiveStatus)}>
                    {clientChargeStatusLabel(c.effectiveStatus)}
                  </Pill>
                </div>
                {c.effectiveStatus !== "paga" &&
                  c.effectiveStatus !== "cancelada" && (
                    <form
                      className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onMarkPaid(c.id, e.currentTarget);
                      }}
                    >
                      <label className="text-xs text-mute">
                        Data pagamento
                        <input
                          type="date"
                          name="paid_at"
                          required
                          defaultValue={new Date().toISOString().slice(0, 10)}
                          className="mt-1 w-full rounded border border-line bg-cream-paper px-2 py-1.5 text-sm block"
                        />
                      </label>
                      <label className="text-xs text-mute">
                        Valor pago (R$)
                        <input
                          name="paid_amount"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={c.openAmount}
                          className="mt-1 w-full rounded border border-line bg-cream-paper px-2 py-1.5 text-sm block"
                        />
                      </label>
                      <label className="text-xs text-mute">
                        Forma
                        <input
                          name="payment_method"
                          placeholder="Pix, boleto…"
                          className="mt-1 w-full rounded border border-line bg-cream-paper px-2 py-1.5 text-sm block"
                        />
                      </label>
                      <Button
                        type="submit"
                        variant="sage"
                        disabled={busy !== null}
                        className="min-h-[44px]"
                      >
                        {busy === `pay-${c.id}` ? "Salvando…" : "Marcar paga"}
                      </Button>
                    </form>
                  )}
                {c.paidAmount !== null && c.paidAmount > 0 && (
                  <p className="text-xs text-mute">
                    Pago {formatMoneyBR(c.paidAmount)}
                    {c.paidAt ? ` em ${formatDateBR(c.paidAt)}` : ""}
                    {c.paymentMethod ? ` · ${c.paymentMethod}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
