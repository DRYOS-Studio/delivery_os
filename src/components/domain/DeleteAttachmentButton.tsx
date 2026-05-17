"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAttachmentAction } from "@/lib/actions/attachments";

export function DeleteAttachmentButton({
  attachmentId,
  filename,
}: {
  attachmentId: string;
  filename: string;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Remover "${filename}"? Não pode ser desfeito.`)) return;
    setBusy(true);
    const result = await deleteAttachmentAction(attachmentId);
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
      onClick={handleDelete}
      disabled={busy}
      title="Remover"
      className="text-mute hover:text-critical disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
    >
      <X className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}
