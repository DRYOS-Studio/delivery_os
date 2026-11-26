"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { buildAppErrorDisplay } from "@/lib/utils/app-error-message";

// Boundary ROOT: pega erro lançado nos LAYOUTS (ex: queries do Sidebar).
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/role", { credentials: "same-origin" });
        if (!res.ok) return;
        const body = (await res.json()) as { role?: string | null };
        if (!cancelled && body.role === "admin") setIsAdmin(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { digestLine, detailLine, technicalBlock } = buildAppErrorDisplay(
    error.message,
    error.digest,
    error.stack,
    { isAdmin },
  );

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-3">
          Erro
        </p>
        <h1 className="font-display text-2xl font-semibold mb-2">
          Algo deu errado
        </h1>
        <p className="text-sm text-mute mb-6">
          Não foi possível carregar a página. Tente de novo em instantes.
        </p>
        {digestLine && (
          <p
            className="text-left text-xs font-mono text-ink-soft bg-card border border-line rounded px-3 py-2 mb-3 break-words"
            role="status"
          >
            {digestLine}
          </p>
        )}
        {detailLine && (
          <p
            className="text-left text-xs font-mono text-ink-soft bg-card border border-line rounded px-3 py-2 mb-3 break-words whitespace-pre-wrap"
            role="status"
          >
            {detailLine}
          </p>
        )}
        {technicalBlock && (
          <pre
            className="text-left text-[10px] font-mono text-mute bg-bg border border-line rounded px-3 py-2 mb-6 overflow-x-auto max-h-40"
            role="status"
          >
            {technicalBlock}
          </pre>
        )}
        <Button onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}