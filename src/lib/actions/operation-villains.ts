"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getOperationVillain } from "@/lib/db/queries/operation-villains";
import {
  assignVillainSchema,
  editOperationVillainSchema,
  type AssignVillainOutput,
  type EditOperationVillainOutput,
} from "@/lib/validators/operation-villain";

type PostgresError = { code?: string; message: string };

function mapDbError(error: PostgresError) {
  if (error.code === "23505") {
    return err("Vilão já atribuído a esta Operação.", "already_assigned");
  }
  if (error.code === "23503") {
    return err("Vilão ou Operação inválidos.", "invalid_fk");
  }
  if (error.code === "23514") {
    if (error.message.includes("write-once") || error.message.includes("Inv. 07")) {
      return err(
        "Severidade inicial é write-once. Para mudar, remova e atribua novamente.",
        "severity_locked",
      );
    }
    return err("Valor inválido (CHECK).", "check_violation");
  }
  return null;
}

function parseAssign(formData: FormData) {
  return {
    villain_id: ((formData.get("villain_id") as string | null) ?? "").trim(),
    initial_severity: ((formData.get("initial_severity") as string | null) ?? "").trim(),
    progress_pct: ((formData.get("progress_pct") as string | null) ?? "0").trim(),
    evidence: ((formData.get("evidence") as string | null) ?? "").trim(),
  };
}

function parseEdit(formData: FormData) {
  return {
    progress_pct: ((formData.get("progress_pct") as string | null) ?? "0").trim(),
    evidence: ((formData.get("evidence") as string | null) ?? "").trim(),
  };
}

function validateAssign(formData: FormData) {
  const parsed = assignVillainSchema.safeParse(parseAssign(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function validateEdit(formData: FormData) {
  const parsed = editOperationVillainSchema.safeParse(parseEdit(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

export async function assignVillainAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const v = validateAssign(formData);
  if (!v.ok) return v;
  const data: AssignVillainOutput = v.data;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("operation_villains")
    .insert({
      operation_id: operationId,
      villain_id: data.villain_id,
      initial_severity: data.initial_severity,
      progress_pct: data.progress_pct,
      evidence: data.evidence ?? null,
    })
    .select("id")
    .single();
  if (error) {
    const mapped = mapDbError(error as PostgresError);
    if (mapped) return mapped;
    return dbErr(error, "assignVillainAction");
  }
  if (!row) return err("Falha ao atribuir vilão.", "no_data");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: row.id, operationId });
}

export async function updateOperationVillainAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getOperationVillain(id);
  if (!current) return err("Atribuição não encontrada.", "not_found");

  const v = validateEdit(formData);
  if (!v.ok) return v;
  const data: EditOperationVillainOutput = v.data;

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_villains")
    .update({
      progress_pct: data.progress_pct,
      evidence: data.evidence ?? null,
    })
    .eq("id", id);
  if (error) {
    const mapped = mapDbError(error as PostgresError);
    if (mapped) return mapped;
    return dbErr(error, "updateOperationVillainAction");
  }

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ id, operationId: current.operation_id });
}

export async function deleteOperationVillainAction(
  id: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const current = await getOperationVillain(id);
  if (!current) return err("Atribuição não encontrada.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_villains")
    .delete()
    .eq("id", id);
  if (error) return dbErr(error, "deleteOperationVillainAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}
