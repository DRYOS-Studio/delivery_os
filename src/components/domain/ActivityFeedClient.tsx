"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ActivityEventRow } from "@/lib/db/queries/activity";
import {
  fetchActivityFeedAction,
  type ActivityFeedScope,
} from "@/lib/actions/activity-feed";
import type { ActivityFormatContext } from "@/lib/utils/activity-format";
import { formatDateTimeBR } from "@/lib/utils/date";
import {
  ACTIVITY_DATE_PRESET_LABELS,
  ACTIVITY_DATE_PRESETS,
  ACTIVITY_FILTER_CATEGORIES,
  ACTIVITY_FILTER_CATEGORY_LABELS,
  type ActivityDatePreset,
  type ActivityFilterCategory,
  type ActivityListFilters,
} from "@/lib/utils/activity-filters";
import {
  formatActivityActorLabel,
  formatActivitySentence,
  groupActivityEventsForDisplay,
} from "@/lib/utils/activity-format";

function formatJson(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 0);
  } catch {
    return String(v);
  }
}

type Props = {
  scope: ActivityFeedScope;
  initialEvents: ActivityEventRow[];
  initialContext: ActivityFormatContext;
  title?: string;
  emptyMessage?: string;
};

export function ActivityFeedClient({
  scope,
  initialEvents,
  initialContext,
  title = "Histórico de atividade",
  emptyMessage = "Nenhum evento registrado ainda.",
}: Props): React.JSX.Element {
  const [readable, setReadable] = useState(true);
  const [category, setCategory] = useState<ActivityFilterCategory>("all");
  const [datePreset, setDatePreset] = useState<ActivityDatePreset>("all");
  const [events, setEvents] = useState(initialEvents);
  const [context, setContext] = useState(initialContext);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const displayEvents = useMemo(() => {
    const base = readable ? groupActivityEventsForDisplay(events) : events;
    return base;
  }, [events, readable]);

  const reload = useCallback(
    (filters: ActivityListFilters) => {
      startTransition(async () => {
        setError(null);
        const res = await fetchActivityFeedAction(scope, filters);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setEvents(res.data.events);
        setContext(res.data.context);
      });
    },
    [scope],
  );

  const onCategoryChange = (next: ActivityFilterCategory): void => {
    setCategory(next);
    reload({ category: next, datePreset });
  };

  const onDatePresetChange = (next: ActivityDatePreset): void => {
    setDatePreset(next);
    reload({ category, datePreset: next });
  };

  return (
    <section className="mt-9">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-ink-soft">
            <span className="sr-only">Tipo de atividade</span>
            <select
              className="border border-line rounded px-2 py-1 bg-card text-ink text-sm"
              value={category}
              onChange={(e) =>
                onCategoryChange(e.target.value as ActivityFilterCategory)
              }
              disabled={pending}
              aria-label="Filtrar por tipo"
            >
              {ACTIVITY_FILTER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ACTIVITY_FILTER_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-ink-soft">
            <span className="sr-only">Período</span>
            <select
              className="border border-line rounded px-2 py-1 bg-card text-ink text-sm"
              value={datePreset}
              onChange={(e) =>
                onDatePresetChange(e.target.value as ActivityDatePreset)
              }
              disabled={pending}
              aria-label="Filtrar por data"
            >
              {ACTIVITY_DATE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {ACTIVITY_DATE_PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="border border-line rounded px-2.5 py-1 bg-card text-ink-soft hover:text-ink text-sm"
            onClick={() => setReadable((v) => !v)}
            aria-pressed={readable}
          >
            {readable ? "Modo técnico" : "Modo legível"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-critical mb-2" role="alert">
          {error}
        </p>
      ) : null}

      {pending ? (
        <p className="text-xs text-mute mb-2">Atualizando histórico…</p>
      ) : null}

      {displayEvents.length === 0 ? (
        <p className="text-sm text-mute">{emptyMessage}</p>
      ) : (
        <ul className="border border-line rounded divide-y divide-line bg-card">
          {displayEvents.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                <time
                  className="font-mono text-[11px] text-mute"
                  dateTime={e.createdAt}
                >
                  {formatDateTimeBR(e.createdAt)}
                </time>
                {readable ? (
                  <p className="text-sm text-ink flex-1 min-w-[12rem]">
                    {formatActivitySentence(e, context)}
                  </p>
                ) : (
                  <>
                    <span className="text-sm font-medium text-ink">
                      {formatActivityActorLabel(e, context)}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {e.action}
                      {e.fieldKey ? ` · ${e.fieldKey}` : ""}
                    </span>
                  </>
                )}
              </div>
              {!readable &&
              ((e.oldValue !== null && e.oldValue !== undefined) ||
                (e.newValue !== null && e.newValue !== undefined)) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs text-mute font-mono whitespace-pre-wrap break-words">
                  <div>
                    <span className="text-mute uppercase tracking-wide text-[10px]">
                      Antes
                    </span>
                    <p className="text-ink-soft mt-0.5">{formatJson(e.oldValue)}</p>
                  </div>
                  <div>
                    <span className="text-mute uppercase tracking-wide text-[10px]">
                      Depois
                    </span>
                    <p className="text-ink-soft mt-0.5">{formatJson(e.newValue)}</p>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
