import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/db/client";
import { dispatch } from "@/lib/notifications/dispatcher";
import { listStaleFrentesPendingNotification } from "@/lib/notifications/detectors/frente-stale";
import { listOpenSlaIncidentsPendingNotification } from "@/lib/notifications/detectors/sla-breach";
import {
  buildFrenteStalePayload,
  buildSlaBreachPayload,
} from "@/lib/notifications/payload";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  // Vercel Cron envia Authorization: Bearer <CRON_SECRET>
  if (auth === `Bearer ${secret}`) return true;
  // Defesa em profundidade: header proprietário do Vercel Cron
  if (req.headers.get("x-vercel-cron") === "1" && auth === `Bearer ${secret}`)
    return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdmin();

  // === 1. Frentes paradas ===
  let staleSuccess = 0;
  let staleFail = 0;
  let staleDetected = 0;
  try {
    const stale = await listStaleFrentesPendingNotification(supabase);
    staleDetected = stale.length;
    for (const f of stale) {
      const payload = buildFrenteStalePayload({
        operation: {
          id: f.operation_id,
          name: f.operation_name,
          client: { id: f.client_id, name: f.client_name },
        },
        frente: { id: f.frente_id, name: f.frente_name },
        context: {
          actionable_status: f.actionable_status,
          stale_days: f.stale_days,
        },
      });
      const result = await dispatch({
        webhookUrl: f.webhook_url,
        operationId: f.operation_id,
        subjectKind: "frente",
        subjectId: f.frente_id,
        payload,
        supabaseAdmin: supabase,
      });
      if (result.ok) staleSuccess++;
      else staleFail++;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "frente_stale detector failed",
        detail: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  // === 2. SLA incidents (safety net) ===
  let slaSuccess = 0;
  let slaFail = 0;
  let slaDetected = 0;
  try {
    const breached = await listOpenSlaIncidentsPendingNotification(supabase);
    slaDetected = breached.length;
    for (const b of breached) {
      const payload = buildSlaBreachPayload({
        operation: {
          id: b.operation_id,
          name: b.operation_name,
          client: { id: b.client_id, name: b.client_name },
        },
        incident: { id: b.incident_id, title: b.incident_title },
        context: {
          severity: b.severity,
          breach_kind: b.breach.kind,
          hours_elapsed: b.breach.hoursElapsed,
          hours_limit: b.breach.hoursLimit,
        },
      });
      const result = await dispatch({
        webhookUrl: b.webhook_url,
        operationId: b.operation_id,
        subjectKind: "sla_incident",
        subjectId: b.incident_id,
        payload,
        supabaseAdmin: supabase,
      });
      if (result.ok) slaSuccess++;
      else slaFail++;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "sla_breach detector failed",
        detail: e instanceof Error ? e.message : "unknown",
        partial: { stale: { detected: staleDetected, success: staleSuccess, failed: staleFail } },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    stale: { detected: staleDetected, success: staleSuccess, failed: staleFail },
    sla: { detected: slaDetected, success: slaSuccess, failed: slaFail },
  });
}
