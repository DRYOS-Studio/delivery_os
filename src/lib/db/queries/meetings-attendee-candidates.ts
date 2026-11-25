function sortKeyName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : "\uffff";
}

/** Ordenação estável: kind, depois nome (pt-BR). Tolera nome ausente (evita TypeError no sort). */
export function mergeAttendeeCandidates<T extends { kind: string; name: string }>(
  internal: T[],
  external: T[],
): T[] {
  return [...internal, ...external].sort((a, b) => {
    const byKind = (a.kind ?? "").localeCompare(b.kind ?? "");
    if (byKind !== 0) return byKind;
    return sortKeyName(a.name).localeCompare(sortKeyName(b.name), "pt-BR");
  });
}

/** Remove duplicatas por id (defesa se a query retornar linhas repetidas). */
export function dedupeAttendeeCandidates<T extends { id: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
