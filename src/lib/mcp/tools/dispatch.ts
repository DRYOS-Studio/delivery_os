import type { McpAuthContext } from "@/lib/mcp/resolve-caller-jwt";
import { mcpHasWriteScope } from "@/lib/mcp/scope";
import {
  mcpGetAttachmentDownloadUrl,
  mcpListAttachments,
  mcpListQuickWinCatalog,
  mcpListServiceProducts,
  mcpListCatalogVillains,
  mcpUploadAttachment,
} from "@/lib/mcp/tools/catalog-attachment-tools";
import {
  mcpCreateClient,
  mcpGetClient,
  mcpListClients,
  mcpRestoreClient,
  mcpUpdateClient,
  mcpArchiveClient,
} from "@/lib/mcp/tools/clients-tools";
import {
  mcpCreateClientSoftwareItem,
  mcpCreateClientTechItem,
  mcpDeleteClientSoftwareItem,
  mcpDeleteClientTechItem,
  mcpListClientSoftwareItems,
  mcpListClientTechItems,
  mcpUpdateClientSoftwareItem,
  mcpUpdateClientTechItem,
} from "@/lib/mcp/tools/client-tooling-tools";
import {
  mcpCreateRepositoryLink,
  mcpDeleteRepositoryLink,
  mcpListRepositoryLinks,
  mcpUpdateRepositoryLink,
} from "@/lib/mcp/tools/repository-links-tools";
import {
  mcpBeginClientContractUpload,
  mcpCreateClientContract,
  mcpFinalizeClientContractUpload,
  mcpGetClientContract,
  mcpGetClientContractDownloadUrl,
  mcpListClientContracts,
  mcpUpdateClientContract,
  mcpUploadClientContract,
} from "@/lib/mcp/tools/contracts-tools";
import {
  mcpCreateDecision,
  mcpCreateMeeting,
  mcpCreatePerson,
  mcpGetOperationBriefing,
  mcpListDecisions,
  mcpListMeetings,
  mcpListPersons,
  mcpUpsertOperationBriefing,
} from "@/lib/mcp/tools/collaboration-tools";
import {
  mcpArchiveQuickWinCatalogItem,
  mcpArchiveServiceProduct,
  mcpCreateQuickWinCatalogItem,
  mcpCreateServiceProduct,
  mcpRestoreQuickWinCatalogItem,
  mcpRestoreServiceProduct,
  mcpUpdateServiceProduct,
} from "@/lib/mcp/tools/catalog-admin-tools";
import {
  mcpAddMeetingAgendaItem,
  mcpAddMeetingNextStep,
  mcpCreateAllocation,
  mcpCreateOperationCost,
  mcpCreateQuickWin,
  mcpCreateSlaIncident,
  mcpEndAllocation,
  mcpEndOperationCost,
  mcpGetAllocation,
  mcpGetQuickWin,
  mcpListAllocations,
  mcpListMeetingAgendaItems,
  mcpListMeetingNextSteps,
  mcpGetOperationMonthlyCosts,
  mcpListOperationCosts,
  mcpListOperationVillains,
  mcpListQuickWins,
  mcpListSlaIncidents,
  mcpUpdateAllocation,
  mcpUpdateMeetingAgendaItem,
  mcpUpdateMeetingNextStep,
  mcpUpdateOperationCost,
  mcpUpdateQuickWin,
  mcpUpdateSlaIncident,
} from "@/lib/mcp/tools/delivery-ops-tools";
import {
  mcpArchiveFrente,
  mcpCreateFrente,
  mcpGetFrente,
  mcpListFrentes,
  mcpUpdateFrente,
} from "@/lib/mcp/tools/frentes-tools";
import {
  mcpAddOperationMember,
  mcpArchiveOperation,
  mcpCreateOperation,
  mcpGetOperation,
  mcpListOperationMembers,
  mcpListOperations,
  mcpRemoveOperationMember,
  mcpUpdateOperation,
} from "@/lib/mcp/tools/operations-tools";
import {
  mcpAddOperationComment,
  mcpArchivePerson,
  mcpAssignOperationVillain,
  mcpGetClientDiagnostic,
  mcpGetDecision,
  mcpGetMeeting,
  mcpGetPerson,
  mcpListOperationComments,
  mcpSaveManagementDiagnostic,
  mcpUpdateDecision,
  mcpUpdateMeeting,
  mcpUpdateOperationComment,
  mcpUpdateOperationVillain,
  mcpUpdatePerson,
  mcpUpsertClientDiagnostic,
} from "@/lib/mcp/tools/parity-tools";
import { mcpToolAccess } from "@/lib/mcp/tools/registry";
import { idempotencyKeyFromArgs, type McpHandlerContext } from "@/lib/mcp/tools/shared";
import {
  mcpAddTaskComment,
  mcpChangeTaskStatus,
  mcpCreateAreaTask,
  mcpCreateDeliveryTask,
  mcpGetTask,
  mcpListTasks,
  mcpUpdateTask,
} from "@/lib/mcp/tools/task-tools";

