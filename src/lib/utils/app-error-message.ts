/** Mensagens de `throw new Error('queryFn: …')` — seguras para exibir na UI. */
const APP_QUERY_ERROR = /^[a-z][a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*: /;

export function isSafeAppErrorMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return APP_QUERY_ERROR.test(message);
}

export function appErrorDetail(
  message: string | undefined,
  digest: string | undefined,
): string | null {
  if (process.env.NODE_ENV === "development" && message?.trim()) {
    return message;
  }
  if (isSafeAppErrorMessage(message)) {
    return message ?? null;
  }
  if (digest) {
    return `Referência: ${digest}`;
  }
  return null;
}
