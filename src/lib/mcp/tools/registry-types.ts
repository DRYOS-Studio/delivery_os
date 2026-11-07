export type McpAccess = "read" | "write" | "admin";

export type McpToolDefinition = {
  name: string;
  description: string;
  access: McpAccess;
  inputSchema: Record<string, unknown>;
  idempotent?: boolean;
};
