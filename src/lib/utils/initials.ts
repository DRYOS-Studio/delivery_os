export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const first = words[0]!.charAt(0);
    return first ? first.toUpperCase() : "?";
  }
  const first = words[0]!.charAt(0);
  const last = words[words.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function initialsFromEmail(
  email: string | null | undefined,
): string {
  if (!email) return "?";
  const prefix = email.split("@")[0] ?? "";
  const parts = prefix.split(/[.\-_]/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const c = parts[0]!.charAt(0);
    return c ? c.toUpperCase() : "?";
  }
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}
