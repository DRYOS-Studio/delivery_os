"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbErr, err, ok } from "@/lib/actions/_types";
import { requireAdminAction, requireUserAction } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  WEBHOOK_URL_PROBLEM_MESSAGE,
  checkWebhookUrl,
} from "@/lib/notifications/webhook-url";

export async function upsertOperationN8nWebhookAction(
  clientId: string,
  operationId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserAction();
  if (!user.ok) return user;
  const admin = await requireAdminAction();
  if (!admin.ok) return admin;

  const urlRaw = ((formData.get("url") as string | null) ?? "").trim();
  if (urlRaw.length > 0) {
    const problem = checkWebhookUrl(urlRaw);
    if (problem) {
      return err(WEBHOOK_URL_PROBLEM_MESSAGE[problem], `validation_url`);
    }
  }

  const supabase = await createServer();
  const { data: op, error: opErr } = await supabase
    .from("operations")
    .select("id, client_id")
    .eq("id", operationId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (opErr) return dbErr(opErr, "upsertOperationN8nWebhook.select");
  if (!op) return err("Operação não encontrada.", "not_found");

  const { data: existing, error: findErr } = await supabase
    .from("client_tech_items")
    .select("id")
    .eq("operation_id", operationId)
    .eq("category", "n8n_webhook")
    .maybeSingle();
  if (findErr) return dbErr(findErr, "upsertOperationN8nWebhook.find");

  if (urlRaw.length === 0) {
    if (existing?.id) {
      const { error: delErr } = await supabase
        .from("client_tech_items")
        .delete()
        .eq("id", existing.id);
      if (delErr) return dbErr(delErr, "upsertOperationN8nWebhook.delete");
    }
    await supabase
      .from("operation_financials")
      .update({ notification_webhook_url: null })
      .eq("operation_id", operationId);
    revalidatePath(`/clients/${clientId}/ferramentas`);
    return ok({ id: operationId });
  }

  let itemId = existing?.id;
  if (itemId) {
    const { error: updErr } = await supabase
      .from("client_tech_items")
      .update({ url: urlRaw, name: "Webhook n8n", client_id: clientId })
      .eq("id", itemId);
    if (updErr) return dbErr(updErr, "upsertOperationN8nWebhook.update");
  } else {
    const { data: created, error: insErr } = await supabase
      .from("client_tech_items")
      .insert({
        client_id: clientId,
        operation_id: operationId,
        name: "Webhook n8n",
        category: "n8n_webhook",
        url: urlRaw,
        sort_order: -100,
      })
      .select("id")
      .single();
    if (insErr) return dbErr(insErr, "upsertOperationN8nWebhook.insert");
    itemId = created?.id;
  }

  await supabase.from("operation_financials").upsert(
    {
      operation_id: operationId,
      notification_webhook_url: urlRaw,
    },
    { onConflict: "operation_id" },
  );

  revalidatePath(`/clients/${clientId}/ferramentas`);
  revalidatePath(`/operations/${operationId}`);
  return ok({ id: itemId ?? operationId });
}
