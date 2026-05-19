"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { upsertVillainNarrativeAction } from "@/lib/actions/villain-narratives";

type Props = {
  operationVillainId: string;
  villainName: string;
  periodYyyymm: string;
  periodLabel: string;
  initialText: string;
  onClose: () => void;
};

const MIN = 20;
const MAX = 4000;

export function VillainNarrativeForm({
  operationVillainId,
  villainName,
  periodYyyymm,
  periodLabel,
  initialText,
  onClose,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLen = text.trim().length;
  const tooShort = trimmedLen < MIN;
  const tooLong = trimmedLen > MAX;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tooShort) {
      setError(`Mínimo ${MIN} caracteres.`);
      return;
    }
    if (tooLong) {
      setError(`Máximo ${MAX} caracteres.`);
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set("narrative_text", text);
    fd.set("period_yyyymm", periodYyyymm);
    const result = await upsertVillainNarrativeAction(operationVillainId, fd);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 mt-2 border-t border-line pt-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={`narrative-${operationVillainId}`}
          className="font-mono text-[10px] uppercase tracking-wide text-mute"
        >
          Narrativa do mês — {periodLabel} · {villainName}
        </label>
        <span className="font-mono text-[10px] text-mute-soft">
          {trimmedLen}/{MAX}
        </span>
      </div>
      <textarea
        id={`narrative-${operationVillainId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
        rows={6}
        placeholder={`Conte o que aconteceu com ${villainName} neste mês. O que foi enfrentado, derrotado, ainda em aberto. Texto será lido pelo cliente no link público.`}
        className="w-full bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
      />
      {error && <p className="text-critical text-xs">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? "Salvando..." : "Salvar narrativa"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
