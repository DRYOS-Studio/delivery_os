import { createServer } from "@/lib/db/client";

export type McpAgentTokenRow = {
  id: string;
  profileId: string;
  name: string;
  scopes: ("read" | "write")[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export async function listMcpAgentTokensForProfiles(
  profileIds: string[],
): Promise<McpAgentTokenRow[]> {
  if (profileIds.length === 0) return [];
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profile_agent_tokens")
    .select("id, profile_id, name, scopes, created_at, expires_at, revoked_at, last_used_at")
    .in("profile_id", profileIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMcpAgentTokensForProfiles: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    name: r.name,
    scopes: (r.scopes ?? ["read", "write"]) as ("read" | "write")[],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    lastUsedAt: r.last_used_at,
  }));
}
