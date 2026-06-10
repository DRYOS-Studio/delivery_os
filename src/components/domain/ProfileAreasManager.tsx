"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addProfileAreaAction,
  removeProfileAreaAction,
} from "@/lib/actions/profile-areas";
import { type ProfileWithAreas } from "@/lib/db/queries/profile-areas";
import type { AreaOption } from "@/lib/utils/areas";
import { cn } from "@/lib/utils/cn";

type Props = { profiles: ProfileWithAreas[]; allAreas: AreaOption[] };

/**
 * Toggle de áreas por usuário (admin). Cada pill liga/desliga uma área —
 * popula/limpa profile_areas (por area_id). A lista inteira serve de auditoria.
 */
export function ProfileAreasManager({
  profiles,
  allAreas,
}: Props): React.JSX.Element {
  return (
    <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
      <ul className="divide-y divide-line">
        {profiles.map((p) => (
          <ProfileRow key={p.id} profile={p} allAreas={allAreas} />
        ))}
      </ul>
    </div>
  );
}

function ProfileRow({
  profile,
  allAreas,
}: {
  profile: ProfileWithAreas;
  allAreas: AreaOption[];
}) {
  const [areaIds, setAreaIds] = useState<string[]>(
    profile.areas.map((a) => a.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(areaId: string) {
    const has = areaIds.includes(areaId);
    const next = has
      ? areaIds.filter((a) => a !== areaId)
      : [...areaIds, areaId];
    const prev = areaIds;
    setAreaIds(next); // otimista
    setError(null);
    startTransition(async () => {
      const result = has
        ? await removeProfileAreaAction({
            profile_id: profile.id,
            area_id: areaId,
          })
        : await addProfileAreaAction({
            profile_id: profile.id,
            area_id: areaId,
          });
      if (!result.ok) {
        setAreaIds(prev); // reverte
        setError(result.error);
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <span className="font-medium text-ink">
        {profile.name ?? "Sem nome"}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {allAreas.map((area) => {
          const active = areaIds.includes(area.id);
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => toggle(area.id)}
              disabled={isPending}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-mono transition-colors disabled:opacity-50",
                active
                  ? "bg-oak text-white"
                  : "bg-surface text-mute hover:text-ink",
              )}
            >
              {active && <Check className="w-3 h-3" strokeWidth={3} />}
              {area.name}
            </button>
          );
        })}
        {error && (
          <span className="text-critical text-xs" role="alert">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}
