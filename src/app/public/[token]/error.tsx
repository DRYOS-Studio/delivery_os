"use client";

// Superfície pública: erro neutro, sem chrome interno, sem detalhe técnico.
export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-24 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink mb-2">
        Não foi possível carregar o relatório
      </h1>
      <p className="text-sm text-mute mb-6">
        Tente de novo em instantes. Se persistir, fale com o time DRYOS.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center rounded font-medium transition-colors bg-ink text-bg hover:bg-oak px-3.5 py-2 text-[13px]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
