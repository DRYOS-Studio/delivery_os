"use client";

import { Button } from "@/components/ui/Button";
import { appErrorDetail } from "@/lib/utils/app-error-message";

// Boundary do route group autenticado: pega erro das queries das pages
// (batches). Exibe mensagens prefixadas de query (`fn: …`) ou detalhe em dev.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const detail = appErrorDetail(error.message, error.digest);

  return (
    <div className="flex items-center justify-center py-24 px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-3">
          Erro
        </p>
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">
          Algo deu errado
        </h1>
        <p className="text-sm text-mute mb-6">
          Não foi possível carregar esta página. Tente de novo em instantes.
        </p>
        {detail && (
          <p
            className="text-left text-xs font-mono text-ink-soft bg-card border border-line rounded px-3 py-2 mb-6 break-words"
            role="status"
          >
            {detail}
          </p>
        )}
        <Button onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}
