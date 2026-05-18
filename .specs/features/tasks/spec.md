# tasks Specification

## Problem Statement

Frente hoje tem 4 tipos de registro associado: **Decisões** (perpétuas), **Reuniões** (touchpoints datados), **SLA Incidents** (eventos não-planejados) e **Quick Wins** (ações ofensivas contra vilão). Falta o mais comum no dia-a-dia: **tarefa planejada**.

Sintomas:
- "Status acionável" da Frente é UMA linha ("aguardando X de Y desde Z"). Quando 4 coisas estão em paralelo, vira frase artificial.
- Decisão registra escolha, não o que executar.
- Incidente é não-planejado por definição (Inv. domain).
- Quick Win exige vínculo com vilão e impact %. Tarefa cotidiana ("ajustar copy do email") não cabe.
- Princípio 07 dispensa GitHub Issues, mas nem toda Frente tem repo (Sparks/Studio podem ser sem código).
- Visão cross-Frente ("o que tá na minha agenda esta semana") não existe.

Pedido do usuário: tabela `tasks` interna leve, vinculada a Frente, com referência opcional a Quick Win ou SLA Incident.

## Goals

- [ ] Tabela `tasks` em `public` (20ª tabela)
- [ ] FK `frente_id` NOT NULL (Inv. de família: Task não existe sem Frente)
- [ ] Campos: title, description (md, nullable), status enum, assignee_person_id (nullable), due_date (nullable date), tags text[] (nullable), quick_win_id (nullable FK), sla_incident_id (nullable FK), created_at, updated_at, completed_at (nullable, auto-managed)
- [ ] Enum `task_status`: `todo` / `doing` / `blocked` / `done`
- [ ] Trigger auto-set `completed_at`: quando status → done, set now(); quando sai de done, set null
- [ ] RLS habilitado: authenticated full (padrão MVP)
- [ ] Server Actions CRUD: create, update, archive (no MVP usar delete real, tasks não são auditadas como decisões), changeStatus
- [ ] UI section "Tarefas" dentro de cada Frente expandida em `/operations/[id]`
- [ ] Form pra new/edit (page route ou modal — escolher no design)
- [ ] List com filtro por status (toggle ou tabs)
- [ ] **Apenas interna** — não aparece em `/public/[token]`
- [ ] DATABASE_SCHEMA.md atualizado
- [ ] Helpers query: `listTasksByFrente(frenteId)`, `countOpenTasksByFrente(frenteId)`
- [ ] Painel admin: card "Tarefas abertas" (count todo+doing+blocked) no DashboardCountsGrid

## Out of Scope

- **Subtarefas / dependências entre tasks** — Frente é o agrupador; se precisar de hierarquia, vira Frente nova.
- **Recorrência** — task recorrente é planejamento que cabe fora (Toggl/calendar).
- **Comentários / threads** — descrição cobre; conversa profunda vira Reunião + Decisão.
- **Anexos por task** — anexos vivem no nível Operação (princípio existente). Linkar via menção no description se necessário.
- **/tasks cross-Frente view** — out do MVP. Section por Frente cobre o caso comum. View agregada por assignee fica pra v2.
- **Estimativa / tempo gasto** — Toggl externo (princípio 07).
- **Labels custom / projeto / sprint** — `tags text[]` cobre suficientemente; sem schema de labels.
- **Notificação Discord ao mudar status** — feature `discord-webhook` separada.
- **Assignee múltiplo** — 1 assignee só. Se vários, criar tasks separadas ou usar Allocation pra alocação ampla.
- **Visibility per-task** — task é sempre interna; sem flag.
- **Histórico de mudança de status** — `updated_at` cobre; sem audit log no MVP.
- **Public link mostra tasks** — não. Cliente vê Status acionável + Decisões + QWs.
- **Linkar com Briefing** — out; description livre cobre referências.

---

## User Stories

### P1: Schema ⭐ MVP

