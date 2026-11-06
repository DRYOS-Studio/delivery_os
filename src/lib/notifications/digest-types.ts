/** Shape enviado em `NotificationPayload` quando `event === "daily_digest"`. */

export const DAILY_DIGEST_DUE_SOON_DAYS = 3;
export const DAILY_DIGEST_STALE_DAYS = 7;

export type DailyDigestData = {
  generated_at: string;
  summary: {
    tasks_overdue: number;
    tasks_due_soon: number;
    frentes_stale: number;
    sla_breaches: number;
  };
  clients: Array<{
    client: { id: string; name: string };
    operations: Array<{
      operation: { id: string; name: string };
      tasks_overdue: Array<{ id: string; title: string; due_date: string | null }>;
      tasks_due_soon: Array<{ id: string; title: string; due_date: string | null }>;
      frentes_stale: Array<{
        id: string;
        name: string;
        actionable_status: string;
        stale_days: number;
      }>;
      sla_incidents: Array<{
        id: string;
        title: string;
        severity: string;
        breach_kind: "response" | "resolution";
        hours_elapsed: number;
        hours_limit: number;
      }>;
    }>;
  }>;
};
