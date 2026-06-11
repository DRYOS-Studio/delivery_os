"use client";

import { Button } from "@/components/ui/Button";

// Boundary ROOT: pega erro lançado nos LAYOUTS (ex: queries do Sidebar) — o
// error.tsx de um segmento não captura erro do próprio layout. Nunca renderiza
// error.message (pode conter detalhe de infra).
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <Button onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}
