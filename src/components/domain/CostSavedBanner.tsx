"use client";

import { useSearchParams } from "next/navigation";

export function CostSavedBanner(): React.JSX.Element | null {
  const searchParams = useSearchParams();
  if (searchParams.get("cost_saved") !== "1") return null;

  return (
    <div
      role="status"
      className="mb-4 bg-sage/15 border border-sage/40 text-ink text-sm rounded px-4 py-3"
      data-testid="cost-saved-banner"
    >
      Custo salvo com sucesso. Ele já aparece na lista abaixo (incluindo inícios
      futuros).
    </div>
  );
}
