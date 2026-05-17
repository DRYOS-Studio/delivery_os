"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  text,
  label = "Copiar",
}: {
  text: string;
  label?: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie manualmente:", text);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded bg-surface hover:bg-line text-ink-soft transition-colors"
      title={label}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" strokeWidth={2} />
          Copiado
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" strokeWidth={1.75} />
          {label}
        </>
      )}
    </button>
  );
}
