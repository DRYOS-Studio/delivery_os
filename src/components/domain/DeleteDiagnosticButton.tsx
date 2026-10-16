"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDiagnosticAction } from "@/lib/actions/diagnostics";

export function DeleteDiagnosticButton({
  diagnosticId,
  clientId,
  label = "Excluir diagnóstico",
  redirectTo,
  variant = "button",
  className = "",
}: {
  diagnosticId: string;
  clientId?: string;
  label?: string;
  redirectTo?: string;
  variant?: "icon" | "button" | "ghost-critical";
  className?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !window.confirm(
        "Tem certeza que deseja excluir este diagnóstico? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }

    setBusy(true);
    const result = await deleteDiagnosticAction(diagnosticId);
    if (result.ok) {
      if (redirectTo) {
        router.push(redirectTo);
      } else if (clientId) {
        router.push(`/clients/${clientId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } else {
      window.alert(`Erro ao excluir diagnóstico: ${result.error}`);
      setBusy(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`inline-flex items-center justify-center text-mute hover:text-critical disabled:opacity-50 transition-colors p-1.5 rounded hover:bg-critical-bg ${className}`}
        aria-label={label}
        title={label}
      >
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    );
  }

  if (variant === "ghost-critical") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-critical hover:bg-critical-bg border border-critical/20 hover:border-critical/40 disabled:opacity-50 transition-colors ${className}`}
      >
        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded text-critical hover:bg-critical-bg disabled:opacity-50 transition-colors ${className}`}
    >
      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}
