import { createServer } from "@/lib/db/client";

export type McpAgentTokenRow = {
  id: string;
  profileId: string;
  name: string;
  tokenPrefix: string | null;
  tokenFingerprint: string;
  scopes: ("read" | "write")[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type McpAgentTokenAdminRow = McpAgentTokenRow & {
  profileEmail: string | null;
  profileLabel: string | null;
};

export async function listMcpAgentTokensForProfiles(
  profileIds: string[],
): Promise<McpAgentTokenRow[]> {
  if (profileIds.length === 0) return [];
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profile_agent_tokens")
    .select(
      "id, profile_id, name, token_prefix, token_fingerprint, scopes, created_at, expires_at, revoked_at, last_used_at",
    )
    .in("profile_id", profileIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMcpAgentTokensForProfiles: ${error.message}`);
  return (data ?? []).map(mapTokenRow);
}

export async function listAllMcpAgentTokensForAdmin(): Promise<McpAgentTokenRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profile_agent_tokens")
    .select(
      "id, profile_id, name, token_prefix, token_fingerprint, scopes, created_at, expires_at, revoked_at, last_used_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`listAllMcpAgentTokensForAdmin: ${error.message}`);
  return (data ?? []).map(mapTokenRow);
}

export function enrichMcpTokensWithProfiles(
  tokens: McpAgentTokenRow[],
  profiles: { id: string; email: string | null; displayLabel: string | null }[],
): McpAgentTokenAdminRow[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return tokens.map((t) => {
    const p = byId.get(t.profileId);
    return {
      ...t,
      profileEmail: p?.email ?? null,
      profileLabel: p?.displayLabel ?? null,
    };
  });
}

function mapTokenRow(r: {
  id: string;
  profile_id: string;
  name: string;
  token_prefix: string | null;
  token_fingerprint: string;
  scopes: ("read" | "write")[] | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}): McpAgentTokenRow {
  return {
    id: r.id,
    profileId: r.profile_id,
    name: r.name,
    tokenPrefix: r.token_prefix,
    tokenFingerprint: r.token_fingerprint,
    scopes: (r.scopes ?? ["read", "write"]) as ("read" | "write")[],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    lastUsedAt: r.last_used_at,
  };
}

export function mcpTokenStatus(
  row: Pick<McpAgentTokenRow, "revokedAt" | "expiresAt">,
  now = new Date(),
): "active" | "revoked" | "expired" {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && new Date(row.expiresAt) <= now) return "expired";
  return "active";
}
