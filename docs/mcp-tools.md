# MCP DeliveryOS — matriz de paridade UI (v0.5)

Servidor: `POST /api/mcp` v0.5.0. Paridade com **Server Actions** existentes; RLS obrigatório.

## Escopos

| Scope | Efeito |
|---|---|
| `read` | Ferramentas `access: read` |
| `write` | read + write |
| `admin` | write + ferramentas `access: admin` (checagem `profiles.role`) |

## Matriz Server Action → ferramenta MCP

| Server Action | Ferramenta(s) MCP | Notas |
|---|---|---|
| `createClientAction` | `create_client` | admin |
| `updateClientAction` | `update_client` | admin |
| `archiveClientAction` / `restoreClientAction` | `archive_client` / `restore_client` | confirm / admin |
| `createClientContractAction` (com arquivo) | `upload_client_contract`, `begin_client_contract_upload` + `finalize_client_contract_upload` | UI exige file; MCP também |
| *(aceite sem PDF)* | **`create_client_contract`** | Metadados só; migration `20261107060000` |
| `deleteClientContractAction` | — | **Excluído** (delete destrutivo) |
| `createOperationAction` | `create_operation` | admin |
| `updateOperationAction` | `update_operation` | admin |
| `archiveOperationAction` | `archive_operation` | admin + confirm |
| `add/removeOperationMemberAction` | `add_operation_member` / `remove_operation_member` | admin |
| `create/update/archiveFrenteAction` | `create/update/archive_frente` | archive write+confirm |
| `createAllocationAction` | `create_allocation` | |
| `updateAllocationAction` | `update_allocation` | |
| `deleteAllocationAction` | **`end_allocation`** | MCP: `end_date` (sem DELETE) |
| `create/updateQuickWinAction` | `create_quick_win` / `get_quick_win` / `update_quick_win` | |
| `deleteQuickWinAction` | — | **Excluído** (admin delete) |
| `create/updateIncidentAction` | `create/update_sla_incident` | list |
| `deleteIncidentAction` | — | **Excluído** |
| `create/update/deleteOperationCostAction` | `create/update_operation_cost` / **`end_operation_cost`** | MCP sem delete |
| `createMeetingAction` | `create_meeting` | |
| `updateMeetingAction` | `get_meeting` / `update_meeting` | Granola: `granola_suggestion_text`, `granola_source_ref`, `granola_captured_at` — **sem sync externo** |
| `deleteMeetingAction` | — | **Excluído** |
| agenda / next steps | `list/add/update_meeting_agenda_item`, `list/add/update_meeting_next_step` | |
| `createDecisionAction` | `create_decision` | |
| `updateDecisionAction` | `get_decision` / `update_decision` | |
| `deleteDecisionAction` | — | **Excluído** |
| `createPersonAction` | `create_person` | |
| `updatePersonAction` | `get_person` / `update_person` | |
| `archivePersonAction` | `archive_person` | admin |
| `createTaskAction` | `create_task` | entrega (frente) |
| `createAreaTaskAction` | `create_area_task` | `list_tasks` + `area_tasks_only: true` |
| `updateTaskAction` / `changeTaskStatusAction` | `update_task` / `change_task_status` | |
| `deleteTaskAction` | — | **Excluído** |
| `create/updateTaskCommentAction` | `add_task_comment` | update/delete comment não exposto |
| `create/updateOperationCommentAction` | `list/add/update_operation_comment` | sem delete |
| `assign/updateOperationVillainAction` | `assign_operation_villain` / `update_operation_villain` | `list_operation_villains` |
| `deleteOperationVillainAction` | — | **Excluído** (admin) |
| `create/update/archive/restoreServiceProductAction` | `create/update/archive/restore_service_product` | admin |
| `create/archive/restoreQuickWinCatalogAction` | `create/archive/restore_quick_win_catalog_item` | admin |
| `saveBriefingAction` | `get/upsert_operation_briefing` | |
| `upsertDiagnosticAction` | `get_client_diagnostic` / `upsert_client_diagnostic` | |
| `saveManagementDiagnosticAction` | `save_management_diagnostic` | Recomputa scores **local** (sem job/API) |
| `deleteDiagnosticAction` | — | **Excluído** |
| anexos | `list/upload/get_attachment_download_url` | path `operation_id/` |
| convites / tokens MCP / Bitwarden / links públicos | — | **Excluído** (segurança) |
| `execute_sql` | — | **Proibido** |

## Contrato — semântica (Assis Sat)

| Campo | Significado |
|---|---|
| `start_date` | Onboarding / início |
| `first_billing_date` | 1ª cobrança (calendário completo) |
| `payment_day_of_month` | Dia recorrente mensal |
| `implementation_fee` + `implementation_fee_paid` | Taxa paga sem data de pagamento |
| `notes` | Aceite WhatsApp |

## Migrations (épico MCP)

1. `20261107040000_client_contracts_implementation_fee.sql`
2. `20261107050000_client_contracts_billing_semantics.sql`
3. `20261107060000_client_contracts_metadata_only.sql`

## Testes

- `mcp-dispatch-access.test.ts` — read token vs todos writes/admin
- `mcp-handler-admin-guards.test.ts` — handlers `mcpRequireAdmin` com perfil member
- `npm run test:mcp-expanded-rls` — contrato metadata-only + isolamento operação
- `assis-sat-field-mapping.test.ts`

## Limites honestos restantes

| Fluxo | Motivo |
|---|---|
| `delete*` (contrato, QW, decisão, reunião, tarefa, incidente, vilão, comentário) | Política: sem delete destrutivo via MCP |
| `inviteUserAction`, tokens MCP, Bitwarden, `create/revokePublicLinkAction` | Segurança / outbound |
| `updateMeetingAction` bulk agenda/next-step delete | UI faz merge complexo; MCP usa ferramentas de pauta granulares |
| `createTaskFromMeetingNextStepAction` | Pode ser feito via `create_task` manualmente (gap menor) |
| Granola API sync | Não existe job MCP — só campos editáveis na reunião |
