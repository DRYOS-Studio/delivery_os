import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";

export function mcpHasWriteScope(ctx: McpAuthContext | undefined): boolean {
  if (!ctx) return true;
  return ctx.scopes.includes("write");
}
