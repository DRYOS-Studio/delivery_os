import { createServiceRole } from "@/lib/db/service-role";
import { isMcpAgentTokenSecret } from "@/lib/mcp/mcp-token-prefix";
import { mintSupabaseUserAccessToken } from "@/lib/mcp/supabase-session-jwt";

const MCP_JWT_TTL_SECONDS = 15 * 60;

export type McpAuthContext = {
  mcpAgent: true;
  profileId: string;
  scopes: ("read" | "write")[];
};

function parseScopes(raw: unknown): ("read" | "write")[] {
  if (!Array.isArray(raw)) return [];
  const out: ("read" | "write")[] = [];
  for (const x of raw) {
    if (x === "read" || x === "write") out.push(x);
  }
  // Escopo vazio no RPC não deve ampliar para write (least privilege).
  return out.length > 0 ? out : ["read"];
}

export async function resolveMcpCallerJwt(
  bearerRaw: string,
): Promise<{ ok: true; jwt: string; ctx?: McpAuthContext } | { ok: false; code: string }> {
  const trimmed = bearerRaw.trim();
  if (trimmed.length === 0) return { ok: false, code: "missing_bearer" };

  if (isMcpAgentTokenSecret(trimmed)) {
    let service: ReturnType<typeof createServiceRole>;
    try {
      service = createServiceRole();
    } catch {
      return { ok: false, code: "server_misconfigured" };
    }
    const { data, error } = await service.rpc("verify_mcp_agent_token", {
      p_token_plaintext: trimmed,
    });
    if (error) {
      return { ok: false, code: "verify_failed" };
    }
    const row = data as { ok?: boolean; profile_id?: string; scopes?: unknown; code?: string };
    if (!row?.ok || !row.profile_id) {
      return { ok: false, code: typeof row?.code === "string" ? row.code : "invalid_or_expired" };
    }
    const scopes = parseScopes(row.scopes);
    let jwt: string;
    try {
      jwt = await mintSupabaseUserAccessToken(row.profile_id, MCP_JWT_TTL_SECONDS);
    } catch {
      return { ok: false, code: "server_misconfigured" };
    }
    return {
      ok: true,
      jwt,
      ctx: {
        mcpAgent: true,
        profileId: row.profile_id,
        scopes,
      },
    };
  }

  return { ok: true, jwt: trimmed };
}
