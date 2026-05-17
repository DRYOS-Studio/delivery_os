import type { PillVariant } from "@/components/ui/Pill";

export type BreachLevel =
  | "ok"
  | "approaching"
  | "response_breach"
  | "resolution_breach";

export type IncidentForBreach = {
  status: "open" | "responded" | "resolved" | "cancelled";
  opened_at: string;
  responded_at: string | null;
  resolved_at: string | null;
};

export type OpSLAConfig = {
  response_hours: number | null;
  resolution_hours: number | null;
};

const APPROACH_RATIO = 0.75;

function hoursDiff(later: string, earlier: string): number {
  const a = new Date(later).getTime();
  const b = new Date(earlier).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return (a - b) / 3_600_000;
}

export function slaBreachLevel(
  incident: IncidentForBreach,
  op: OpSLAConfig,
): BreachLevel {
  if (incident.status === "cancelled") return "ok";

  const now = new Date().toISOString();

  // Resolution check (resolved or open-counting-up)
  if (op.resolution_hours !== null) {
    const refResolved = incident.resolved_at ?? now;
    if (
      incident.status !== "responded" ||
      incident.resolved_at !== null
    ) {
      const elapsed = hoursDiff(refResolved, incident.opened_at);
      if (elapsed > op.resolution_hours) return "resolution_breach";
    } else {
      // status responded sem resolved_at: ainda pode resolver dentro do prazo
      const elapsed = hoursDiff(now, incident.opened_at);
      if (elapsed > op.resolution_hours) return "resolution_breach";
    }
  }

  // Response check (responded or open-counting-up)
  if (op.response_hours !== null) {
    const refResponded = incident.responded_at ?? now;
    const elapsed = hoursDiff(refResponded, incident.opened_at);
    if (elapsed > op.response_hours) return "response_breach";
  }

  // Approaching check: only for incidents still in flight (open/responded without resolved)
  if (incident.status === "open" && op.response_hours !== null) {
    const elapsed = hoursDiff(now, incident.opened_at);
    if (elapsed > op.response_hours * APPROACH_RATIO) return "approaching";
  }
  if (
    incident.status === "responded" &&
    incident.resolved_at === null &&
    op.resolution_hours !== null
  ) {
    const elapsed = hoursDiff(now, incident.opened_at);
    if (elapsed > op.resolution_hours * APPROACH_RATIO) return "approaching";
  }

  return "ok";
}

export function slaBreachPill(
  level: BreachLevel,
): { text: string; variant: PillVariant } | null {
  if (level === "ok") return null;
  if (level === "approaching")
    return { text: "Próximo do limite", variant: "warning" };
  if (level === "response_breach")
    return { text: "Resposta atrasada", variant: "critical" };
  return { text: "Resolução atrasada", variant: "critical" };
}

export function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rest = h % 24;
  if (rest === 0) return `${days}d`;
  return `${days}d ${rest}h`;
}
