"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  archiveServiceProductAction,
  restoreServiceProductAction,
} from "@/lib/actions/service-products";

export function ArchiveServiceProductButton({
  productId,
  productName,
  archivedAt,
}: {
  productId: string;
  productName: string;
  archivedAt: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isArchived = archivedAt !== null;

  async function handleClick() {
    const verb = isArchived ? "Restaurar" : "Arquivar";
    if (!window.confirm(`${verb} ${productName}?`)) return;
    setBusy(true);
    const result = isArchived
      ? await restoreServiceProductAction(productId)
      : await archiveServiceProductAction(productId);
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
      className={
        isArchived
          ? "text-sage hover:text-sage hover:bg-sage-bg"
          : "text-critical hover:text-critical hover:bg-critical-bg"
      }
    >
      {isArchived ? (
        <>
          <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={1.75} />
          {busy ? "Restaurando..." : "Restaurar"}
        </>
      ) : (
        <>
          <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
          {busy ? "Arquivando..." : "Arquivar"}
        </>
      )}
    </Button>
  );
}
