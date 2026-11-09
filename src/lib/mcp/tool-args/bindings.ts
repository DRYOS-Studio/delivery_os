import { clientSchema } from "@/lib/validators/client";
import { decisionSchema } from "@/lib/validators/decision";
import { allocationSchema } from "@/lib/validators/allocation";
import { operationCostSchema } from "@/lib/validators/operationCost";
import { quickWinSchema } from "@/lib/validators/quick-win";
import { personSchema } from "@/lib/validators/person";
import { meetingSchema } from "@/lib/validators/meeting";
import { incidentSchema } from "@/lib/validators/incident";
import { frenteSchema } from "@/lib/validators/frente";
import { briefingSchema } from "@/lib/validators/briefing";
import { diagnosticSchema } from "@/lib/validators/diagnostic";
import { managementDiagnosticSaveSchema } from "@/lib/validators/management-diagnostic";
import { serviceProductSchema } from "@/lib/validators/service-product";
import { quickWinCatalogSchema } from "@/lib/validators/quick-win-catalog";
import {
  assignVillainSchema,
  editOperationVillainSchema,
} from "@/lib/validators/operation-villain";
import { mcpUpdateOperationMonthlyCostItemSchema } from "@/lib/mcp/tool-args/operation-monthly-cost-item-update";
import { mcpUpdateTaskSchema } from "@/lib/mcp/tool-args/task-update";
import { mcpDecisionUpdateSchema } from "@/lib/mcp/tool-args/decision-update";
import {
  mcpCreateOperationRiskBlockerSchema,
  mcpPromoteMeetingNextStepSchema,
  mcpUpdateOperationRiskBlockerSchema,
} from "@/lib/mcp/tool-args/operation-risk-blocker-update";
import {
  mcpAddMeetingNextStepSchema,
  mcpMeetingUpdateBodySchema,
  mcpUpdateMeetingNextStepSchema,
} from "@/lib/mcp/tool-args/meeting-update";
import { taskFieldsSchema, taskStatusEnum } from "@/lib/validators/task";
import { WRITABLE_STATUSES } from "@/lib/utils/operation-status";
import type { McpToolDefinition } from "@/lib/mcp/tools/registry-types";
import { z } from "zod";
import {
  clientContractMcpBodySchema,
  createClientContractMcpSchema,
  updateClientContractMcpSchema,
} from "@/lib/mcp/tool-args/contracts";
import { mcpInputSchemaFromZod } from "@/lib/mcp/tool-args/mcp-json-schema";
import {
  repositoryLinkCreateSchema,
  repositoryLinkUpdateSchema,
} from "@/lib/validators/repository-link";
import {
  clientTechItemSchema,
  clientTechItemUpdateSchema,
} from "@/lib/validators/client-tech-item";
import {
  clientSoftwareItemSchema,
  clientSoftwareItemUpdateSchema,
} from "@/lib/validators/client-software-item";
import { createInvitationSchema } from "@/lib/validators/client-registration";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const operationMcpBody = z
  .object({
    client_id: uuid.optional(),
    product_line: z.enum(["core", "spark", "studio"]),
    name: z.string().trim().min(1).max(160),
    status: z.enum(WRITABLE_STATUSES as [string, ...string[]]),
    recurrence: z.enum(["mensal", "trimestral", "anual", "unica"]).optional(),
    monthly_recurring_revenue: z.number().nonnegative().nullable().optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    response_hours: z.number().int().min(0).max(720).optional(),
    resolution_hours: z.number().int().min(0).max(720).optional(),
    tax_rate_pct: z.number().min(0).max(100).nullable().optional(),
    diagnostic_id: uuid.optional(),
    notification_webhook_url: z.string().max(500).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.start_date && d.end_date && d.end_date < d.start_date) {
      ctx.addIssue({ code: "custom", message: "end_date ≥ start_date", path: ["end_date"] });
    }
  });

