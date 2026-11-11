/** PostgREST às veis devolve relação to-one como objeto ou array de um elemento. */
export function normalizeEmbedOne<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
