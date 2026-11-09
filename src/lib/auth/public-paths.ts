/** Rotas acessíveis sem sessão Supabase (proxy / Next 16). */

export const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/auth/callback",
  "/api/webhooks",
  "/api/cron",
  "/api/mcp",
  "/public",
  "/cadastro",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
