# Database Schema

**Última análise**: 2026-05-17
**Projeto Supabase**: `Delivery OS` (`tmsaucxoeqpfluzwrwkc`)
**Schema**: `public`

Referência viva das tabelas vivas. Atualizar a cada migration. **Antes de criar tabela nova**, consultar este doc + buscar no banco vivo (vide CLAUDE.md "Antes de criar qualquer tabela no banco").

---

## Índice por módulo

| Módulo | Tabelas | Total |
|---|---|---|
| **Cliente** | `clients` | 1 |
| **Operação** | `operations` | 1 |
| **Entrega** | `frentes`, `allocations` | 2 |
| **Pessoas** | `persons` | 1 |
| **Briefing** | `briefings`, `briefing_versions` | 2 |
| **Reuniões / Decisões** | `meetings`, `meeting_attendees`, `decisions` | 3 |
| **Total atual** | | **10** |

---

## Tabelas

### `clients` — empresa atendida pela DRYOS

Origem de Operações, Pessoas externas, Credenciais (v2).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `name` | text NOT NULL | razão social / nome de mercado |
| `slug` | text UNIQUE NOT NULL | URL-safe; pra futuro link público |
| `notes` | text | livre, max 1000 chars (validado no app) |
| `created_at`, `updated_at`, `archived_at` | timestamptz | soft-delete via `archived_at` |

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

---

## Próximas tabelas planejadas (roadmap)

- `profiles` — perfis dos usuários (papel Admin/Membro/Visualizador); sem 02
- `attachments` — Storage refs; sem 03
- `sla` — campos estruturados; sem 03 (pode ser inlined em operations dependendo do modelo)
- `villains` — catálogo de marca (seed 7 records); sem 04
- `operation_villains` — M:N com severidade inicial + progresso; sem 04
- `quick_wins` + `quick_win_catalog` — impactos capped por vilão; sem 04
- `diagnostics` — diagnóstico com vilões detectados; sem 04
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

Seeds dev (não-permanentes):
- `supabase/seed/dev_demo.sql` — 3 Clientes + 3 Operações + 3 Frentes + 2 Pessoas + 3 Alocações
