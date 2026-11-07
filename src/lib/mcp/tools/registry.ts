export type McpAccess = "read" | "write" | "admin";

export type McpToolDefinition = {
  name: string;
  description: string;
  access: McpAccess;
  inputSchema: Record<string, unknown>;
  idempotent?: boolean;
};

const idem = { idempotency_key: { type: "string", description: "Chave 8–200 chars (cache MCP)." } };

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "list_operations",
    access: "read",
    description: "Lista operações visíveis (RLS). Filtro client_id opcional.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "get_operation",
    access: "read",
    description: "Detalhe de operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_operation",
    access: "admin",
    idempotent: true,
    description: "Cria operação (admin). Campos = operationSchema UI.",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_operation",
    access: "admin",
    idempotent: true,
    description: "Atualiza operação (admin).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id"],
    },
  },
  {
    name: "archive_operation",
    access: "admin",
    idempotent: true,
    description: "Arquiva operação (status terminal + cascata). Exige confirm: true.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, confirm: { type: "boolean" }, ...idem },
      required: ["operation_id", "confirm"],
    },
  },
  {
    name: "list_operation_members",
    access: "read",
    description: "Membros com acesso à operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "add_operation_member",
    access: "admin",
    idempotent: true,
    description: "Vincula membro à operação (admin).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, profile_id: { type: "string" }, ...idem },
      required: ["operation_id", "profile_id"],
    },
  },
  {
    name: "remove_operation_member",
    access: "admin",
    idempotent: true,
    description: "Remove membro da operação (admin).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, profile_id: { type: "string" }, ...idem },
      required: ["operation_id", "profile_id"],
    },
  },
  {
    name: "list_clients",
    access: "read",
    description: "Lista clientes visíveis (RLS).",
    inputSchema: {
      type: "object",
      properties: { include_archived: { type: "boolean" }, limit: { type: "number" }, offset: { type: "number" } },
    },
  },
  {
    name: "get_client",
    access: "read",
    description: "Detalhe de cliente.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "create_client",
    access: "admin",
    idempotent: true,
    description: "Cria cliente (admin). Campos = formulário /clients.",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_client",
    access: "admin",
    idempotent: true,
    description: "Atualiza cliente (admin).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, ...idem },
      required: ["client_id"],
    },
  },
  {
    name: "archive_client",
    access: "admin",
    idempotent: true,
    description: "Arquiva cliente (cascata). confirm: true.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, confirm: { type: "boolean" }, ...idem },
      required: ["client_id", "confirm"],
    },
  },
  {
    name: "restore_client",
    access: "admin",
    idempotent: true,
    description: "Restaura cliente arquivado (admin).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, ...idem },
      required: ["client_id"],
    },
  },
  {
    name: "list_client_contracts",
    access: "admin",
    description: "Contratos do cliente (admin).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "get_client_contract",
    access: "admin",
    description: "Detalhe contrato (admin).",
    inputSchema: {
      type: "object",
      properties: { contract_id: { type: "string" } },
      required: ["contract_id"],
    },
  },
  {
    name: "update_client_contract",
    access: "admin",
    idempotent: true,
    description: "Atualiza metadados do contrato (sem trocar arquivo).",
    inputSchema: {
      type: "object",
      properties: { contract_id: { type: "string" }, ...idem },
      required: ["contract_id"],
    },
  },
  {
    name: "upload_client_contract",
    access: "admin",
    idempotent: true,
    description: "Cria contrato com arquivo base64 (≤5MB). Campos financeiros + implementation_fee opcional.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        filename: { type: "string" },
        mime_type: { type: "string" },
        content_base64: { type: "string" },
        ...idem,
      },
      required: ["client_id", "filename", "mime_type", "content_base64", "label", "status"],
    },
  },
  {
    name: "begin_client_contract_upload",
    access: "admin",
    description: "URL assinada de upload Storage (contratos >5MB).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, filename: { type: "string" } },
      required: ["client_id", "filename"],
    },
  },
  {
    name: "finalize_client_contract_upload",
    access: "admin",
    idempotent: true,
    description: "Registra contrato após upload assinado.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        storage_path: { type: "string" },
        filename: { type: "string" },
        mime_type: { type: "string" },
        size_bytes: { type: "number" },
        ...idem,
      },
      required: ["client_id", "storage_path", "filename", "mime_type", "size_bytes", "label", "status"],
    },
  },
  {
    name: "get_client_contract_download_url",
    access: "admin",
    description: "URL assinada de download do contrato (1h).",
    inputSchema: {
      type: "object",
      properties: { contract_id: { type: "string" } },
      required: ["contract_id"],
    },
  },
  {
    name: "list_frentes",
    access: "read",
    description: "Frentes da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, include_archived: { type: "boolean" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "get_frente",
    access: "read",
    description: "Detalhe frente (inclui produto vinculado).",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" } },
      required: ["frente_id"],
    },
  },
  {
    name: "create_frente",
    access: "write",
    idempotent: true,
    description: "Cria frente (RLS).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "name", "cycle_type", "domain", "phase", "actionable_status"],
    },
  },
  {
    name: "update_frente",
    access: "write",
    idempotent: true,
    description: "Atualiza frente; preserva product_id se enviado.",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" }, ...idem },
      required: ["frente_id", "name", "cycle_type", "domain", "phase", "actionable_status"],
    },
  },
  {
    name: "archive_frente",
    access: "write",
    idempotent: true,
    description: "Arquiva frente (cascata). confirm: true.",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" }, confirm: { type: "boolean" }, ...idem },
      required: ["frente_id", "confirm"],
    },
  },
  {
    name: "list_tasks",
    access: "read",
    description: "Lista tarefas (RLS).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_task",
    access: "read",
    description: "Detalhe tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "create_task",
    access: "write",
    idempotent: true,
    description: "Cria tarefa de entrega.",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" }, title: { type: "string" }, ...idem },
      required: ["frente_id", "title"],
    },
  },
  {
    name: "update_task",
    access: "write",
    idempotent: true,
    description: "Atualiza tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, ...idem },
      required: ["task_id"],
    },
  },
  {
    name: "change_task_status",
    access: "write",
    idempotent: true,
    description: "Muda status da tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, status: { type: "string" }, ...idem },
      required: ["task_id", "status"],
    },
  },
  {
    name: "add_task_comment",
    access: "write",
    idempotent: true,
    description: "Comentário em tarefa.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, body: { type: "string" }, ...idem },
      required: ["task_id", "body"],
    },
  },
  {
    name: "list_persons",
    access: "read",
    description: "Pessoas (internas/externas).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, limit: { type: "number" } },
    },
  },
  {
    name: "create_person",
    access: "write",
    idempotent: true,
    description: "Cria pessoa (kind internal|external).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "list_meetings",
    access: "read",
    description: "Reuniões da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_meeting",
    access: "write",
    idempotent: true,
    description: "Cria reunião.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "title", "scheduled_at", "visibility"],
    },
  },
  {
    name: "list_decisions",
    access: "read",
    description: "Decisões da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_decision",
    access: "write",
    idempotent: true,
    description: "Registra decisão.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "title", "decision", "visibility", "decided_at"],
    },
  },
  {
    name: "get_operation_briefing",
    access: "read",
    description: "Briefing vivo da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "upsert_operation_briefing",
    access: "write",
    idempotent: true,
    description: "Cria/atualiza briefing.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id"],
    },
  },
  {
    name: "list_service_products",
    access: "read",
    description: "Catálogo de produtos (sem preços secretos).",
    inputSchema: {
      type: "object",
      properties: { include_archived: { type: "boolean" }, limit: { type: "number" } },
    },
  },
  {
    name: "list_villains",
    access: "read",
    description: "Vilões canônicos.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_quick_win_catalog",
    access: "read",
    description: "Catálogo admin de quick wins.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_attachments",
    access: "read",
    description: "Anexos da operação (metadados).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "upload_attachment",
    access: "write",
    idempotent: true,
    description: "Envia anexo base64 (≤5MB) com path operation_id/.",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string" },
        filename: { type: "string" },
        mime_type: { type: "string" },
        content_base64: { type: "string" },
        ...idem,
      },
      required: ["operation_id", "filename", "mime_type", "content_base64"],
    },
  },
  {
    name: "get_attachment_download_url",
    access: "read",
    description: "URL assinada de download de anexo.",
    inputSchema: {
      type: "object",
      properties: { attachment_id: { type: "string" } },
      required: ["attachment_id"],
    },
  },
];

export function mcpToolAccess(name: string): McpAccess | null {
  return MCP_TOOL_DEFINITIONS.find((t) => t.name === name)?.access ?? null;
}

export function mcpToolIsIdempotent(name: string): boolean {
  return MCP_TOOL_DEFINITIONS.find((t) => t.name === name)?.idempotent === true;
}
