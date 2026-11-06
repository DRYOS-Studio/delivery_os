import type { DailyDigestData } from "./digest-types";
import { DAILY_DIGEST_DUE_SOON_DAYS, DAILY_DIGEST_STALE_DAYS } from "./digest-types";
import type {
  FrenteStaleContext,
  NotificationPayload,
  SlaBreachContext,
} from "./types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://delivery-os-phi.vercel.app";

type OperationLite = {
  id: string;
  name: string;
  client: {
    id: string;
    name: string;
  };
};

export function buildFrenteStalePayload(input: {
  operation: OperationLite;
  frente: { id: string; name: string };
  context: FrenteStaleContext;
}): NotificationPayload {
  return {
    event: "frente_stale",
    v: 1,
    operation: input.operation,
    subject: { kind: "frente", id: input.frente.id, name: input.frente.name },
    context: input.context,
    url: `${APP_URL}/operations/${input.operation.id}/frentes/${input.frente.id}`,
    ts: new Date().toISOString(),
  };
}

export function buildSlaBreachPayload(input: {
  operation: OperationLite;
  incident: { id: string; title: string };
  context: SlaBreachContext;
}): NotificationPayload {
  return {
    event: "sla_breach",
    v: 1,
    operation: input.operation,
    subject: {
      kind: "sla_incident",
      id: input.incident.id,
      name: input.incident.title,
    },
    context: input.context,
    url: `${APP_URL}/operations/${input.operation.id}`,
    ts: new Date().toISOString(),
  };
}

export function buildDailyDigestPayload(digest: DailyDigestData): NotificationPayload {
  return {
    event: "daily_digest",
    v: 1,
    digest,
    window: {
      due_soon_days: DAILY_DIGEST_DUE_SOON_DAYS,
      stale_days_threshold: DAILY_DIGEST_STALE_DAYS,
      timezone: "America/Sao_Paulo",
    },
    ts: new Date().toISOString(),
  };
}
