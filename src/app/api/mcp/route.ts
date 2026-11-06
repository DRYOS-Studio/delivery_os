import { NextResponse } from "next/server";
import { createUserSupabase } from "@/lib/mcp/supabase-user-client";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

function jsonRpcError(id: JsonRpcId, code: number, message: string, status: number) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status },
  );
}

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function parseBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

const TOOLS = [
  {
    name: "list_operations",
    description:
      "Lista operações visíveis ao usuário (RLS), com nome do cliente. Parâmetro opcional: limit (1–50, default 20).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Máximo de linhas" } },
    },
  },
  {
    name: "get_operation",
    description: "Detalhe de uma operação por id (uuid).",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string", description: "UUID da operação" },
      },
      required: ["operation_id"],
    },
  },
] as const;

export async function POST(req: Request) {
  const jwt = parseBearer(req);
  if (!jwt) {
    return jsonRpcError(null, -32001, "Autenticação obrigatória: Authorization Bearer <JWT Supabase>.", 401);
  }

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Corpo JSON inválido.", 400);
  }

  if (body.jsonrpc !== "2.0") {
    return jsonRpcError(body.id ?? null, -32600, "jsonrpc deve ser 2.0.", 400);
  }

  const { method, params, id } = body;
  if (!method) {
    return jsonRpcError(id ?? null, -32600, "method obrigatório.", 400);
  }

  const supabase = createUserSupabase(jwt);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonRpcError(id ?? null, -32001, "JWT inválido ou sessão expirada.", 401);
  }

  switch (method) {
    case "initialize":
      return jsonRpcResult(id ?? null, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dryos-delivery-mcp", version: "0.1.0" },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "tools/list":
      return jsonRpcResult(id ?? null, { tools: [...TOOLS] });

    case "tools/call": {
      const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = p?.name;
      const args = p?.arguments ?? {};

      if (toolName === "list_operations") {
        const rawLimit = args.limit;
        const limit =
          typeof rawLimit === "number" && Number.isFinite(rawLimit)
            ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
            : 20;
        const { data, error } = await supabase
          .from("operations")
          .select(
            `
            id, name, status,
            client:clients!fk_operations_client_id ( id, name )
            `,
          )
          .is("archived_at", null)
          .order("name", { ascending: true })
          .limit(limit);
        if (error) {
          return jsonRpcError(id ?? null, -32000, `DB: ${error.message}`, 500);
        }
        return jsonRpcResult(id ?? null, {
          content: [
            {
              type: "text",
              text: JSON.stringify(data ?? [], null, 2),
            },
          ],
        });
      }

      if (toolName === "get_operation") {
        const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
        if (!opId) {
          return jsonRpcError(id ?? null, -32602, "operation_id obrigatório.", 400);
        }
        const { data, error } = await supabase
          .from("operations")
          .select(
            `
            id, name, status, client_id, monthly_recurring_revenue, recurrence, start_date, end_date,
            client:clients!fk_operations_client_id ( id, name, slug )
            `,
          )
          .eq("id", opId)
          .maybeSingle();
        if (error) {
          return jsonRpcError(id ?? null, -32000, `DB: ${error.message}`, 500);
        }
        if (!data) {
          return jsonRpcError(id ?? null, -32002, "Operação não encontrada ou sem acesso.", 404);
        }
        return jsonRpcResult(id ?? null, {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      }

      return jsonRpcError(id ?? null, -32601, `Ferramenta desconhecida: ${toolName ?? ""}`, 400);
    }

    default:
      return jsonRpcError(id ?? null, -32601, `Método não suportado: ${method}`, 400);
  }
}

export async function GET() {
  return NextResponse.json({
    name: "dryos-delivery-mcp",
    protocol: "jsonrpc-2.0",
    post: "/api/mcp",
    auth: "Authorization: Bearer <Supabase access_token>",
  });
}
