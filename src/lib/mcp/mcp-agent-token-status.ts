export type McpTokenStatusInput = {
  revokedAt: string | null;
  expiresAt: string | null;
};

export function mcpTokenStatus(
  row: McpTokenStatusInput,
  now = new Date(),
): "active" | "revoked" | "expired" {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && new Date(row.expiresAt) <= now) return "expired";
  return "active";
}
