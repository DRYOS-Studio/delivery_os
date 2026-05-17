"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteOperationVillainAction } from "@/lib/actions/operation-villains";

export function RemoveOperationVillainButton({
  itemId,
  villainName,
}: {
  itemId: string;
  villainName: string;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !window.confirm(
        `Remover ${villainName} desta Operação? O progresso registrado será perdido.`,
      )
    )
      return;
    setBusy(true);
    const result = await deleteOperationVillainAction(itemId);
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
      title="Remover atribuição"
      className="text-mute hover:text-critical disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
    >
      <X className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}
