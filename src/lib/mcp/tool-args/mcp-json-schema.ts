import { z } from "zod";

export const MCP_IDEMPOTENCY_PROPERTY = {
  idempotency_key: {
    type: "string",
    description: "Chave idempotente (8–200 caracteres) para deduplicar retries de escrita.",
    minLength: 8,
    maxLength: 200,
  },
} as const;

/**
 * Converte Zod MCP-facing (sem transforms) para JSON Schema publicado em tools/list.
 * additionalProperties: true — o servidor aceita campos extras que o parser ignora.
 */
export function mcpInputSchemaFromZod(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const properties = { ...(json.properties ?? {}), ...MCP_IDEMPOTENCY_PROPERTY };
  const required = json.required ?? [];
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: true,
  };
}
