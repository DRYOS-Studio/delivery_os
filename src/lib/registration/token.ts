import { createHash, randomBytes } from "node:crypto";

/** Token bruto para o link (base64url, 32 bytes). */
export function generateRegistrationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRegistrationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function buildRegistrationPath(rawToken: string): string {
  return `/cadastro/${encodeURIComponent(rawToken)}`;
}

export function buildAbsoluteRegistrationUrl(
  rawToken: string,
  siteOrigin: string,
): string {
  const base = siteOrigin.replace(/\/$/, "");
  return `${base}${buildRegistrationPath(rawToken)}`;
}
