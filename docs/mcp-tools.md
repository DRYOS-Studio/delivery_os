# MCP DeliveryOS — matriz de cobertura

Servidor: `POST /api/mcp` (JSON-RPC 2.0). Auth: JWT Supabase ou token `mcp_agt_…` (scopes `read` | `write`). **Sem SQL genérico**, sem bypass RLS, sem gestão de tokens MCP/credenciais por ferramenta.

## Escopos

| Scope token | Leitura (`read` tools) | Escrita (`write` + `admin` tools) |
|---|---|---|
| `read` | Sim | Não |
| `write` | Sim | Sim (admin ainda exige `profiles.role = admin` no banco) |

## Matriz resumida UI → ferramentas

| Domínio UI | List / get | Create / update | Arquivo / confirmação | Storage assinado |
|---|---|---|---|---|
| Clientes | `list_clients`, `get_client` | `create_client`, `update_client` (admin) | `archive_client` (`confirm`) | — |
| Contratos cliente | `list_client_contracts`, `get_client_contract` (admin) | `update_client_contract`, `upload_client_contract`, `finalize_*` (admin) | — | `begin_client_contract_upload`, `get_client_contract_download_url` |
| Operações | `list_operations`, `get_operation` | `create_operation`, `update_operation` (admin) | `archive_operation` (`confirm`) | — |
| Membros op | `list_operation_members` | `add/remove_operation_member` (admin) | — | — |
| Frentes | `list_frentes`, `get_frente` | `create_frente`, `update_frente` | `archive_frente` (`confirm`) | — |
| Tarefas | `list_tasks`, `get_task` | `create_task`, `update_task`, `change_task_status`, `add_task_comment` | — | — |
| Pessoas | `list_persons` | `create_person` | — | — |
| Reuniões / decisões | `list_meetings`, `list_decisions` | `create_meeting`, `create_decision` | — | — |
| Briefing | `get_operation_briefing` | `upsert_operation_briefing` | — | — |
| Catálogo | `list_service_products`, `list_villains`, `list_quick_win_catalog` | — (CRUD catálogo só UI admin) | — | — |
| Anexos op | `list_attachments` | `upload_attachment` | — | `get_attachment_download_url` |

## Limitações honestas (v0.3)

- **Não exposto:** convite de usuários, tokens MCP, credenciais Bitwarden, custos avançados, quick wins em operação, alocações, SLA/incidentes, pauta/próximos passos Granola item-a-item, arquivamento em massa, delete destrutivo de contratos.
- **Upload MCP:** contrato/anexo via base64 limitado a **5MB**; maiores usam URL assinada de upload (`begin_client_contract_upload`).
- **Contrato sem PDF:** ainda exige arquivo no Storage (placeholder mínimo via upload) — metadados `implementation_fee` + `notes` cobrem aceite WhatsApp.
- **Admin:** ferramentas `admin` retornam erro se o JWT não for de administrador, mesmo com scope `write`.

## Caso Assis Sat (modelo)

| Fato | Campo |
|---|---|
| R$397/m | `client_contracts.monthly_value` + opcional `operations.monthly_recurring_revenue` |
| Taxa R$1000 | `client_contracts.implementation_fee` (migration `20261107040000`) |
| Onboarding 04/11/2026 | `start_date` contrato/operação |
| 1ª cobrança dia 14 | `payment_day_of_month: 14` + `notes` |
| Aceite WhatsApp | `client_contracts.notes` |
| Vinicius | `clients.primary_contact_name` |
| Produto OS Basic | `frentes.product_id` → slug `dryos-os-basic` (após catálogo v2) |

Teste unitário: `src/lib/mcp/assis-sat-field-mapping.test.ts`.
