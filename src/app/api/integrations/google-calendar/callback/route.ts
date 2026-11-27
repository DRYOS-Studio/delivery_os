import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertGoogleCalendarConnection } from "@/lib/db/queries/google-calendar-integration";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserEmail,
  OAUTH_STATE_COOKIE,
  verifyGoogleOAuthState,
} from "@/lib/google-calendar/oauth";
import { logRouteError } from "@/lib/utils/log-route-error";

export async function GET(request: Request): Promise<NextResponse> {
  const route = "/api/integrations/google-calendar/callback";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  const failRedirect = (reason: string) =>
    NextResponse.redirect(
      new URL(`/admin?google_calendar=${encodeURIComponent(reason)}`, request.url),
    );

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return failRedirect("state_invalid");
  }

  const payload = await verifyGoogleOAuthState(stateCookie);
  cookieStore.delete(OAUTH_STATE_COOKIE);
  if (!payload) return failRedirect("state_expired");

  try {
    const tokens = await exchangeGoogleAuthCode(code);
    if (!tokens.refresh_token) {
      return failRedirect("sem_refresh_token");
    }
    const email = await fetchGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();
    await upsertGoogleCalendarConnection({
      accountEmail: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAtIso: expiresAt,
      connectedByUserId: payload.userId,
      calendarId: "primary",
      calendarSummary: "primary",
    });
    const dest = payload.returnTo.startsWith("/")
      ? payload.returnTo
      : "/admin";
    const redirectUrl = new URL(dest, request.url);
    redirectUrl.searchParams.set("google_calendar", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    logRouteError(route, e, { phase: "callback" });
    return failRedirect("oauth_error");
  }
}