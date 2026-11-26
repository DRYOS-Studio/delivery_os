/** Log estruturado em Server Components/loaders — sem PII nem segredos. */

function firstStackLines(stack: string | undefined, max = 6): string[] {
  if (!stack?.trim()) return [];
  return stack
    .split("\n")
    .slice(0, max)
    .map((l) => l.trim());
}

export function logRouteError(
  route: string,
  error: unknown,
  extra?: Record<string, string | undefined>,
): void {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "unknown_error");
  const payload = {
    kind: "route_error",
    route,
    digest: (err as Error & { digest?: string }).digest ?? undefined,
    message: err.message,
    stack_head: firstStackLines(err.stack),
    ...extra,
  };
  console.error(JSON.stringify(payload));
}