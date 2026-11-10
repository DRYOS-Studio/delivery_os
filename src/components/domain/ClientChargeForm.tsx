"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { updateClientChargeAction } from "@/lib/actions/client-charges";
import type { ClientChargeRow } from "@/lib/db/queries/client-charges";
import {
  clientChargeNetDue,
  computeDiscountAmount,
  type ClientChargeDiscountKind,
} from "@/lib/utils/client-charge-amount";
import { Button } from "@/components/ui/Button";
import { formatMoneyBR } from "@/lib/utils/money";
import { canSetChargeBillingStatus } from "@/lib/utils/client-charge-rules";

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm";

type Props = {
  clientId: string;
  charge: ClientChargeRow;
};

export function ClientChargeForm({ clientId, charge }: Props): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ClientChargeDiscountKind>(charge.discountKind);
  const [amount, setAmount] = useState(String(charge.amount));
  const [discountInput, setDiscountInput] = useState(
    charge.discountInput !== null ? String(charge.discountInput) : "",
  );

  const canEditBillingStatus =
    canSetChargeBillingStatus(charge.status) &&
    !(charge.paidAmount !== null && charge.paidAmount > 0);

  const previewNet = useMemo(() => {
    const gross = Number(amount);
    if (!Number.isFinite(gross) || gross <= 0) return 0;
    const input =
      discountInput.trim() === "" ? null : Number(discountInput.replace(",", "."));
    const disc = computeDiscountAmount(gross, kind, input);
    return clientChargeNetDue(gross, disc);
  }, [amount, discountInput, kind]);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    formData.set("discount_kind", kind);
    const res = await updateClientChargeAction(clientId, charge.id, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/clients/${clientId}/cobrancas`);
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">Editar cobrança</h2>
        <Link
          href={`/clients/${clientId}/cobrancas`}
          className="text-sm text-oak hover:underline"
        >
          Voltar
        </Link>
      </div>
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <form action={onSubmit} className="grid gap-3">
        <Field label="Valor bruto (R$)" htmlFor="amount" required>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Desconto" htmlFor="discount_kind">
          <select
            id="discount_kind"
            name="discount_kind"
            className={inputCn}
            value={kind}
            onChange={(e) => setKind(e.target.value as ClientChargeDiscountKind)}
            disabled={busy}
          >
            <option value="none">Sem desconto</option>
            <option value="fixed">Valor (R$)</option>
            <option value="percent">Percentual (%)</option>
          </select>
        </Field>
        {kind !== "none" && (
          <Field
            label={kind === "percent" ? "Percentual (%)" : "Valor do desconto (R$)"}
            htmlFor="discount_input"
          >
            <input
              id="discount_input"
              name="discount_input"
              type="number"
              step="0.01"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className={inputCn}
              disabled={busy}
            />
          </Field>
        )}
        <p className="text-sm text-mute">
          Valor líquido:{" "}
          <span className="font-mono text-ink font-semibold">
            {formatMoneyBR(previewNet)}
          </span>
        </p>
        {canEditBillingStatus && (
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              name="status"
              className={inputCn}
              defaultValue={charge.status}
              disabled={busy}
            >
              <option value="prevista">Prevista</option>
              <option value="emitida">Emitida</option>
            </select>
          </Field>
        )}
        <Field label="Vencimento" htmlFor="due_date" required>
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={charge.dueDate}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Descrição / observações" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={charge.notes ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Button type="submit" variant="sage" disabled={busy} className="min-h-[44px]">
          {busy ? "Salvando…" : "Salvar cobrança"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs text-mute mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
