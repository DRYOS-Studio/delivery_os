import { SignJWT, jwtVerify } from "jose";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  googleOAuthRedirectUri,
} from "@/lib/google-calendar/config";

const OAUTH_STATE_COOKIE = "google_calendar_oauth_state";
const STATE_TTL_SEC = 600;

function oauthStateSecret(): Uint8Array {
  const key = process.env.GOOGLE_OAUTH_STATE_SECRET?.trim();
  if (key) return new TextEncoder().encode(key);
  const fallback = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!fallback) {
    throw new Error("Missing GOOGLE_OAUTH_STATE_SECRET or SUPABASE_SECRET_KEY");
  }
  return new TextEncoder().encode(fallback);
}

export type GoogleOAuthStatePayload = {
  userId: string;
  returnTo: string;
};

export async function signGoogleOAuthState(
  payload: GoogleOAuthStatePayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SEC}s`)
    .sign(oauthStateSecret());
}

export async function verifyGoogleOAuthState(
  token: string,
): Promise<GoogleOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, oauthStateSecret());
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    const returnTo =
      typeof payload.returnTo === "string" ? payload.returnTo : "/admin";
    if (!userId) return null;
    return { userId, returnTo };
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID não configurado.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleOAuthRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

export { OAUTH_STATE_COOKIE };

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeGoogleAuthCode(
  code: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Google OAuth ausentes.");
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleOAuthRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange falhou: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Google OAuth ausentes.");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google refresh falhou: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserEmail(
  accessToken: string,
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Falha ao obter perfil Google: ${res.status}`);
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email?.trim()) {
    throw new Error("Conta Google sem e-mail.");
  }
  return data.email.trim();
}