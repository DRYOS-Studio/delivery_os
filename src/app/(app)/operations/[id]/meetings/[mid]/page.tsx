import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { VISIBILITY_LABEL, VISIBILITY_VARIANT } from "@/lib/constants/visibility";
import { listDecisionsByOperation } from "@/lib/db/queries/decisions";
import { getMeeting } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";
import { listRiskBlockersByMeeting } from "@/lib/db/queries/operation-risk-blockers";
import { formatDateTimeBR } from "@/lib/utils/datetime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { id, mid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(mid)) redirect("/operations");

  const [op, meeting] = await Promise.all([getOperation(id), getMeeting(mid)]);
  if (!op) redirect("/operations");
  if (!meeting || meeting.operation_id !== id) redirect(`/operations/${id}`);

  const [allDecisions, riskBlockers] = await Promise.all([
    listDecisionsByOperation(id, 100),
    listRiskBlockersByMeeting(mid),
  ]);
  const decisions = allDecisions.filter((d) => d.meeting?.id === mid);

  const granolaUrl = meeting.granola_source_ref?.trim()
    ? meeting.granola_source_ref.startsWith("http")
      ? meeting.granola_source_ref
      : undefined
    : undefined;

  return (
    <>
      <PageHeader
        title={meeting.title}
        subtitle={`${op.client.name} · ${op.name}`}
        actions={
          <Link
            href={`/operations/${id}/meetings/${mid}/edit`}
            className="inline-flex items-center rounded font-medium px-3 py-1.5 text-xs bg-sage text-bg hover:bg-sage-deep"
          >
            Editar
          </Link>
        }
      />

      <Card className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Pill variant={VISIBILITY_VARIANT[meeting.visibility]}>
            {VISIBILITY_LABEL[meeting.visibility]}
          </Pill>
          <span className="font-mono text-xs text-mute">
            Início {formatDateTimeBR(meeting.scheduled_at)}
            {meeting.ended_at
              ? ` · Término ${formatDateTimeBR(meeting.ended_at)}`
              : ""}
          </span>
        </div>
        {meeting.notes && (
          <p className="text-sm text-ink-soft whitespace-pre-wrap">{meeting.notes}</p>
        )}
        {meeting.attendees.length > 0 && (
          <p className="text-sm text-mute">
            Participantes:{" "}
            {meeting.attendees
              .map((a) => `${a.name}${a.kind === "external" ? " (cliente)" : ""}`)
              .join(", ")}
          </p>
        )}
        {granolaUrl && (
          <p className="text-sm">
            <a href={granolaUrl} className="text-oak hover:underline" target="_blank" rel="noreferrer">
              Abrir nota no Granola
            </a>
          </p>
        )}
      </Card>

      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold mb-3">Pauta</h2>
        <ul className="space-y-2">
          {meeting.agenda_items.map((item) => (
            <li key={item.id} className="border border-line rounded px-3 py-2">
              <p className="font-medium text-sm">{item.title}</p>
              {item.notes && (
                <p className="text-sm text-mute mt-1 whitespace-pre-wrap">{item.notes}</p>
              )}
            </li>
          ))}
          {meeting.agenda_items.length === 0 && (
            <li className="text-sm text-mute">Nenhum item registrado.</li>
          )}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold mb-3">Próximos passos</h2>
        <ul className="space-y-2">
          {meeting.next_steps.map((s) => (
            <li key={s.id} className="border border-line rounded px-3 py-2 text-sm">
              <p>{s.description}</p>
              <p className="font-mono text-[11px] text-mute mt-1">
                {s.due_date ? `Prazo ${s.due_date}` : "Sem prazo"}
                {s.assignee ? ` · ${s.assignee.name}` : ""}
              </p>
              {s.task_id && s.task?.frente_id && (
                <Link
                  href={`/operations/${id}/frentes/${s.task.frente_id}/tasks/${s.task_id}/edit`}
                  className="text-oak text-xs hover:underline"
                >
                  Ver tarefa vinculada
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold mb-3">Decisões desta reunião</h2>
        <ul className="space-y-2">
          {decisions.map((d) => (
            <li key={d.id}>
              <Link
                href={`/operations/${id}/decisions/${d.id}/edit`}
                className="text-sm text-oak hover:underline"
              >
                {d.title}
              </Link>
            </li>
          ))}
          {decisions.length === 0 && (
            <li className="text-sm text-mute">Nenhuma decisão vinculada.</li>
          )}
        </ul>
      </section>

      {riskBlockers.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold mb-3">Riscos e bloqueios</h2>
          <ul className="space-y-2">
            {riskBlockers.map((r) => (
              <li key={r.id} className="border border-line rounded px-3 py-2 text-sm">
                <span className="font-medium">{r.title}</span>
                <span className="font-mono text-[10px] text-mute ml-2 uppercase">
                  {r.kind} · {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
