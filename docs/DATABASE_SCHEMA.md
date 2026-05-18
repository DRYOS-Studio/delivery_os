# Database Schema

**Última análise**: 2026-05-18 (clients-enrich)
**Projeto Supabase**: `Delivery OS` (`tmsaucxoeqpfluzwrwkc`)
**Schema**: `public`

Referência viva das tabelas vivas. Atualizar a cada migration. **Antes de criar tabela nova**, consultar este doc + buscar no banco vivo (vide CLAUDE.md "Antes de criar qualquer tabela no banco").

---

## Índice por módulo

| Módulo | Tabelas | Total |
|---|---|---|
| **Cliente** | `clients` | 1 |
| **Operação** | `operations` | 1 |
| **Entrega** | `frentes`, `allocations`, `tasks` | 3 |
| **Pessoas** | `persons` | 1 |
| **Briefing** | `briefings`, `briefing_versions` | 2 |
| **Reuniões / Decisões** | `meetings`, `meeting_attendees`, `decisions` | 3 |
| **Anexos** | `attachments` | 1 |
| **Acesso público** | `public_links` | 1 |
| **SLA** | `sla_incidents` | 1 |
| **Vilões (catálogo)** | `villains` | 1 |
| **Operação × Vilão** | `operation_villains` | 1 |
| **Diagnóstico** | `diagnostics` | 1 |
| **Quick Wins** | `quick_wins`, `quick_win_impacts` | 2 |
| **Profiles** | `profiles` | 1 |
| **Total atual** | | **20** |

---

## Tabelas

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
| `notes` | text | livre, max 1000 chars (validado no app) |
| `created_at`, `updated_at`, `archived_at` | timestamptz | soft-delete via `archived_at` |

CHECKs: `cnpj`, `address_state`, `address_zip` (length), `primary_contact_email` (shape).
RLS: `authenticated_full_access` (sem 1). Granularidade Admin/Membro entra com `profiles` (sem 2+).

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
| `status` | enum `operation_status` default `em_construcao` | em_construcao / em_operacao / janela_critica / arquivada |
| `monthly_recurring_revenue` | numeric(14,2) | nullable (Studio one-off) |
| `recurrence` | enum `recurrence` | mensal / trimestral / anual / unica; nullable |
| `start_date`, `end_date` | date | nullable; Tipo C/E não tem fim (validado via Frente) |
| `response_hours` | int | SLA prometido pra primeira resposta. CHECK 0-720. Null = sem SLA |
| `resolution_hours` | int | SLA prometido pra resolução total. CHECK 0-720. Null = sem SLA |
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
| `capacity_weekly_pct` | numeric(5,2) NOT NULL default 0 | CHECK 0..100 |
| `start_date` | date NOT NULL default current_date | |
| `end_date` | date | nullable |
| `created_at`, `updated_at` | timestamptz | sem `archived_at` — é puro relacionamento |

---

### `tasks` — tarefa planejada por Frente

Cobre o gap entre Decisão (perpétuo), Reunião (touchpoint), SLA Incident (não-planejado) e Quick Win (vinculado a vilão). Interna — sem visibility, não aparece em `/public/[token]`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `frente_id` | uuid NOT NULL → frentes (CASCADE) | Inv. de família |
| `title` | text NOT NULL | CHECK length ≥ 3 |
| `description` | text | markdown livre, nullable |
| `status` | enum `task_status` | `todo` / `doing` / `blocked` / `done`, default `todo` |
| `assignee_person_id` | uuid → persons (SET NULL) | nullable; person arquivada não derruba task |
| `due_date` | date | granularidade dia |
| `tags` | text[] | livre; dedup no front |
| `quick_win_id` | uuid → quick_wins (SET NULL) | vínculo opcional |
| `sla_incident_id` | uuid → sla_incidents (SET NULL) | vínculo opcional |
| `created_at`, `updated_at`, `completed_at` | timestamptz | `completed_at` auto-managed por trigger |

Trigger `manage_task_completed_at` (BEFORE INSERT OR UPDATE): set quando status → `done`, clear quando sai de `done`.
Indexes: `(frente_id, status)` + `assignee_person_id` (partial WHERE NOT NULL).
RLS: `tasks_authenticated_full` (delete bloqueado pra member via `requireAdminAction` na action — Inv. 14).

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
| `notes` | text | livre, max 5000 chars (Zod) |
| `visibility` | enum `meeting_visibility` default `interno` | interno / cliente |
| `created_at`, `updated_at` | timestamptz | |

Trigger `set_meetings_updated_at` + index `idx_meetings_operation_scheduled` (operation_id, scheduled_at DESC).

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
| `uploaded_by` | uuid → auth.users (SET NULL) | |
| `created_at`, `updated_at` | timestamptz | |

Triggers `set_attachments_updated_at`. Indexes: `idx_attachments_operation_created` (operation_id, created_at DESC); `idx_attachments_meeting_created` parcial (WHERE meeting_id IS NOT NULL).

**Storage bucket** `attachments` (privado): policies authenticated SELECT/INSERT/DELETE. Sem UPDATE — substituir = delete + upload.

Download via `/api/attachments/[id]/download` Route Handler → signed URL TTL 5min.

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

Rota pública: `/public/[token]` (fora do `(app)`, sem auth). Download de anexo público: `/public/[token]/attachments/[aid]/download` com tripla validação (token válido + attachment pertence à op + meeting visibility=cliente se aplicável).

---

### `sla_incidents` — incidente operacional com timestamps

SLA prometido vive em `operations.response_hours/resolution_hours`. Breach calculado em runtime via helper `utils/sla.ts`.

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

### `diagnostics` — diagnóstico precede a Operação

1 por cliente no MVP (UNIQUE). Notes em prosa + recommended_product opcional.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid NOT NULL UNIQUE → clients (CASCADE) | |
| `notes` | text NOT NULL | CHECK length 10-10000 |
| `recommended_product` | enum `product_recommendation` | core/spark/studio nullable |
| `conducted_at` | date | nullable |
| `created_at`, `updated_at` | timestamptz | |

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
| `created_at`, `updated_at` | timestamptz | |

Trigger `create_profile_for_new_user` (AFTER INSERT em auth.users, SECURITY DEFINER) cria profile automático com role='member' em cada signup. Backfill na migration cobriu users existentes; seed `rafaelemeth@gmail.com` virou admin.

RLS:
- SELECT pra authenticated (todos veem todos — necessário pra section "Usuários" em /admin)
- UPDATE só admin (policy WITH CHECK `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`)
- INSERT bloqueado pra authenticated (só via trigger SECURITY DEFINER)
- DELETE bloqueado (sem policy)

**Gate na aplicação:** helpers `requireAdmin` (server redirect) e `requireAdminAction` (ActionResult). Actions destrutivas (archive×4, delete×7, villain catalog×3, revokePublicLink, setUserRole) chamam `requireAdminAction`. UI esconde botões destrutivos e info comercial (MRR/recorrência) pra member.

---

## Enums

| Enum | Valores |
|---|---|
| `product_line` | core, spark, studio |
| `frente_cycle_type` | a, b, c, d, e |
| `frente_domain` | infra, dados_analiticos, dados_tecnicos |
| `operation_status` | em_construcao, em_operacao, janela_critica, arquivada |
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

Seeds dev (não-permanentes):
- `supabase/seed/dev_demo.sql` — 3 Clientes + 3 Operações + 3 Frentes + 2 Pessoas + 3 Alocações