export const MCP_TOOL_ZOD_ARGS: Record<string, z.ZodType> = {
  create_client: clientSchema,
  update_client: clientSchema.extend({ client_id: uuid }),
  archive_client: z.object({ client_id: uuid, confirm: z.literal(true) }),
  restore_client: z.object({ client_id: uuid }),
  create_client_contract: createClientContractMcpSchema,
  update_client_contract: updateClientContractMcpSchema,
  upload_client_contract: createClientContractMcpSchema.extend({
    filename: z.string().min(1).max(255),
    mime_type: z.string().min(1).max(120),
    content_base64: z.string().min(1),
  }),
  finalize_client_contract_upload: createClientContractMcpSchema.extend({
    storage_path: z.string().min(3),
    filename: z.string().min(1),
    mime_type: z.string().min(1),
    size_bytes: z.number().int().positive().max(52_428_800),
  }),
  create_operation: operationMcpBody,
  update_operation: operationMcpBody.extend({ operation_id: uuid }),
  archive_operation: z.object({ operation_id: uuid, confirm: z.literal(true) }),
  add_operation_member: z.object({ operation_id: uuid, profile_id: uuid }),
  remove_operation_member: z.object({ operation_id: uuid, profile_id: uuid }),
  create_frente: frenteSchema.and(z.object({ operation_id: uuid })),
  update_frente: frenteSchema.and(z.object({ frente_id: uuid })),
  archive_frente: z.object({ frente_id: uuid, confirm: z.literal(true) }),
  create_task: taskFieldsSchema.extend({ frente_id: uuid }),
  update_task: mcpUpdateTaskSchema,
  change_task_status: z.object({ task_id: uuid, status: taskStatusEnum }),
  add_task_comment: z.object({ task_id: uuid, body: z.string().min(1).max(8000) }),
  create_area_task: taskFieldsSchema
    .extend({ operation_id: uuid })
    .refine((d) => Boolean(d.area_id), { message: "area_id obrigatório" }),
  create_person: personSchema,
  update_person: z.intersection(personSchema, z.object({ person_id: uuid })),
  archive_person: z.object({ person_id: uuid }),
  create_meeting: meetingSchema.and(z.object({ operation_id: uuid })),
  update_meeting: mcpMeetingUpdateBodySchema,
  add_meeting_next_step: mcpAddMeetingNextStepSchema,
  update_meeting_next_step: mcpUpdateMeetingNextStepSchema,
  promote_meeting_next_step_to_task: mcpPromoteMeetingNextStepSchema,
  list_operation_risk_blockers: z.object({
    operation_id: uuid,
    limit: z.number().int().positive().max(100).optional(),
  }),
  create_operation_risk_blocker: mcpCreateOperationRiskBlockerSchema,
  update_operation_risk_blocker: mcpUpdateOperationRiskBlockerSchema,
  create_decision: decisionSchema.and(z.object({ operation_id: uuid })),
  update_decision: mcpDecisionUpdateSchema,
  upsert_operation_briefing: briefingSchema.and(z.object({ operation_id: uuid })),
  create_allocation: allocationSchema.and(z.object({ frente_id: uuid })),
  update_allocation: allocationSchema.and(z.object({ allocation_id: uuid })),
  end_allocation: z.object({ allocation_id: uuid, end_date: isoDate }),
  create_quick_win: quickWinSchema.and(z.object({ operation_id: uuid })),
  update_quick_win: quickWinSchema.and(z.object({ quick_win_id: uuid })),
  create_sla_incident: incidentSchema.and(z.object({ operation_id: uuid })),
  update_sla_incident: incidentSchema.and(z.object({ incident_id: uuid })),
  create_operation_cost: operationCostSchema.and(z.object({ operation_id: uuid })),
  update_operation_cost: operationCostSchema.and(z.object({ cost_id: uuid })),
  end_operation_cost: z.object({ cost_id: uuid, ended_at: isoDate }),
  get_operation_monthly_costs: z.object({ operation_id: uuid }),
  list_operation_monthly_cost_items: z.object({ operation_id: uuid }),
  create_operation_monthly_cost_item: z
    .object({
      operation_id: uuid,
      category: z.enum([
        "comissoes",
        "servicos_terceiros",
        "time",
        "infra",
      ]),
      amount: z.number().nonnegative(),
      description: z.string().max(500).nullable().optional(),
    }),
  update_operation_monthly_cost_item: mcpUpdateOperationMonthlyCostItemSchema,
  delete_operation_monthly_cost_item: z.object({ item_id: uuid }),
  create_service_product: serviceProductSchema,
  update_service_product: serviceProductSchema.extend({ product_id: uuid }),
  archive_service_product: z.object({ product_id: uuid }),
  restore_service_product: z.object({ product_id: uuid }),
  create_quick_win_catalog_item: quickWinCatalogSchema,
  archive_quick_win_catalog_item: z.object({ catalog_item_id: uuid }),
  restore_quick_win_catalog_item: z.object({ catalog_item_id: uuid }),
  assign_operation_villain: assignVillainSchema.and(z.object({ operation_id: uuid })),
  update_operation_villain: editOperationVillainSchema.and(z.object({ operation_villain_id: uuid })),
  add_operation_comment: z.object({ operation_id: uuid, body: z.string().min(1).max(8000) }),
  update_operation_comment: z.object({ comment_id: uuid, body: z.string().min(1).max(8000) }),
  upsert_client_diagnostic: diagnosticSchema.and(z.object({ client_id: uuid })),
  save_management_diagnostic: managementDiagnosticSaveSchema.and(
    z.object({
      client_id: uuid,
      diagnostic_id: uuid.optional(),
    }),
  ),
  list_repository_links: z.object({
    client_id: uuid,
    operation_id: uuid.optional(),
    frente_id: uuid.optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  create_repository_link: repositoryLinkCreateSchema,
  update_repository_link: repositoryLinkUpdateSchema,
  delete_repository_link: z.object({ link_id: uuid }),
  list_client_tech_items: z.object({ client_id: uuid }),
  create_client_tech_item: clientTechItemSchema.and(z.object({ client_id: uuid })),
  update_client_tech_item: clientTechItemUpdateSchema,
  delete_client_tech_item: z.object({ client_id: uuid, item_id: uuid }),
  list_client_software_items: z.object({ client_id: uuid }),
  create_client_software_item: clientSoftwareItemSchema.and(
    z.object({ client_id: uuid }),
  ),
  update_client_software_item: clientSoftwareItemUpdateSchema,
  delete_client_software_item: z.object({ client_id: uuid, item_id: uuid }),
  create_client_registration_invitation: createInvitationSchema,
  list_client_registration_invitations: z.object({
    status: z
      .enum(["enviado", "preenchido", "aprovado", "expirado", "cancelado"])
      .optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().nonnegative().optional(),
  }),
  get_client_registration_submission: z.object({ invitation_id: uuid }),
  approve_client_registration_invitation: z.object({ invitation_id: uuid }),
};

export function applyZodInputSchemas(definitions: McpToolDefinition[]): McpToolDefinition[] {
  return definitions.map((d) => {
    const zod = MCP_TOOL_ZOD_ARGS[d.name];
    if (!zod) return d;
    return { ...d, inputSchema: mcpInputSchemaFromZod(zod) };
  });
}
