/** Origem pública do app (links absolutos em convites). Nunca usa VERCEL_URL (preview instável). */

function normalizeOriginUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Resolve origem para links de convite.
 * Ordem: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → requestHost → localhost.
 */
export function resolveSiteOrigin(requestHost?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizeOriginUrl(explicit);

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return normalizeOriginUrl(prod);

  const host = requestHost?.trim();
  if (host) {
    const hostname = host.split(",")[0]?.trim() ?? host;
    const scheme = hostname.startsWith("localhost") ? "http" : "https";
    return `${scheme}://${hostname.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

/** Fallback sem request (ex.: MCP, cron). */
export function getSiteOriginFromEnv(): string {
  return resolveSiteOrigin(null);
}
