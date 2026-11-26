export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export const GOOGLE_CALENDAR_TIMEZONE = "America/Sao_Paulo";

export const GOOGLE_OAUTH_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CALENDAR_API_BASE =
  "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SINGLETON_KEY = "dryos";

export function googleOAuthConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim())
  );
}

export function googleOAuthRedirectUri(): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const app =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return `${app.replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
}