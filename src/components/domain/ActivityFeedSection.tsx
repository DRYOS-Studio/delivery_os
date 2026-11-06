import type { ActivityEventRow } from "@/lib/db/queries/activity";
import { formatDateTimeBR } from "@/lib/utils/date";

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
  title?: string;
  events: ActivityEventRow[];
  emptyMessage?: string;
};

export function ActivityFeedSection({
  title = "Histórico de atividade",
  events,
  emptyMessage = "Nenhum evento registrado ainda.",
}: Props): React.JSX.Element {
  return (
    <section className="mt-9">
      <h2 className="font-display text-lg text-ink font-semibold mb-4">
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-mute">{emptyMessage}</p>
      ) : (
        <ul className="border border-line rounded divide-y divide-line bg-card">
          {events.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                <time
                  className="font-mono text-[11px] text-mute"
                  dateTime={e.createdAt}
                >
                  {formatDateTimeBR(e.createdAt)}
                </time>
                <span className="text-sm font-medium text-ink">
                  {e.actorName ?? "Usuário"}
                </span>
                <span className="text-sm text-ink-soft">
                  {e.action}
                  {e.fieldKey ? ` · ${e.fieldKey}` : ""}
                </span>
              </div>
              {(e.oldValue !== null && e.oldValue !== undefined) ||
              (e.newValue !== null && e.newValue !== undefined) ? (
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
