import {
  exchangeProfileForGoTrueAccessToken,
  GoTrueExchangeError,
} from "@/lib/mcp/exchange-gotrue-session";
import { resolveMcpSessionStrategy } from "@/lib/mcp/mcp-session-strategy";
import { mintSupabaseUserAccessToken } from "@/lib/mcp/supabase-session-jwt";

const MCP_JWT_TTL_SECONDS = 15 * 60;

export type IssueMcpAccessTokenResult =
  | { ok: true; jwt: string }
  | { ok: false; code: "server_misconfigured" | "profile_unusable" };

export async function issueMcpAccessTokenForProfile(
  profileId: string,
): Promise<IssueMcpAccessTokenResult> {
  const strategy = resolveMcpSessionStrategy();
  try {
    if (strategy === "hs256") {
      const jwt = await mintSupabaseUserAccessToken(profileId, MCP_JWT_TTL_SECONDS);
      return { ok: true, jwt };
    }
    const jwt = await exchangeProfileForGoTrueAccessToken(profileId);
    return { ok: true, jwt };
  } catch (e) {
    if (e instanceof GoTrueExchangeError) {
      if (e.code === "profile_not_found" || e.code === "no_email") {
        return { ok: false, code: "profile_unusable" };
      }
      return { ok: false, code: "server_misconfigured" };
    }
    return { ok: false, code: "server_misconfigured" };
  }
}
