import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Webhook de notificação: por Operação ou fallback global (`NOTIFICATION_WEBHOOK_URL`).
 * Usado pelos detectores e pelo cron — mantém um único lugar pra regra.
 */
export function resolveOperationWebhook(
  operationWebhookUrl: string | null | undefined,
): string | null {
  const trimmed = (operationWebhookUrl ?? "").trim();
  if (trimmed.length > 0) return trimmed;
  const globalUrl = (process.env.NOTIFICATION_WEBHOOK_URL ?? "").trim();
  return globalUrl.length > 0 ? globalUrl : null;
}

/** Resolve URL persistida (stack n8n → coluna legada). Requer service_role ou RLS que permita RPC. */
export async function resolveOperationWebhookFromDb(
  supabase: SupabaseClient<Database>,
  operationId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    "resolve_operation_notification_webhook",
    { p_operation_id: operationId },
  );
  if (error) return null;
  return resolveOperationWebhook(
    typeof data === "string" ? data : null,
  );
}

/** Apenas o webhook global (resumo diário agregado). */
export function resolveGlobalDigestWebhook(): string | null {
  const globalUrl = (process.env.NOTIFICATION_WEBHOOK_URL ?? "").trim();
  return globalUrl.length > 0 ? globalUrl : null;
}
