/** Mensagens de `throw new Error('queryFn: …')` — seguras para exibir na UI. */
const APP_QUERY_ERROR = /^[a-z][a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*: /;

const CLIENT_OR_HYDRATION = [
  /hydration/i,
  /Minified React error/i,
  /Text content does not match/i,
  /did not match\. Server:/i,
  /There was an error while hydrating/i,
  /use client/i,
];

export function isSafeAppErrorMessage(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return APP_QUERY_ERROR.test(message);
}

export function isClientOrHydrationError(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  return CLIENT_OR_HYDRATION.some((re) => re.test(message));
}

export function formatErrorStackHead(
  stack: string | undefined,
  maxLines = 8,
): string | null {
  if (!stack?.trim()) return null;
  const lines = stack
    .split("\n")
    .slice(0, maxLines)
    .map((l) => l.trim());
  return lines.join("\n");
}

export type AppErrorDisplay = {
  /** Sempre exibido quando existir (produção). */
  digestLine: string | null;
  detailLine: string | null;
  technicalBlock: string | null;
};

export function buildAppErrorDisplay(
  message: string | undefined,
  digest: string | undefined,
  stack: string | undefined,
  opts: { isAdmin: boolean },
): AppErrorDisplay {
  const digestLine = digest?.trim() ? `Referência: ${digest.trim()}` : null;

  let detailLine: string | null = null;
  let technicalBlock: string | null = null;

  if (process.env.NODE_ENV === "development" && message?.trim()) {
    detailLine = message;
    technicalBlock = formatErrorStackHead(stack);
  } else if (isSafeAppErrorMessage(message)) {
    detailLine = message ?? null;
  } else if (isClientOrHydrationError(message) || opts.isAdmin) {
    if (message?.trim()) detailLine = message;
    technicalBlock = formatErrorStackHead(stack);
  }

  return { digestLine, detailLine, technicalBlock };
}

/** @deprecated Preferir `buildAppErrorDisplay` — mantido para testes legados. */
export function appErrorDetail(
  message: string | undefined,
  digest: string | undefined,
): string | null {
  const { digestLine, detailLine } = buildAppErrorDisplay(
    message,
    digest,
    undefined,
    { isAdmin: false },
  );
  if (detailLine) return detailLine;
  return digestLine;
}