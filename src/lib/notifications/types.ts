/**
 * Tipos do contrato de notificação outbound (v1).
 *
 * App POSTa esse JSON pra n8n. n8n consome o shape único e traduz pro Discord
 * (ou outro destino) no fluxo do cliente. Versionado via `v` pra evolução
 * futura sem quebrar n8n existente.
 */

import type { DailyDigestData } from "./digest-types";

export type NotificationEvent = "frente_stale" | "sla_breach" | "daily_digest";

export type SubjectKind = "frente" | "sla_incident" | "daily_digest";

export type FrenteStaleContext = {
  actionable_status: string;
  stale_days: number;
};

export type SlaBreachContext = {
  severity: "low" | "medium" | "high";
  breach_kind: "response" | "resolution";
  hours_elapsed: number;
  hours_limit: number;
};

export type NotificationContext = FrenteStaleContext | SlaBreachContext;

export type NotificationPayload =
  | {
      event: "frente_stale" | "sla_breach";
      v: 1;
      operation: {
        id: string;
        name: string;
        client: {
          id: string;
          name: string;
        };
      };
      subject: {
        kind: Exclude<SubjectKind, "daily_digest">;
        id: string;
        name: string;
      };
      context: NotificationContext;
      url: string;
      ts: string;
    }
  | {
      event: "daily_digest";
      v: 1;
      digest: DailyDigestData;
      window: {
        due_soon_days: number;
        stale_days_threshold: number;
        timezone: string;
      };
      ts: string;
    };
