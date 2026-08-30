"use client";

import { ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { restoreClientAction } from "@/lib/actions/clients";
import { restoreFrenteAction } from "@/lib/actions/frentes";
import { restoreOperationAction } from "@/lib/actions/operations";

type Kind = "client" | "operation" | "frente";

const ACTION = {
  client: restoreClientAction,
  operation: restoreOperationAction,
  frente: restoreFrenteAction,
} as const;

const NOUN: Record<Kind, string> = {
  client: "Cliente",
  operation: "Operação",
  frente: "Frente",
};

/**
 * Restore é item a item, nunca em cascata: não existe coluna de proveniência que
 * diga quem foi arquivado pela cascata e quem já estava antes.
 *
 * A recusa por pai arquivado vem do banco (`P0003` → `state_conflict`), não daqui —
 * a UI só mostra a mensagem.
 */
export function RestoreButton({
  kind,
  id,
  name,
}: {
  kind: Kind;
  id: string;
  name: string;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Restaurar ${NOUN[kind]} ${name}?`)) return;
    setBusy(true);
    const result = await ACTION[kind](id);
    if (result.ok) {
      router.refresh();
    } else {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={busy}
    >
      <ArchiveRestore className="w-4 h-4" strokeWidth={1.75} />
      Restaurar
    </Button>
  );
}
