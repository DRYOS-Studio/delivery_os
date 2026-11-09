/** Rótulo de autor/perfil: evita "Usuário" quando há profileId (nome veio do resolver). */
export function profileDisplayLabel(
  displayName: string | null | undefined,
  profileId: string | null | undefined,
): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  if (profileId) return "Colega";
  return "Usuário removido";
}
