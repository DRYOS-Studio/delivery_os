"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  clientJourneyOptionsForManualSelect,
  isClientJourneyStatus,
} from "@/lib/utils/client-journey-status";

export function ClientsJourneyFilter(): React.JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("journey") ?? "";
  const q = params.get("q") ?? "";

  function onChange(next: string): void {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (next && isClientJourneyStatus(next)) sp.set("journey", next);
    const qs = sp.toString();
    router.replace(qs ? `/clients?${qs}` : "/clients");
  }

  return (
    <label className="flex items-center gap-2 text-sm text-mute mb-5 max-w-md">
      <span className="font-mono text-[10px] uppercase shrink-0">Jornada</span>
      <select
        className="w-full min-h-[44px] bg-card border border-line rounded px-3 py-2 text-sm text-ink-soft"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todas</option>
        {clientJourneyOptionsForManualSelect().map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
