# Areas as Access Groups — Design

**Spec**: `.specs/features/areas-as-access-groups/spec.md`
**Status**: Draft

---

## Architecture Overview

"Área" deixa de ser enum-rótulo e vira **grupo de acesso** = tabela `areas` + duas junções de concessão (`area_clients`, `area_operations`) + vínculo de pessoa (`profile_areas`, que migra de enum pra FK). O acesso de **leitura** ao painel é decidido por uma cadeia de funções SQL `SECURITY DEFINER` que as policies de RLS chamam. A **escrita** não muda: continua `can_see_operation` (admin/membro real).

```
profile (login) ──< profile_areas >── areas ──< area_clients >── clients ──< operations
                                          └──< area_operations >── operations

Leitura de operação X por mim =
   can_see_operation(X)                  [sou admin ou operation_member]
   OR is_area_granted(X)                 [sou de uma área (não-arquivada) que alcança X]

is_area_granted(X) = EXISTS minha área A tal que area_can_reach_operation(A, X)
area_can_reach_operation(A, X) =
      EXISTS area_operations(A, X)
   OR EXISTS area_clients(A, client_de_X)
```

**Princípio do design:** uma função-base pura de concessão (`area_can_reach_operation(area_id, op_id)`) que **nunca toca `tasks`** — elimina a recursão de RLS (RT-M1) e serve tanto o painel (`is_area_granted`) quanto o gating de tarefa de área.

---

## Code Reuse Analysis

| Componente existente | Local | Como usar |
|---|---|---|
| Padrão `operation_members` + `can_see_operation` | migration `20260526190001` | Espelhar: junção + helper `SECURITY DEFINER STABLE` |
| `can_read_operation` | migration `20260610140002` | **Reescrever** (tirar o ramo que deriva de `tasks`) |
| `can_see_area` | migration `20260610140000` | **Reescrever** assinatura `task_area`→`uuid` |
| `ProfileAreasManager` | `src/components/domain/ProfileAreasManager.tsx` | Estender: vínculo agora por `area_id`; base da UI de gestão |
| `MultiSelect` | `src/components/ui/MultiSelect.tsx` | Reusar pra concessão (selecionar clientes/operações) |
| `AddOperationMemberForm` / `settings/members` | `src/app/(app)/operations/[id]/settings/members` | Padrão de tela de concessão (add/remove com optimistic) |
| `requireAdminAction` / `ActionResult` | `src/lib/actions/*` | Guards + retorno tipado |
| Catálogo arquivável (vilões) | `villains` archive pattern | `areas.archived_at` segue o mesmo (nunca DELETE) |
| `src/lib/utils/areas.ts` | (criado no hotfix) | Vira o módulo puro de tipos/labels carregados do banco |

---

## Data Models

### `areas` (nova — substitui o enum `task_area`)

```sql
CREATE TABLE public.areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,          -- normalizado (lower, sem acento, kebab)
  name        text NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
-- seeds write-once (slug = enum-value antigo, estável p/ backfill; name = rótulo):
--   slug='cs'         name='CS'
--   slug='financeiro' name='Financeiro'
--   slug='juridico'   name='Jurídico'
-- backfill de tasks.area_id / profile_areas.area_id casa enum-value ↔ areas.slug.
```

### `area_clients` (nova — concessão cliente inteiro)

```sql
CREATE TABLE public.area_clients (
  area_id    uuid NOT NULL REFERENCES public.areas(id)    ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES public.clients(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (area_id, client_id)
);
```

### `area_operations` (nova — concessão operação específica)

```sql
CREATE TABLE public.area_operations (
  area_id      uuid NOT NULL REFERENCES public.areas(id)       ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.operations(id)  ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (area_id, operation_id)
);
```

### `profile_areas` (migra enum→FK)

```sql
-- antes: (profile_id, area task_area)   PK (profile_id, area)
-- depois: (profile_id, area_id uuid)    PK (profile_id, area_id)
--   FK area_id → areas(id) ON DELETE CASCADE
```