export type DispatchInput = {
  toolName: string;
  args: Record<string, unknown>;
  ctx: McpHandlerContext;
  mcpCtx?: McpAuthContext | undefined;
};

function flattenResult<T extends Record<string, unknown>>(r: {
  ok: boolean;
  message?: string;
  notFound?: boolean;
  forbidden?: boolean;
  data?: T;
}) {
  if (!r.ok) {
    return {
      ok: false as const,
      error: r.message ?? "Erro.",
      code: r.forbidden ? "forbidden" : r.notFound ? "not_found" : undefined,
    };
  }
  return { ok: true as const, ...(r.data ?? {}) };
}

export function mcpAccessDenied(
  toolName: string,
  mcpCtx?: McpAuthContext,
): { ok: false; error: string } | null {
  const access = mcpToolAccess(toolName);
  if (!access) return { ok: false, error: `Ferramenta desconhecida: ${toolName}` };
  if ((access === "write" || access === "admin") && mcpCtx && !mcpHasWriteScope(mcpCtx)) {
    return { ok: false, error: "Token somente leitura (read)." };
  }
  return null;
}

export async function dispatchMcpTool(input: DispatchInput): Promise<unknown> {
  const { toolName, args, ctx, mcpCtx } = input;
  const denied = mcpAccessDenied(toolName, mcpCtx);
  if (denied) return denied;

  switch (toolName) {
    case "list_operations": {
      const r = await mcpListOperations(ctx, args);
      return flattenResult(r);
    }
    case "get_operation": {
      const r = await mcpGetOperation(ctx, args);
      return flattenResult(r);
    }
    case "create_operation": {
      const r = await mcpCreateOperation(ctx, args);
      return flattenResult(r);
    }
    case "update_operation": {
      const r = await mcpUpdateOperation(ctx, args);
      return flattenResult(r);
    }
    case "archive_operation": {
      const r = await mcpArchiveOperation(ctx, args);
      return flattenResult(r);
    }
    case "list_operation_members": {
      const r = await mcpListOperationMembers(ctx, args);
      return flattenResult(r);
    }
    case "add_operation_member": {
      const r = await mcpAddOperationMember(ctx, args);
      return flattenResult(r);
    }
    case "remove_operation_member": {
      const r = await mcpRemoveOperationMember(ctx, args);
      return flattenResult(r);
    }
    case "list_clients": {
      const r = await mcpListClients(ctx, args);
      return flattenResult(r);
    }
    case "get_client": {
      const r = await mcpGetClient(ctx, args);
      return flattenResult(r);
    }
    case "create_client": {
      const r = await mcpCreateClient(ctx, args);
      return flattenResult(r);
    }
    case "update_client": {
      const r = await mcpUpdateClient(ctx, args);
      return flattenResult(r);
    }
    case "archive_client": {
      const r = await mcpArchiveClient(ctx, args);
      return flattenResult(r);
    }
    case "restore_client": {
      const r = await mcpRestoreClient(ctx, args);
      return flattenResult(r);
    }
    case "list_repository_links": {
      const r = await mcpListRepositoryLinks(ctx, args);
      return flattenResult(r);
    }
    case "create_repository_link": {
      const r = await mcpCreateRepositoryLink(ctx, args);
      return flattenResult(r);
    }
    case "update_repository_link": {
      const r = await mcpUpdateRepositoryLink(ctx, args);
      return flattenResult(r);
    }
    case "delete_repository_link": {
      const r = await mcpDeleteRepositoryLink(ctx, args);
      return flattenResult(r);
    }
    case "list_client_tech_items": {
      const r = await mcpListClientTechItems(ctx, args);
      return flattenResult(r);
    }
    case "create_client_tech_item": {
      const r = await mcpCreateClientTechItem(ctx, args);
      return flattenResult(r);
    }
    case "update_client_tech_item": {
      const r = await mcpUpdateClientTechItem(ctx, args);
      return flattenResult(r);
    }
    case "delete_client_tech_item": {
      const r = await mcpDeleteClientTechItem(ctx, args);
      return flattenResult(r);
    }
    case "list_client_software_items": {
      const r = await mcpListClientSoftwareItems(ctx, args);
      return flattenResult(r);
    }
    case "create_client_software_item": {
      const r = await mcpCreateClientSoftwareItem(ctx, args);
      return flattenResult(r);
    }
    case "update_client_software_item": {
      const r = await mcpUpdateClientSoftwareItem(ctx, args);
      return flattenResult(r);
    }
    case "delete_client_software_item": {
      const r = await mcpDeleteClientSoftwareItem(ctx, args);
      return flattenResult(r);
    }
    case "list_client_contracts": {
      const r = await mcpListClientContracts(ctx, args);
      return flattenResult(r);
    }
    case "get_client_contract": {
      const r = await mcpGetClientContract(ctx, args);
      return flattenResult(r);
    }
    case "create_client_contract": {
      const r = await mcpCreateClientContract(ctx, args);
      return flattenResult(r);
    }
    case "update_client_contract": {
      const r = await mcpUpdateClientContract(ctx, args);
      return flattenResult(r);
    }
    case "upload_client_contract": {
      const r = await mcpUploadClientContract(ctx, args);
      return flattenResult(r);
    }
    case "begin_client_contract_upload": {
      const r = await mcpBeginClientContractUpload(ctx, args);
      return flattenResult(r);
    }
    case "finalize_client_contract_upload": {
      const r = await mcpFinalizeClientContractUpload(ctx, args);
      return flattenResult(r);
    }
    case "get_client_contract_download_url": {
      const r = await mcpGetClientContractDownloadUrl(ctx, args);
      return flattenResult(r);
    }
    case "list_frentes": {
      const r = await mcpListFrentes(ctx, args);
      return flattenResult(r);
    }
    case "get_frente": {
      const r = await mcpGetFrente(ctx, args);
      return flattenResult(r);
    }
    case "create_frente": {
      const r = await mcpCreateFrente(ctx, args);
      return flattenResult(r);
    }
    case "update_frente": {
      const r = await mcpUpdateFrente(ctx, args);
      return flattenResult(r);
    }
    case "archive_frente": {
      const r = await mcpArchiveFrente(ctx, args);
      return flattenResult(r);
    }
    case "list_tasks": {
      const r = await mcpListTasks(ctx.supabase, args);
      return r.ok ? { ok: true, tasks: r.tasks } : { ok: false, error: r.message };
    }
    case "get_task": {
      const r = await mcpGetTask(ctx.supabase, args);
      return r.ok ? { ok: true, task: r.task } : { ok: false, error: r.message };
    }
    case "create_task": {
      const r = await mcpCreateDeliveryTask(ctx.supabase, args);
      return r;
    }
    case "create_area_task": {
      const r = await mcpCreateAreaTask(ctx.supabase, args);
      return r;
    }
    case "update_task": {
      const r = await mcpUpdateTask(ctx.supabase, args);
      return r;
    }
    case "change_task_status": {
      const r = await mcpChangeTaskStatus(ctx.supabase, args);
      return r;
    }
    case "add_task_comment": {
      const r = await mcpAddTaskComment(ctx.supabase, args, ctx.callerUserId);
      return r;
    }
    case "list_persons": {
      const r = await mcpListPersons(ctx, args);
      return flattenResult(r);
    }
    case "create_person": {
      const r = await mcpCreatePerson(ctx, args);
      return flattenResult(r);
    }
    case "get_person": {
      return flattenResult(await mcpGetPerson(ctx, args));
    }
    case "update_person": {
      return flattenResult(await mcpUpdatePerson(ctx, args));
    }
    case "archive_person": {
      return flattenResult(await mcpArchivePerson(ctx, args));
    }
    case "list_meetings": {
      const r = await mcpListMeetings(ctx, args);
      return flattenResult(r);
    }
    case "create_meeting": {
      const r = await mcpCreateMeeting(ctx, args);
      return flattenResult(r);
    }
    case "get_meeting": {
      return flattenResult(await mcpGetMeeting(ctx, args));
    }
    case "update_meeting": {
      return flattenResult(await mcpUpdateMeeting(ctx, args));
    }
    case "list_decisions": {
      const r = await mcpListDecisions(ctx, args);
      return flattenResult(r);
    }
    case "create_decision": {
      const r = await mcpCreateDecision(ctx, args);
      return flattenResult(r);
    }
    case "get_decision": {
      return flattenResult(await mcpGetDecision(ctx, args));
    }
    case "update_decision": {
      return flattenResult(await mcpUpdateDecision(ctx, args));
    }
    case "get_operation_briefing": {
      const r = await mcpGetOperationBriefing(ctx, args);
      return flattenResult(r);
    }
    case "upsert_operation_briefing": {
      const r = await mcpUpsertOperationBriefing(ctx, args);
      return flattenResult(r);
    }
    case "list_service_products": {
      const r = await mcpListServiceProducts(ctx, args);
      return flattenResult(r);
    }
    case "list_villains": {
      const r = await mcpListCatalogVillains(ctx);
      return flattenResult(r);
    }
    case "list_quick_win_catalog": {
      const r = await mcpListQuickWinCatalog(ctx);
      return flattenResult(r);
    }
    case "list_attachments": {
      const r = await mcpListAttachments(ctx, args);
      return flattenResult(r);
    }
    case "upload_attachment": {
      const r = await mcpUploadAttachment(ctx, args);
      return flattenResult(r);
    }
    case "get_attachment_download_url": {
      const r = await mcpGetAttachmentDownloadUrl(ctx, args);
      return flattenResult(r);
    }
    case "create_service_product": {
      return flattenResult(await mcpCreateServiceProduct(ctx, args));
    }
    case "update_service_product": {
      return flattenResult(await mcpUpdateServiceProduct(ctx, args));
    }
    case "archive_service_product": {
      return flattenResult(await mcpArchiveServiceProduct(ctx, args));
    }
    case "restore_service_product": {
      return flattenResult(await mcpRestoreServiceProduct(ctx, args));
    }
    case "create_quick_win_catalog_item": {
      return flattenResult(await mcpCreateQuickWinCatalogItem(ctx, args));
    }
    case "archive_quick_win_catalog_item": {
      return flattenResult(await mcpArchiveQuickWinCatalogItem(ctx, args));
    }
    case "restore_quick_win_catalog_item": {
      return flattenResult(await mcpRestoreQuickWinCatalogItem(ctx, args));
    }
    case "list_allocations": {
      return flattenResult(await mcpListAllocations(ctx, args));
    }
    case "create_allocation": {
      return flattenResult(await mcpCreateAllocation(ctx, args));
    }
    case "update_allocation": {
      return flattenResult(await mcpUpdateAllocation(ctx, args));
    }
    case "get_allocation": {
      return flattenResult(await mcpGetAllocation(ctx, args));
    }
    case "end_allocation": {
      return flattenResult(await mcpEndAllocation(ctx, args));
    }
    case "list_quick_wins": {
      return flattenResult(await mcpListQuickWins(ctx, args));
    }
    case "create_quick_win": {
      return flattenResult(await mcpCreateQuickWin(ctx, args));
    }
    case "get_quick_win": {
      return flattenResult(await mcpGetQuickWin(ctx, args));
    }
    case "update_quick_win": {
      return flattenResult(await mcpUpdateQuickWin(ctx, args));
    }
    case "list_sla_incidents": {
      return flattenResult(await mcpListSlaIncidents(ctx, args));
    }
    case "create_sla_incident": {
      return flattenResult(await mcpCreateSlaIncident(ctx, args));
    }
    case "update_sla_incident": {
      return flattenResult(await mcpUpdateSlaIncident(ctx, args));
    }
    case "list_operation_costs": {
      return flattenResult(await mcpListOperationCosts(ctx, args));
    }
    case "get_operation_monthly_costs": {
      return flattenResult(await mcpGetOperationMonthlyCosts(ctx, args));
    }
    case "create_operation_cost": {
      return flattenResult(await mcpCreateOperationCost(ctx, args));
    }
    case "update_operation_cost": {
      return flattenResult(await mcpUpdateOperationCost(ctx, args));
    }
    case "end_operation_cost": {
      return flattenResult(await mcpEndOperationCost(ctx, args));
    }
    case "list_meeting_agenda_items": {
      return flattenResult(await mcpListMeetingAgendaItems(ctx, args));
    }
    case "add_meeting_agenda_item": {
      return flattenResult(await mcpAddMeetingAgendaItem(ctx, args));
    }
    case "update_meeting_agenda_item": {
      return flattenResult(await mcpUpdateMeetingAgendaItem(ctx, args));
    }
    case "list_meeting_next_steps": {
      return flattenResult(await mcpListMeetingNextSteps(ctx, args));
    }
    case "add_meeting_next_step": {
      return flattenResult(await mcpAddMeetingNextStep(ctx, args));
    }
    case "update_meeting_next_step": {
      return flattenResult(await mcpUpdateMeetingNextStep(ctx, args));
    }
    case "list_operation_villains": {
      return flattenResult(await mcpListOperationVillains(ctx, args));
    }
    case "assign_operation_villain": {
      return flattenResult(await mcpAssignOperationVillain(ctx, args));
    }
    case "update_operation_villain": {
      return flattenResult(await mcpUpdateOperationVillain(ctx, args));
    }
    case "list_operation_comments": {
      return flattenResult(await mcpListOperationComments(ctx, args));
    }
    case "add_operation_comment": {
      return flattenResult(await mcpAddOperationComment(ctx, args));
    }
    case "update_operation_comment": {
      return flattenResult(await mcpUpdateOperationComment(ctx, args));
    }
    case "get_client_diagnostic": {
      return flattenResult(await mcpGetClientDiagnostic(ctx, args));
    }
    case "upsert_client_diagnostic": {
      return flattenResult(await mcpUpsertClientDiagnostic(ctx, args));
    }
    case "save_management_diagnostic": {
      return flattenResult(await mcpSaveManagementDiagnostic(ctx, args));
    }
    default:
      return { ok: false, error: `Ferramenta desconhecida: ${toolName}` };
  }
}

export function mcpIdempotencyScope(toolName: string): string | null {
  if (!idempotencyKeyFromArgs({ idempotency_key: "x" })) return null;
  return toolName;
}
