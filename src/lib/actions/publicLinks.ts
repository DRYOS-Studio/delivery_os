"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";

export async function createPublicLinkAction(
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; token: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const labelRaw = ((formData.get("label") as string | null) ?? "").trim();
  const label = labelRaw.length > 0 ? labelRaw.slice(0, 200) : null;

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("public_links")
    .insert({ operation_id: operationId, label })
    .select("id, token")
    .single();
  if (error) return dbErr(error, "createPublicLinkAction");
  if (!data) return err("Falha ao criar link.", "no_data");

  revalidatePath(`/operations/${operationId}`);
  return ok({ id: data.id, token: data.token });
}

export async function revokePublicLinkAction(
  linkId: string,
): Promise<ActionResult<{ operationId: string }>> {
  const userResult = await requireUserAction();
  if (!userResult.ok) return userResult;

  const adminGuard = await requireAdminAction();
  if (!adminGuard.ok) return adminGuard;

  const supabase = await createServer();
  const { data: current, error: selErr } = await supabase
    .from("public_links")
    .select("operation_id")
    .eq("id", linkId)
    .maybeSingle();
  if (selErr) return dbErr(selErr, "revokePublicLinkAction.select");
  if (!current) return err("Link não encontrado.", "not_found");

  const { error } = await supabase
    .from("public_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) return dbErr(error, "revokePublicLinkAction");

  revalidatePath(`/operations/${current.operation_id}`);
  return ok({ operationId: current.operation_id });
}

