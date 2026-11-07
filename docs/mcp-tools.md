# MCP DeliveryOS — matriz de cobertura (v0.4)

Servidor: `POST /api/mcp` (JSON-RPC 2.0). **Sem SQL genérico**, sem bypass RLS.

## Escopos token `mcp_agt_`

| Scope | `read` tools | `write` + `admin` tools |
|---|---|---|
| `read` | Sim | **Não** (teste: `mcp-dispatch-access.test.ts`) |
| `write` | Sim | Sim — ferramentas `admin` ainda exigem `profiles.role = admin` |

## Cobertura UI → ferramentas (implementado)

| Domínio | Leitura | Escrita / transição |
|---|---|---|
| Clientes | `list_clients`, `get_client` | `create/update_client`, `archive_client` (`confirm`), `restore_client` |
| Contratos | `list/get_client_contract` (admin) | `update_client_contract`, upload base64 / signed upload, `finalize_*`, download URL |
| Operações | `list/get_operation` | `create/update/archive_operation` (admin, `confirm` arquivar) |
| Membros | `list_operation_members` | `add/remove_operation_member` (admin) |
| Frentes | `list/get_frente` | `create/update_frente`, `archive_frente` (`confirm`) |
| Tarefas | `list/get_task` | `create/update_task`, `change_task_status`, `add_task_comment` |
| Alocações | `list_allocations` | `create/update_allocation` |
| Quick wins (op) | `list_quick_wins`, `list_operation_villains` | `create_quick_win` (+ impactos) |
| SLA | `list_sla_incidents` | `create/update_sla_incident` |
| Custos op | `list_operation_costs` | `create/update_operation_cost` |
| Pessoas | `list_persons` | `create_person` |
| Reuniões | `list_meetings` | `create_meeting` |
| Pauta | `list_meeting_agenda_items` | `add/update_meeting_agenda_item` |
| Próximos passos | `list_meeting_next_steps` | `add/update_meeting_next_step` |
| Decisões | `list_decisions` | `create_decision` |
| Briefing | `get_operation_briefing` | `upsert_operation_briefing` (versões) |
| Catálogo produtos | `list_service_products` | `create/update/archive/restore_service_product` (admin) |
| Catálogo QW tipos | `list_quick_win_catalog` | `create_quick_win_catalog_item`, `archive_quick_win_catalog_item` (admin) |
| Vilões (marca) | `list_villains` | — (atribuição vilão×op: ver gaps) |
| Anexos | `list_attachments` | `upload_attachment`, `get_attachment_download_url` |

## Exclusões deliberadas (segurança / fora de escopo)

| Área | Motivo |
|---|---|
| Convites / e-mail de usuário | Disparo outbound não autorizado |
| Tokens MCP (`create/revoke`) | Superfície sensível — só UI admin |
| Credenciais Bitwarden | Princípio 01 — nunca secret no Delivery |
| `execute_sql` / raw query | Proibido no briefing |
| Delete destrutivo (contratos, etc.) | Só soft-archive onde a UI arquiva |
| Envio automático Discord/n8n | Webhook é write na operação, não “enviar agora” via MCP |

## Gaps honestos (fluxo UI existe, MCP ainda não)

| Fluxo | Nota |
|---|---|
| Atribuir vilão à operação (`assignVillain`) | Leitura via `list_operation_villains`; write não exposto nesta rodada |
| Diagnóstico cliente / management diagnostic | Entidade pesada — usar UI |
| Granola sync fields em reunião | Só pauta/next-step manual MCP |
| Tarefas de área (back-office) | XOR área×frente — escopo membro+área |
| `operation_comments` / threads | Não exposto |
| Restore QW catálogo arquivado | Só archive no catálogo QW |
| Links públicos | Geração/revogação token — sensível |

## Contrato — semântica de datas (Assis Sat)

| Campo | Uso |
|---|---|
| `start_date` | Onboarding / início contrato (ex. 2026-11-04) |
| `first_billing_date` | **Primeira cobrança calendário** (ex. 2026-12-14) — migration `20261107050000` |
| `payment_day_of_month` | Dia fixo mensal recorrente (14), não substitui `first_billing_date` |
| `implementation_fee` + `implementation_fee_paid` | Taxa R$1000 **paga** sem obrigar data de pagamento |
| `notes` | Aceite WhatsApp (não assinatura formal) |

Testes: `assis-sat-field-mapping.test.ts`, RLS: `npm run test:mcp-expanded-rls`.

## Migrations deste épico MCP

1. `20261107040000_client_contracts_implementation_fee.sql`
2. `20261107050000_client_contracts_billing_semantics.sql`
