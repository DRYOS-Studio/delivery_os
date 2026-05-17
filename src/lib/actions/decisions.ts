"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getDecision } from "@/lib/db/queries/decisions";
import { getMeeting } from "@/lib/db/queries/meetings";
import {
  decisionSchema,
  type DecisionOutput,
} from "@/lib/validators/decision";

function parseFormData(formData: FormData) {
  return {
    title: ((formData.get("title") as string | null) ?? "").trim(),
    context: ((formData.get("context") as string | null) ?? "").trim(),
    decision: ((formData.get("decision") as string | null) ?? "").trim(),
    visibility: ((formData.get("visibility") as string | null) ?? "cliente").trim(),
    decided_at: ((formData.get("decided_at") as string | null) ?? "").trim(),
    meeting_id: ((formData.get("meeting_id") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = decisionSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

async function validateMeetingBelongsToOp(
  meetingId: string,
  operationId: string,
): Promise<ActionResult<true>> {
  const m = await getMeeting(meetingId);
  if (!m) return err("Reunião não encontrada.", "invalid_meeting");
  if (m.operation_id !== operationId)
    return err("Reunião não pertence a esta Operação.", "invalid_meeting");
  return ok(true);
}

export async function createDecisionAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validate(formData);
  if (!v.ok) return v;
  const data: DecisionOutput = v.data;

  if (data.meeting_id) {
    const check = await validateMeetingBelongsToOp(data.meeting_id, operationId);
    if (!check.ok) return check;
  }

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("decisions")
    .insert({
      operation_id: operationId,
      meeting_id: data.meeting_id ?? null,
      title: data.title,
      context: data.context ?? null,
      decision: data.decision,
      visibility: data.visibility,
      decided_at: data.decided_at,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createDecisionAction");
  if (!row) return err("Falha ao criar decisão.", "no_data");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: row.id, operationId });
}

export async function updateDecisionAction(
  decisionId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getDecision(decisionId);
  if (!current) return err("Decisão não encontrada.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data: DecisionOutput = v.data;

  if (data.meeting_id) {
    const check = await validateMeetingBelongsToOp(
      data.meeting_id,
      current.operation_id,
    );
    if (!check.ok) return check;
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("decisions")
    .update({
      meeting_id: data.meeting_id ?? null,
      title: data.title,
      context: data.context ?? null,
      decision: data.decision,
      visibility: data.visibility,
      decided_at: data.decided_at,
    })
    .eq("id", decisionId);
  if (error) return dbErr(error, "updateDecisionAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ id: decisionId, operationId: current.operation_id });
}

export async function deleteDecisionAction(
  decisionId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getDecision(decisionId);
  if (!current) return err("Decisão não encontrada.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("decisions")
    .delete()
    .eq("id", decisionId);
  if (error) return dbErr(error, "deleteDecisionAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}
