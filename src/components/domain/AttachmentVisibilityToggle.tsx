"use client";

import { Lock, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAttachmentVisibilityAction } from "@/lib/actions/attachments";
import type { AttachmentVisibility } from "@/lib/db/queries/attachments";

export function AttachmentVisibilityToggle({
  attachmentId,
  visibility,
}: {
  attachmentId: string;
  visibility: AttachmentVisibility;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isInternal = visibility === "interno";

  async function handleToggle() {
    setBusy(true);
    const next = isInternal ? "cliente" : "interno";
    const result = await setAttachmentVisibilityAction(attachmentId, next);
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
      onClick={handleToggle}
      disabled={busy}
      title={
        isInternal
          ? "Interno — clique pra tornar visível ao cliente"
          : "Visível ao cliente — clique pra tornar interno"
      }
      className="text-mute hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1"
    >
      {isInternal ? (
        <Lock className="w-4 h-4" strokeWidth={1.75} />
      ) : (
        <Users className="w-4 h-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
