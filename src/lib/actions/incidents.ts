"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getIncident } from "@/lib/db/queries/incidents";
import { maybeNotifySlaBreach } from "@/lib/notifications/triggers";
import {
  incidentSchema,
  type IncidentOutput,
} from "@/lib/validators/incident";

function parseFormData(formData: FormData) {
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    severity: ((formData.get("severity") as string | null) ?? "medium").trim(),
    status: ((formData.get("status") as string | null) ?? "open").trim(),
    opened_at: ((formData.get("opened_at") as string | null) ?? "").trim(),
    responded_at: ((formData.get("responded_at") as string | null) ?? "").trim(),
    resolved_at: ((formData.get("resolved_at") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = incidentSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

export async function createIncidentAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const userId = userResult.data.id;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: IncidentOutput = v.data;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("sla_incidents")
    .insert({
      operation_id: operationId,
      title: data.title,
      description: data.description ?? null,
      severity: data.severity,
      status: data.status,
      opened_at: data.opened_at,
      responded_at: data.responded_at ?? null,
      resolved_at: data.resolved_at ?? null,
      opened_by: userId,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createIncidentAction");
  if (!row) return err("Falha ao criar incidente.", "no_data");

  // Fire-and-forget: notifica se já nasceu em breach
  void maybeNotifySlaBreach(row.id);

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: row.id, operationId });
}

export async function updateIncidentAction(
  incidentId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getIncident(incidentId);
  if (!current) return err("Incidente não encontrado.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data: IncidentOutput = v.data;

  const supabase = await createServer();
  const { error } = await supabase
    .from("sla_incidents")
    .update({
      title: data.title,
      description: data.description ?? null,
      severity: data.severity,
      status: data.status,
      opened_at: data.opened_at,
      responded_at: data.responded_at ?? null,
      resolved_at: data.resolved_at ?? null,
    })
    .eq("id", incidentId);
  if (error) return dbErr(error, "updateIncidentAction");

  // Fire-and-forget: dispara se o update deixou o incidente em breach
  void maybeNotifySlaBreach(incidentId);

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ id: incidentId, operationId: current.operation_id });
}

export async function deleteIncidentAction(
  incidentId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const current = await getIncident(incidentId);
  if (!current) return err("Incidente não encontrado.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("sla_incidents")
    .delete()
    .eq("id", incidentId);
  if (error) return dbErr(error, "deleteIncidentAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}
