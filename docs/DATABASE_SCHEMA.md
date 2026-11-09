# Database Schema

**Última análise**: 2026-11-06 (tokens MCP + tarefas no connector)
**Projeto Supabase**: `Delivery OS` (`tmsaucxoeqpfluzwrwkc`)
**Schema**: `public`

Referência viva das tabelas vivas. Atualizar a cada migration. **Antes de criar tabela nova**, consultar este doc + buscar no banco vivo (vide CLAUDE.md "Antes de criar qualquer tabela no banco").

---

## Índice por módulo

| Módulo | Tabelas | Total |
|---|---|---|
| **Cliente** | `clients`, `client_contracts`, `client_registration_invitations`, `repository_links`, `client_tech_items`, `client_software_items` | 6 |
| **Operação** | `operations` | 1 |
| **Entrega** | `frentes`, `allocations`, `tasks`, `task_assignees` | 4 |
| **Pessoas** | `persons` | 1 |
| **Briefing** | `briefings`, `briefing_versions` | 2 |
| **Reuniões / Decisões** | `meetings`, `meeting_attendees`, `meeting_agenda_items`, `meeting_agenda_next_steps`, `decisions`, `operation_risk_blockers` | 6 |
| **Anexos** | `attachments` | 1 |
| **Acesso público** | `public_links` | 1 |
| **SLA** | `sla_incidents` | 1 |
| **Vilões (catálogo)** | `villains` | 1 |
| **Operação × Vilão** | `operation_villains`, `operation_villain_narratives` | 2 |
| **Diagnóstico** | `diagnostics` | 1 |
| **Quick Wins** | `quick_wins`, `quick_win_impacts` | 2 |
| **Profiles** | `profiles` | 1 |
| **Integração (MCP)** | `profile_agent_tokens`, `mcp_idempotent_responses` | 2 |
| **Auth · Scope** | `operation_members`, `profile_areas`, `areas`, `area_clients`, `area_operations` | 5 |
| **Operação · Custos** | `operation_costs` | 1 |
| **Catálogo · Produtos** | `service_products` | 1 |
| **Catálogo · Quick Wins** | `quick_win_catalog` | 1 |
| **Notificações** | `notifications_log` | 1 |
| **Auditoria** | `activity_events` | 1 |
| **Comentários** | `task_comments`, `operation_comments` | 2 |
| **Total atual** | | **40** |

---

## Tabelas