### `tasks.area` → `tasks.area_id`

```sql
-- area (task_area enum, NULL) → area_id (uuid NULL) FK → areas(id)
-- CHECK XOR: (area_id IS NULL AND frente_id IS NOT NULL) OR (area_id IS NOT NULL AND frente_id IS NULL)
```

**Índices:** `area_clients(area_id)`, `area_clients(client_id)`, `area_operations(area_id)`, `area_operations(operation_id)`, `profile_areas(profile_id)` (já existe), `tasks(operation_id, area_id)`, `tasks(area_id) WHERE area_id IS NOT NULL`.

---

## Funções SQL (núcleo do acesso)

Todas `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`, `REVOKE FROM PUBLIC` / `GRANT TO authenticated`. Não-recursão depende do owner (`postgres`) ter `BYPASSRLS` — padrão Supabase, já usado por `can_see_operation` (RT-M1).

| Função | Assinatura | Lógica | Toca `tasks`? |
|---|---|---|---|
| `area_can_reach_operation` | `(area_id uuid, op_id uuid) → bool` | `EXISTS area_operations(area_id,op_id)` OR `EXISTS area_clients JOIN operations ON client_id WHERE area_id AND operations.id=op_id`. **Não checa auth** (pura concessão). | **Não** |
| `is_area_granted` | `(op_id uuid) → bool` | `is_admin() OR EXISTS(profile_areas pa JOIN areas a ON a.id=pa.area_id AND a.archived_at IS NULL WHERE pa.profile_id=auth.uid() AND area_can_reach_operation(pa.area_id, op_id))` | Não |
| `can_read_operation` | `(op_id uuid) → bool` | **REESCRITA:** `can_see_operation(op_id) OR is_area_granted(op_id)`. Remove o ramo `EXISTS(tasks…)` atual. | **Não** (era sim) |
| `user_in_area` | `(area_id uuid) → bool` | `is_admin() OR EXISTS(profile_areas WHERE profile_id=auth.uid() AND area_id=$1)` (substitui `can_see_area(task_area)`) | Não |
| `can_see_task` | `(t_id uuid) → bool` | `EXISTS tasks t WHERE id=t_id AND ( (area_id IS NULL AND can_read_operation(operation_id)) OR (area_id IS NOT NULL AND (is_admin() OR (user_in_area(area_id) AND area_can_reach_operation(area_id, operation_id)))) )` | Sim (mas usada só em `task_assignees`, não em `tasks` → sem recursão) |

> `can_see_area(task_area)` é **dropada** (assinatura muda); vira `user_in_area(uuid)`. Todas as policies que a chamavam são reescritas.

---

## Mapa de RLS por tabela (SELECT)

Legenda: **R** = ganha leitura de área (`OR is_area_granted`); **R+vis** = leitura de área só `visibility='cliente'`; **R(task)** = regra de tarefa; **—** = inalterada (`can_see_operation`, área **não** vê).

