import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";
import { MCP_TOOL_ZOD_ARGS } from "@/lib/mcp/tool-args/bindings";
import { mcpInputSchemaFromZod } from "@/lib/mcp/tool-args/mcp-json-schema";
import {
  createClientContractMcpSchema,
  updateClientContractMcpSchema,
} from "@/lib/mcp/tool-args/contracts";

function toolSchema(name: string) {
  const t = MCP_TOOL_DEFINITIONS.find((d) => d.name === name);
  expect(t).toBeDefined();
  return t!.inputSchema as {
    properties?: Record<string, { enum?: string[]; type?: string }>;
    required?: string[];
  };
}

describe("MCP tools/list schema parity (Zod-derived)", () => {
  it("generates JSON Schema for every bound write tool without throwing", () => {
    for (const [name, zod] of Object.entries(MCP_TOOL_ZOD_ARGS)) {
      expect(() => mcpInputSchemaFromZod(zod), name).not.toThrow();
      const def = MCP_TOOL_DEFINITIONS.find((d) => d.name === name);
      expect(def, `registry missing tool ${name}`).toBeDefined();
      if (def) {
        expect(def.inputSchema).toEqual(mcpInputSchemaFromZod(zod));
      }
    }
  });

  it("create_client_contract exposes status enum and financial fields (regression Assis Sat)", () => {
    const schema = toolSchema("create_client_contract");
    const status = schema.properties?.status;
    expect(status?.enum).toEqual(["rascunho", "vigente", "encerrada"]);
    expect(schema.required).toEqual(
      expect.arrayContaining(["client_id", "label", "status"]),
    );
    expect(schema.properties?.monthly_value).toBeDefined();
    expect(schema.properties?.implementation_fee).toBeDefined();
    expect(schema.properties?.implementation_fee_paid).toBeDefined();
    expect(schema.properties?.start_date).toBeDefined();
    expect(schema.properties?.first_billing_date).toBeDefined();
    expect(schema.properties?.notes).toBeDefined();
    expect(schema.properties?.idempotency_key).toBeDefined();
  });

  it("update_client_contract exposes the same body fields plus contract_id", () => {
    const schema = toolSchema("update_client_contract");
    expect(schema.properties?.status?.enum).toEqual(["rascunho", "vigente", "encerrada"]);
    expect(schema.required).toEqual(["contract_id"]);
  });

  it("update_client_contract aceita patch parcial (metadata + end_date)", () => {
    const partial = updateClientContractMcpSchema.safeParse({
      contract_id: "8e79c305-1629-4f82-8dbe-6ce9cbde1369",
      label: "Contrato de infraestrutura Digital e Performance",
      status: "vigente",
      end_date: "2027-04-24",
    });
    expect(partial.success).toBe(true);
    const full = updateClientContractMcpSchema.safeParse({
      contract_id: "11111111-1111-4111-8111-222222222222",
      label: "DRYOS OS Basic",
      status: "vigente",
      monthly_value: 397,
      notes: "unchanged",
    });
    expect(full.success).toBe(true);
  });

  it("update_operation exposes writable status enum (not truncated client_id-only)", () => {
    const schema = toolSchema("update_operation");
    expect(schema.properties?.status).toBeDefined();
    expect(schema.properties?.product_line?.enum ?? schema.properties?.product_line).toBeDefined();
    expect(schema.required).toEqual(expect.arrayContaining(["operation_id"]));
  });

  it("accepts Assis Sat metadata-only payload via published-shape args", () => {
    const args = {
      client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      label: "DRYOS OS Basic — aceite WhatsApp",
      monthly_value: 397,
      implementation_fee: 1000,
      implementation_fee_paid: true,
      currency: "BRL",
      start_date: "2026-11-04",
      first_billing_date: "2026-12-14",
      payment_day_of_month: 14,
      status: "vigente" as const,
      notes: "Aceite por WhatsApp, sem assinatura formal.",
      idempotency_key: "assis-sat-contract-001",
    };
    const parsed = createClientContractMcpSchema.safeParse(args);
    expect(parsed.success).toBe(true);
  });
});
