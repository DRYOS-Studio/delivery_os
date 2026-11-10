"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createClientAcquisitionCostAction,
  updateClientAcquisitionCostAction,
} from "@/lib/actions/client-acquisition-costs";
import type { ClientAcquisitionCostRow } from "@/lib/db/queries/client-acquisition-costs";
import { Button } from "@/components/ui/Button";
import { calendarDateLocalToday } from "@/lib/utils/calendar-date";
import {
  CLIENT_CAC_CATEGORIES,
  clientCacCategoryLabel,
} from "@/lib/utils/client-cac-category";

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm";

type Props =
  | { mode: "create"; clientId: string }
  | { mode: "edit"; clientId: string; item: ClientAcquisitionCostRow };

export function ClientCacForm(props: Props): React.JSX.Element {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const item = isEdit ? props.item : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = isEdit
      ? await updateClientAcquisitionCostAction(
          props.clientId,
          props.item.id,
          formData,
        )
      : await createClientAcquisitionCostAction(props.clientId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/clients/${props.clientId}/cac`);
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">
          {isEdit ? "Editar custo de aquisição" : "Novo custo de aquisição"}
        </h2>
        <Link
          href={`/clients/${props.clientId}/cac`}
          className="text-sm text-oak hover:underline"
        >
          Voltar
        </Link>
      </div>
      <p className="text-sm text-mute">
        Custos pontuais para calcular o CAC do cliente — não entram na margem
        mensal das operações.
      </p>
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <form action={onSubmit} className="grid gap-3">
        <Field label="Data" htmlFor="spent_on" required>
          <input
            id="spent_on"
            name="spent_on"
            type="date"
            required
            defaultValue={item?.spentOn ?? calendarDateLocalToday()}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Descrição" htmlFor="description" required>
          <input
            id="description"
            name="description"
            required
            maxLength={500}
            defaultValue={item?.description ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Field label="Categoria" htmlFor="category" required>
          <select
            id="category"
            name="category"
            required
            defaultValue={item?.category ?? "outros"}
            className={inputCn}
            disabled={busy}
          >
            {CLIENT_CAC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {clientCacCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor (R$)" htmlFor="amount" required>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={item?.amount ?? ""}
            className={inputCn}
            disabled={busy}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
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
    <label className="text-sm text-ink block" htmlFor={htmlFor}>
      {label}
      {required ? " *" : ""}
      <span className="block mt-1">{children}</span>
    </label>
  );
}
