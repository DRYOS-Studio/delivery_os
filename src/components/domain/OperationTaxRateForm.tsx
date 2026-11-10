"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { updateOperationTaxRateAction } from "@/lib/actions/operation-tax-rate";
import { Button } from "@/components/ui/Button";

const inputCn =
  "w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm";

type Props = {
  operationId: string;
  initialTaxRatePct: number | null;
};

function formatTaxRateInput(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseTaxRatePct(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function OperationTaxRateForm({
  operationId,
  initialTaxRatePct,
}: Props): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState(formatTaxRateInput(initialTaxRatePct));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await updateOperationTaxRateAction(operationId, formData);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/operations/${operationId}?tab=custos`);
    router.refresh();
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg text-ink font-semibold">
          Alíquota de impostos
        </h1>
        <Link
          href={`/operations/${operationId}?tab=custos`}
          className="text-sm text-oak hover:underline"
        >
          Voltar aos custos
        </Link>
      </div>
      <p className="text-sm text-mute">
        Percentual sobre o MRR (valor cobrado). Edite somente aqui — o formulário
        da operação não altera impostos.
      </p>
      {error && (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      )}
      <form
        ref={formRef}
        action={onSubmit}
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(formRef.current ?? undefined);
          const parsed = parseTaxRatePct(input);
          fd.set(
            "tax_rate_pct",
            parsed === null ? "" : String(parsed),
          );
          void onSubmit(fd);
        }}
      >
        <label className="text-sm text-ink" htmlFor="tax_rate_pct">
          Impostos (%)
          <input
            id="tax_rate_pct"
            name="tax_rate_pct"
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            disabled={busy}
            className={`${inputCn} mt-1`}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar alíquota"}
          </Button>
          <Link href={`/operations/${operationId}?tab=custos`}>
            <Button type="button" variant="ghost" disabled={busy}>
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
