import { type NextRequest, NextResponse } from "next/server";
import { getCachedMcpResult, setCachedMcpResult } from "@/lib/mcp/idempotency";
import { jsonRpcError, jsonRpcResult, toolText, type JsonRpcId } from "@/lib/mcp/jsonrpc";
import { resolveMcpCallerJwt } from "@/lib/mcp/resolve-caller-jwt";
import { dispatchMcpTool } from "@/lib/mcp/tools/dispatch";
import { MCP_TOOL_DEFINITIONS, mcpToolIsIdempotent } from "@/lib/mcp/tools/registry";
import { idempotencyKeyFromArgs } from "@/lib/mcp/tools/shared";
import { createUserSupabase } from "@/lib/mcp/supabase-user-client";

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
          ? "Servidor sem credenciais MCP (service role + publishable URL) ou estratégia de sessão incompatível."
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
  const mcpCtx = resolved.ctx;

  let callerUserId: string;
  if (mcpCtx?.mcpAgent) {
    callerUserId = mcpCtx.profileId;
  } else {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return jsonRpcError(id ?? null, -32001, "Sessão inválida ou expirada.", 401);
    }
    callerUserId = userData.user.id;
  }

  const handlerCtx = { supabase, callerUserId };

  switch (method) {
    case "initialize":
      return jsonRpcResult(id ?? null, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dryos-delivery-mcp", version: "0.3.0" },
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "tools/list":
      return jsonRpcResult(id ?? null, {
        tools: MCP_TOOL_DEFINITIONS.map((t) => ({
          name: t.name,
          description: `${t.description} [access: ${t.access}]`,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const toolName = p?.name;
      const args = p?.arguments ?? {};
      if (!toolName) {
        return jsonRpcError(id ?? null, -32602, "name obrigatório em tools/call.", 400);
      }

      const ik = idempotencyKeyFromArgs(args);
      const useIdem = Boolean(mcpCtx && ik && mcpToolIsIdempotent(toolName));
      if (useIdem && mcpCtx) {
        const hit = await getCachedMcpResult(mcpCtx.profileId, toolName, ik!);
        if (hit !== null) return jsonRpcResult(id ?? null, toolText(hit));
      }

      const out = await dispatchMcpTool({
        toolName,
        args,
        ctx: handlerCtx,
        mcpCtx,
      });

      const okPayload =
        typeof out === "object" &&
        out !== null &&
        "ok" in out &&
        (out as { ok: boolean }).ok;

      if (useIdem && mcpCtx && ik && okPayload) {
        await setCachedMcpResult(mcpCtx.profileId, toolName, ik, out);
      }

      const notFound =
        typeof out === "object" &&
        out !== null &&
        "code" in out &&
        (out as { code?: string }).code === "not_found";
      const forbidden =
        (typeof out === "object" &&
          out !== null &&
          "code" in out &&
          (out as { code?: string }).code === "forbidden") ||
        (typeof out === "object" &&
          out !== null &&
          "error" in out &&
          String((out as { error: string }).error).includes("administradores"));

      if (
        typeof out === "object" &&
        out !== null &&
        "ok" in out &&
        !(out as { ok: boolean }).ok
      ) {
        const msg = (out as { error?: string }).error ?? "Erro.";
        return jsonRpcError(id ?? null, notFound ? -32002 : forbidden ? -32003 : -32000, msg, notFound ? 404 : forbidden ? 403 : 400);
      }

      return jsonRpcResult(id ?? null, toolText(out));
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
    tool_count: MCP_TOOL_DEFINITIONS.length,
    auth: {
      bearer_jwt: "Authorization: Bearer <Supabase access_token> (sessão Curta)",
      bearer_mcp:
        "Authorization: Bearer <token mcp_agt_…>; o servidor valida no Postgres e troca por access token GoTrue (ES256/assinatura do projeto) ou HS256 legado se MCP_SESSION_STRATEGY=hs256",
    },
  });
}
