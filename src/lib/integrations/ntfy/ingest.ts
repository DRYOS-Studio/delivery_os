import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  appendOccurrenceNote,
  buildIncidentTitle,
  dedupeKeyForTopic,
  isRecoveryMessage,
  ntfyTimeToIso,
} from "@/lib/integrations/ntfy/ingest-core";
import { mapNtfyPriorityToSeverity } from "@/lib/integrations/ntfy/severity-map";
import {
  ntfyIngestMessageSchema,
  type NtfyIngestMessage,
  type NtfyIngestOutcome,
  type NtfyTopicMapping,
} from "@/lib/integrations/ntfy/types";
import { maybeNotifySlaBreach } from "@/lib/notifications/triggers";

export type NtfyIngestResult = {
  outcome: NtfyIngestOutcome;
  ntfyMessageId: string;
  incidentId?: string;
  unmappedAlertId?: string;
  operationId?: string;
};

type AdminClient = SupabaseClient<Database>;

async function loadMapping(
  admin: AdminClient,
  topic: string,
): Promise<NtfyTopicMapping | null> {
  const { data, error } = await admin
    .from("operation_ntfy_topics")
    .select(
      "operation_id, topic, recovery_tags, default_problem_origin, priority_severity_map",
    )
    .eq("topic", topic)
    .maybeSingle();
  if (error) throw new Error(`loadMapping: ${error.message}`);
  if (!data) return null;
  const recovery = Array.isArray(data.recovery_tags)
    ? (data.recovery_tags as string[])
    : ["resolved", "recovery"];
  const map =
    data.priority_severity_map &&
    typeof data.priority_severity_map === "object" &&
    !Array.isArray(data.priority_severity_map)
      ? (data.priority_severity_map as Record<string, string>)
      : undefined;
  return {
    operation_id: data.operation_id,
    topic: data.topic,
    recovery_tags: recovery,
    default_problem_origin: data.default_problem_origin,
    priority_severity_map: map ?? {},
  };
}

