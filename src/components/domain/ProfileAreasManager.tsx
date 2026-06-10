"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import {
  addProfileAreaAction,
  removeProfileAreaAction,
} from "@/lib/actions/profile-areas";
import { type ProfileWithAreas } from "@/lib/db/queries/profile-areas";
import { ALL_AREAS, AREA_LABELS, type TaskArea } from "@/lib/utils/areas";
import { cn } from "@/lib/utils/cn";

type Props = { profiles: ProfileWithAreas[] };

/**
 * Toggle de áreas por usuário (admin). Cada pill liga/desliga uma área —
 * popula/limpa profile_areas. A lista inteira serve de auditoria (quem é de quê).
 */
export function ProfileAreasManager({ profiles }: Props): React.JSX.Element {
  return (
    <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
      <ul className="divide-y divide-line">
        {profiles.map((p) => (
          <ProfileRow key={p.id} profile={p} />
        ))}
      </ul>
    </div>
  );
}

function ProfileRow({ profile }: { profile: ProfileWithAreas }) {
  const [areas, setAreas] = useState<TaskArea[]>(profile.areas);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(area: TaskArea) {
    const has = areas.includes(area);
    const next = has ? areas.filter((a) => a !== area) : [...areas, area];
    setAreas(next); // otimista
    setError(null);
    startTransition(async () => {
      const result = has
        ? await removeProfileAreaAction({ profile_id: profile.id, area })
        : await addProfileAreaAction({ profile_id: profile.id, area });
      if (!result.ok) {
        setAreas(areas); // reverte
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
        {ALL_AREAS.map((area) => {
          const active = areas.includes(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
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
              {AREA_LABELS[area]}
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
