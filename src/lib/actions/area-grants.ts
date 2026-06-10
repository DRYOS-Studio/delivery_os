"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

const uuid = z.string().uuid();

function revalidateArea(areaId: string) {
  revalidatePath(`/admin/areas/${areaId}`);
  revalidatePath("/admin/areas");
}

export async function grantClientToAreaAction(
  areaId: string,
  clientId: string,
): Promise<ActionResult<{ areaId: string; clientId: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  if (!uuid.safeParse(areaId).success || !uuid.safeParse(clientId).success)
    return err("Dados inválidos.", "validation_failed");

  const supabase = await createServer();
  const { error } = await supabase
    .from("area_clients")
    .insert({ area_id: areaId, client_id: clientId, created_by: admin.data.user.id });
  if (error && error.code !== "23505") return dbErr(error, "grantClientToArea");

  revalidateArea(areaId);
  return ok({ areaId, clientId });
}

export async function revokeClientFromAreaAction(
  areaId: string,
  clientId: string,
): Promise<ActionResult<{ areaId: string; clientId: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { error } = await supabase
    .from("area_clients")
    .delete()
    .eq("area_id", areaId)
    .eq("client_id", clientId);
  if (error) return dbErr(error, "revokeClientFromArea");

  revalidateArea(areaId);
  return ok({ areaId, clientId });
}

export async function grantOperationToAreaAction(
  areaId: string,
  operationId: string,
): Promise<ActionResult<{ areaId: string; operationId: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;
  if (!uuid.safeParse(areaId).success || !uuid.safeParse(operationId).success)
    return err("Dados inválidos.", "validation_failed");

  const supabase = await createServer();
  const { error } = await supabase
    .from("area_operations")
    .insert({ area_id: areaId, operation_id: operationId, created_by: admin.data.user.id });
  if (error && error.code !== "23505") return dbErr(error, "grantOperationToArea");

  revalidateArea(areaId);
  return ok({ areaId, operationId });
}

export async function revokeOperationFromAreaAction(
  areaId: string,
  operationId: string,
): Promise<ActionResult<{ areaId: string; operationId: string }>> {
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const supabase = await createServer();
  const { error } = await supabase
    .from("area_operations")
    .delete()
    .eq("area_id", areaId)
    .eq("operation_id", operationId);
  if (error) return dbErr(error, "revokeOperationFromArea");

  revalidateArea(areaId);
  return ok({ areaId, operationId });
}
