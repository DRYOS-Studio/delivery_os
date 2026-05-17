import { AlertTriangle } from "lucide-react";
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

export function PublicSLAList({
  incidents,
  op,
}: {
  incidents: IncidentListItem[];
  op: OpSLAConfig;
}): React.JSX.Element {
  const hasSLA = op.response_hours !== null || op.resolution_hours !== null;
  if (!hasSLA && incidents.length === 0) {
    return <></>;
  }

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          SLA &amp; incidentes
        </h2>
        <Pill variant="neutral">{incidents.length}</Pill>
      </div>

      {hasSLA && (
        <Card className="mb-4">
          <p className="text-sm text-ink-soft">
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
              Compromisso:
            </span>{" "}
            Resposta em até{" "}
            <span className="font-semibold">
              {formatHours(op.response_hours)}
            </span>{" "}
            · Resolução em até{" "}
            <span className="font-semibold">
              {formatHours(op.resolution_hours)}
            </span>
          </p>
        </Card>
      )}

      {incidents.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhum incidente registrado.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {incidents.map((i) => (
            <Row key={i.id} incident={i} op={op} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  incident,
  op,
}: {
  incident: IncidentListItem;
  op: OpSLAConfig;
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
              <span className="font-display text-base font-semibold text-ink">
                {incident.title}
              </span>
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
