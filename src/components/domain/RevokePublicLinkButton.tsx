"use client";

import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { revokePublicLinkAction } from "@/lib/actions/publicLinks";

export function RevokePublicLinkButton({
  linkId,
  label,
}: {
  linkId: string;
  label: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRevoke() {
    const target = label ? `"${label}"` : "este link";
    if (
      !window.confirm(
        `Revogar ${target}? A URL deixa de funcionar imediatamente.`,
      )
    )
      return;
    setBusy(true);
    const result = await revokePublicLinkAction(linkId);
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
      onClick={handleRevoke}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded text-critical hover:bg-critical-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <XCircle className="w-3 h-3" strokeWidth={1.75} />
      {busy ? "Revogando..." : "Revogar"}
    </button>
  );
}
