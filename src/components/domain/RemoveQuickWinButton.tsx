"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteQuickWinAction } from "@/lib/actions/quick-wins";

export function RemoveQuickWinButton({
  qwId,
  title,
}: {
  qwId: string;
  title: string;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !window.confirm(
        `Remover "${title}"? Os impactos em vilões serão revertidos automaticamente.`,
      )
    )
      return;
    setBusy(true);
    const result = await deleteQuickWinAction(qwId);
    if (result.ok) {
      router.refresh();
    } else {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Remover Quick Win"
      className="text-mute hover:text-critical disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
    >
      <X className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}
