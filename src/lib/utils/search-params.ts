/** Normaliza query string do App Router (valor pode ser string | string[]). */
export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export type NewMeetingSearchParams = {
  defaultKind: "general" | "onboarding";
  returnTo?: string;
};

const RETURN_TO_PREFIXES = ["/clients/", "/operations/"] as const;

/** Parse da rota `/operations/[id]/meetings/new` (kind + returnTo). */
export function parseNewMeetingSearchParams(
  raw: { kind?: string | string[]; returnTo?: string | string[] } | undefined,
): NewMeetingSearchParams {
  const kind = firstSearchParam(raw?.kind);
  const defaultKind: NewMeetingSearchParams["defaultKind"] =
    kind === "onboarding" ? "onboarding" : "general";
  const returnToRaw = firstSearchParam(raw?.returnTo)?.trim();
  const returnTo =
    returnToRaw &&
    RETURN_TO_PREFIXES.some((p) => returnToRaw.startsWith(p))
      ? returnToRaw
      : undefined;
  if (returnTo) {
    return { defaultKind, returnTo };
  }
  return { defaultKind };
}