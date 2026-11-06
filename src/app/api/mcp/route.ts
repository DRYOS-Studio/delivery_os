import { type NextRequest, NextResponse } from "next/server";
import { getCachedMcpResult, setCachedMcpResult } from "@/lib/mcp/idempotency";
import { jsonRpcError, jsonRpcResult, toolText, type JsonRpcId } from "@/lib/mcp/jsonrpc";
import { resolveMcpCallerJwt } from "@/lib/mcp/resolve-caller-jwt";
import { mcpHasWriteScope } from "@/lib/mcp/scope";
import { createUserSupabase } from "@/lib/mcp/supabase-user-client";
import {
  mcpAddTaskComment,
  mcpChangeTaskStatus,
  mcpCreateDeliveryTask,
  mcpGetTask,
  mcpListTasks,
  mcpUpdateTask,
} from "@/lib/mcp/tools/task-tools";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

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
      "Lista operações visíveis (RLS). Parâmetro opcional: limit (1–50, default 20).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "get_operation",
    description: "Detalhe de operação por id (uuid).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "list_tasks",
    description:
      "Lista tarefas visíveis (RLS). Filtros: operation_id, client_id, status[], assignee_person_id. limit 1–50, offset.",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string" },
        client_id: { type: "string" },
        status: { type: "array", items: { type: "string" } },
        assignee_person_id: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_task",
    description: "Detalhe de tarefa por id.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Cria tarefa de entrega (frente_id obrigatório). Campos alinhados ao app (title, status, datas, assignees…).",
    inputSchema: {
      type: "object",
      properties: {
        frente_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        assignee_person_ids: { type: "array", items: { type: "string" } },
        parent_task_id: { type: "string" },
        start_date: { type: "string" },
        due_date: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        quick_win_id: { type: "string" },
        sla_incident_id: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["frente_id", "title"],
    },
  },
  {
    name: "update_task",
    description: "Atualiza tarefa (task_id + campos opcionais). assignee_person_ids substitui lista.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        assignee_person_ids: { type: "array", items: { type: "string" } },
        parent_task_id: { type: "string" },
        start_date: { type: "string" },
        due_date: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        quick_win_id: { type: "string" },
        sla_incident_id: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "change_task_status",
    description: "Atualiza só o status da tarefa.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["task_id", "status"],
    },
  },
  {
    name: "add_task_comment",
    description: "Adiciona comentário à tarefa (autor = perfil do token/JWT).",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        body: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["task_id", "body"],
    },
  },
] as const;

export async function POST(req: NextRequest) {
  const bearerRaw = parseBearer(req);
  if (!bearerRaw) {
    return jsonRpcError(null, -32001, "Autenticação obrigatória: Bearer <JWT Supabase ou token MCP>.", 401);
  }

  const resolved = await resolveMcpCallerJwt(bearerRaw);
  if (!resolved.ok) {
    const msg =
      resolved.code === "invalid_or_expired"
        ? "Token MCP inválido, expirado ou revogado."
        : resolved.code === "server_misconfigured"
          ? "Servidor sem SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_JWT_SECRET."
          : "Falha na autenticação.";
    return jsonRpcError(null, -32001, msg, 401);
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

  const supabase = createUserSupabase(resolved.jwt);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonRpcError(id ?? null, -32001, "Sessão inválida ou expirada.", 401);
  }

  const mcpCtx = resolved.ctx;

  switch (method) {
    case "initialize":
      return jsonRpcResult(id ?? null, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dryos-delivery-mcp", version: "0.2.0" },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "tools/list":
      return jsonRpcResult(id ?? null, { tools: [...TOOLS] });

    case "tools/call": {
      const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = p?.name;
      const args = p?.arguments ?? {};

      const needWrite =
        toolName === "create_task" ||
        toolName === "update_task" ||
        toolName === "change_task_status" ||
        toolName === "add_task_comment";

      if (needWrite && mcpCtx && !mcpHasWriteScope(mcpCtx)) {
        return jsonRpcError(id ?? null, -32003, "Token somente leitura (read).", 403);
      }

      async function withIdem(scope: string, fn: () => Promise<unknown>) {
        const ik =
          typeof args.idempotency_key === "string" ? args.idempotency_key.trim() : undefined;
        if (mcpCtx && ik) {
          const hit = await getCachedMcpResult(mcpCtx.profileId, scope, ik);
          if (hit !== null) return jsonRpcResult(id ?? null, toolText(hit));
        }
        const out = await fn();
        if (
          mcpCtx &&
          ik &&
          typeof out === "object" &&
          out !== null &&
          "ok" in out &&
          (out as { ok: boolean }).ok
        ) {
          await setCachedMcpResult(mcpCtx.profileId, scope, ik, out);
        }
        return jsonRpcResult(id ?? null, toolText(out));
      }

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
        return jsonRpcResult(id ?? null, toolText(data ?? []));
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
        return jsonRpcResult(id ?? null, toolText(data));
      }

      if (toolName === "list_tasks") {
        const r = await mcpListTasks(supabase, args);
        return jsonRpcResult(id ?? null, toolText(r.ok ? { tasks: r.tasks } : { error: r.message }));
      }

      if (toolName === "get_task") {
        const r = await mcpGetTask(supabase, args);
        if (!r.ok) {
          return jsonRpcError(id ?? null, r.notFound ? -32002 : -32000, r.message, r.notFound ? 404 : 400);
        }
        return jsonRpcResult(id ?? null, toolText(r.task));
      }

      if (toolName === "create_task") {
        return withIdem("create_task", async () => {
          return mcpCreateDeliveryTask(supabase, args);
        });
      }

      if (toolName === "update_task") {
        return withIdem("update_task", async () => {
          return mcpUpdateTask(supabase, args);
        });
      }

      if (toolName === "change_task_status") {
        return withIdem("change_task_status", async () => {
          return mcpChangeTaskStatus(supabase, args);
        });
      }

      if (toolName === "add_task_comment") {
        return withIdem("add_task_comment", async () => {
          return mcpAddTaskComment(supabase, args, userData.user.id);
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
    auth: {
      bearer_jwt: "Authorization: Bearer <Supabase access_token> (sessão Curta)",
      bearer_mcp:
        "Authorization: Bearer <token MCP exibido uma vez no /admin — prefixo mcp_agt_>; o servidor troca por JWT curto com SUPABASE_JWT_SECRET",
    },
  });
}
