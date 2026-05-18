"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteOperationCostAction } from "@/lib/actions/operationCosts";

export function DeleteCostButton({
  costId,
  label,
  redirectTo,
  variant = "icon",
}: {
  costId: string;
  label: string;
  redirectTo?: string;
  variant?: "icon" | "button";
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Excluir custo "${label}"?`)) return;
    setBusy(true);
    const result = await deleteOperationCostAction(costId);
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
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        Excluir custo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-mute hover:text-critical disabled:opacity-50 transition-colors"
      aria-label="Excluir custo"
      title="Excluir custo"
    >
      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}
