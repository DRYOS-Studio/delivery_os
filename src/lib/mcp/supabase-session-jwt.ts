import { SignJWT } from "jose";

function requiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/**
 * Emite access token no formato aceito pelo PostgREST/GoTrue (HS256, audience authenticated).
 * Usa o mesmo segredo que o projeto Supabase (JWT Secret no Dashboard), não a anon key.
 */
export async function mintSupabaseUserAccessToken(
  userId: string,
  ttlSeconds: number,
): Promise<string> {
  const secret = new TextEncoder().encode(requiredEnv("SUPABASE_JWT_SECRET"));
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  return new SignJWT({
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "mcp_agent_token", timestamp: now }],
    app_metadata: { mcp_agent: true },
    user_metadata: {},
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
}