| Tabela | Caminho até `operation_id` | SELECT novo |
|---|---|---|
| `operations` | direto | `can_read_operation(id)` *(já é; muda só por baixo)* |
| `frentes` | direto | **R**: `can_see_operation(op) OR is_area_granted(op)` |
| `tasks` | direto | **R(task)**: `(area_id IS NULL AND can_read_operation(op)) OR (area_id IS NOT NULL AND (is_admin() OR (user_in_area(area_id) AND area_can_reach_operation(area_id,op))))` |
| `decisions` | direto | **R+vis**: `can_see_operation(op) OR (visibility='cliente' AND is_area_granted(op))` |
| `meetings` | direto | **R+vis**: idem decisions |
| `quick_wins` | direto | **R** (conteúdo client-facing, já vai pro /public) |
| `operation_villains` | direto | **R** (client-facing) |
| `operation_villain_narratives` | direto | **R** (client-facing) |
| `sla_incidents` | direto | **R** |
| `briefings` | direto | **R** (o time da área precisa do briefing — decisão do usuário; briefing não tem `visibility`, área lê inteiro) |
| `allocations` | via `frente` | **R**: `EXISTS frentes f WHERE f.id=frente_id AND (can_see_operation(f.op) OR is_area_granted(f.op))` |
| `briefing_versions` | via `briefing` | **R**: `EXISTS(briefings b WHERE b.id=briefing_id AND (can_see_operation(b.op) OR is_area_granted(b.op)))` |
| `meeting_attendees` | via `meeting` | **R+vis** (predicado completo): `EXISTS(meetings m WHERE m.id=meeting_id AND (can_see_operation(m.op) OR (m.visibility='cliente' AND is_area_granted(m.op))))` |
| `quick_win_impacts` | via `quick_win` | **R**: `EXISTS(quick_wins qw WHERE qw.id=quick_win_id AND (can_see_operation(qw.op) OR is_area_granted(qw.op)))` |
| `task_assignees` | via `can_see_task` | usa `can_see_task` reescrita |
| `clients` | via `operations` | **R**: troca o ramo task-area por `OR EXISTS(operations o WHERE o.client_id=clients.id AND is_area_granted(o.id))` |
| `persons` | via `allocations`/`task_assignees` | **R (internal)**: troca o ramo task-area por `(kind='internal' AND EXISTS(allocations a JOIN frentes f… WHERE a.person_id=persons.id AND is_area_granted(f.op)))`. Externa **não** ganha área (MVP). |
| **`diagnostics`** | via `client` | **—** notas de pré-venda sensíveis: área **não** vê (decisão do usuário M1) |
| **`operation_costs`** | direto | **—** financeiro: área **não** vê (decisão deliberada — ver Tech Decisions) |
| **`public_links`** | direto | **—** contém token: área **nunca** vê (segurança) |
| **`attachments`** | direto | **—** Storage tem RLS própria; fora do painel de área no MVP (RT-M2) |
| **`profiles`** | (logins) | **—** área não vê logins de colegas; vê só `persons` internas via allocations |

**Escrita (INSERT/UPDATE/DELETE):** inalterada em tudo = `can_see_operation`, EXCETO `tasks` de área e `task_assignees` de área, cujo CUD passa a `is_admin() OR (user_in_area(area_id) AND area_can_reach_operation(area_id, operation_id))` (a área gerencia o próprio bucket onde tem acesso). Tarefa de entrega: CUD inalterado (`can_see_operation`).

---

## Componentes (app)

### Migração SQL (3 migrations)

- **M-A `<ts>_areas_table.sql`**: cria `areas` + RLS (`areas_admin_all`, `areas_authenticated_select` p/ todos lerem o catálogo — necessário pra UI de tarefa de área e labels). Seeds cs/fin/jur. `area_clients` + `area_operations` + RLS (admin all; `authenticated select` só admin, ou self via profile_areas — concessão é dado de admin). Índices.
- **M-B `<ts>_areas_enum_to_fk.sql`** (a arriscada — RT-M3, ordem obrigatória):
  1. `ADD COLUMN area_id uuid` em `tasks` e `profile_areas`.
  2. Backfill (0 rows hoje; mapear por slug se houver).
  3. **DROP policies** (lista NOMINAL exaustiva — RT-B2): `tasks_scoped_select/insert/update/delete`, `task_assignees_scoped_select/insert/delete`, `clients_scoped_select`, `persons_scoped_select`, `operations_scoped_select`. ⚠️ **`task_assignees_scoped_insert` é caso especial**: foi reescrita em `140002:110-119` e tem `AND EXISTS(persons WHERE kind='internal')` — a recriação DEVE preservar esse guard (invariante "responsável só interno"), senão regride.
  4. **DROP FUNCTION** `can_see_area(task_area)`, `can_see_task(uuid)`, `can_read_operation(uuid)`.
  5. DDL (todos com `IF EXISTS`/`IF NOT EXISTS` — RT-m1): dropar CHECK XOR antigo, trigger `enforce_task_area_immutable` (evento `OF area`), índices `idx_tasks_area`/`idx_tasks_operation_area`; `DROP CONSTRAINT IF EXISTS pk_profile_areas`; dropar coluna `area` (tasks) e `area` (profile_areas); promover `area_id` (FK; NOT NULL em profile_areas; `ADD PRIMARY KEY (profile_id, area_id)`).
  6. **CREATE FUNCTION** novas: `area_can_reach_operation`, `is_area_granted`, `user_in_area`, `can_read_operation` (reescrita), `can_see_task` (reescrita).
  7. Recriar CHECK XOR sobre `area_id`, trigger imutável (`OF area_id`), índices novos.
  8. Atualizar `enforce_task_parent` (`NEW.area`→`NEW.area_id`).
  9. **CREATE policies** novas (mapa acima) em todas as tabelas afetadas.
  10. `COMMENT ON` tabelas/colunas. `DO`-block de asserção + rollback.