async function findOpenIncidentForDedupe(
  admin: AdminClient,
  operationId: string,
  topic: string,
  dedupeKey: string,
): Promise<{ id: string; description: string | null; occurrence_count: number } | null> {
  const { data, error } = await admin
    .from("sla_incidents")
    .select("id, description, occurrence_count")
    .eq("operation_id", operationId)
    .eq("ntfy_topic", topic)
    .eq("dedupe_key", dedupeKey)
    .in("status", ["open", "responded"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findOpenIncidentForDedupe: ${error.message}`);
  return data;
}

async function recordReceipt(
  admin: AdminClient,
  params: {
    ntfyMessageId: string;
    topic: string;
    receivedAt: string;
    outcome: Exclude<NtfyIngestOutcome, "duplicate">;
    payload: NtfyIngestMessage;
    incidentId?: string;
    unmappedAlertId?: string;
  },
): Promise<void> {
  const { error } = await admin.from("ntfy_message_receipts").insert({
    ntfy_message_id: params.ntfyMessageId,
    topic: params.topic,
    received_at: params.receivedAt,
    outcome: params.outcome,
    payload: params.payload as unknown as Database["public"]["Tables"]["ntfy_message_receipts"]["Insert"]["payload"],
    incident_id: params.incidentId ?? null,
    unmapped_alert_id: params.unmappedAlertId ?? null,
  });
  if (error) throw new Error(`recordReceipt: ${error.message}`);
}

export async function ingestNtfyMessage(
  admin: AdminClient,
  raw: unknown,
): Promise<NtfyIngestResult> {
  const parsed = ntfyIngestMessageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload ntfy inválido.");
  }
  const msg = parsed.data;
  const receivedAt = ntfyTimeToIso(msg.time);

  const { data: existing } = await admin
    .from("ntfy_message_receipts")
    .select("ntfy_message_id, incident_id, unmapped_alert_id, outcome")
    .eq("ntfy_message_id", msg.id)
    .maybeSingle();

  if (existing) {
    const dup: NtfyIngestResult = {
      outcome: "duplicate",
      ntfyMessageId: msg.id,
    };
    if (existing.incident_id) dup.incidentId = existing.incident_id;
    if (existing.unmapped_alert_id) {
      dup.unmappedAlertId = existing.unmapped_alert_id;
    }
    return dup;
  }

  const mapping = await loadMapping(admin, msg.topic);

  if (!mapping) {
    const { data: unmapped, error: unmappedErr } = await admin
      .from("ntfy_unmapped_alerts")
      .insert({
        ntfy_message_id: msg.id,
        topic: msg.topic,
        title: msg.title ?? null,
        message: msg.message ?? null,
        priority:
          typeof msg.priority === "number"
            ? msg.priority
            : msg.priority !== undefined
              ? Number.parseInt(String(msg.priority), 10) || null
              : null,
        tags: msg.tags ?? null,
        received_at: receivedAt,
        payload: msg as unknown as Database["public"]["Tables"]["ntfy_unmapped_alerts"]["Insert"]["payload"],
      })
      .select("id")
      .single();
    if (unmappedErr) throw new Error(`unmapped insert: ${unmappedErr.message}`);
    await recordReceipt(admin, {
      ntfyMessageId: msg.id,
      topic: msg.topic,
      receivedAt,
      outcome: "unmapped",
      payload: msg,
      unmappedAlertId: unmapped.id,
    });
    return {
      outcome: "unmapped",
      ntfyMessageId: msg.id,
      unmappedAlertId: unmapped.id,
    };
  }

  const dedupeKey = dedupeKeyForTopic(msg.topic);
  const recovery = isRecoveryMessage(msg.tags, mapping.recovery_tags);

  if (recovery) {
    const open = await findOpenIncidentForDedupe(
      admin,
      mapping.operation_id,
      msg.topic,
      dedupeKey,
    );
    if (!open) {
      await recordReceipt(admin, {
        ntfyMessageId: msg.id,
        topic: msg.topic,
        receivedAt,
        outcome: "ignored_recovery",
        payload: msg,
      });
      return { outcome: "ignored_recovery", ntfyMessageId: msg.id };
    }
    const closedVia = `ntfy:tag:${(msg.tags ?? []).join(",")}`;
    const { error: updErr } = await admin
      .from("sla_incidents")
      .update({
        status: "resolved",
        responded_at: receivedAt,
        resolved_at: receivedAt,
        closed_via: closedVia,
        ntfy_last_message_id: msg.id,
      })
      .eq("id", open.id);
    if (updErr) throw new Error(`recovery update: ${updErr.message}`);
    await recordReceipt(admin, {
      ntfyMessageId: msg.id,
      topic: msg.topic,
      receivedAt,
      outcome: "recovered",
      payload: msg,
      incidentId: open.id,
    });
    return {
      outcome: "recovered",
      ntfyMessageId: msg.id,
      incidentId: open.id,
      operationId: mapping.operation_id,
    };
  }

  const open = await findOpenIncidentForDedupe(
    admin,
    mapping.operation_id,
    msg.topic,
    dedupeKey,
  );

  if (open) {
    const newCount = (open.occurrence_count ?? 1) + 1;
    const description = appendOccurrenceNote(
      open.description,
      receivedAt,
      msg.message,
    );
    const { error: dedupeErr } = await admin
      .from("sla_incidents")
      .update({
        occurrence_count: newCount,
        last_occurrence_at: receivedAt,
        ntfy_last_message_id: msg.id,
        description,
        severity: mapNtfyPriorityToSeverity(
          msg.priority,
          mapping.priority_severity_map,
        ),
      })
      .eq("id", open.id);
    if (dedupeErr) throw new Error(`dedupe update: ${dedupeErr.message}`);
    await recordReceipt(admin, {
      ntfyMessageId: msg.id,
      topic: msg.topic,
      receivedAt,
      outcome: "deduped",
      payload: msg,
      incidentId: open.id,
    });
    void maybeNotifySlaBreach(open.id);
    return {
      outcome: "deduped",
      ntfyMessageId: msg.id,
      incidentId: open.id,
      operationId: mapping.operation_id,
    };
  }

  const severity = mapNtfyPriorityToSeverity(
    msg.priority,
    mapping.priority_severity_map,
  );
  const title = buildIncidentTitle(msg);
  const { data: created, error: createErr } = await admin
    .from("sla_incidents")
    .insert({
      operation_id: mapping.operation_id,
      title,
      description: msg.message?.trim() || null,
      severity,
      status: "open",
      opened_at: receivedAt,
      source: "ntfy",
      problem_origin: mapping.default_problem_origin,
      ntfy_topic: msg.topic,
      dedupe_key: dedupeKey,
      occurrence_count: 1,
      last_occurrence_at: receivedAt,
      ntfy_last_message_id: msg.id,
    })
    .select("id")
    .single();
  if (createErr) throw new Error(`create incident: ${createErr.message}`);
  if (!created) throw new Error("create incident: no data");

  await recordReceipt(admin, {
    ntfyMessageId: msg.id,
    topic: msg.topic,
    receivedAt,
    outcome: "created",
    payload: msg,
    incidentId: created.id,
  });
  void maybeNotifySlaBreach(created.id);

  return {
    outcome: "created",
    ntfyMessageId: msg.id,
    incidentId: created.id,
    operationId: mapping.operation_id,
  };
}
