import { createAdmin } from "@/lib/db/client";
import { alreadySent } from "./dedup";
import { detectSlaBreach } from "./detectors/sla-breach";
import { dispatch } from "./dispatcher";
import { buildSlaBreachPayload } from "./payload";

/**
 * Trigger síncrono pra SLA breach. Chamado pelas Server Actions de
 * incidente (create/update). Fire-and-forget: não bloqueia a UX da action.
 *
 * Faz tudo:
 * - carrega operation (com SLA hours + webhook url + client)
 * - roda detector
 * - checa dedup
 * - dispara
 *
 * Sempre retorna void — não lança, não bloqueia.
 */
export async function maybeNotifySlaBreach(incidentId: string): Promise<void> {
  try {
    const supabase = createAdmin();

    const { data: incident, error: e1 } = await supabase
      .from("sla_incidents")
      .select(
        `
        id, title, severity, status, opened_at, responded_at, resolved_at,
        operation:operations!inner (
          id, name, response_hours, resolution_hours,
          notification_webhook_url, archived_at,
          client:clients!inner ( id, name )
        )
      `,
      )
      .eq("id", incidentId)
      .maybeSingle();

    if (e1 || !incident) return;

    const op = Array.isArray(incident.operation)
      ? incident.operation[0]
      : incident.operation;
    if (!op || op.archived_at !== null) return;
    if (!op.notification_webhook_url) return;

    const client = Array.isArray(op.client) ? op.client[0] : op.client;
    if (!client) return;

    const breach = detectSlaBreach(incident, op);
    if (!breach) return;

    const recent = await alreadySent(supabase, {
      operation_id: op.id,
      event_type: "sla_breach",
      subject_id: incident.id,
    });
    if (recent) return;

    const payload = buildSlaBreachPayload({
      operation: {
        id: op.id,
        name: op.name,
        client: { id: client.id, name: client.name },
      },
      incident: { id: incident.id, title: incident.title },
      context: {
        severity: incident.severity,
        breach_kind: breach.kind,
        hours_elapsed: breach.hoursElapsed,
        hours_limit: breach.hoursLimit,
      },
    });

    await dispatch({
      webhookUrl: op.notification_webhook_url,
      operationId: op.id,
      subjectKind: "sla_incident",
      subjectId: incident.id,
      payload,
      supabaseAdmin: supabase,
    });
  } catch {
    // Notificação nunca quebra fluxo principal. Silenciado de propósito.
  }
}