**Acceptance Criteria**:
1. Enum `task_status` (`todo`/`doing`/`blocked`/`done`)
2. Tabela `tasks`:
   - id uuid PK default gen_random_uuid
   - frente_id uuid NOT NULL FK frentes(id) ON DELETE CASCADE
   - title text NOT NULL CHECK length >= 3
   - description text NULL
   - status task_status NOT NULL DEFAULT 'todo'
   - assignee_person_id uuid NULL FK persons(id) ON DELETE SET NULL
   - due_date date NULL
   - tags text[] NULL
   - quick_win_id uuid NULL FK quick_wins(id) ON DELETE SET NULL
   - sla_incident_id uuid NULL FK sla_incidents(id) ON DELETE SET NULL
   - created_at timestamptz NOT NULL DEFAULT now()
   - updated_at timestamptz NOT NULL DEFAULT now()
   - completed_at timestamptz NULL
3. Trigger BEFORE INSERT/UPDATE de `manage_task_completed_at`:
   - Se NEW.status='done' e (OLD IS NULL OR OLD.status<>'done') → NEW.completed_at = now()
   - Se NEW.status<>'done' e OLD.status='done' → NEW.completed_at = NULL
4. Trigger BEFORE UPDATE `set_tasks_updated_at` (reusa fn set_updated_at)
5. RLS habilitado + policy `authenticated_full` (padrão MVP)
6. COMMENT ON TABLE: módulo, propósito, Inv. de família

---

### P1: Server Actions ⭐ MVP

**Acceptance Criteria**:
1. `createTaskAction(formData)`:
   - Auth guard
   - Validação Zod: title (3+ chars), status (enum), opcionais validados
   - INSERT
   - revalidatePath operation
   - Retorna ok({id})
2. `updateTaskAction(id, formData)`: similar
3. `changeTaskStatusAction(id, newStatus)`: ação leve sem form, usada pelo botão de mudança de status no list
4. `deleteTaskAction(id)`: hard delete (não há histórico). Gated `requireAdminAction` por consistência com outras delete actions (Inv. 14 do CLAUDE.md).

---

### P1: Queries ⭐ MVP

**Acceptance Criteria**:
1. `listTasksByFrente(frenteId)` — retorna tasks ordenadas: `done` por último, depois `due_date asc nulls last`, depois `created_at desc`. Inclui assignee resolvido (name) via join.
2. `countOpenTasksByFrente(frenteId)` — count status IN (todo, doing, blocked)
3. `countAllOpenTasks()` — para o painel admin

---

### P1: UI section "Tarefas" em Frente ⭐ MVP

**Acceptance Criteria**:
1. Bloco "Tarefas" dentro de cada Frente expandida em `/operations/[id]`
2. Header: "Tarefas" + count aberta + botão "+ Nova tarefa" (admin pode criar; member também pode — task não é destrutiva)
3. Lista com 4 colunas visuais (ou stack vertical em mobile):
   - Checkbox-like de status (clique cicla todo→doing→done; blocked via dropdown)
   - Title (linkado pra edit)
   - Assignee Avatar + initials (nullable)
   - Due date Pill (variant warning se atrasada, oak se < 3d, neutral se > 3d, sem pill se null)
4. Filtro toggle: "Abertas" (default) / "Concluídas" / "Todas"
5. Empty state: "Nenhuma tarefa por aqui ainda — adicionar a primeira"
6. Botão delete (×) só pra admin (Inv. 14)

---

### P1: Form new/edit ⭐ MVP

**Acceptance Criteria**:
1. Rota `/operations/[id]/frentes/[fid]/tasks/new` e `.../tasks/[tid]/edit`
2. Form com campos: title (required), description (textarea md), status (select), assignee (select de persons), due_date (date input), tags (chips input ou input separated by comma), quick_win_id (select opcional dos QW da Operação), sla_incident_id (select opcional dos incidents da Operação)
3. Submit chama action; redirect pra `/operations/[id]` (volta pra Frente expandida)
4. Form mode edit pré-popula tudo
5. Delete button no edit (admin only)