- **M-C `<ts>_area_grants_rls.sql`**: aplica os `OR is_area_granted` / `R+vis` nas tabelas restantes (frentes, decisions, meetings, quick_wins, villains, narratives, sla, briefings, allocations, briefing_versions, meeting_attendees, quick_win_impacts, diagnostics). *(Pode fundir com M-B; separar reduz risco de revisão.)*

### Queries — `src/lib/db/queries/`
- `areas.ts` (nova): `listAreas()`, `listAreasWithGrantCounts()`, CRUD reads.
- `profile-areas.ts`: `area`→`area_id`; `listProfilesWithAreas` embeda `areas(name,slug)`.
- `area-grants.ts` (nova): `listAreaClients(areaId)`, `listAreaOperations(areaId)`, `listGrantableClients`, `listGrantableOperations`.
- `tasks.ts`: `area`→`area_id` em select/mappers/tipos; `TaskArea` deixa de ser enum, vira `{id,slug,name}`.
- `decisions.ts` / meetings: leitor de área só vê `cliente` — RLS resolve, mas conferir que a query não força nada que contrarie.

**RT-B1+ — checklist EXAUSTIVO de call-sites de `area` (não só `/public`):** após dropar a coluna, qualquer filtro sobre `area` quebra a query (`42703`). Migrar TODOS:
- `src/lib/db/queries/public-report.ts:88` → `.is("area_id", null)` (invariante 15)
- `src/lib/db/queries/public.ts` (todas as ocorrências de `area`) → `area_id`
- `src/lib/db/queries/dashboard.ts:78` → `.is("area_id", null)` *(o gate pegou: não é `/public`, escapou do grep do invariante)*
- `src/lib/db/queries/tasks.ts:152` → `.not("area_id","is",null)`; + linhas 5/13/35/63/81/234/255 (`TaskArea`, embed `area:`, mappers)
- `src/lib/actions/tasks.ts:25` (`formData.get("area")`) e parse/insert/update → `area_id`
- `src/lib/actions/profile-areas.ts` (`.eq("area",...)`) → `area_id`
- componentes: `AreaTaskForm`, `AreaTasksSection`, `MyTaskListItem`, `ProfileAreasManager`, `SidebarNav`, `utils/areas.ts`
- **Verificação:** `grep -rn '"area"' src/lib/db src/lib/actions` deve voltar vazio após a migração.

### Actions — `src/lib/actions/`
- `areas.ts` (nova): `createAreaAction`/`updateAreaAction`/`archiveAreaAction` (requireAdmin, slug normalizado, 23505 tratado).
- `area-grants.ts` (nova): `grantClientToAreaAction`/`revokeClientFromAreaAction`/`grantOperationToAreaAction`/`revokeOperationFromAreaAction` (requireAdmin, idempotente, revalidate).
- `profile-areas.ts`: `area`→`area_id`.
- `tasks.ts`: `area`→`area_id`.

