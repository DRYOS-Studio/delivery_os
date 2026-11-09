/** Normalização de valores vindos de FormData, JSON (jsonb) ou RHF. */

export function nullishToUndefined(v: unknown): unknown {
  if (v === null || v === undefined || v === "") {
    return undefined;
  }
  return v;
}

export function nullishToEmptyString(v: unknown): unknown {
  if (v === null || v === undefined) {
    return "";
  }
  return v;
}
