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

/** Apenas o webhook global (resumo diário agregado). */
export function resolveGlobalDigestWebhook(): string | null {
  const globalUrl = (process.env.NOTIFICATION_WEBHOOK_URL ?? "").trim();
  return globalUrl.length > 0 ? globalUrl : null;
}