> **⚠️ Nota de RLS (pós `operation-members` #80):** as policies `*_authenticated_full` / `authenticated_full_access` citadas nas seções abaixo foram **substituídas** por policies `*_scoped_*` que filtram via `can_see_operation()`. Member só vê dados de Operações em que foi atribuído (`operation_members`); admin vê tudo. Exceções globais: `villains`, `service_products`, `quick_win_catalog` (catálogos, abertos a `authenticated`). Detalhe completo na seção `operation_members`.

### `clients` — empresa atendida pela DRYOS

Origem de Operações, Pessoas externas, Credenciais (v2).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `name` | text NOT NULL | nome fantasia / uso interno |
| `slug` | text UNIQUE NOT NULL | URL-safe; pra futuro link público |
| `legal_name` | text | razão social (PJ) |
| `cnpj` | text | só dígitos (14); CHECK length=14; display formata |
| `inscricao_estadual` | text | nullable |
| `primary_contact_name` | text | contato principal, texto livre (não FK pra persons) |
| `primary_contact_email` | text | CHECK shape `%_@_%.%` |
| `primary_contact_phone` | text | sem máscara (BR/intl) |
| `address_street`, `address_number`, `address_complement`, `address_district`, `address_city` | text | endereço plano nullable |
| `address_state` | text | UF 2 chars maiúsculas; CHECK length=2 |
| `address_zip` | text | só dígitos (8); CHECK length=8; display formata |
| `person_type` | text | `pf` \| `pj` — qualificação contratual |
| `cpf` | text | só dígitos (11); PF ou rep. legal |
| `profession`, `marital_status`, `trade_name` | text | PF/PJ (contrato) |
| `formal_email` | text | comunicações formais |
| `focal_point_*`, `financial_contact_*` | text | ponto focal e financeiro |
| `legal_representative_*` | text | representante legal (PJ), incl. `legal_representative_marital_status` |
| `notes` | text | livre, max 1000 chars (validado no app) |
| `created_at`, `updated_at`, `archived_at` | timestamptz | soft-delete via `archived_at` |

CHECKs: `cnpj`, `address_state`, `address_zip` (length), `primary_contact_email` (shape).
RLS: `authenticated_full_access` (sem 1). Granularidade Admin/Membro entra com `profiles` (sem 2+).

### `client_registration_invitations` — convite de autocadastro por link

Token em `token_hash` (SHA-256); `token_encrypted` só para copiar link no admin. Submissão em `submitted_payload` (JSON) até `approve` criar `clients` + `client_software_items`.

Status enum: `enviado`, `preenchido`, `aprovado`, `expirado`, `cancelado`.
RLS: admin only (`is_admin()`). Público acessa via service role + validação de token nas Server Actions.

Migration: `20261109180000_client_registration_invitations.sql`

### `repository_links` — repositórios Git (múltiplos por escopo)

| Coluna | Tipo | Notas |
|---|---|---|
| `client_id` | uuid NOT NULL | âncora RLS |
| `operation_id`, `frente_id` | uuid NULL | escopo Operação/Frente; ambos null = nível Cliente |
| `label` | text NOT NULL | nome/finalidade do repo |
| `url` | text NOT NULL | https, validado no app |
| `notes` | text | opcional, curto |

Migration `20261108040000` importa colunas legadas `git_repository_url` (se existirem) com label `Principal` **sem** remover as colunas singulares. A remoção fica em `20261108050000_drop_legacy_git_repository_url_columns.sql` (após deploy do app novo). Ver `docs/ROLLOUT_REPOSITORY_TOOLING.md`.

### `client_tech_items` — stack técnica (dev/infra)

| Coluna | Tipo | Notas |
|---|---|---|
| `name` | text NOT NULL | texto livre |
| `category` | text | ex.: cloud, linguagem |
| `url` | text | https opcional (docs/console) |
| `notes` | text | opcional |

### `client_software_items` — softwares que o cliente usa

| Coluna | Tipo | Notas |
|---|---|---|
| `name` | text NOT NULL | texto livre (sem catálogo fechado) |
| `purpose` | text | finalidade no cliente |
| `url` | text | opcional — acesso ao **workspace/sistema do cliente**, não só site do fornecedor |
| `notes` | text | opcional |

Escrita (tech/software): admin. Repositórios em Operação/Frente: membro com `can_see_operation`.

---

### `client_contracts` — contrato comercial (arquivo + metadados)

Metadados financeiros e PDF/arquivo no bucket privado `contracts` (Storage path prefixado com `<client_id>/`). Apenas **admin** via RLS e policies de Storage. `uploaded_by` → `profiles`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid NOT NULL → clients (CASCADE) | |
| `label` | text NOT NULL | CHECK trim length ≥ 2 |
| `monthly_value` | numeric(14,2) | nullable |
| `implementation_fee` | numeric(14,2) | nullable; taxa de implantação única (≥0) |
| `implementation_fee_paid` | boolean NOT NULL default false | quitada sem data obrigatória |
| `first_billing_date` | date | nullable; 1ª cobrança (distinto de `payment_day_of_month`) |
| `currency` | text NOT NULL default `BRL` | |
| `reajuste_notes` | text | nullable |
| `start_date`, `end_date` | date | nullable; CHECK `end >= start` quando ambos |
| `payment_day_of_month` | int | nullable; 1–28 |
| `status` | enum `client_contract_status` | `rascunho` \| `vigente` \| `encerrada` |
| `notes` | text | nullable |
| `storage_path` | text NOT NULL | CHECK prefix `<client_id>/` |
| `filename`, `mime_type` | text | |
| `size_bytes` | bigint | CHECK > 0 e ≤ 50 MB |
| `uploaded_by` | uuid → profiles | SET NULL |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_client_contracts_updated_at`. Trigger `trg_activity_client_contracts_aiud` → `activity_events` (`subject_type = client_contract`).

---

### `activity_events` — histórico de mudanças (audit trail)

Eventos gerados por triggers em `clients`, `operations`, `frentes`, `tasks`, `task_assignees` (responsáveis) e `client_contracts`, e por RPC a partir de ações admin em `profiles` (convite, troca de papel, vínculo de pessoa). Cada linha referencia o assunto (`subject_type` + `subject_id`), denormaliza `operation_id` / `client_id` quando aplicável e guarda `actor_profile_id` = `auth.uid()` no momento da mudança. Assunto `profile` é visível só para admin (`can_read_activity_subject`).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `subject_type` | enum `activity_subject_type` | client \| operation \| frente \| task \| client_contract \| profile |
| `subject_id` | uuid NOT NULL | id do registro no tipo acima |
| `operation_id` | uuid → operations | nullable (client puro) |
| `client_id` | uuid → clients | nullable |
| `action` | text | ex.: `created`, `updated`, `assignee_added` |
| `field_key` | text | coluna lógica alterada, se houver |
| `old_value`, `new_value` | jsonb | snapshot compacto; null em creates |
| `metadata` | jsonb | reservado |
| `actor_profile_id` | uuid → profiles | FK opcional (SET NULL) |
| `actor_name` | text | snapshot do ator no INSERT (`profiles.name` ou parte local do e-mail); ignora RLS de leitura |
| `created_at` | timestamptz | |

RLS: SELECT quando `can_read_activity_subject(subject_type, subject_id)`. Inserts via funções/triggers SECURITY DEFINER (`log_activity_event_system`); não há policy de INSERT para `authenticated` direto na tabela.

---

### `task_comments` — comentário em tarefa

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid → tasks | CASCADE |
| `body` | text | 1–8000 chars |
| `author_profile_id` | uuid → profiles | default `auth.uid()` |
| `created_at`, `updated_at` | timestamptz | trigger `set_updated_at` |

RLS: SELECT `can_see_task(task_id)`; INSERT se `can_see_task` e autor = `auth.uid()`; UPDATE/DELETE autor ou `is_admin()`.

---

### `operation_comments` — comentário na Operação

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid → operations | CASCADE |
| `body` | text | 1–8000 chars |
| `author_profile_id` | uuid → profiles | default `auth.uid()` |
| `created_at`, `updated_at` | timestamptz | |

RLS: SELECT `can_read_operation(operation_id)`; INSERT `can_see_operation` e autor; UPDATE/DELETE `can_read_operation` e (autor ou admin).

---

### `persons` — pessoa interna ou externa

Discriminada por `kind`; campos mutuamente exclusivos via CHECK constraint.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `kind` | enum `person_kind` | `internal` (DRYOS) ou `external` (do Cliente) |
| `name` | text NOT NULL | |
| `email` | text | nullable |
| `specialty` | text | NOT NULL se `internal`, NULL se `external` |
| `external_role` | text | NOT NULL se `external`, NULL se `internal` |
| `client_id` | uuid → clients (RESTRICT) | NOT NULL se `external`, NULL se `internal` |
| `hourly_rate` | numeric(10,2) | nullable; taxa horária BRL/h (legacy). Usada se salário/horas não preenchidos |
| `monthly_compensation` | numeric(12,2) | nullable; salário/compensação mensal bruto (BRL/mês). Junto com contracted_weekly_hours, deriva taxa horária |
| `contracted_weekly_hours` | numeric(5,2) | nullable; horas contratadas/semana (ex: 40 CLT). Junto com salário, deriva taxa |
| `created_at`, `updated_at`, `archived_at` | timestamptz | |

CHECK `chk_persons_kind_consistency`: garante exclusividade.

---

### `operations` — contrato comercial (Core / Spark / Studio)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid NOT NULL → clients (RESTRICT) | |
| `product_line` | enum `product_line` | core / spark / studio |
| `name` | text NOT NULL | |
| `status` | enum `operation_status` default `em_construcao` | ativos: em_construcao / em_operacao / janela_critica · terminais: concluida / cancelada (e arquivada, legado — nunca escrito). Terminal e `archived_at` são eixos distintos: terminal sai dos agregados, `archived_at` tira da vista |
| `monthly_recurring_revenue` | numeric(14,2) | nullable (Studio one-off) |
| `monthly_fixed_cost` | numeric(12,2) | nullable; custo mensal fixo (hospedagem, infra). Admin-only via UI |
| `tax_rate_pct` | numeric(5,2) | nullable; alíquota de imposto (0–100) sobre `monthly_recurring_revenue`; valor derivado entra no custo mensal/margem. Admin-only via UI/MCP |
| `recurrence` | enum `recurrence` | mensal / trimestral / anual / unica; nullable |
| `start_date`, `end_date` | date | nullable; Tipo C/E não tem fim (validado via Frente) |
| `response_hours` | int | SLA prometido pra primeira resposta. CHECK 0-720. Null = sem SLA |
| `resolution_hours` | int | SLA prometido pra resolução total. CHECK 0-720. Null = sem SLA |
| `notification_webhook_url` | text | nullable; webhook n8n por Operação |
| `created_at`, `updated_at`, `archived_at` | timestamptz | |

---

### `frentes` — fluxo de entrega dentro de uma Operação

Status acionável validado no banco (CHECK).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (RESTRICT) | |
| `name` | text NOT NULL | |
| `cycle_type` | enum `frente_cycle_type` | a / b / c / d / e |
| `domain` | enum `frente_domain` | infra / dados_analiticos / dados_tecnicos |
| `phase` | enum `frente_phase` default `descoberta` | descoberta / execucao / entrega / encerrada |
| `actionable_status` | text NOT NULL | CHECK `char_length >= 15` + NOT IN lista de genéricos |
| `actionable_status_since` | timestamptz default now() | |
| `responsible_person_id` | uuid → persons (SET NULL) | |
| `product_id` | uuid → service_products (SET NULL) | opcional; produto comercial DRYOS associado |
| `start_date`, `end_date` | date | |
| `created_at`, `updated_at`, `archived_at` | timestamptz | |

CHECKs `chk_frentes_actionable_status_min_length` + `chk_frentes_actionable_status_not_generic` garantem "status acionável" (princípio 04).

Index parcial `idx_frentes_actionable_status_since_active` em `(actionable_status_since ASC) WHERE archived_at IS NULL` otimiza queries de staleness (Home + sidebar badge).

---

### `allocations` — relação Pessoa × Frente

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid NOT NULL → persons (CASCADE) | |
| `frente_id` | uuid NOT NULL → frentes (CASCADE) | |
| `role` | enum `allocation_role` | responsavel / executor / aprovador / plantao |
| `capacity_weekly_pct` | numeric(5,2) NOT NULL default 0 | CHECK 0..100 (legacy; usado se weekly_hours null) |
| `weekly_hours` | numeric(5,2) | nullable; horas/semana alocadas. Custo: rate × weekly_hours × 4 |
| `monthly_cost` | numeric(12,2) | nullable; valor mensal fechado pra esta alocação. Quando preenchido, vira custo direto e ignora cálculo por horas |
| `start_date` | date NOT NULL default current_date | |
| `end_date` | date | nullable |
| `created_at`, `updated_at` | timestamptz | sem `archived_at` — é puro relacionamento |

---

### `tasks` — tarefa de entrega (Frente) OU tarefa de área (Operação)

Cobre o gap entre Decisão (perpétuo), Reunião (touchpoint), SLA Incident (não-planejado) e Quick Win (vinculado a vilão). Interna — não aparece em `/public/[token]`.

**XOR entrega/área:** uma tarefa é **de entrega** (`area NULL` + `frente_id` obrigatório, visível à Operação) **ou** **de área** (`area` setada + `frente_id NULL`, transversal à Operação, visível só a admin + quem é da área). `operation_id` está sempre presente.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | sempre presente; em task de entrega é derivado da Frente (trigger `sync_task_operation`) |
| `frente_id` | uuid → frentes (CASCADE) | **nullable**; obrigatório em task de entrega, NULL em task de área (CHECK `check_tasks_area_xor_frente`) |
| `area_id` | uuid → areas (RESTRICT) | nullable; FK p/ catálogo dinâmico `areas`. Setada = task de área (sem Frente, gated por área **+ concessão**, não mais global). Write-once (trigger) |
| `title` | text NOT NULL | CHECK length ≥ 3 |
| `description` | text | markdown livre, nullable |
| `status` | enum `task_status` | `todo` / `doing` / `blocked` / `done`, default `todo` |
| `parent_task_id` | uuid → tasks (CASCADE) | nullable; subtarefa aponta pro pai. CHECK anti-self + trigger `enforce_task_parent` (1 nível, mesma Frente; **proibido em task de área**). Deletar pai → CASCADE apaga filhas |
| `start_date` | date | nullable; data de início planejada. CHECK `check_tasks_start_before_due`: `start_date <= due_date` quando ambos preenchidos |
| `due_date` | date | granularidade dia |
| `tags` | text[] | livre; dedup no front |
| `quick_win_id` | uuid → quick_wins (SET NULL) | vínculo opcional |
| `sla_incident_id` | uuid → sla_incidents (SET NULL) | vínculo opcional |
| `source_meeting_id` | uuid → meetings (SET NULL) | reunião de origem (próximo passo promovido) |
| `created_at`, `updated_at`, `completed_at` | timestamptz | `completed_at` auto-managed por trigger |

> Responsáveis migraram de `assignee_person_id` (single, removido em `20260610120000`) pra N:N via `task_assignees`.

Trigger `manage_task_completed_at` (BEFORE INSERT OR UPDATE): set quando status → `done`, clear quando sai de `done`.
Trigger `sync_task_operation` (BEFORE INSERT OR UPDATE OF frente_id, operation_id): quando há Frente, deriva/valida `operation_id = frente.operation_id` (raise em mismatch).
Trigger `enforce_task_parent`: hierarquia de subtarefa trava em **1 nível** + **mesma Frente**; **proibida em task de área**. Sem rollup de status.
Indexes: `(frente_id, status)`, `parent_task_id` (partial), `(operation_id, area_id)`, `area_id` (partial WHERE NOT NULL).
RLS: `area_id NULL → can_read_operation(operation_id)` (membro real OU área com concessão); `area_id setada → is_admin() OR (user_in_area(area_id) AND area_can_reach_operation(area_id, operation_id))`. Escrita: entrega = `can_see_operation` (read-only pra área); bucket de área = área+concessão. **Invariante:** `/public` filtra `area_id IS NULL` (task de área nunca vaza).

---

### `task_assignees` — responsáveis (N:N) de uma tarefa, todos iguais

Substitui `tasks.assignee_person_id`. Sem "responsável principal" — todos iguais. A tarefa aparece na agenda de cada pessoa marcada.

| Coluna | Tipo | Notas |
|---|---|---|
| `task_id` | uuid → tasks (CASCADE) | PK composto |
| `person_id` | uuid → persons (CASCADE) | PK composto |
| `created_at` | timestamptz | default now() |

Index: `person_id`.
RLS: gated por `can_see_task(task_id)` (cobre task de entrega via operação e task de área via área). Sem policy UPDATE (junção é insert/delete).

---

### `areas` — catálogo dinâmico de áreas (grupo de acesso) ⭐ AD-014

Substitui o enum `task_area`. Áreas criáveis/arquiváveis pela UI (admin). Seeds `cs`/`financeiro`/`juridico` (slug estável). Soft-delete via `archived_at` (nunca DELETE — FK `tasks.area_id` é RESTRICT).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `slug` | text UNIQUE | normalizado (lower, sem acento, kebab); seeds casam o enum antigo |
| `name` | text NOT NULL | rótulo exibido |
| `archived_at` | timestamptz | soft-delete; área arquivada não concede acesso |
| `created_at`, `created_by` | | |

RLS: `areas_admin_all` (admin CUD) + `areas_authenticated_select` (todo autenticado lê o catálogo — labels/selects).

### `area_clients` / `area_operations` — concessões de acesso ⭐ AD-014

Concedem **leitura** de uma área a um cliente inteiro (`area_clients`) e/ou a uma operação específica (`area_operations`). PK composta, FKs CASCADE. RLS admin-only (CUD+SELECT) — a leitura pela área é resolvida pelas funções `SECURITY DEFINER`, não por SELECT direto.

| `area_clients` | `area_operations` |
|---|---|
| `(area_id → areas, client_id → clients)` PK | `(area_id → areas, operation_id → operations)` PK |

Funções de acesso: `area_can_reach_operation(area_id, op_id)` (pura, não toca `tasks`), `is_area_granted(op_id)` (minhas áreas não-arquivadas alcançam op), `can_read_operation = can_see_operation OR is_area_granted`, `user_in_area(area_id)`.

---

### `profile_areas` — vínculo profile × área

Define quem (login) é de qual área. **Escopo NÃO é mais global** (AD-014): a área só vê onde tem concessão (`area_clients`/`area_operations`). Admin vê tudo sem row. Eixo de **visibilidade** (profile), separado de `task_assignees` (eixo de execução, person).

| Coluna | Tipo | Notas |
|---|---|---|
| `profile_id` | uuid → profiles (CASCADE) | PK composto |
| `area_id` | uuid → areas (CASCADE) | PK composto (era enum `task_area`, migrado em `20260610150001`) |
| `created_at` | timestamptz | default now() |
| `created_by` | uuid → profiles (SET NULL) | quem atribuiu |

Index: `profile_id`.
RLS: `pa_admin_all` (admin gere tudo) + `pa_member_select_self` (member lê só os próprios).

---

### `operation_costs` — custos ad-hoc por Operação

Itens de custo manuais. Custo fixo principal vive em `operations.monthly_fixed_cost`. Custos derivados de pessoas vêm de `allocations × persons.hourly_rate` (não materializados).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `label` | text NOT NULL | CHECK length >= 2 |
| `amount` | numeric(12,2) NOT NULL | CHECK >= 0 |
| `recurrence` | enum `cost_recurrence` | `mensal` (entra na margem) ou `unica` (informativo) |
| `started_at` | date NOT NULL default current_date | |
| `ended_at` | date | nullable; CHECK >= started_at |
| `notes` | text | nullable |
| `created_at`, `updated_at` | timestamptz | |

Index: `(operation_id, recurrence)`.
RLS: `operation_costs_authenticated_full` (CRUD gated por `requireAdminAction` — Inv. 14).

---

### `briefings` — briefing vivo 1:1 com Operation

Documento estruturado com versionamento append-only. Conteúdo vive em `briefing_versions`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL UNIQUE → operations (CASCADE) | 1 briefing por Operation |
| `current_version_id` | uuid → briefing_versions (SET NULL) | denormalização da versão mais recente |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_briefings_updated_at` reusa função `set_updated_at`.

---

### `briefing_versions` — snapshot append-only de briefings

Cada save da action cria linha completa. RLS bloqueia UPDATE/DELETE (ausência de policy = bloqueado).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `briefing_id` | uuid NOT NULL → briefings (CASCADE) | |
| `contexto`, `objetivos`, `escopo_incluido`, `escopo_excluido`, `premissas`, `riscos`, `stakeholders`, `observacoes` | text | 8 seções estruturadas; Zod app limita 5000 chars/campo |
| `author_id` | uuid → auth.users (SET NULL) | preserva versão se user removido |
| `created_at` | timestamptz | |

Index `idx_briefing_versions_briefing_created` em (briefing_id, created_at DESC).

RLS: SELECT + INSERT pra `authenticated`. Sem policy UPDATE/DELETE = bloqueado.

---

### `meetings` — reunião com cliente ou interna

Registro temporal ligado à Operação. Visibility própria (Inv. 05).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `title` | text NOT NULL | Zod min 3 max 200 |
| `scheduled_at` | timestamptz NOT NULL default now | reunião agendada (futura ou passada) |
| `ended_at` | timestamptz | opcional; ≥ `scheduled_at` |
| `notes` | text | livre, max 5000 chars (Zod) |
| `visibility` | enum `meeting_visibility` default `interno` | interno / cliente |
| `granola_suggestion_text` | text | sugestão editável (import/cola) |
| `granola_captured_at` | timestamptz | opcional; quando houve captura de sugestão |
| `granola_source_ref` | text | opcional; ref externa (ex. id no Granola) |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_meetings_updated_at` + index `idx_meetings_operation_scheduled` (operation_id, scheduled_at DESC).

---

### `meeting_agenda_items` — item de pauta

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid NOT NULL → meetings (CASCADE) | |
| `sort_order` | int NOT NULL default 0 | |
| `title` | text NOT NULL | |
| `notes` | text | nullable |
| `source` | text NOT NULL | `manual` \| `granola` |
| `granola_line` | text | reservado |
| `created_at`, `updated_at` | timestamptz | |

RLS: SELECT espelha `meetings` (membro ou área com concessão e meeting `cliente`); INSERT/UPDATE/DELETE exige `can_see_operation` da reunião.

---

### `meeting_agenda_next_steps` — próximo passo da reunião

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `meeting_id` | uuid NOT NULL → meetings (CASCADE) | |
| `sort_order` | int NOT NULL default 0 | |
| `description` | text NOT NULL | |
| `due_date` | date | nullable |
| `assignee_person_id` | uuid → persons (SET NULL) | responsável opcional (interno ou externo do cliente) |
| `task_id` | uuid → tasks (SET NULL) | preenchido ao “virar tarefa” |
| `created_at`, `updated_at` | timestamptz | |

RLS: mesmo padrão de `meeting_agenda_items`.

---

### `operation_risk_blockers` — risco/bloqueio de entrega (fora do SLA Dryos)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations | |
| `title` | text NOT NULL | min 3 |
| `description` | text | |
| `kind` | enum `operation_risk_kind` | risk / blocker |
| `severity` | enum low/medium/high | default medium |
| `status` | enum open/mitigated/resolved | default open |
| `origin` | enum dryos/client/vendor | default dryos |
| `responsible_person_id` | uuid → persons (SET NULL) | |
| `meeting_id`, `decision_id`, `task_id` | uuid opcional | vínculos na operação |
| `created_at`, `updated_at` | timestamptz | |

Auditoria: `activity_events` subject `operation_risk_blocker`. Distinto de `sla_incidents`.

---

### `meeting_attendees` — N:N reunião × pessoa

| Coluna | Tipo | Notas |
|---|---|---|
| `meeting_id` | uuid → meetings (CASCADE) | parte do PK composto |
| `person_id` | uuid → persons (RESTRICT) | preserva histórico se pessoa arquivada |
| `created_at` | timestamptz | |

PK composto `(meeting_id, person_id)` bloqueia duplicatas.

---

### `decisions` — registro perpétuo (Inv. 02)

Standalone (operation_id NOT NULL) com FK opcional pra meeting (SET NULL).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `meeting_id` | uuid → meetings (SET NULL) | opcional; apagar reunião preserva decisão |
| `agenda_item_id` | uuid → meeting_agenda_items (SET NULL) | opcional; FK exige mesmo `meeting_id` (CHECK + trigger) |
| `title` | text NOT NULL | |
| `context` | text | situação que motivou (opcional) |
| `decision` | text NOT NULL | decisão tomada em prosa |
| `visibility` | enum `decision_visibility` default `cliente` | independente da reunião (Inv. 05) |
| `decided_at` | timestamptz NOT NULL default now | |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_decisions_updated_at` + index `idx_decisions_operation_decided` (operation_id, decided_at DESC).

---

### `attachments` — ref pro Supabase Storage

Bucket `attachments` privado. Path no formato `<operation_id>/<uuid>-<filename_sanitizado>` (Inv. 11).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `meeting_id` | uuid → meetings (SET NULL) | opcional; ata/slides linkados |
| `storage_path` | text NOT NULL | CHECK começa com `<operation_id>/` |
| `filename` | text NOT NULL | display name original |
| `mime_type` | text NOT NULL | |
| `size_bytes` | bigint NOT NULL | CHECK > 0 AND ≤ 10485760 (10MB) |
| `description` | text | opcional, max 500 chars (Zod) |
| `visibility` | attachment_visibility NOT NULL DEFAULT 'cliente' | controla SÓ a superfície pública; interno nunca aparece/baixa no `/public`. Regra composta: anexo `cliente` E (se meeting, meeting `cliente`) — diverge de decisions (independente) de propósito |
| `uploaded_by` | uuid → auth.users (SET NULL) | |
| `created_at`, `updated_at` | timestamptz | |

Triggers `set_attachments_updated_at`. Indexes: `idx_attachments_operation_created` (operation_id, created_at DESC); `idx_attachments_meeting_created` parcial (WHERE meeting_id IS NOT NULL).

**Storage bucket** `attachments` (privado): policies authenticated SELECT/INSERT/DELETE **escopadas por operação** (`20260611040158_rls_hardening`) — o prefixo `<operation_id>/` do path é parseado com guard de UUID (CASE; path malformado = deny-all) e gated por `can_see_operation` (membro/admin; área NÃO lê storage — AD-014). Sem UPDATE — substituir = delete + upload. DELETE direto via SQL é bloqueado pra todos pelo trigger de plataforma `storage.protect_delete` (o caminho real é a Storage API, onde a policy aplica).

Download via `/api/attachments/[id]/download` Route Handler → signed URL TTL 5min.

**Nota (comportamento deliberado, registrado em 2026-06-11):** anexo de meeting `cliente` em meeting `cliente` é **baixável mas não listado** no link público — `listPublicAttachments` filtra `meeting_id IS NULL` e nenhuma superfície pública renderiza link de anexo de meeting. Não é leak: o download exige token válido + aid + dupla visibility `cliente`. Não "redescobrir" em auditoria futura.

---

### `public_links` — token de acesso externo

Múltiplos links por Operação, revogáveis individualmente. Sem auth: quem tem o token vê. `expires_at` reservado, sem validação no MVP.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `token` | uuid NOT NULL UNIQUE default gen_random_uuid() | |
| `label` | text | identificação livre (cliente, contato) |
| `last_accessed_at` | timestamptz | fire-and-forget update no GET |
| `revoked_at` | timestamptz | soft revogação |
| `expires_at` | timestamptz | reservado pra v2 |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_public_links_updated_at` + index `idx_public_links_operation_created`.

Rota pública: `/public/[token]` (fora do `(app)`, sem auth). O resolver do token (`getPublicLinkByToken`) é o ponto único de validade: null pra revogado, expirado (`expires_at`, `<` estrito) ou operação arquivada. Marcar a Operação como **cancelada** ou **arquivá-la** revoga os links ativos dela via trigger `trg_operations_revoke_links` — *concluída* não revoga (contrato entregue ainda serve o relatório). Restaurar uma Operação também revoga, na mesma transação: desarquivar sem revogar reabriria em silêncio todo token que o arquivamento tinha apagado. Download de anexo público: `/public/[token]/attachments/[aid]/download` com validação quádrupla (token válido + attachment pertence à op + attachment visibility=cliente + meeting visibility=cliente se aplicável), 404 uniforme.

---

### `sla_incidents` — incidente operacional com timestamps

SLA prometido vive em `operations.response_hours/resolution_hours`. Breach calculado em runtime via helper `src/lib/utils/sla.ts`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `title` | text NOT NULL | min 3 max 200 (Zod) |
| `description` | text | max 5000 (Zod) |
| `severity` | enum `sla_severity` default `medium` | low / medium / high |
| `status` | enum `sla_incident_status` default `open` | open / responded / resolved / cancelled |
| `opened_at` | timestamptz NOT NULL default now | |
| `responded_at` | timestamptz | exigido se status >= responded |
| `resolved_at` | timestamptz | exigido se status = resolved |
| `opened_by` | uuid → auth.users (SET NULL) | |
| `created_at`, `updated_at` | timestamptz | |

CHECKs:
- `responded_at >= opened_at`
- `resolved_at >= responded_at` (se ambos NOT NULL)
- status `responded`/`resolved` requer `responded_at`
- status `resolved` requer `resolved_at`

Trigger `set_sla_incidents_updated_at` + index `idx_sla_incidents_operation_opened` (operation_id, opened_at DESC).

---

### `villains` — catálogo da marca DRYOS

7 registros canon (Manualis, Silos, Retrabalho, Lento, Achismo, Drenador, Enganador). **Inv. 06**: nunca delete, só archive — RLS **sem policy DELETE** (defense-in-depth no banco).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | "Capitão Manualis", etc |
| `slug` | text UNIQUE NOT NULL | CHECK regex `^[a-z0-9-]+$`, length 2-60 |
| `quote` | text NOT NULL | Frase típica (1ª pessoa) |
| `description` | text NOT NULL | Narrativa curta (Zod 10-500 chars) |
| `icon_name` | text NOT NULL | Lucide component name; map em `villain-icons.ts` (20 opções) |
| `pill_variant` | text NOT NULL | CHECK IN ('neutral','oak','sage','ok','warning','critical') |
| `display_order` | int NOT NULL UNIQUE | 1-7 no seed; até 99 permitido |
| `archived_at` | timestamptz | soft delete via Inv. 06 |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_villains_updated_at` + 2 indexes (display_order asc + parcial archived_at IS NULL).

Seed inline na migration via `ON CONFLICT (slug) DO NOTHING` (idempotente).

RLS policies: SELECT + INSERT + UPDATE pra authenticated. **Sem DELETE.**

---

### `operation_villains` — M:N entre Operação e Vilão

Relação produzida pelo Diagnóstico (futura feature) ou atribuição manual via UI. **Inv. 07**: `initial_severity` write-once via trigger. **Inv. 08** parcial: `progress_pct` capped 0-100.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `villain_id` | uuid NOT NULL → villains (RESTRICT) | preserva histórico mesmo se vilão for archived |
| `initial_severity` | enum `severity_level` NOT NULL | low/medium/high/critical — write-once via trigger |
| `progress_pct` | int NOT NULL default 0 | CHECK 0..100 |
| `evidence` | text | CHECK length ≤ 1000 |
| `created_at`, `updated_at` | timestamptz | |

UNIQUE(operation_id, villain_id) — vilão não duplica na Op.

Trigger `lock_operation_villain_initial_severity` BEFORE UPDATE rejeita mudança em `initial_severity` com `RAISE EXCEPTION ... ERRCODE = 'check_violation'`.

Index `idx_operation_villains_operation_created` (operation_id, created_at DESC).

`progress_pct` é **derivado** a partir de `quick_win_impacts` (trigger `sync_operation_villain_progress`); edit manual removido na UI.

---

### `operation_villain_narratives` — narrativa mensal por vilão da Operação

Texto narrativo do progresso de um vilão naquela Operação em um mês específico. Editável pelo time interno; lido no link público pra montar o "relatório premium" do mês. Versionado por mês — relatório de Maio pode ter narrativa diferente do de Junho pro mesmo vilão.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `villain_id` | uuid NOT NULL → villains (RESTRICT) | |
| `period_yyyymm` | text NOT NULL | CHECK regex `^\d{4}-(0[1-9]\|1[0-2])$` |
| `narrative_text` | text NOT NULL | CHECK `length(trim()) >= 20` |
| `created_at`, `updated_at` | timestamptz | trigger `trg_ovn_updated_at` |

UNIQUE(operation_id, villain_id, period_yyyymm) — 1 narrativa por op×vilão×mês. Upsert via `ON CONFLICT`.

Index `idx_ovn_op_period` (operation_id, period_yyyymm) — read do relatório por período.

RLS `ovn_authenticated_full` (Inv. 12); leitura pública via `createAdmin` server-side em `listVillainNarratives`.

---

### `service_products` — catálogo de produtos comerciais DRYOS

Ofertas canônicas alinhadas ao repo **dryos-conteudo** (`funcionarios_digitais`, `automacoes`, `dryos_os`, `studio` + 6 categorias Studio). O seed legado Core/Spark/Studio/Evergreen (`20260519160001`) é **arquivado por slug explícito** na migration `20261107013000_catalog_conteudo_v2`; itens custom/desconhecidos não são tocados. Referenciado opcionalmente por Frentes via `frentes.product_id`. Archive-only via `archived_at` (Frente que aponta pra produto arquivado continua válida; select de novas Frentes filtra ativos).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | CHECK `length(trim()) >= 2` |
| `slug` | text NOT NULL UNIQUE | CHECK regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` (URL-safe kebab-case) |
| `description` | text | opcional, livre |
| `default_cycle_type` | enum `frente_cycle_type` | nullable; sugestão de ciclo ao usar este produto na Frente |
| `catalog_group` | enum `catalog_offer_group` | nullable; grupo comercial (FD, Automações, DRYOS OS, Studio) |
| `catalog_kind` | enum `catalog_offer_kind` | `product` / `plan` / `studio_category`; default `product` |
| `sort_order` | smallint NOT NULL default 0 | ordem dentro do grupo na UI |
| `content_ref` | text | path relativo no dryos-conteudo (referência, sem preço) |
| `archived_at` | timestamptz | soft delete |
| `created_at`, `updated_at` | timestamptz | trigger updated_at |

Index `idx_service_products_slug` (UNIQUE) + `idx_service_products_archived_active` parcial em `(name)` WHERE archived_at IS NULL.

RLS `service_products_authenticated_full` (Inv. 12); mutações via Server Actions admin-only.

**FK relacionada**: `frentes.product_id uuid` nullable → `service_products(id)` ON DELETE SET NULL.

---

### `quick_win_catalog` — catálogo de tipos de Quick Win

21 tipos canônicos cobrindo 7 vilões (3 cada) seedados na migration. Cada tipo tem vilão sugerido (opcional) e impacto sugerido (1-100, opcional). Admin gerencia em `/catalog/quick-wins`. Quando QW é criada numa Operação, usuário pode escolher tipo do catálogo que pré-preenche título/descrição e adiciona impacto sugerido (se vilão está na Op). Sem rastreabilidade de origem na QW criada (v2).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `title` | text NOT NULL | CHECK `length(trim()) BETWEEN 3 AND 120` |
| `description` | text | opcional, livre |
| `suggested_villain_id` | uuid → villains (SET NULL) | nullable; vilão tipicamente atacado |
| `default_impact_pct` | smallint | nullable; CHECK 1-100 quando preenchido |
| `archived_at` | timestamptz | soft delete |
| `created_at`, `updated_at` | timestamptz | trigger updated_at |

UNIQUE expression index `idx_qwc_title_unique_ci` em `lower(trim(title))` evita duplicatas case-insensitive.

Index `idx_qwc_archived_active` parcial em `(title)` WHERE archived_at IS NULL.

RLS `qwc_authenticated_full` (Inv. 12); mutações via Server Actions admin-only.

---

### `diagnostics` — diagnóstico de gestão e maturidade precede a Operação

Histórico por cliente permitido (reavaliações no tempo). Questionário de 13 dimensões e 61 perguntas, pontuação 1-5, sinais de alerta e plano de ação. Suporta rascunho (`status = 'draft'`) e finalizado (`status = 'completed'`).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `client_id` | uuid NOT NULL → clients (CASCADE) | histórico por cliente (sem UNIQUE) |
| `form_type` | text NOT NULL default 'estruturacao_processos' | tipo/modelo do diagnóstico |
| `status` | text NOT NULL default 'completed' | CHECK in ('draft', 'completed') |
| `version` | int NOT NULL default 1 | versão do questionário |
| `notes` | text | nullable; notas ou síntese livre (CHECK length 10-10000 se preenchido) |
| `recommended_product` | enum `product_recommendation` | core/spark/studio nullable |
| `conducted_at` | date | data de condução |
| `profile_data` | jsonb NOT NULL default '{}' | respondente, cargo, setor, porte, faturamento, dores, objetivos |
| `answers` | jsonb NOT NULL default '{}' | mapa de respostas das 61 perguntas |
| `na_answers` | jsonb NOT NULL default '{}' | mapa de perguntas marcadas como N/A |
| `computed_scores` | jsonb NOT NULL default '{}' | índice geral (0-100), nível (1-5), notas das 13 dimensões |
| `flags` | jsonb NOT NULL default '[]' | sinais de alerta detectados (alta/média severidade) |
| `action_plan` | jsonb NOT NULL default '{}' | plano de ação em 3 horizontes (qw 30d, d90, m12) |
| `created_at`, `updated_at` | timestamptz | trigger updated_at |

Index `idx_diagnostics_client_conducted` em `(client_id, conducted_at DESC, created_at DESC)`.
`operations.diagnostic_id` FK SET NULL liga Op opcionalmente ao diagnóstico do cliente.

---

### `quick_wins` — unidade de avanço (PRD §04)

Vinculado a Operação (CASCADE) e opcionalmente a Frente (SET NULL). Executor FK auth.users (SET NULL).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid NOT NULL → operations (CASCADE) | |
| `frente_id` | uuid → frentes (SET NULL) | opcional |
| `executor_id` | uuid → auth.users (SET NULL) | quem registrou |
| `title` | text NOT NULL | CHECK length 3-200 |
| `description` | text | CHECK length ≤ 5000 |
| `happened_at` | date NOT NULL default current_date | |
| `created_at`, `updated_at` | timestamptz | |

Index `idx_quick_wins_operation_happened` (operation_id, happened_at DESC).

---

### `quick_win_impacts` — M:N QW × operation_villain (Inv. 08)

Soma de `impact_pct` por `operation_villain_id` capped 100% via **trigger BEFORE INSERT/UPDATE**. Trigger **AFTER** sincroniza `operation_villains.progress_pct = SUM(impact_pct)`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `quick_win_id` | uuid NOT NULL → quick_wins (CASCADE) | |
| `operation_villain_id` | uuid NOT NULL → operation_villains (CASCADE) | |
| `impact_pct` | int NOT NULL | CHECK 1-100 |
| `created_at` | timestamptz | |

UNIQUE(quick_win_id, operation_villain_id) — sem duplicata. Index parcial em operation_villain_id pra perf da soma.

Trigger `validate_quick_win_impact_sum` (BEFORE INSERT/UPDATE) rejeita com `check_violation` se sum > 100. Mensagem inclui "Inv. 08".

Trigger `sync_operation_villain_progress` (AFTER INSERT/UPDATE/DELETE) recalcula progress_pct do `operation_villain` afetado.

---

### `profiles` — papel do usuário autenticado (Inv. 14)

1:1 com `auth.users` via PK = FK. Diferencia admin de member dentro do app. Visualizador externo é coberto por `/public/[token]` (sem auth).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK → auth.users (CASCADE) | |
| `role` | enum `user_role` NOT NULL default 'member' | admin / member |
| `name` | text | nullable; display name livre |
| `person_id` | uuid → persons (SET NULL) | nullable; liga o login à Pessoa interna. Fonte da verdade pra "Minhas Tasks" (`minhas-tasks` #). Index parcial `idx_profiles_person_id WHERE person_id IS NOT NULL`. |
| `created_at`, `updated_at` | timestamptz | |

Trigger `create_profile_for_new_user` (AFTER INSERT em auth.users, SECURITY DEFINER) cria profile automático com role='member' em cada signup. Backfill na migration cobriu users existentes; seed `rafaelemeth@gmail.com` virou admin. O vínculo `person_id` recebeu backfill por match de email (auth.user × Pessoa interna não-arquivada) na migration `20260529160001_profile_person_link`.

RLS (refinado por `operation-members`, #80):
- SELECT (`profiles_scoped_select`): admin vê todos; member vê **si mesmo + colegas que compartilham uma Operação** (via `operation_members`). Não é mais "todos veem todos".
- UPDATE só admin (`profiles_admin_update`: `USING` / `WITH CHECK` = `public.is_admin()`. Não usar subquery `SELECT ... FROM profiles` na policy — recursão RLS com `profiles_scoped_select`.)
- INSERT bloqueado pra authenticated (só via trigger SECURITY DEFINER)
- DELETE bloqueado (sem policy)

**Gate na aplicação:** helpers `requireAdmin` (server redirect) e `requireAdminAction` (ActionResult). Actions destrutivas (archive×4, delete×7, villain catalog×3, revokePublicLink, setUserRole) chamam `requireAdminAction`. UI esconde botões destrutivos e info comercial (MRR/recorrência) pra member.

---

### `profile_agent_tokens` — token estático MCP (troca por JWT curto)

Segredos de conector remoto (prefixo `mcp_agt_`, exibido **uma vez** no `/admin`). Armazenamento: fingerprint SHA-256 (32 hex) para lookup + `crypt(..., gen_salt('bf'))` para o segredo; sem coluna de plaintext.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL → profiles | dono = `auth.users.id` |
| `name` | text NOT NULL | rótulo (1–120) |
| `token_fingerprint` | text NOT NULL | unique parcial quando ativo |
| `token_hash` | text NOT NULL | bcrypt |
| `scopes` | `mcp_agent_token_scope[]` | `read` / `write` |
| `created_at`, `last_used_at` | timestamptz | |
| `expires_at` | timestamptz NOT NULL | > created_at (CHECK) |
| `revoked_at` | timestamptz | revogação admin |
| `created_by` | uuid → profiles | quem criou |

RLS: SELECT `is_admin()` OU `profile_id = auth.uid()`. **Sem** INSERT/UPDATE direto — `create_mcp_agent_token` / `revoke_mcp_agent_token` (authenticated, SECURITY DEFINER, gate `is_admin()`). **`verify_mcp_agent_token`** (service_role): valida plaintext, checa `auth.users` existente e não banido (`banned_until`), atualiza `last_used_at`; usada só no servidor ao trocar token por JWT.

---

### `mcp_idempotent_responses` — cache de resposta por idempotency (MCP writes)

Chave composta `(profile_id, scope, idempotency_key)`; `result` jsonb. Preenchido pelo app com **service role** após escrita MCP bem-sucedida (evita duplicar `create_task` / etc. em retries).

RLS habilitado **sem** policy para `authenticated` — invisível ao cliente; service_role bypassa.

---

### `operation_members` — vínculo member × Operação (Inv. scope, #80)

Define **quem (member) vê qual Operação**. Admin vê tudo sem precisar de row aqui. Base do gating de visibilidade por Operação que cascateia pra todas as tabelas-filhas.

| Coluna | Tipo | Notas |
|---|---|---|
| `profile_id` | uuid → profiles (CASCADE) | parte da PK composta |
| `operation_id` | uuid → operations (CASCADE) | parte da PK composta |
| `created_at` | timestamptz default now() | |
| `created_by` | uuid → profiles (SET NULL) | admin que atribuiu |

PK composta `(profile_id, operation_id)`. Index reverso `idx_operation_members_operation_id`.

**Helpers SQL (SECURITY DEFINER, STABLE):**
- `is_admin()` → `profiles.role='admin'` do `auth.uid()`.
- `can_see_operation(op_id uuid)` → `is_admin() OR EXISTS(operation_members WHERE profile_id=auth.uid() AND operation_id=op_id)`. **Base de toda RLS de visibilidade.**

RLS:
- `om_admin_all` (ALL): admin lê/escreve tudo.
- `om_member_select_self` (SELECT): member vê só rows que mencionam ele.
- INSERT/DELETE de vínculo só por admin (via `addOperationMemberAction`/`removeOperationMemberAction`, gated por `requireAdminAction`).

**Cascata:** tabelas com `operation_id` usam `can_see_operation(operation_id)`; `allocations`/`tasks` via JOIN com `frentes`; `clients`/`persons`/`diagnostics` via EXISTS em operações visíveis. Catálogos globais (`villains`, `service_products`, `quick_win_catalog`) ficam abertos a `authenticated`. UI admin em `/operations/[id]/settings/members`.

---

### `notifications_log` — audit + dedup de notificações outbound (#90)

Registra cada disparo (sucesso ou falha) pra webhook n8n (por Operação ou global — ver abaixo). Index dedup permite checar "já enviei esse evento pra esse subject nas últimas 24h?". O resumo diário (`daily_digest`) usa `operation_id` NULL e `subject_kind` `daily_digest`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `operation_id` | uuid → operations (CASCADE), **nullable** | NULL só quando `event_type = 'daily_digest'` |
| `event_type` | text NOT NULL | CHECK in `('frente_stale', 'sla_breach', 'daily_digest')` |
| `subject_kind` | text NOT NULL | CHECK in `('frente', 'sla_incident', 'daily_digest')` |
| `subject_id` | uuid NOT NULL | id da Frente ou do incidente |
| `sent_at` | timestamptz default now() | |
| `payload` | jsonb NOT NULL | snapshot do JSON enviado (payload v1) |
| `response_status` | int | HTTP status (200 ok, 0 timeout/rede) |

Index dedup: `(operation_id, event_type, subject_id, sent_at DESC)`.

**RLS:**
- SELECT: admin-only via `is_admin()`.
- INSERT: admin-only via policy (Server Actions); cron usa `createAdmin()` (service-role bypassa RLS).
- Member não vê — notificações são internas.

**Webhooks:** `operations.notification_webhook_url` por Operação. Variável de ambiente **`NOTIFICATION_WEBHOOK_URL`** (server-only) é fallback para `frente_stale` e `sla_breach` quando a Operação não tem URL; é **obrigatória** para o resumo diário agregado (`daily_digest`) no cron `/api/cron/notifications`. Destino validado por `checkWebhookUrl` no `dispatch` — só `https`, porta 443, host público, `fetch` sem redirect.

**Dispatcher:** `src/lib/notifications/dispatcher.ts` POSTa + loga aqui em uma transação lógica (POST → registra status). Timeout 10s. Nunca lança — notificação não pode quebrar fluxo principal.

---

## Funções de arquivamento (migration `20260830023102`)

Oito funções `SECURITY INVOKER` + 1 trigger. Todas com `SET search_path = public`,
`is_admin()` interno, `REVOKE EXECUTE … FROM PUBLIC, anon` + `GRANT … TO authenticated`.

| Função | Papel |
|---|---|
| `archive_operation_cascade(uuid)` | arquiva Operação + Frentes + fecha alocações abertas. Exige status terminal (`23514`) |
| `archive_client_cascade(uuid)` | arquiva Cliente cascateando em cada Operação; aborta a transação se alguma não estiver encerrada |
| `archive_frente_cascade(uuid)` | arquiva Frente + fecha alocações abertas dela |
| `restore_operation(uuid)` | revoga `public_links` **antes** de desarquivar; exige Cliente não arquivado (`P0003`) |
| `restore_frente(uuid)` | desarquiva; exige Operação não arquivada (`P0003`) |
| `archive_operation_impact(uuid)` | contagem do que a cascata vai alterar (alimenta a confirmação) |
| `archive_client_impact(uuid)` | idem, no nível do Cliente |
| `tg_revoke_links_on_terminal()` | trigger: revoga `public_links` ao cancelar **ou** arquivar |

⚠️ **O guard `is_admin()` interno não é redundante com `requireAdminAction`.** A RLS de
UPDATE em `operations`/`frentes`/`allocations` é `can_see_operation`, ou seja qualquer
membro passa — sem o guard, `/rest/v1/rpc/` contorna a Server Action. As duas funções de
impacto **não podem virar `SECURITY DEFINER`**: viveriam como oráculo de contagem
cross-tenant.

⚠️ **`archived_at` de `clients`/`operations`/`frentes` só se escreve por estas funções.**
`update({ archived_at })` direto é bug: pula a cascata, o guard de status e o trigger.

## Enums

| Enum | Valores |
|---|---|
| `product_line` | core, spark, studio |
| `frente_cycle_type` | a, b, c, d, e |
| `frente_domain` | infra, dados_analiticos, dados_tecnicos |
| `operation_status` | em_construcao, em_operacao, janela_critica, concluida, cancelada, arquivada (legado) |
| `frente_phase` | descoberta, execucao, entrega, encerrada |
| `person_kind` | internal, external |
| `allocation_role` | responsavel, executor, aprovador, plantao |
| `recurrence` | mensal, trimestral, anual, unica |
| `meeting_visibility` | interno, cliente |
| `decision_visibility` | interno, cliente |
| `sla_severity` | low, medium, high |
| `sla_incident_status` | open, responded, resolved, cancelled |
| `severity_level` | low, medium, high, critical |
| `product_recommendation` | core, spark, studio |
| `user_role` | admin, member |
| `task_status` | todo, doing, blocked, done |
| `client_contract_status` | rascunho, vigente, encerrada |

> Enum `task_area` **removido** em `20260610150001` — virou a tabela `areas` (FK `area_id`).
| `cost_recurrence` | mensal, unica |

---

## Próximas tabelas planejadas (roadmap)

- `villains` — catálogo de marca (seed 7 records); sem 04
- `quick_win_catalog` — tipos pré-definidos com pesos sugeridos; v2 (deferida)
- `credentials` — refs Bitwarden; v2 (adiada per AD-009)
- `notifications` — Discord webhook events; sem 05
- `form_templates` — refs Tally; sem 05

---

## Migrations aplicadas

| Timestamp | Nome | Aplicada em |
|---|---|---|
| 20260515000001 | initial_schema | 2026-05-15 (via MCP, AD-007) |
| 20260517125711 | briefing_vivo | 2026-05-17 (via MCP) |
| 20260517163210 | meetings_decisions | 2026-05-17 (via MCP) |
| 20260517174018 | attachments | 2026-05-17 (via MCP) |
| 20260517182352 | public_links | 2026-05-17 (via MCP) |
| 20260517184006 | idx_frentes_actionable_status_since | 2026-05-17 (via MCP) |
| 20260517194119 | sla | 2026-05-17 (via MCP) |
| 20260517200953 | villains_catalog | 2026-05-17 (via MCP) |
| 20260517203345 | operation_villains | 2026-05-17 (via MCP) |
| 20260517205902 | diagnostico_quickwins | 2026-05-17 (via MCP) |
| 20260517225505 | profiles | 2026-05-17 (via MCP) |
| 20260518000001 | tasks | 2026-05-18 (via MCP) |
| 20260518010001 | clients_enrich | 2026-05-18 (via MCP) |
| 20260518020001 | operation_costs | 2026-05-18 (via MCP) |
| 20260518030001 | salary_based_costs | 2026-05-18 (via MCP) |
| 20260518030002 | allocation_monthly_cost | 2026-05-18 (via MCP) |
| 20260518040001 | operation_villain_narratives | 2026-05-19 (via MCP) |
| 20260519160001 | service_products | 2026-05-19 (via MCP) |
| 20260520170001 | quick_win_catalog | 2026-05-20 (via MCP) |
| 20260603191700 | tasks_add_start_date | 2026-06-03 (via MCP) |
| 20260610120000 | task_assignees | 2026-06-10 (via MCP) — N:N responsáveis, dropa `tasks.assignee_person_id` |
| 20260610130000 | task_subtasks | 2026-06-10 (via MCP) — `tasks.parent_task_id` self-FK + trigger `enforce_task_parent` |
| 20260610140000 | task_areas_scope | 2026-06-10 (via MCP) — enum `task_area`, tabela `profile_areas`, função `can_see_area` |
| 20260610140001 | tasks_area_operation | 2026-06-10 (via MCP) — `tasks.area`/`operation_id`, `frente_id` nullable, XOR, RLS por área, `can_see_task` |
| 20260610150000 | areas_table | 2026-06-10 (via MCP, AD-014) — tabelas `areas`+`area_clients`+`area_operations`, RLS, seeds cs/fin/jur |
| 20260610150001 | areas_enum_to_fk | 2026-06-10 (via MCP, AD-014) — enum `task_area`→FK `area_id` em tasks/profile_areas; funções `area_can_reach_operation`/`is_area_granted`/`user_in_area`; `can_read_operation`/`can_see_task` reescritas; drop `task_area` |
| 20260610150002 | area_grants_rls | 2026-06-10 (via MCP, AD-014) — SELECT de ~12 tabelas operation-scoped ampliado p/ leitura por concessão; decisions/meetings só `cliente` pra área |
| 20260611040158 | rls_hardening | 2026-06-11 (via MCP, AD-015, issue #127) — storage policies escopadas por operação; catálogos escrita `is_admin()` + DELETE sem policy; `SET search_path` em 6 funções; `rls_auto_enable`/`ensure_rls` versionados; REVOKE anon/PUBLIC + `ALTER DEFAULT PRIVILEGES` |
| 20260611130334 | attachment_visibility | 2026-06-11 (via MCP, AD-016, issue #129) — enum `attachment_visibility` + `attachments.visibility` default `cliente` (controle da superfície pública) |
| 20260611155226 | hot_fk_indexes | 2026-06-11 (via MCP, AD-017, issue #131) — índices nos 5 FKs quentes (`frentes.operation_id`, `allocations.frente_id`/`person_id`, `operations.client_id`, `persons.client_id`); FKs frios (`created_by` etc.) deliberadamente sem índice |
| 20261106123000 | client_contracts | repo — bucket `contracts`, tabela `client_contracts`, RLS admin |
| 20261106123100 | activity_client_contracts | repo — `activity_subject_type` + `client_contract`; triggers no feed |
| 20261106124000 | meeting_agenda_granola | repo — pauta/próximos passos; colunas Granola em `meetings`; `decisions.agenda_item_id` |
| 20261106124500 | activity_profile_subject | repo — enum `activity_subject_type` + valor `profile`; `can_read_activity_subject` para audit de perfil (só admin) |
| 20261106210000 | profiles_admin_update_no_recursion | repo — `profiles_admin_update` usa `is_admin()` para evitar recursão RLS com `profiles_scoped_select` |
| 20261106220000 | mcp_agent_tokens | repo — `profile_agent_tokens`, enum `mcp_agent_token_scope`, RPCs create/revoke/verify (verify service_role) |
| 20261106220100 | mcp_idempotent_calls | repo — `mcp_idempotent_responses` (cache idempotency MCP; só service_role) |
| 20261106220200 | verify_mcp_agent_token_auth_user | repo — `verify_mcp_agent_token` recusa `auth.users` inexistente ou banido |
| 20261107013000 | catalog_conteudo_v2 | repo — enums `catalog_offer_*`, colunas em `service_products`, seed dryos-conteudo, arquivo slugs legado |
| 20261107040000 | client_contracts_implementation_fee | repo — coluna `implementation_fee` opcional |
| 20261107050000 | client_contracts_billing_semantics | repo — `first_billing_date`, `implementation_fee_paid` |
| 20261107060000 | client_contracts_metadata_only | repo — contrato sem arquivo (storage NULL) |

Seeds dev (não-permanentes):
- `supabase/seed/dev_demo.sql` — 3 Clientes + 3 Operações + 3 Frentes + 2 Pessoas + 3 Alocações
