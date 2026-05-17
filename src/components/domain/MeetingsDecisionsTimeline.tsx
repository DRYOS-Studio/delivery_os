import { CalendarDays, Gavel, Lock, Plus, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import {
  VISIBILITY_LABEL,
  VISIBILITY_VARIANT,
  type VisibilityValue,
} from "@/lib/constants/visibility";
import type { DecisionListItem } from "@/lib/db/queries/decisions";
import type { MeetingListItem } from "@/lib/db/queries/meetings";
import { formatDateTimeBR } from "@/lib/utils/datetime";
import { relativeFromNow } from "@/lib/utils/date";

type TimelineItemData =
  | { type: "meeting"; timestamp: string; payload: MeetingListItem }
  | { type: "decision"; timestamp: string; payload: DecisionListItem };

const LIMIT = 8;

function truncate(s: string | null | undefined, n = 140): string {
  if (!s) return "";
  const cleaned = s.trim().replace(/\s+/g, " ");
  if (cleaned.length <= n) return cleaned;
  return `${cleaned.slice(0, n)}…`;
}

export function MeetingsDecisionsTimeline({
  meetings,
  decisions,
  operationId,
}: {
  meetings: MeetingListItem[];
  decisions: DecisionListItem[];
  operationId: string;
}): React.JSX.Element {
  const items: TimelineItemData[] = [
    ...meetings.map(
      (m): TimelineItemData => ({
        type: "meeting",
        timestamp: m.scheduledAt,
        payload: m,
      }),
    ),
    ...decisions.map(
      (d): TimelineItemData => ({
        type: "decision",
        timestamp: d.decidedAt,
        payload: d,
      }),
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const visible = items.slice(0, LIMIT);
  const total = items.length;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            Reuniões e decisões
          </h2>
          <Pill variant="neutral">{total}</Pill>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/operations/${operationId}/meetings/new`}
            className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Reunião
          </Link>
          <Link
            href={`/operations/${operationId}/decisions/new`}
            className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Decisão
          </Link>
        </div>
      </div>

      {total === 0 ? (
        <Card>
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <p className="text-sm text-ink-soft max-w-md">
              Nenhuma reunião ou decisão registrada. Registre a primeira pra
              começar a timeline.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/operations/${operationId}/meetings/new`}
                className="inline-flex items-center gap-1.5 rounded font-medium px-3 py-1.5 text-xs bg-sage text-bg hover:bg-sage-deep transition-colors"
              >
                Reunião
              </Link>
              <Link
                href={`/operations/${operationId}/decisions/new`}
                className="inline-flex items-center gap-1.5 rounded font-medium px-3 py-1.5 text-xs bg-sage text-bg hover:bg-sage-deep transition-colors"
              >
                Decisão
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <TimelineItem
              key={`${item.type}-${item.payload.id}`}
              item={item}
              operationId={operationId}
            />
          ))}
          {total > LIMIT && (
            <li className="text-xs text-mute font-mono">
              Mostrando {LIMIT} de {total}. Itens mais antigos disponíveis em
              breve.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function VisibilityPill({ value }: { value: VisibilityValue }) {
  const Icon = value === "interno" ? Lock : Users;
  return (
    <Pill variant={VISIBILITY_VARIANT[value]}>
      <Icon className="w-3 h-3" strokeWidth={1.75} />
      {VISIBILITY_LABEL[value]}
    </Pill>
  );
}

function TimelineItem({
  item,
  operationId,
}: {
  item: TimelineItemData;
  operationId: string;
}) {
  const Icon = item.type === "meeting" ? CalendarDays : Gavel;
  const title = item.payload.title;
  const visibility = item.payload.visibility;
  const editHref =
    item.type === "meeting"
      ? `/operations/${operationId}/meetings/${item.payload.id}/edit`
      : `/operations/${operationId}/decisions/${item.payload.id}/edit`;

  const preview =
    item.type === "meeting"
      ? truncate(item.payload.notes)
      : truncate(item.payload.decision || item.payload.context);

  const attendeesPreview =
    item.type === "meeting" && item.payload.attendees.length > 0
      ? item.payload.attendees.map((a) => a.name).join(", ")
      : null;

  const linkedMeeting =
    item.type === "decision" && item.payload.meeting
      ? item.payload.meeting.title
      : null;

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded bg-surface flex items-center justify-center text-mute">
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-base font-semibold text-ink">
                {title}
              </span>
              <VisibilityPill value={visibility} />
            </div>
            <p className="font-mono text-[11px] text-mute">
              {formatDateTimeBR(item.timestamp)} · {relativeFromNow(item.timestamp)}
              {linkedMeeting && (
                <>
                  {" · "}
                  <span className="text-mute">
                    via reunião <span className="text-ink-soft">{linkedMeeting}</span>
                  </span>
                </>
              )}
            </p>
            {preview && (
              <p className="text-sm text-ink-soft line-clamp-2">{preview}</p>
            )}
            {attendeesPreview && (
              <p className="font-mono text-[11px] text-mute-soft">
                Participantes: {attendeesPreview}
              </p>
            )}
            <Link
              href={editHref}
              className="font-mono text-xs text-oak hover:underline inline-block"
            >
              Editar →
            </Link>
          </div>
        </div>
      </Card>
    </li>
  );
}
