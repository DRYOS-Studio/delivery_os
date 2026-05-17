import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type {
  IncidentListItem,
  IncidentSeverity,
  IncidentStatus,
} from "@/lib/db/queries/incidents";
import { relativeFromNow } from "@/lib/utils/date";
import { formatDateTimeBR } from "@/lib/utils/datetime";
import {
  formatHours,
  type OpSLAConfig,
  slaBreachLevel,
  slaBreachPill,
} from "@/lib/utils/sla";

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const SEVERITY_VARIANT: Record<IncidentSeverity, PillVariant> = {
  low: "neutral",
  medium: "oak",
  high: "critical",
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Aberto",
  responded: "Respondido",
  resolved: "Resolvido",
  cancelled: "Cancelado",
};

const STATUS_VARIANT: Record<IncidentStatus, PillVariant> = {
  open: "warning",
  responded: "oak",
  resolved: "sage",
  cancelled: "neutral",
};

type Props = {
  incidents: IncidentListItem[];
  openCount: number;
  op: OpSLAConfig;
  operationId: string;
};

export function SLASection({
  incidents,
  openCount,
  op,
  operationId,
}: Props): React.JSX.Element {
  const hasSLA = op.response_hours !== null || op.resolution_hours !== null;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            SLA &amp; incidentes
          </h2>
          {openCount > 0 ? (
            <Pill variant="warning">
              {openCount} {openCount === 1 ? "aberto" : "abertos"}
            </Pill>
          ) : (
            <Pill variant="neutral">{incidents.length}</Pill>
          )}
        </div>
        <Link
          href={`/operations/${operationId}/incidents/new`}
          className="inline-flex items-center gap-1.5 rounded font-medium px-2.5 py-1.5 text-xs bg-sage-bg text-sage-deep hover:bg-sage hover:text-bg transition-colors"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          Registrar incidente
        </Link>
      </div>

      <Card className="mb-4">
        {hasSLA ? (
          <p className="text-sm text-ink-soft">
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
              Promessa:
            </span>{" "}
            Resposta em até{" "}
            <span className="font-semibold">{formatHours(op.response_hours)}</span>{" "}
            · Resolução em até{" "}
            <span className="font-semibold">
              {formatHours(op.resolution_hours)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-mute italic">
            Sem SLA definido pra esta Operação.{" "}
            <Link
              href={`/operations/${operationId}/edit`}
              className="text-oak hover:underline not-italic"
            >
              Definir →
            </Link>
          </p>
        )}
      </Card>

      {incidents.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhum incidente registrado.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {incidents.map((i) => (
            <IncidentRow
              key={i.id}
              incident={i}
              op={op}
              operationId={operationId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function IncidentRow({
  incident,
  op,
  operationId,
}: {
  incident: IncidentListItem;
  op: OpSLAConfig;
  operationId: string;
}) {
  const breach = slaBreachLevel(
    {
      status: incident.status,
      opened_at: incident.openedAt,
      responded_at: incident.respondedAt,
      resolved_at: incident.resolvedAt,
    },
    op,
  );
  const breachPill = slaBreachPill(breach);

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
              incident.severity === "high"
                ? "bg-critical-bg text-critical"
                : incident.severity === "medium"
                  ? "bg-oak-50 text-oak"
                  : "bg-surface text-mute"
            }`}
          >
            <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/operations/${operationId}/incidents/${incident.id}/edit`}
                className="font-display text-base font-semibold text-ink hover:underline"
              >
                {incident.title}
              </Link>
              <Pill variant={SEVERITY_VARIANT[incident.severity]}>
                {SEVERITY_LABEL[incident.severity]}
              </Pill>
              <Pill variant={STATUS_VARIANT[incident.status]}>
                {STATUS_LABEL[incident.status]}
              </Pill>
              {breachPill && (
                <Pill variant={breachPill.variant}>{breachPill.text}</Pill>
              )}
            </div>
            <p className="font-mono text-[11px] text-mute">
              Aberto {formatDateTimeBR(incident.openedAt)} ·{" "}
              {relativeFromNow(incident.openedAt)}
              {incident.respondedAt && (
                <>
                  {" · resp. "}
                  {relativeFromNow(incident.respondedAt)}
                </>
              )}
              {incident.resolvedAt && (
                <>
                  {" · resolv. "}
                  {relativeFromNow(incident.resolvedAt)}
                </>
              )}
              {incident.openerEmail && <> · por {incident.openerEmail}</>}
            </p>
            {incident.description && (
              <p className="text-sm text-ink-soft whitespace-pre-wrap line-clamp-3">
                {incident.description}
              </p>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
