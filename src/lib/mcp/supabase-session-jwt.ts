import { SignJWT } from "jose";

function requiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/**
 * Legado: mint HS256 com JWT Secret simétrico (projetos antes de JWT Signing Keys / rotação ES256).
 * Projetos só com chaves assimétricas devem usar `exchangeProfileForGoTrueAccessToken` (estratégia gotrue).
 */
export async function mintSupabaseUserAccessToken(
  userId: string,
  ttlSeconds: number,
): Promise<string> {
  const secret = new TextEncoder().encode(requiredEnv("SUPABASE_JWT_SECRET"));
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
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
    .setIssuer(`${supabaseUrl}/auth/v1`)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
}
