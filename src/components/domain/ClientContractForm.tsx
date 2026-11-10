"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  createClientContractAction,
  updateClientContractAction,
} from "@/lib/actions/client-contracts";
import type { ClientContractDetail } from "@/lib/db/queries/client-contracts";
import { Button } from "@/components/ui/Button";

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm";

type Props =
  | {
      mode: "create";
      clientId: string;
    }
  | {
      mode: "edit";
      clientId: string;
      contract: ClientContractDetail;
    };

export function ClientContractForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = props.mode === "edit";
  const c = isEdit ? props.contract : null;

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = isEdit
      ? await updateClientContractAction(props.clientId, props.contract.id, formData)
      : await createClientContractAction(props.clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/clients/${props.clientId}/contratos`);
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">
          {isEdit ? "Editar contrato" : "Novo contrato"}
        </h2>
        <Link
          href={`/clients/${props.clientId}/contratos`}
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
      {isEdit && (
        <p className="text-sm text-mute">
          Alterar o contrato <strong>não</strong> recalcula cobranças já geradas.
          Use &quot;Gerar previstas&quot; na aba Cobranças para incluir meses
          faltantes.
        </p>
      )}
      <form ref={formRef} action={onSubmit} className="grid gap-3">
        <Field label="Nome / referência" htmlFor="label" required>
          <input
            id="label"
            name="label"
            required
            defaultValue={c?.label ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Valor mensal (BRL)" htmlFor="monthly_value">
            <input
              id="monthly_value"
              name="monthly_value"
              type="number"
              step="0.01"
              defaultValue={c?.monthlyValue ?? ""}
              className={inputCn}
              disabled={busy}
            />
          </Field>
          <Field label="Dia pagamento (1–28)" htmlFor="payment_day_of_month">
            <input
              id="payment_day_of_month"
              name="payment_day_of_month"
              type="number"
              min={1}
              max={28}
              defaultValue={c?.paymentDayOfMonth ?? ""}
              className={inputCn}
              disabled={busy}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Taxa de implantação (BRL)" htmlFor="implementation_fee">
            <input
              id="implementation_fee"
              name="implementation_fee"
              type="number"
              step="0.01"
              defaultValue={c?.implementationFee ?? ""}
              className={inputCn}
              disabled={busy}
            />
          </Field>
          <Field label="Implantação quitada?" htmlFor="implementation_fee_paid">
            <select
              id="implementation_fee_paid"
              name="implementation_fee_paid"
              className={inputCn}
              defaultValue={c?.implementationFeePaid ? "true" : "false"}
              disabled={busy}
            >
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Início (onboarding)" htmlFor="start_date">
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={c?.startDate ?? ""}
              className={inputCn}
              disabled={busy}
            />
          </Field>
          <Field label="1ª cobrança" htmlFor="first_billing_date">
            <input
              id="first_billing_date"
              name="first_billing_date"
              type="date"
              defaultValue={c?.firstBillingDate ?? ""}
              className={inputCn}
              disabled={busy}
            />
          </Field>
        </div>
        <Field label="Fim / vencimento" htmlFor="end_date">
          <input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={c?.endDate ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Moeda" htmlFor="currency">
          <input
            id="currency"
            name="currency"
            defaultValue={c?.currency ?? "BRL"}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Reajustes (texto)" htmlFor="reajuste_notes">
          <textarea
            id="reajuste_notes"
            name="reajuste_notes"
            rows={2}
            defaultValue={c?.reajusteNotes ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            className={inputCn}
            defaultValue={c?.status ?? "rascunho"}
            disabled={busy}
          >
            <option value="rascunho">Rascunho</option>
            <option value="vigente">Vigente</option>
            <option value="encerrada">Encerrada</option>
          </select>
        </Field>
        <Field label="Observações" htmlFor="notes">
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={c?.notes ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field
          label={isEdit ? "Substituir arquivo (opcional)" : "Arquivo (PDF ou outro)"}
          htmlFor="file"
          required={!isEdit}
        >
          <input
            id="file"
            name="file"
            type="file"
            required={!isEdit}
            className="text-sm w-full"
            disabled={busy}
          />
          {isEdit && c?.filename && (
            <p className="text-xs text-mute mt-1">Atual: {c.filename}</p>
          )}
        </Field>
        <Button type="submit" disabled={busy} variant="sage" className="min-h-[44px]">
          {busy ? "Salvando…" : "Salvar contrato"}
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
