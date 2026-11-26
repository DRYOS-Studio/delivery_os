import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { googleOAuthConfigured } from "@/lib/google-calendar/config";
import {
  buildGoogleAuthorizationUrl,
  OAUTH_STATE_COOKIE,
  signGoogleOAuthState,
} from "@/lib/google-calendar/oauth";

export async function GET(request: Request): Promise<NextResponse> {
  const profile = await requireAdmin("/admin");
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/admin?google_calendar=missing_env", request.url),
    );
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo")?.trim() || "/admin";
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/admin";

  const state = await signGoogleOAuthState({
    userId: profile.user.id,
    returnTo: safeReturn,
  });

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const authUrl = buildGoogleAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}