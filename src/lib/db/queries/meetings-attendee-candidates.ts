/** Ordenação estável: kind, depois nome (pt-BR). */
export function mergeAttendeeCandidates<T extends { kind: string; name: string }>(
  internal: T[],
  external: T[],
): T[] {
  return [...internal, ...external].sort((a, b) => {
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) return byKind;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
