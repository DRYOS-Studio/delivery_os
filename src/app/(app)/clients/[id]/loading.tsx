// Skeleton de navegação pro detalhe de Cliente. Só segmentos SEM searchParams
// podem ter loading.tsx (boundary re-dispara em navegação same-page com
// searchParams — flash de skeleton em filtro/tab; ver design #131).
export default function ClientDetailLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="h-3 w-24 bg-surface rounded mb-3" />
      <div className="h-8 w-64 bg-surface rounded mb-6" />
      <div className="flex gap-2 mb-8">
        <div className="h-6 w-20 bg-surface rounded-full" />
        <div className="h-6 w-24 bg-surface rounded-full" />
      </div>
      <div className="space-y-4">
        <div className="h-32 bg-surface rounded border border-line" />
        <div className="h-32 bg-surface rounded border border-line" />
        <div className="h-32 bg-surface rounded border border-line" />
      </div>
    </div>
  );
}
