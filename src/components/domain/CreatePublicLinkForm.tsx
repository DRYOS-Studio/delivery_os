"use client";

import { LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPublicLinkAction } from "@/lib/actions/publicLinks";

export function CreatePublicLinkForm({
  operationId,
}: {
  operationId: string;
}): React.JSX.Element {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await createPublicLinkAction(operationId, fd);
    setBusy(false);

    if (result.ok) {
      formRef.current?.reset();
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-card border border-line rounded p-4 space-y-3"
    >
      <div className="space-y-1">
        <label
          htmlFor={`link-label-${operationId}`}
          className="block font-mono text-[10px] text-mute uppercase tracking-wide"
        >
          Identificação (opcional)
        </label>
        <input
          id={`link-label-${operationId}`}
          name="label"
          type="text"
          disabled={busy}
          placeholder="Ex: Time do cliente, contato comercial..."
          className="w-full bg-bg border border-line rounded px-3 py-1.5 text-sm text-ink-soft placeholder:text-mute-soft focus:outline-none focus:border-line-strong disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="bg-critical-bg border border-critical text-critical text-xs rounded px-3 py-2">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={busy}
        className="inline-flex items-center gap-2"
      >
        <LinkIcon className="w-4 h-4" strokeWidth={1.75} />
        {busy ? "Gerando..." : "Gerar link"}
      </Button>
    </form>
  );
}
