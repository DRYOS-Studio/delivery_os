"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getOperationCost } from "@/lib/db/queries/operation-costs";
import { operationCostSchema } from "@/lib/validators/operationCost";

function parseFormData(formData: FormData) {
  return {
    label: ((formData.get("label") as string | null) ?? "").trim(),
    amount: ((formData.get("amount") as string | null) ?? "").trim(),
    recurrence: ((formData.get("recurrence") as string | null) ?? "mensal").trim(),
    started_at: ((formData.get("started_at") as string | null) ?? "").trim(),
    ended_at: ((formData.get("ended_at") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

function validate(formData: FormData) {
  const parsed = operationCostSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

async function revalidateForOp(operationId: string) {
  revalidatePath(`/operations/${operationId}`);
  revalidatePath("/admin/dashboard");
}

export async function createOperationCostAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("operation_costs")
    .insert({
      operation_id: operationId,
      label: data.label,
      amount: data.amount,
      recurrence: data.recurrence,
      started_at: data.started_at,
      ended_at: data.ended_at ?? null,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createOperationCostAction");
  if (!row) return err("Falha ao criar custo.", "no_data");

  await revalidateForOp(operationId);
  return ok({ id: row.id, operationId });
}

export async function updateOperationCostAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const current = await getOperationCost(id);
  if (!current) return err("Custo não encontrado.", "not_found");

  const v = validate(formData);
  if (!v.ok) return v;
  const data = v.data;

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_costs")
    .update({
      label: data.label,
      amount: data.amount,
      recurrence: data.recurrence,
      started_at: data.started_at,
      ended_at: data.ended_at ?? null,
      notes: data.notes ?? null,
    })
    .eq("id", id);
  if (error) return dbErr(error, "updateOperationCostAction");

  await revalidateForOp(current.operationId);
  return ok({ id, operationId: current.operationId });
}

export async function deleteOperationCostAction(
  id: string,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const current = await getOperationCost(id);
  if (!current) return err("Custo não encontrado.", "not_found");

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_costs")
    .delete()
    .eq("id", id);
  if (error) return dbErr(error, "deleteOperationCostAction");

  await revalidateForOp(current.operationId);
  return ok({ id, operationId: current.operationId });
}
