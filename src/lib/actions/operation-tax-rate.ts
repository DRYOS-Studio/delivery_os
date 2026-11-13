"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getOperation } from "@/lib/db/queries/operations";
import { operationTaxRateSchema } from "@/lib/validators/operation-tax-rate";

export async function updateOperationTaxRateAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const op = await getOperation(operationId);
  if (!op) return err("Operação não encontrada.", "not_found");

  const raw = (formData.get("tax_rate_pct") as string | null) ?? "";
  const parsed = operationTaxRateSchema.safeParse({
    tax_rate_pct: raw === "" ? null : raw,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Alíquota inválida.", "validation_form");
  }

  const supabase = await createServer();
  const { error } = await supabase.from("operation_financials").upsert(
      {
        operation_id: operationId,
        tax_rate_pct: parsed.data.tax_rate_pct,
      },
      { onConflict: "operation_id" },
    );
  if (error) return dbErr(error, "updateOperationTaxRateAction");

  revalidatePath(`/operations/${operationId}`);
  revalidatePath(`/operations/${operationId}/costs/tax`);
  return ok({ id: operationId });
}
