"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { getClientAcquisitionCost } from "@/lib/db/queries/client-acquisition-costs";
import { clientAcquisitionCostFormSchema } from "@/lib/validators/client-acquisition-cost";

function revalidateCacPaths(clientId: string): void {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/cac`);
}

function parseForm(formData: FormData) {
  return {
    spent_on: ((formData.get("spent_on") as string | null) ?? "").trim(),
    description: ((formData.get("description") as string | null) ?? "").trim(),
    category: ((formData.get("category") as string | null) ?? "").trim(),
    amount: ((formData.get("amount") as string | null) ?? "").trim(),
  };
}

export async function createClientAcquisitionCostAction(
  clientId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const parsed = clientAcquisitionCostFormSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Dados inválidos.", "validation_form");
  }

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_acquisition_costs")
    .insert({
      client_id: clientId,
      spent_on: parsed.data.spent_on,
      description: parsed.data.description,
      category: parsed.data.category,
      amount: parsed.data.amount,
    })
    .select("id")
    .single();
  if (error) return dbErr(error, "createClientAcquisitionCostAction");
  if (!data) return err("Falha ao criar.", "no_data");
  revalidateCacPaths(clientId);
  return ok({ id: data.id });
}

export async function updateClientAcquisitionCostAction(
  clientId: string,
  itemId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const existing = await getClientAcquisitionCost(itemId);
  if (!existing || existing.clientId !== clientId) {
    return err("Item não encontrado.", "not_found");
  }

  const parsed = clientAcquisitionCostFormSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return err(first?.message ?? "Dados inválidos.", "validation_form");
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_acquisition_costs")
    .update({
      spent_on: parsed.data.spent_on,
      description: parsed.data.description,
      category: parsed.data.category,
      amount: parsed.data.amount,
    })
    .eq("id", itemId);
  if (error) return dbErr(error, "updateClientAcquisitionCostAction");
  revalidateCacPaths(clientId);
  return ok({ id: itemId });
}

export async function deleteClientAcquisitionCostAction(
  clientId: string,
  itemId: string,
): Promise<ActionResult<{ id: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const existing = await getClientAcquisitionCost(itemId);
  if (!existing || existing.clientId !== clientId) {
    return err("Item não encontrado.", "not_found");
  }

  const supabase = await createServer();
  const { error } = await supabase
    .from("client_acquisition_costs")
    .delete()
    .eq("id", itemId);
  if (error) return dbErr(error, "deleteClientAcquisitionCostAction");
  revalidateCacPaths(clientId);
  return ok({ id: itemId });
}
