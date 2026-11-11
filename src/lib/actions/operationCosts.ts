"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  getOperationCost,
  voidOperationCost,
} from "@/lib/db/queries/operation-costs";
import {
  operationCostCreateSchema,
  operationCostSchema,
  type OperationCostOutput,
} from "@/lib/validators/operationCost";

function parseFormData(formData: FormData) {
  return {
    category: ((formData.get("category") as string | null) ?? "time").trim(),
    label: ((formData.get("label") as string | null) ?? "").trim(),
    amount: ((formData.get("amount") as string | null) ?? "").trim(),
    commission_percent: (
      (formData.get("commission_percent") as string | null) ?? ""
    ).trim(),
    recurrence: ((formData.get("recurrence") as string | null) ?? "mensal").trim(),
    started_at: ((formData.get("started_at") as string | null) ?? "").trim(),
    ended_at: ((formData.get("ended_at") as string | null) ?? "").trim(),
    notes: ((formData.get("notes") as string | null) ?? "").trim(),
  };
}

function validate(
  formData: FormData,
  mode: "create" | "edit",
): ActionResult<OperationCostOutput> {
  const raw = parseFormData(formData);
  const parsed = (mode === "create"
    ? operationCostCreateSchema
    : operationCostSchema
  ).safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.message ?? "Dados inválidos.";
    const field = (first?.path[0] as string | undefined) ?? "validation";
    return err(message, `validation_${field}`);
  }
  return ok(parsed.data);
}

function rowFromValidated(data: OperationCostOutput): {
  category: OperationCostOutput["category"];
  label: string;
  amount: number | null;
  commission_percent: number | null;
  recurrence: OperationCostOutput["recurrence"];
  started_at: string;
  ended_at: string | null;
  notes: string | null;
} {
  const isPercentCommission =
    data.category === "comissoes" &&
    "commission_percent" in data &&
    data.commission_percent !== undefined;
  const amount =
    "amount" in data && data.amount !== undefined ? data.amount : null;
  return {
    category: data.category,
    label: data.label,
    amount: isPercentCommission ? null : amount,
    commission_percent: isPercentCommission ? data.commission_percent : null,
    recurrence: data.recurrence,
    started_at: data.started_at,
    ended_at: data.ended_at ?? null,
    notes: data.notes ?? null,
  };
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

  const v = validate(formData, "create");
  if (!v.ok) return v;
  const row = rowFromValidated(v.data);

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_costs")
    .insert({
      operation_id: operationId,
      category: row.category,
      label: row.label,
      amount: row.amount,
      commission_percent: row.commission_percent,
      recurrence: row.recurrence,
      started_at: row.started_at,
      ended_at: row.ended_at,
      notes: row.notes,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createOperationCostAction");
  if (!data) return err("Falha ao criar custo.", "no_data");

  await revalidateForOp(operationId);
  return ok({ id: data.id, operationId });
}

export async function updateOperationCostAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const current = await getOperationCost(id);
  if (!current) return err("Custo não encontrado.", "not_found");

  const v = validate(formData, "edit");
  if (!v.ok) return v;
  const row = rowFromValidated(v.data);

  const supabase = await createServer();
  const { error } = await supabase
    .from("operation_costs")
    .update({
      category: row.category,
      label: row.label,
      amount: row.amount,
      commission_percent: row.commission_percent,
      recurrence: row.recurrence,
      started_at: row.started_at,
      ended_at: row.ended_at,
      notes: row.notes,
    })
    .eq("id", id);
  if (error) return dbErr(error, "updateOperationCostAction");

  await revalidateForOp(current.operationId);
  return ok({ id, operationId: current.operationId });
}

export async function voidOperationCostAction(
  id: string,
  formData?: FormData,
): Promise<ActionResult<{ id: string; operationId: string }>> {
  const guard = await requireAdminAction();
  if (!guard.ok) return guard;

  const current = await getOperationCost(id);
  if (!current) return err("Custo não encontrado.", "not_found");

  const rawReason = formData?.get("void_reason");
  const reason = typeof rawReason === "string" ? rawReason : "";

  try {
    const { operationId } = await voidOperationCost(id, reason || null);
    await revalidateForOp(operationId);
    return ok({ id, operationId });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falha ao remover lançamento.";
    if (message.includes("not_found_or_already_voided")) {
      return err("Lançamento não encontrado ou já removido.", "not_found");
    }
    return err(message, "void_failed");
  }
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
