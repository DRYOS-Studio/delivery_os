import {
  loadGoogleCalendarTokens,
  updateGoogleCalendarAccessToken,
} from "@/lib/db/queries/google-calendar-integration";
import { refreshGoogleAccessToken } from "@/lib/google-calendar/oauth";

const EXPIRY_BUFFER_MS = 60_000;

export async function getValidGoogleCalendarAccessToken(): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const tokens = await loadGoogleCalendarTokens();
  if (!tokens) return null;
  const expiresAt = new Date(tokens.tokenExpiresAt).getTime();
  const now = Date.now();
  if (expiresAt - now > EXPIRY_BUFFER_MS) {
    return { accessToken: tokens.accessToken, calendarId: tokens.calendarId };
  }
  const refreshed = await refreshGoogleAccessToken(tokens.refreshToken);
  const nextExpiry = new Date(
    now + refreshed.expires_in * 1000,
  ).toISOString();
  await updateGoogleCalendarAccessToken({
    accessToken: refreshed.access_token,
    expiresAtIso: nextExpiry,
  });
  return {
    accessToken: refreshed.access_token,
    calendarId: tokens.calendarId,
  };
}