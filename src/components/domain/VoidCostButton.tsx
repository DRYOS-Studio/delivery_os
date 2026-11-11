"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { voidOperationCostAction } from "@/lib/actions/operationCosts";

export function VoidCostButton({
  costId,
  label,
  redirectTo,
  variant = "icon",
}: {
  costId: string;
  label: string;
  redirectTo?: string;
  variant?: "icon" | "button" | "row";
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const reason = window.prompt(
      `Remover lançamento "${label}"?\n\nMotivo (opcional):`,
      "",
    );
    if (reason === null) return;
    setBusy(true);
    const fd = new FormData();
    if (reason.trim()) fd.set("void_reason", reason.trim());
    const result = await voidOperationCostAction(costId, fd);
    if (result.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded text-critical hover:bg-critical-bg disabled:opacity-50 transition-colors"
      >
        <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
        Remover lançamento
      </button>
    );
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded text-critical border border-line hover:bg-critical-bg disabled:opacity-50 transition-colors min-h-[32px]"
      >
        <Ban className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {busy ? "…" : "Remover"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-mute hover:text-critical disabled:opacity-50 transition-colors"
      aria-label="Remover lançamento"
      title="Remover lançamento"
    >
      <Ban className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}
