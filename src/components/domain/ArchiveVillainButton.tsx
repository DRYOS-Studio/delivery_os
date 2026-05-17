"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  archiveVillainAction,
  restoreVillainAction,
} from "@/lib/actions/villains";

export function ArchiveVillainButton({
  villainId,
  villainName,
  archivedAt,
}: {
  villainId: string;
  villainName: string;
  archivedAt: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isArchived = archivedAt !== null;

  async function handleClick() {
    if (isArchived) {
      if (!window.confirm(`Restaurar ${villainName}?`)) return;
    } else {
      if (
        !window.confirm(
          `Arquivar ${villainName}? Vilões nunca são deletados — só arquivados.`,
        )
      )
        return;
    }
    setBusy(true);
    const result = isArchived
      ? await restoreVillainAction(villainId)
      : await archiveVillainAction(villainId);
    if (result.ok) {
      router.refresh();
      router.push("/catalog");
    } else {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      disabled={busy}
      className={
        isArchived
          ? "text-sage hover:text-sage hover:bg-sage-bg"
          : "text-critical hover:text-critical hover:bg-critical-bg"
      }
    >
      {isArchived ? (
        <>
          <ArchiveRestore className="w-4 h-4" strokeWidth={1.75} />
          {busy ? "Restaurando..." : "Restaurar"}
        </>
      ) : (
        <>
          <Archive className="w-4 h-4" strokeWidth={1.75} />
          {busy ? "Arquivando..." : "Arquivar"}
        </>
      )}
    </Button>
  );
}