---

### P1: Painel admin card ⭐ MVP

**Acceptance Criteria**:
1. DashboardCountsGrid ganha 5º card "Tarefas abertas" (todo+doing+blocked, todas frentes não-arquivadas) — ou trocar layout pra 5 col em lg
2. Variant: sage se 0, neutral default, warning se > 20

---

### P2: View cross-Frente filtrada por assignee

Pulada no MVP. Pode ser feature futura "Minha agenda".

### P3: Recorrência, comentários, subtarefas

Out.

---

## Edge Cases

- **Task deletada** → CASCADE de Frente apaga; FK SET NULL de QW/incident/person preserva referências
- **Person arquivada** → assignee_person_id SET NULL (assignment perde-se; task continua viva)
- **Quick Win deletado** → quick_win_id SET NULL
- **SLA Incident resolvido** → não afeta task linkada; admin pode mudar status manualmente
- **Status done → todo** → completed_at volta pra NULL (trigger)
- **Task sem assignee** → permitido; aparece sem avatar
- **Due_date passada e status != done** → Pill warning ("Atrasada há Nd")
- **Tag duplicada no array** → permitido no MVP (UI pode dedup); sem CHECK no banco
- **Member criar task** → permitido (não-destrutivo)
- **Member deletar task** → bloqueado (requireAdminAction)
- **Public link mostra tasks** → não. Skip explicit; nenhum query público busca tasks.

---

## Success Criteria

- [ ] Migration aplicada; tipos regenerados
- [ ] Build + typecheck verde
- [ ] Criar task pelo form funciona (admin e member)
- [ ] Mudar status via checkbox/cycle funciona
- [ ] Filtro Abertas/Concluídas/Todas funciona
- [ ] Trigger completed_at preenche/limpa corretamente
- [ ] CASCADE testado: deletar Frente apaga tasks; deletar Person seta assignee NULL
- [ ] Member não consegue deletar (toast forbidden)
- [ ] Painel admin mostra count tasks abertas
- [ ] DATABASE_SCHEMA.md atualizado (20 tabelas)
- [ ] Smoke preview: section visível em Frente expandida; form abre; criar+listar+marcar done funciona

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Tabela nova ou reusar | Nova (`tasks`) | Gap real; nenhuma tabela existente cobre |
| frente_id NOT NULL | Sim | Task não é Operação-level; Frente é o agrupador natural |
| Status enum | todo/doing/blocked/done | 4 estados clássicos; sem custom statuses |
| Assignee 1 | 1 só (nullable) | Pra múltiplos, várias tasks ou Allocation |
| Vincular a QW e Incidente | FKs nullable | Permite "tarefa pra resolver QW X" sem exigir |
| Public visibility | Não | Pedido do usuário — task é ferramenta interna |
| Delete | Hard delete (admin only) | Sem histórico de tarefas; arquivar não faz sentido pra tarefas executadas |
| Description | Sim, markdown nullable | Detalhe quando precisa |
| Tags | text[] nullable | Flex sem schema de labels |
| Due_date | date nullable | Granularidade dia; horário não importa pra MVP |
| Estimativa | Não | Toggl externo |
| Recorrência | Não | Out |
| Comentários | Não | Reunião + Decisão cobrem |
| Subtarefas | Não | Frente é o agrupador |
| Mudança via cycle | todo→doing→done | UX rápida; blocked via dropdown |
| Trigger completed_at | Sim, set/clear automático | Consistência sem app overhead |
| RLS | authenticated_full | Padrão MVP; Inv. 14 cobre o gate destrutivo |
| /tasks cross-Frente | Não no MVP | Section por Frente cobre o caso comum |
| Painel admin card | Sim — "Tarefas abertas" | Visibilidade do volume |
| Anexos | Não | Anexos vivem no nível Operação |
| Created_by | Não | Tabelas similares (decisions, meetings, incidents) não tracking; updated_at + tabela leve cobrem |
| Audit log de status | Não | updated_at cobre MVP |
