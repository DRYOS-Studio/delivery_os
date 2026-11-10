import { applyZodInputSchemas } from "@/lib/mcp/tool-args/bindings";
import type { McpAccess, McpToolDefinition } from "@/lib/mcp/tools/registry-types";

export type { McpAccess, McpToolDefinition } from "@/lib/mcp/tools/registry-types";

const idem = { idempotency_key: { type: "string", description: "Chave 8–200 chars (cache MCP)." } };

const BASE_MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
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
      properties: {
        include_archived: { type: "boolean" },
        journey_status: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
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
    name: "update_client_journey_status",
    access: "admin",
    idempotent: true,
    description:
      "Atualiza journey_status do cliente (jornada comercial). Valores: em_cadastro, onboarding_pendente, onboarding_agendado, em_implantacao, ativo, pausado, encerrado.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        journey_status: { type: "string" },
        ...idem,
      },
      required: ["client_id", "journey_status"],
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
    name: "create_client_registration_invitation",
    access: "admin",
    idempotent: true,
    description:
      "Cria convite de autocadastro (nome + telefone) e retorna registration_url.",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "list_client_registration_invitations",
    access: "admin",
    description: "Lista convites de autocadastro (admin).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "get_client_registration_submission",
    access: "admin",
    description: "Lê convite + payload submetido (admin).",
    inputSchema: {
      type: "object",
      properties: { invitation_id: { type: "string" } },
      required: ["invitation_id"],
    },
  },
  {
    name: "approve_client_registration_invitation",
    access: "admin",
    idempotent: true,
    description: "Aprova submissão e cria registro em clients + softwares.",
    inputSchema: {
      type: "object",
      properties: { invitation_id: { type: "string" }, ...idem },
      required: ["invitation_id"],
    },
  },
  {
    name: "list_repository_links",
    access: "read",
    description:
      "Links de repositório Git do cliente (e herdados por operation_id/frente_id quando informados).",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        operation_id: { type: "string" },
        frente_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "create_repository_link",
    access: "write",
    idempotent: true,
    description:
      "Cria link de repositório (escopo client_id; operation_id/frente_id opcionais).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_repository_link",
    access: "write",
    idempotent: true,
    description: "Atualiza link de repositório.",
    inputSchema: {
      type: "object",
      properties: { link_id: { type: "string" }, ...idem },
      required: ["link_id"],
    },
  },
  {
    name: "delete_repository_link",
    access: "write",
    idempotent: true,
    description: "Remove link de repositório.",
    inputSchema: {
      type: "object",
      properties: { link_id: { type: "string" }, ...idem },
      required: ["link_id"],
    },
  },
  {
    name: "list_client_tech_items",
    access: "read",
    description: "Stack técnica do cliente.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "create_client_tech_item",
    access: "admin",
    idempotent: true,
    description: "Adiciona item à stack técnica (admin).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_client_tech_item",
    access: "admin",
    idempotent: true,
    description: "Atualiza item da stack técnica (admin; preserva id).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "delete_client_tech_item",
    access: "admin",
    idempotent: true,
    description: "Remove item da stack técnica (admin).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, item_id: { type: "string" }, ...idem },
      required: ["client_id", "item_id"],
    },
  },
  {
    name: "list_client_software_items",
    access: "read",
    description: "Softwares que o cliente utiliza.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "create_client_software_item",
    access: "admin",
    idempotent: true,
    description:
      "Adiciona software do cliente (nome/finalidade/url workspace opcional; admin).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_client_software_item",
    access: "admin",
    idempotent: true,
    description: "Atualiza software do cliente (admin; preserva id).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "delete_client_software_item",
    access: "admin",
    idempotent: true,
    description: "Remove software do cliente (admin).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, item_id: { type: "string" }, ...idem },
      required: ["client_id", "item_id"],
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
    name: "list_activity_events",
    access: "read",
    description:
      "Histórico de atividade (RLS). Informe task_id ou operation_id. Filtros: category (all|created|updated|status|assignee|comments), date_preset (all|today|7d|30d).",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        operation_id: { type: "string" },
        category: {
          type: "string",
          enum: ["all", "created", "updated", "status", "assignee", "comments"],
        },
        date_preset: { type: "string", enum: ["all", "today", "7d", "30d"] },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
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
  {
    name: "create_service_product",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: cria produto (service_products).",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "update_service_product",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: atualiza produto.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" }, ...idem },
      required: ["product_id"],
    },
  },
  {
    name: "archive_service_product",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: arquiva produto.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" }, ...idem },
      required: ["product_id"],
    },
  },
  {
    name: "restore_service_product",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: restaura produto arquivado.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" }, ...idem },
      required: ["product_id"],
    },
  },
  {
    name: "create_quick_win_catalog_item",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: tipo de quick win.",
    inputSchema: { type: "object", properties: { ...idem } },
  },
  {
    name: "archive_quick_win_catalog_item",
    access: "admin",
    idempotent: true,
    description: "Catálogo admin: arquiva tipo QW.",
    inputSchema: {
      type: "object",
      properties: { catalog_item_id: { type: "string" }, ...idem },
      required: ["catalog_item_id"],
    },
  },
  {
    name: "list_allocations",
    access: "read",
    description: "Alocações da frente.",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" } },
      required: ["frente_id"],
    },
  },
  {
    name: "create_allocation",
    access: "write",
    idempotent: true,
    description: "Cria alocação pessoa×frente.",
    inputSchema: {
      type: "object",
      properties: { frente_id: { type: "string" }, ...idem },
      required: ["frente_id", "person_id", "role", "start_date"],
    },
  },
  {
    name: "update_allocation",
    access: "write",
    idempotent: true,
    description: "Atualiza alocação.",
    inputSchema: {
      type: "object",
      properties: { allocation_id: { type: "string" }, ...idem },
      required: ["allocation_id", "person_id", "role", "start_date"],
    },
  },
  {
    name: "list_quick_wins",
    access: "read",
    description: "Quick wins da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_quick_win",
    access: "write",
    idempotent: true,
    description: "Cria quick win + impactos (cap vilão).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "title", "happened_at"],
    },
  },
  {
    name: "list_sla_incidents",
    access: "read",
    description: "Incidentes SLA da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_sla_incident",
    access: "write",
    idempotent: true,
    description: "Abre incidente SLA.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "title", "severity", "status", "opened_at"],
    },
  },
  {
    name: "update_sla_incident",
    access: "write",
    idempotent: true,
    description: "Atualiza incidente SLA.",
    inputSchema: {
      type: "object",
      properties: { incident_id: { type: "string" }, ...idem },
      required: ["incident_id", "title", "severity", "status", "opened_at"],
    },
  },
  {
    name: "list_operation_ntfy_topics",
    access: "read",
    description: "Lista tópicos ntfy mapeados na operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_operation_ntfy_topic",
    access: "write",
    idempotent: true,
    description: "Cadastra mapeamento tópico ntfy → operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, topic: { type: "string" }, ...idem },
      required: ["operation_id", "topic", "default_problem_origin"],
    },
  },
  {
    name: "delete_operation_ntfy_topic",
    access: "write",
    idempotent: true,
    description: "Remove mapeamento de tópico ntfy.",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string" },
        topic_id: { type: "string" },
        ...idem,
      },
      required: ["operation_id", "topic_id"],
    },
  },
  {
    name: "list_ntfy_unmapped_alerts",
    access: "read",
    description: "Fila de triagem: alertas ntfy sem tópico mapeado (admin).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "list_operation_costs",
    access: "read",
    description: "Lista custos ad-hoc da operação (operation_costs).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "get_operation_monthly_costs",
    access: "read",
    description:
      "Breakdown mensal de custos (itens categorizados, ad-hoc, alocações, impostos) e margem sobre MRR.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_operation_cost",
    access: "admin",
    idempotent: true,
    description:
      "Adiciona custo à operação (categoria, recorrência, datas).",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string" },
        category: {
          type: "string",
          enum: ["comissoes", "servicos_terceiros", "time", "infra"],
        },
        ...idem,
      },
      required: [
        "operation_id",
        "category",
        "label",
        "amount",
        "recurrence",
        "started_at",
      ],
    },
  },
  {
    name: "update_operation_cost",
    access: "admin",
    idempotent: true,
    description:
      "Atualiza custo parcialmente. notes e ended_at: null limpam (clearable).",
    inputSchema: {
      type: "object",
      properties: {
        cost_id: { type: "string" },
        category: {
          type: "string",
          enum: [
            "comissoes",
            "servicos_terceiros",
            "time",
            "infra",
            "a_classificar",
          ],
        },
        notes: { type: ["string", "null"] },
        ended_at: { type: ["string", "null"] },
        ...idem,
      },
      required: ["cost_id"],
    },
  },
  {
    name: "delete_operation_cost",
    access: "admin",
    idempotent: true,
    description: "Remove um custo da operação.",
    inputSchema: {
      type: "object",
      properties: { cost_id: { type: "string" }, ...idem },
      required: ["cost_id"],
    },
  },
  {
    name: "list_meeting_agenda_items",
    access: "read",
    description: "Itens de pauta da reunião.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" } },
      required: ["meeting_id"],
    },
  },
  {
    name: "add_meeting_agenda_item",
    access: "write",
    idempotent: true,
    description: "Adiciona item de pauta.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" }, title: { type: "string" }, ...idem },
      required: ["meeting_id", "title"],
    },
  },
  {
    name: "update_meeting_agenda_item",
    access: "write",
    idempotent: true,
    description: "Atualiza item de pauta.",
    inputSchema: {
      type: "object",
      properties: { agenda_item_id: { type: "string" }, ...idem },
      required: ["agenda_item_id"],
    },
  },
  {
    name: "list_meeting_next_steps",
    access: "read",
    description: "Próximos passos da reunião.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" } },
      required: ["meeting_id"],
    },
  },
  {
    name: "add_meeting_next_step",
    access: "write",
    idempotent: true,
    description: "Adiciona próximo passo.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" }, description: { type: "string" }, ...idem },
      required: ["meeting_id", "description"],
    },
  },
  {
    name: "update_meeting_next_step",
    access: "write",
    idempotent: true,
    description: "Atualiza próximo passo.",
    inputSchema: {
      type: "object",
      properties: { next_step_id: { type: "string" }, ...idem },
      required: ["next_step_id"],
    },
  },
  {
    name: "promote_meeting_next_step_to_task",
    access: "write",
    idempotent: true,
    description: "Cria tarefa na Frente a partir do próximo passo, já vinculada.",
    inputSchema: {
      type: "object",
      properties: {
        next_step_id: { type: "string" },
        frente_id: { type: "string" },
        ...idem,
      },
      required: ["next_step_id", "frente_id"],
    },
  },
  {
    name: "list_operation_risk_blockers",
    access: "read",
    description:
      "Riscos e bloqueios da operação (fora do SLA Dryos).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, limit: { type: "number" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_operation_risk_blocker",
    access: "write",
    idempotent: true,
    description: "Registra risco ou bloqueio na operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, title: { type: "string" }, ...idem },
      required: ["operation_id", "title", "kind"],
    },
  },
  {
    name: "update_operation_risk_blocker",
    access: "write",
    idempotent: true,
    description: "Atualiza risco/bloqueio; null limpa vínculos opcionais.",
    inputSchema: {
      type: "object",
      properties: { risk_blocker_id: { type: "string" }, ...idem },
      required: ["risk_blocker_id"],
    },
  },
  {
    name: "list_operation_villains",
    access: "read",
    description: "Vilões vinculados à operação (progresso).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "create_client_contract",
    access: "admin",
    idempotent: true,
    description:
      "Cria contrato só metadados (sem arquivo). Para PDF use upload_client_contract.",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, ...idem },
      required: ["client_id", "label"],
    },
  },
  {
    name: "list_client_charges",
    access: "admin",
    description: "Lista cobranças do cliente (previstas, pagas, atrasadas).",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        contract_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "generate_client_charges",
    access: "admin",
    idempotent: true,
    description:
      "Gera cobranças previstas a partir do contrato vigente (mensalidade + implantação).",
    inputSchema: {
      type: "object",
      properties: {
        contract_id: { type: "string" },
        months_ahead: { type: "number", description: "1–36, default 12" },
      },
      required: ["contract_id"],
    },
  },
  {
    name: "mark_client_charge_paid",
    access: "admin",
    idempotent: true,
    description: "Registra pagamento (valor e data); quitado se paid_amount >= amount.",
    inputSchema: {
      type: "object",
      properties: {
        charge_id: { type: "string" },
        paid_at: { type: "string", description: "AAAA-MM-DD" },
        paid_amount: { type: "number" },
        payment_method: { type: "string" },
      },
      required: ["charge_id", "paid_at", "paid_amount"],
    },
  },
  {
    name: "get_person",
    access: "read",
    description: "Detalhe de pessoa.",
    inputSchema: {
      type: "object",
      properties: { person_id: { type: "string" } },
      required: ["person_id"],
    },
  },
  {
    name: "update_person",
    access: "write",
    idempotent: true,
    description: "Atualiza pessoa (= updatePersonAction).",
    inputSchema: {
      type: "object",
      properties: { person_id: { type: "string" }, ...idem },
      required: ["person_id"],
    },
  },
  {
    name: "archive_person",
    access: "admin",
    idempotent: true,
    description: "Arquiva pessoa (= archivePersonAction).",
    inputSchema: {
      type: "object",
      properties: { person_id: { type: "string" }, ...idem },
      required: ["person_id"],
    },
  },
  {
    name: "get_meeting",
    access: "read",
    description: "Reunião + participantes.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" } },
      required: ["meeting_id"],
    },
  },
  {
    name: "update_meeting",
    access: "write",
    idempotent: true,
    description:
      "Atualiza reunião, campos Granola (texto/ref), participantes. Sem sync externo.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" }, ...idem },
      required: ["meeting_id"],
    },
  },
  {
    name: "get_decision",
    access: "read",
    description: "Detalhe de decisão.",
    inputSchema: {
      type: "object",
      properties: { decision_id: { type: "string" } },
      required: ["decision_id"],
    },
  },
  {
    name: "update_decision",
    access: "write",
    idempotent: true,
    description: "Atualiza decisão (= updateDecisionAction).",
    inputSchema: {
      type: "object",
      properties: { decision_id: { type: "string" }, ...idem },
      required: ["decision_id"],
    },
  },
  {
    name: "get_allocation",
    access: "read",
    description: "Detalhe de alocação.",
    inputSchema: {
      type: "object",
      properties: { allocation_id: { type: "string" } },
      required: ["allocation_id"],
    },
  },
  {
    name: "end_allocation",
    access: "write",
    idempotent: true,
    description: "Encerra alocação (end_date). Substitui deleteAllocationAction no MCP.",
    inputSchema: {
      type: "object",
      properties: { allocation_id: { type: "string" }, end_date: { type: "string" }, ...idem },
      required: ["allocation_id", "end_date"],
    },
  },
  {
    name: "get_quick_win",
    access: "read",
    description: "Quick win + impactos.",
    inputSchema: {
      type: "object",
      properties: { quick_win_id: { type: "string" } },
      required: ["quick_win_id"],
    },
  },
  {
    name: "update_quick_win",
    access: "write",
    idempotent: true,
    description: "Atualiza quick win (= updateQuickWinAction).",
    inputSchema: {
      type: "object",
      properties: { quick_win_id: { type: "string" }, ...idem },
      required: ["quick_win_id"],
    },
  },
  {
    name: "end_operation_cost",
    access: "admin",
    idempotent: true,
    description: "Encerra custo (ended_at). Substitui delete no MCP.",
    inputSchema: {
      type: "object",
      properties: { cost_id: { type: "string" }, ended_at: { type: "string" }, ...idem },
      required: ["cost_id", "ended_at"],
    },
  },
  {
    name: "create_area_task",
    access: "write",
    idempotent: true,
    description: "Tarefa de área XOR frente (= createAreaTaskAction).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, area_id: { type: "string" }, ...idem },
      required: ["operation_id", "area_id", "title", "status"],
    },
  },
  {
    name: "list_operation_comments",
    access: "read",
    description: "Thread de comentários da operação.",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" } },
      required: ["operation_id"],
    },
  },
  {
    name: "add_operation_comment",
    access: "write",
    idempotent: true,
    description: "Comentário na operação (= createOperationCommentAction).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, body: { type: "string" }, ...idem },
      required: ["operation_id", "body"],
    },
  },
  {
    name: "update_operation_comment",
    access: "write",
    idempotent: true,
    description: "Edita comentário (= updateOperationCommentAction, RLS autor).",
    inputSchema: {
      type: "object",
      properties: { comment_id: { type: "string" }, body: { type: "string" }, ...idem },
      required: ["comment_id", "body"],
    },
  },
  {
    name: "assign_operation_villain",
    access: "write",
    idempotent: true,
    description: "Atribui vilão (= assignVillainAction).",
    inputSchema: {
      type: "object",
      properties: { operation_id: { type: "string" }, ...idem },
      required: ["operation_id", "villain_id", "initial_severity", "progress_pct"],
    },
  },
  {
    name: "update_operation_villain",
    access: "write",
    idempotent: true,
    description: "Atualiza evidência (= updateOperationVillainAction).",
    inputSchema: {
      type: "object",
      properties: { operation_villain_id: { type: "string" }, ...idem },
      required: ["operation_villain_id"],
    },
  },
  {
    name: "restore_quick_win_catalog_item",
    access: "admin",
    idempotent: true,
    description: "Restaura item QW catálogo (= restoreQuickWinCatalogAction).",
    inputSchema: {
      type: "object",
      properties: { catalog_item_id: { type: "string" }, ...idem },
      required: ["catalog_item_id"],
    },
  },
  {
    name: "get_client_diagnostic",
    access: "read",
    description: "Diagnóstico do cliente (simples ou gestão, último registro).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "upsert_client_diagnostic",
    access: "write",
    idempotent: true,
    description: "Notas diagnóstico simples (= upsertDiagnosticAction).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, ...idem },
      required: ["client_id", "notes"],
    },
  },
  {
    name: "save_management_diagnostic",
    access: "write",
    idempotent: true,
    description:
      "Diagnóstico gestão: persiste respostas e recomputa scores localmente (sem API externa).",
    inputSchema: {
      type: "object",
      properties: { client_id: { type: "string" }, diagnostic_id: { type: "string" }, ...idem },
      required: ["client_id"],
    },
  },
];

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = applyZodInputSchemas(
  BASE_MCP_TOOL_DEFINITIONS,
);

export function mcpToolAccess(name: string): McpAccess | null {
  return MCP_TOOL_DEFINITIONS.find((t) => t.name === name)?.access ?? null;
}

export function mcpToolIsIdempotent(name: string): boolean {
  return MCP_TOOL_DEFINITIONS.find((t) => t.name === name)?.idempotent === true;
}
