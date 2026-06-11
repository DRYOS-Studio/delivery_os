"use client";

import { Button } from "@/components/ui/Button";

// Boundary do route group autenticado: pega erro das queries das pages
// (batches). Nunca renderiza error.message (pode conter detalhe de infra).
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <Button onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}
