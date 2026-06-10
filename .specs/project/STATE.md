# State

**Last Updated:** 2026-06-10
**Current Work:** `areas-as-access-groups` — fase tlc-pipeline: SPECIFY ✅ + DESIGN ✅ (2 gates the-fool passados), aguardando aprovação do design pra entrar em TASKS. Reverte AD-013 → ver AD-014. Hotfix prévio mergeado (PR #116): constantes de área movidas pra `src/lib/utils/areas.ts` (fronteira client/server quebrava build Vercel). Anteriormente: `tasks-multi-assignee-subtasks` — issue #102, 2 PRs stacked. **PR-A** `feat/tasks-multi-assignee` (#103): múltiplos responsáveis (todos iguais). Nova junção `task_assignees(task_id,person_id)` PK composto, FKs CASCADE, RLS espelha tasks via task→frente→operation. Backfill dos `assignee_person_id` → junção, depois **drop** da coluna (fonte única). Migration `20260610120000_task_assignees.sql`. Queries: `TaskRow.assignees: {id,name}[]`; filtro `/tasks` por pessoa usa embed `!inner` (+`.eq("assignees.person_id")`), display usa embed normal; counts via `task_assignees!inner`. Actions: `syncAssignees` (delete+insert) no create/update; validator `assignee_person_ids` (array). UI: TaskForm/TaskQuickCreateForm com checkboxes; TaskListItem grupo de avatares; MyTaskListItem nomes concatenados. Sintaxe dos 3 selects PostgREST validada via REST anon → 200. **PR-B** `feat/tasks-subtasks` (stacked sobre A): subtarefas pai→filho 1 nível. Coluna `tasks.parent_task_id` self-FK CASCADE + CHECK anti-self + trigger `enforce_task_parent` (BEFORE INS/UPD OF parent_task_id,frente_id; `SET search_path=''`): barra 2 níveis, exige mesma Frente, barra pai-com-filhas virar filha. Migration `20260610130000_task_subtasks.sql`. **Sem rollup de status** (pai/filhas independentes; UI só mostra "m/n subtarefas"). Helpers `listEligibleParents(frenteId,exclude?)` + `countSubtasks(parentId)`. TaskForm ganha select "Tarefa-pai" (escondido em edição se a task já tem filhas); new page lê `?parent=` (atalho "+ subtarefa" no TaskListItem). TasksSection agrupa pai→filhas (filha órfã sob filtro cai como top-level); contador via `subtaskTotals` computado no frente page sobre lista completa; contagem de Frente (totalOpen/Done/All) passa a excluir subtarefas. Trigger testado via DO block (5 asserções OK). `get_advisors` só warnings pré-existentes em ambos. **Decisões:** ver AD-011 (junção, sem principal) + AD-012 (subtarefa 1 nível, CASCADE, sem rollup). Anteriormente (MERGED #101): `tasks-start-date` — branch `feat/tasks-start-date`, issue #100. Adiciona `start_date` (data de início) à tabela `tasks`, ao lado de `due_date`. Migration `20260603191700_tasks_add_start_date.sql` (aplicada via MCP): coluna `date` nullable + CHECK `check_tasks_start_before_due` (`start_date IS NULL OR due_date IS NULL OR start_date <= due_date`) + COMMENT. Types regenerados. `queries/tasks.ts`: `TaskRow.startDate` + `start_date` no `TaskJoinedRow`, nos 2 SELECTs e nos 2 mappers. `validators/task.ts`: `start_date` optionalDate + `.refine` (início ≤ prazo, path start_date → erro mapeado pro campo). `actions/tasks.ts`: parse + insert + update. Forms `TaskForm` e `TaskQuickCreateForm` ganharam campo "Data de início" (grid com Prazo; Tags virou linha própria). Exibição: `MyTaskListItem` (/tasks) mostra `· início DD/MM` na linha meta; `TaskListItem` (lista por Frente) mostra `início DD/MM` abaixo do pill de prazo. `get_advisors` só acusou warnings pré-existentes (nada do change). Anteriormente (MERGED #99): `tasks-quick-create` — branch `feat/tasks-quick-create`, issue #98. Criação de tarefa direto de `/tasks`: botão "Criar tarefa" (Plus, variant sage, visível p/ todo user — `createTaskAction` usa `requireUserAction`, não admin) no PageHeader → rota `/tasks/new`. Form `TaskQuickCreateForm` (client) com cascade Operação→Frente: select de Frente desabilitado até escolher Operação, opções filtradas client-side via `watch("operation_id")`+`useMemo`; troca de Operação reseta `frente_id` (register onChange→setValue). Campos core (título, descrição, status, responsável, prazo, tags); **Quick Win/Incidente SLA fora de escopo** (dependem da Operação, ficam no form de edição por Frente). Reusa `createTaskAction(frenteId, fd)`; sucesso → push `/tasks`. Nova query `listOperationsWithFrentes()` em `queries/operations.ts` (RLS-safe, operações não-arquivadas c/ frentes ativas, omite op sem frente — alimenta cascade sem round-trip). Empty-state quando user não tem Operação com Frente. Sem migration. Anteriormente (MERGED #97): `tasks-assignee-filter` — branch `feat/tasks-assignee-filter`, issue #96. Evolui `minhas-tasks` numa visão geral "Tasks": rota `/me/tasks` → `/tasks`, nav label "Minhas Tasks" → "Tasks". Novo dropdown de responsável (pessoas internas + "Todos") no topo. Default = minhas tarefas (resolve `profile.personId`; cai pra "Todos" quando o vínculo é null — desarma o empty-state do AD-010). Sem migration (filtra `assignee_person_id` existente). Query: `listMyTasks`/`countMyTasks` → `listTasks(filter, assigneePersonId?)`/`countTasks(assigneePersonId?)`; tipos `MyTaskFilter`→`TaskListFilter`, `MyTaskRow`→`CrossFrenteTaskRow`; select ganhou join do assignee p/ mostrar responsável no modo "Todos". `countMyOpenTasks` (badge do nav = minhas abertas) inalterado. Componentes: `MyTasksList`→`TasksList` + novo `TasksToolbar` (client, select + tabs preservando params via useSearchParams); `MyTaskListItem` ganhou prop `showAssignee`. Anteriormente: `minhas-tasks` — branch `feat/minhas-tasks`, sem issue (decisão do usuário). Realiza o "/tasks cross-Frente view por assignee" que o spec de `tasks` deixou pra v2. Nova coluna `profiles.person_id` (FK persons, SET NULL, backfill por email) liga login → Pessoa interna. Página `/me/tasks` lista tasks atribuídas a mim agregadas de todas as Frentes/Operações; default só abertas, tabs open/done/all. Query `listMyTasks` + `countMyTasks`/`countMyOpenTasks` em `queries/tasks.ts` (join aninhado frente→operation→client). Componentes `MyTasksList` + `MyTaskListItem`. Nav leaf "Minhas Tasks" (ListChecks) com count de abertas. Empty state quando `person_id` null. ⚠️ Gotcha: backfill só casou `rafaelemeth@gmail.com` (seed person Rafael); os users reais `rafael@dryos.com.br` e `gabriela@dryos.studio` ficaram com `person_id` NULL → veem empty state até admin vincular. Anteriormente: `discord-notifications` — COMPLETE (issue #90). Outbound de eventos críticos via n8n (Frente parada + SLA estourado). Nova coluna `operations.notification_webhook_url` (per-Op, NULL = no-op). Nova tabela `notifications_log` (audit + dedup window 24h, admin-only RLS). Módulo `src/lib/notifications/` com types canônicos (payload v1 versionado), dispatcher fire-and-forget (timeout 10s, sempre loga), detectores (frente-stale via cron + sla-breach helper puro). Cron diário `/api/cron/notifications` (Vercel cron schedule `0 11 * * *` UTC = 08:00 BRT) com auth via `CRON_SECRET`. SLA breach também dispara sync no `createIncidentAction` + `updateIncidentAction` via `maybeNotifySlaBreach` (fire-and-forget). UI: nova seção "Integrações" no `OperationForm` com campo URL. Doc `payload-v1.md` pro time do n8n implementar o fluxo. Anteriormente: `mobile-responsive` — COMPLETE (issue #86, PRs #87 + #88 + #89). App agora navegável em mobile/tablet sem zoom horizontal. PR-A: `MobileShell` (Client) wrappa Sidebar (Server) com top-bar mobile + drawer slide-in (ESC/backdrop/click-outside/auto-close on navigate); sidebar refatorada pra componente puro. PR-B: novo `MobileListItem` reusável (5 slots: title/subtitle/pills/meta/trailingValue); 3 tabelas viram card list abaixo de md; 4 grids 12-col (FrentesListSection, CostsTab, AllocationsSection, TaskListItem) stack via `flex-col + md:grid` + truque `md:contents` pra pills cluster. PR-C: PageHeader actions `flex-wrap`, MetricCard responsive text size, HomeSidebar grid em tablet, AddOperationMemberForm stack mobile, TabsNav snap-scroll. DS SKILL ganhou seção canônica "Mobile patterns" (Shell drawer + Listas responsivas + Grids responsivos + PageHeader actions). Anteriormente: `home-dashboard` — COMPLETE (issue #84, PR #85). Home (`/`) reescrita como dashboard grid 2 colunas, role-aware.

Anteriormente: `operation-members` — COMPLETE (issue #80, PRs #81 + #82 + #83). Home (`/`) reescrita como dashboard grid 2 colunas, role-aware: faixa de KPIs no topo (`HomeKpiStrip` — admin 6 cards c/ MRR+Margem, member 4 sem financeiro), coluna principal (tabs funcionais via `?status=` + Atenção + `OperationsGrid`), sidebar (`HomeSidebar` — vilões da carteira/ops + Quick Wins 30d). Reusa `getDashboardSummary`/`getTopVillainsByFrequency` (RLS-safe). Componentes novos: HomeKpiStrip, HomeStatusTabs, OperationsGrid, HomeSidebar + helper `normalizeStatusFilter`. `/admin/dashboard` inalterado. Anteriormente: `operation-members` — COMPLETE (issue #80, PRs #81 + #82 + #83). Gating de visibilidade por Operação: tabela `operation_members(profile_id, operation_id)` + helpers `is_admin()`/`can_see_operation()`; member só vê Operações atribuídas, admin vê tudo. RLS reescrita em ~20 tabelas (diretas via `operation_id`, allocations/tasks via frente, clients/persons/profiles cascateadas). UI admin em `/operations/[id]/settings/members` (add/remove). Estados vazios diferenciados admin vs member. Catálogos (villains/service_products/quick_win_catalog) ficam globais. Também: provisionados 2 users via SQL (Gabriel=member, Gabriela=admin) — vide memory `dryos-dev-workflow-quirks` pro gotcha de `auth.identities` + tokens NULL. Anteriormente: #76 catalog-view-toggle (PR #77), #64 quick-wins-catalog (PR #75). **Catalog-admin (Semana 04) COMPLETE.** Próximos: integrações n8n (`tally-webhook`, `discord-notifications`, `sla-incidents-ingest`), `dark-mode`, `polish-migration`.

---

## Recent Decisions (Last 60 days)

### AD-014: Áreas viram grupos de acesso escopado read-only — SUCEDE AD-013 (2026-06-10)

**Decision:** Reverte o escopo global do AD-013. "Área" deixa de ser enum-rótulo e vira **grupo de acesso dinâmico**: tabela `areas` (CRUD admin, cs/fin/jur viram seeds arquiváveis), concessão em 2 níveis (`area_clients` + `area_operations`), vínculo `profile_areas` migra enum→FK `area_id`, `tasks.area`→`tasks.area_id`. Quem é da área **lê** (read-only) o painel operacional dos clientes/operações concedidos via `can_read_operation` reescrita (`can_see_operation OR is_area_granted`). Núcleo: função-base `area_can_reach_operation(area_id,op_id)` **pura** (não toca `tasks` → sem recursão de RLS, owner `postgres` tem BYPASSRLS). Tarefa de área agora gateada por **área + concessão** (não mais global). Decisões/reuniões pra área: só `visibility='cliente'` (não vaza `interno`). Escopo de leitura: operação/frentes/tarefas de entrega/decisões+reuniões(cliente)/vilões/quick-wins/SLA/briefing/pessoas internas. **Fora:** diagnóstico (pré-venda sensível), custos, public_links (token), anexos (Storage MVP). Exceção ao read-only: área gere o próprio bucket de tarefa de área (CUD onde concedida).
**Reason:** Usuário pediu áreas criáveis pela UI + acesso por cliente/projeto (não "toda a carteira"). 2 gates the-fool: B1 (RLS de decisions/meetings nunca filtrou visibility p/ leitor não-cliente → vazaria interno), B2 (concessão tem que ser fonte única, senão decorativa), M1 (design vazava diagnóstico/briefing além do spec → diagnóstico cortado, briefing mantido a pedido), M2 (escrita de tarefa de área = exceção legítima).
**Trade-off:** Migração enum→FK é a parte arriscada (type `task_area` em 9 pontos: coluna, PK, função, 3 triggers, CHECK, 2 índices) — ordem obrigatória drop policies→drop funções→DDL→seed→recriar. RLS com OR de 2 junções por linha (índices mitigam; reavaliar se carteira crescer). Specs em `.specs/features/areas-as-access-groups/`.
**Impact:** Invariante 15 do CLAUDE.md muda (`area`→`area_id`); `docs/DATABASE_SCHEMA.md` ganha 3 tabelas. 3 migrations planejadas (M-A tabelas, M-B enum→FK, M-C RLS grants).

### AD-013: Tarefas de área (CS/Financeiro/Jurídico) — escopo global + opção B read-only (2026-06-10)

**Decision:** Tarefas transversais por área, no nível da Operação. `tasks` vira XOR — entrega (`area NULL` + Frente, visível à Operação) OU área (`area` setada + `frente_id NULL`, visível a admin + `profile_areas` da área, **escopo global**). Após red-team (`the-fool`) no PR #110: (opção **B**, read-only) a área passa a **ler** Operação/Cliente/Pessoa das suas tarefas via `can_read_operation` aplicado só nos SELECT de `operations`/`clients`/`persons` — escrita continua só `can_see_operation`. `area` imutável após criação (trigger); responsável só pessoa interna (RLS); `/public` filtra `area IS NULL`; KPI de entrega do dashboard exclui área.
**Reason:** Usuário precisa de tarefas que não sejam "de conhecimento total da Operação". Global porque CS/Fin/Jur são back-office da carteira inteira. Read-only na opção B pra não dar à área poder de escrita em operação que não é dela (furo que o the-fool pegou).
**Trade-off:** Membro de área lê o contexto (op/cliente/responsável) das suas tarefas mas NÃO o resto da operação (frentes/decisões) — se quiserem "leitor pleno da operação", estender `can_read_operation` às demais tabelas. Ex-membro de área cujo row em `profile_areas` não foi removido mantém acesso global (furo #4 → fechar com remove + audit no PR2). Migrations `20260610140000/140001/140002`. PR #110 = backend; PR2 = admin de áreas; PR3 = UI.

### AD-012: Subtarefa é hierarquia de 1 nível, CASCADE, sem rollup de status (2026-06-10)

**Decision:** Relação entre tarefas = subtarefas (pai→filho), NÃO dependências. `tasks.parent_task_id` self-FK `ON DELETE CASCADE`. Trigger `enforce_task_parent` trava em 1 nível (sem subtarefa-de-subtarefa) e exige mesma Frente. Pai e filhas têm status independentes — sem rollup; UI mostra só "m/n subtarefas".
**Reason:** Pedido do usuário com restrição "não complicar". Subtarefa é mais intuitiva que dependência; 1 nível + sem rollup evita lógica de grafo e de auto-completar. CASCADE casa com o modelo (task não é auditada como Decisão).
**Trade-off:** Deletar pai apaga filhas (perda controlada, aceita). Contagem de Frente passou a excluir subtarefas pra não inflar "abertas". Filha órfã sob filtro de status cai como top-level no render.
**Impact:** Migration `20260610130000`. Helpers `listEligibleParents`/`countSubtasks`. Se um dia precisar de dependências reais (A bloqueia B), é feature nova — não estender este modelo.

### AD-011: Múltiplos responsáveis via junção `task_assignees`, sem principal, dropa coluna single (2026-06-10)

**Decision:** Responsáveis de Task viram N:N "todos iguais" via `task_assignees(task_id, person_id)`. Backfill do `assignee_person_id` e **drop** da coluna — junção é fonte única, sem "responsável principal".
**Reason:** Pedido do usuário (trabalho em dupla sem duplicar task). Manter a coluna + junção = duas fontes da verdade (anti-padrão que os invariantes barram). Filtro `/tasks` por pessoa vira "está entre os responsáveis" via PostgREST `!inner`.
**Trade-off:** Drop irreversível pós-merge (backfill roda antes do drop na mesma migration). Filtro com `!inner` poda o avatar group pra pessoa filtrada — aceitável (você filtrou por ela).
**Impact:** Migration `20260610120000`. `TaskRow.assignees[]`. Forms com checkboxes. RLS da junção espelha tasks via task→frente→operation.

### AD-010: Link usuário→pessoa via `profiles.person_id`, não match por email em runtime (2026-05-29)

**Decision:** "Minhas Tasks" resolve "quem sou eu" via coluna explícita `profiles.person_id` (FK → persons, ON DELETE SET NULL), não casando email em runtime. Email só alimenta o backfill da migration.
**Reason:** Match por email é frágil — Pessoa sem email (ex: Gabi no seed) some; homônimos colidem. Coluna explícita é fonte da verdade, gerenciável por admin (RLS UPDATE já é admin-only).
**Trade-off:** Exige vincular cada user à sua Pessoa. Backfill por email cobre só quem tem email batendo; resto vê empty state até vínculo manual. No banco vivo, só `rafaelemeth@gmail.com` casou — `rafael@dryos.com.br`/`gabriela@dryos.studio` precisam de UPDATE manual.
**Impact:** `person_id` mora em `profiles` (1:1 com auth.users). Próximo passo natural (fora deste escopo): tela admin pra editar o vínculo, ou backfill SQL dos users reais.

### AD-001: Skills movidas pra `.claude/skills/<name>/SKILL.md` (2026-05-15)

**Decision:** `dryos-conventions-SKILL.md` e `dryos-design-system-SKILL.md` movidos da raiz pros caminhos canônicos do CLAUDE.md (`.claude/skills/dryos-conventions/SKILL.md`, `.claude/skills/dryos-design-system/SKILL.md`).
**Reason:** Alinhar com referência do CLAUDE.md e permitir descoberta automática do agente.
**Trade-off:** Histórico git tem rename, mas mantém continuidade via `git log --follow`.
**Impact:** Skills passam a ser carregadas automaticamente quando o pattern bater.

### AD-002: CLAUDE.md expandido com 8 blocos da Casa Financeira (2026-05-15)

**Decision:** Trazidos pro DRYOS, com adaptação de razões/conteúdo: `tlc-spec-driven` obrigatório antes de code change; Invariantes de implementação (14 regras duras); Server Actions com `ActionResult<T>`; Migration conventions detalhadas; Antes de criar tabela (checklist 3 buscas); Issue antes de PR; Documentação como contrato; MCP tools listados.
**Reason:** Mesmas dores do outro projeto (17+ entidades, regras sutis, RLS universal). Padrões maduros valem trazer com adaptação, não verbatim.
**Trade-off:** CLAUDE.md cresceu de 186 → 404 linhas; ainda dentro de margem útil. Cerimônia maior por mudança de código (tlc-spec-driven obrigatório), aceito pelo usuário.
**Impact:** Toda mudança de código agora abre com `Skill: tlc-spec-driven`. Schema obrigado a `COMMENT ON TABLE` + RLS + FK nomeada na mesma migration.

### AD-009: Adiar `bitwarden-integration` pra v2 (2026-05-15)

**Decision:** Tirar a feature `bitwarden-integration` do escopo da semana 1. Tabela `credentials` (que apontaria pro Bitwarden) também sai do MVP — entra junto quando o cofre real for definido.
**Reason:** Bitwarden Teams (US$ 4/usuário/mês) é custo evitável no estágio atual. Decisão 03 do PRD já antecipou: "Vaultwarden self-host fica como alternativa pra v2 se mensalidade incomodar." Princípio 01 ("sistema é mapa, não cofre") permanece intacto — apenas pula a integração inicial.
**Trade-off:** Operação aberta vai ter aba/seção "Credenciais" vazia ou hidden até v2. Quando voltar: avaliar Bitwarden Free pessoal (só solo), Vaultwarden self-host (precisa VPS), ou Bitwarden Teams (pagar).
**Impact:** Cronograma sem 1 reduzido a `week-01-setup` ✅ + `auth`. ROADMAP atualizado movendo `bitwarden-integration` pra Future Considerations. CLAUDE.md mantém o princípio mas linha "Cofre senhas | Bitwarden Teams" do stack table fica como aspiração não-imediata.

### AD-008: Vercel deploy live em delivery-os-phi.vercel.app (2026-05-15)

**Decision:** Deploy de produção via integração GitHub→Vercel; trigger automático em push pra `main`. Projeto Vercel `delivery-os` em `rafaelemeths-projects` (team Pro), Node 24.x. Alias produção: `delivery-os-phi.vercel.app`.
**Reason:** Cumpre item de validação do PR #2 (run em URL pública); habilita demo + smoke test E2E daqui em diante.
**Trade-off:** **Gotcha encontrada e corrigida**: quando o projeto foi importado no dashboard, `main` ainda só tinha docs (sem `package.json`). Vercel salvou `framework: null` no projeto. Mesmo após o merge do PR #2 com o app Next.js completo, o framework continuou `null` → todos os paths retornavam 404 (até `/favicon.ico`), mesmo com build verde. Fix: dashboard → Project Settings → Framework Preset → **Next.js** → Save → Redeploy. **Lição**: importar projeto Vercel ANTES do `main` ter código quebra detecção.
**Impact:** Build atual 6s (Turbopack), TTFB 65ms (CDN edge gru1), HTML 8077b. Pending: `NEXT_PUBLIC_APP_URL` nas envs da Vercel ainda em branco — preencher com `https://delivery-os-phi.vercel.app` na próxima sessão antes de habilitar link público.

### AD-007: Pivot pra Supabase remoto (projeto `Delivery OS` `tmsaucxoeqpfluzwrwkc`) (2026-05-15)

**Decision:** Usar projeto remoto `Delivery OS` (criado pelo usuário no dashboard, org Altis Lisboa, região `us-east-2`, Postgres 17.6.1.121) em vez de local Docker (B-002). Migration aplicada via MCP. Types regenerados via MCP. `gen:types` script atualizado pra `--project-id tmsaucxoeqpfluzwrwkc`.
**Reason:** Docker Desktop quebrou (`unable to start`, I/O error ao baixar image). Pivot pro remoto desbloqueou imediatamente; e remoto vai precisar existir mesmo pra deploy futuro.
**Trade-off:** Schema testes (T9b) rodam contra DB de produção (sem branch/clone). Pra dev mais agressivo (refactor de schema), considerar Supabase branches (`create_branch` MCP) na sem 2+. Região `us-east-2` (não `sa-east-1` como a `Radar Altis`) — latência levemente maior pro BR, aceito.
**Impact:** `.env.local.example` aponta pro URL real (`tmsaucxoeqpfluzwrwkc.supabase.co`). Cliente Supabase (`src/lib/db/client.ts`) lê de env vars. Migration `20260515000001_initial_schema.sql` aplicada com `success: true`. Bateria de invariantes 5/5 OK_rejected. Types gerados em `src/lib/db/types.ts`.

### AD-006: Manter `AGENTS.md` gerado pelo create-next-app (2026-05-15)

**Decision:** Manter o `AGENTS.md` gerado pelo bootstrap (1 bloco curto avisando "This is NOT the Next.js you know — read node_modules/next/dist/docs/"). Sobrescrever apenas o `CLAUDE.md` mínimo gerado pelo `@AGENTS.md`; o nosso (404 linhas) prevalece.
**Reason:** Aviso do framework é válido — Next 16 tem breaking changes. Vou consultar `node_modules/next/dist/docs/` antes de escrever código Next sensível a versão (routing, fetching, caching).
**Trade-off:** Mais 1 arquivo na raiz pra checar; trivial.
**Impact:** Antes de tarefas com APIs Next sensíveis, ler `node_modules/next/dist/docs/`. CLAUDE.md custom mantido.

### AD-005: Aceitar Next.js 16 + Tailwind 4 (em vez de 15 + 3) (2026-05-15)

**Decision:** Bootstrap com versões current (Next 16.2.6, Tailwind 4) em vez de pinar 15 + 3. Skill `dryos-design-system` adaptada: tokens viram bloco `@theme inline { ... }` em `globals.css` em vez de `tailwind.config.ts`.
**Reason:** create-next-app@latest entrega 16 + 4. Pinar versões antigas só pra casar com snippet desatualizado de skill é dívida invertida. Tailwind 4 CSS-first é mais limpo. Risco de breaking change em Next 16 é mitigado por consultar `node_modules/next/dist/docs/`.
**Trade-off:** Skill `dryos-design-system` precisou ser revisada (seção "Tailwind config" → "@theme block"). Task T5 do week-01-setup foi merged com T4 (um arquivo: `globals.css` com vars + `@theme`).
**Impact:** Sem `tailwind.config.ts` na raiz. Adicionar token novo = adicionar linha em `:root` + linha em `@theme inline`. Documentação atualizada no mesmo commit (regra "documentação como contrato").

### AD-004: Supabase local via Docker pro desenvolvimento da semana 1 (2026-05-15)

**Decision:** `supabase init && supabase start` no worktree. Migration aplicada localmente via `supabase db reset` ou `supabase migration up`. Types gerados via CLI local. Decisão de projeto remoto adiada.
**Reason:** Autônomo, não bloqueia. Mais rápido pra iterar. Sem custo de criar projeto Supabase ainda na fase de bootstrap.
**Trade-off:** Antes de fazer deploy, vai precisar de projeto remoto (criar via MCP ou usar existente).
**Impact:** T9/T10 da week-01-setup rodam local; instalação do Supabase CLI vira pré-req (Bash detecta e instala se necessário). Adiciona Docker como dependência implícita do ambiente dev.

### AD-003: Schema dedicado vs `public` no Supabase — usar `public` (2026-05-15)

**Decision:** DRYOS usa `public`. Projeto Supabase é dedicado, não compartilhado com outros apps.
**Reason:** Sem necessidade de isolamento de schema (não há outros apps no mesmo projeto). Casa Financeira usa `casa_financeira` porque divide projeto com Radar Altis — não é o caso aqui.
**Trade-off:** Se um dia precisar dividir o projeto Supabase com outro app, teremos que migrar tudo pra um schema dedicado. Risco baixo.
**Impact:** Migrations qualificam tabelas como `public.<nome>` (default). Sem helper `cf(supabase)`.

---

## Active Blockers

_None._

## Resolved Blockers

### B-002: Docker Desktop unable to start ✅ RESOLVED 2026-05-15

**Discovered:** 2026-05-15 durante T9 (apply local migration).
**Impact:** `supabase start` falhou ao baixar image do Postgres (I/O error + Docker Desktop unable to start). Bloqueou T9/T10/T11.
**Resolution:** Pivot pra Supabase remoto (AD-007). Migration aplicada via MCP `apply_migration` no projeto `Delivery OS` (`tmsaucxoeqpfluzwrwkc`). Types gerados via MCP `generate_typescript_types`. Docker não é mais dependência do fluxo de dev/setup (pode virar relevante de novo em sem 2 se a gente quiser branch isolada local).

### B-001: Supabase MCP — projeto-alvo não definido ✅ RESOLVED 2026-05-15

**Discovered:** 2026-05-15
**Resolution:** Optou-se por **Supabase local via Docker** (`supabase init && supabase start`). Decisão de projeto remoto (deploy) fica pra mais tarde. T9/T10 da week-01-setup usam o local stack.

---

## Lessons Learned

### L-003: `useTransition` deixa `isPending` preso após `router.push` em forms (2026-05-16)

**Context:** OperationForm e ClientForm usavam `useTransition` pra rastrear estado de submit. Padrão era: `startTransition(async () => { const result = await action(...); if (result.ok) router.push(...) })`.
**Problem:** Quando o action retornava OK e a gente chamava `router.push + router.refresh`, `isPending` permanecia `true` indefinidamente — botão ficava "Salvando..." mesmo depois do save ter funcionado e os dados terem sido persistidos. Comportamento inconsistente do `useTransition` no Next 16 + App Router quando o callback da transição dispara navegação.
**Solution:** Trocar `useTransition` pelo `formState.isSubmitting` do react-hook-form. Esse flag é `true` durante o handler async e volta a `false` quando o handler retorna — independente do que o router faça depois. Pro botão Arquivar (não-RHF), state local `isArchiving`. Variável `busy = isSubmitting || isArchiving` cobre os disabled dos inputs. Bug fix em PR #16.
**Prevents:** Forms novos devem seguir o pattern em `.claude/skills/dryos-conventions/SKILL.md` seção "Forms". Não usar `useTransition` pra wrapping de submit que vai navegar depois.

### L-002: Importar projeto Vercel antes do `main` ter código quebra detecção de framework (2026-05-15)

**Context:** Setup do Vercel feito pelo dashboard ANTES do PR #2 ser merged. Naquele momento `main` só tinha docs (CLAUDE.md, PRD, mockup, README), sem `package.json`.
**Problem:** Vercel detectou framework como `null` e salvou no projeto. Mesmo após o merge incluir `package.json` + `src/app/`, framework continuou null → 404 em todos os paths, mesmo com build verde.
**Solution:** Dashboard → Project Settings → Framework Preset → **Next.js** → Save → Redeploy. Aí TTFB caiu pra 65ms e `/` virou 200.
**Prevents:** Em deploys futuros: garantir que `main` já tem o framework no momento do import OU, no dashboard, escolher manualmente o Framework Preset durante o import (não confiar 100% em autodetect).

### L-001: Worktree de Claude Code parte do commit inicial (2026-05-15)

**Context:** Worktree foi criada antes do commit "Setup" entrar em main; arquivos canônicos (CLAUDE.md, SETUP.md, PRD, mockup) ficaram fora do estado inicial.
**Problem:** Primeira investigação reportou repo vazio, gastando turn de descoberta.
**Solution:** Olhar parent repo + `git log --all` revelou commits em main não trazidos pra branch da worktree. `git merge main --no-edit` resolve fast-forward.
**Prevents:** Em próxima worktree, checar `git log --all --oneline` ANTES de assumir que o repo está vazio.

---

## Preferences

**Model Guidance Shown:** never