### UI — `src/app/(app)/admin/areas/`
- `page.tsx`: vira hub — lista de áreas (criar/editar/arquivar) + por área, gestão de membros e concessões.
- `[areaId]/page.tsx` (nova): detalhe da área — membros (`ProfileAreasManager` por área), concessões de cliente (`MultiSelect` de clientes), concessões de operação (`MultiSelect` de operações).
- `AreaForm` (nova), `AreaGrantsManager` (nova). UI de tarefa de área (`AreaTaskForm`) troca enum por options do banco.
- **Read-only no painel:** componentes de operação escondem botões de escrita quando o acesso é só-de-área. Helper de página: `canWriteOperation` (= é admin OU `operation_member`) vs `canReadOperation`. Server components passam um flag `readOnly` pros componentes de ação.

---

## Error Handling Strategy

| Cenário | Tratamento | Usuário vê |
|---|---|---|
| Nome/slug de área duplicado | `23505` → `err('Já existe área com esse nome.', 'validation_failed')` | Toast no form |
| Concessão duplicada | insert idempotente (`23505`→ok) | Sucesso silencioso |
| Non-admin chama action de área | `requireAdminAction` → `err('forbidden')` | Bloqueio |
| Área tenta mutar painel concedido | RLS WITH CHECK falha → `dbErr` | Erro tratado; UI já esconde o controle |
| Arquivar área com concessões | soft-delete; `is_area_granted` filtra `archived_at` | Acesso cessa, histórico mantido |

---

## Tech Decisions (não-óbvias)

| Decisão | Escolha | Razão |
|---|---|---|
| Recursão de RLS em `tasks` | Função-base `area_can_reach_operation` **não toca `tasks`**; `can_read_operation` reescrita sem o ramo de tasks | Repo já baniu `SELECT FROM tasks` em policy de tasks (140001:115). Elimina a recursão na raiz |
| Gating de tarefa de área | área **+** concessão (`user_in_area(area_id) AND area_can_reach_operation(area_id, op)`), não `can_see_area` global | RT-B2: concessão é fonte única; sem isso a concessão vira decorativa |
| Decisão/reunião pra área | `R+vis` (só `visibility='cliente'`) | RT-B1: senão vaza decisão `interna`. Membro real continua vendo tudo |
| `operation_costs` pra área | **fora** | Financeiro (MRR/margem) não é do escopo de um departamento; reduz superfície. Veto do usuário reverte |
| `public_links` pra área | **fora** | Contém token de link público — vazaria acesso anônimo |
| Anexos pra área | **fora** no MVP | RLS de Storage é separada (`storage_path=<op>/`); cobrir exige policy de bucket — adiar (RT-M2) |
| Catálogo `areas` legível por todos `authenticated` | Sim (select aberto) | Labels de tarefa de área e selects precisam; concessão (area_clients/ops) fica admin-only |
| **Escrita de tarefa de área pela área** (exceção ao read-only) | Permitida: CUD de `tasks` com `area_id` setado em op concedida = `is_admin() OR (user_in_area(area_id) AND area_can_reach_operation(area_id, op))` | Decisão M2 do usuário: a área gere o **próprio bucket** de back-office. Read-only vale pra entrega/frentes/decisões/etc — não pro bucket da própria área. Spec Out-of-Scope atualizado |
| **`diagnostics` fora do painel de área** | `—` (área não vê) | Decisão M1: notas de pré-venda (até 10k chars) são o material mais sensível/comercial do cliente. `briefing` entra (time precisa); diagnóstico não |

---

## Riscos residuais (pro 2º gate the-fool)
- Migração enum→FK com ~6 policies dropadas/recriadas numa transação — se uma policy ficar pra trás, tabela fica sem RLS de leitura (vazamento) ou sem acesso (quebra). Asserção pós-migration conta policies esperadas.
- `is_area_granted` chamada por linha em listas grandes — STABLE ajuda dentro do statement; validar plano com `EXPLAIN` em `/operations` e `/tasks`.
- Owner das funções precisa ter `BYPASSRLS` (confirmar `rolbypassrls` do owner antes de confiar na não-recursão).
