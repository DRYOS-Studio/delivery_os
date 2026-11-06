/** Prefix for durable MCP connector secrets (exchange → short Supabase JWT). */
export const MCP_AGENT_TOKEN_PREFIX = "mcp_agt_" as const;

export function isMcpAgentTokenSecret(s: string): boolean {
  return s.startsWith(MCP_AGENT_TOKEN_PREFIX);
}
