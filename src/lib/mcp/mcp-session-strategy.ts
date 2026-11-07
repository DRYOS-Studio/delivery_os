export type McpSessionStrategy = "gotrue" | "hs256";

/**
 * Como o servidor obtém um access token Supabase após validar `mcp_agt_…`.
 *
 * - **gotrue** (padrão): Auth Admin `generateLink` + `verifyOtp` — JWT assinado pelo
 *   projeto (ES256/RS256/etc.), sem `SUPABASE_JWT_SECRET` nem chave privada exportada.
 * - **hs256** (legado): mint local com `SUPABASE_JWT_SECRET` — só projetos ainda no JWT secret simétrico.
 */
export function resolveMcpSessionStrategy(): McpSessionStrategy {
  const explicit = process.env.MCP_SESSION_STRATEGY?.trim().toLowerCase();
  if (explicit === "hs256" || explicit === "gotrue") {
    return explicit;
  }
  if (process.env.SUPABASE_JWT_SECRET?.trim()) {
    return "hs256";
  }
  return "gotrue";
}
