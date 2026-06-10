# Areas as Access Groups Specification

## Problem Statement

Hoje "área" é um enum fixo (`cs`/`financeiro`/`juridico`) com escopo **global**: quem é de uma área vê as tarefas daquela área em toda a carteira, e nada mais (read-only do contexto mínimo). O usuário precisa de duas coisas que o modelo atual não dá: **criar áreas novas pela UI** (não só as 3 fixas) e **dizer o que cada área pode ver de cada cliente/projeto** — em vez de "tudo da carteira". Isso transforma "área" de um rótulo de tarefa num **grupo de acesso escopado** (equipe/departamento), reaproveitando o que já existe de `operation_members` mas em nível de grupo, não pessoa-a-pessoa.

## Goals

- [ ] Admin cria/edita/arquiva áreas pela UI (catálogo dinâmico, não enum).
- [ ] Admin concede a uma área acesso de leitura a **clientes inteiros** e/ou **operações específicas**.
- [ ] Quem é de uma área enxerga o **painel completo** (read-only) dos clientes/operações concedidos: operação, frentes, decisões, tarefas, reuniões, anexos, pessoas.
- [ ] Tarefas de **entrega** permanecem 100% idênticas (zero regressão).
- [ ] Conceito de **tarefa de área** preservado, agora referenciando `areas.id` (FK) em vez do enum.
- [ ] Área **nunca** escreve (cria/edita/apaga) em operação que não seja sua via `operation_members`.
- [ ] `/public` nunca vaza tarefa de área nem qualquer dado escopado por área.

## Out of Scope

- **Escrita por área no painel da operação.** Acesso de área ao painel (entrega, frentes, decisões, reuniões, etc.) é estritamente read-only. Quem edita isso continua admin ou membro real (`operation_members`). **Exceção (decisão M2):** a área pode criar/editar/apagar as **próprias tarefas de área** (`area_id` da sua área) nas operações concedidas — é o back-office do departamento, não dado de entrega.
- **Escopo global de tarefa de área (revertido).** O comportamento do AD-013 — "CS vê tarefa CS de toda a carteira" — é **removido**. Tarefa de área passa a ser visível só onde a área tem concessão (ver Resolução RT-B2). É a reversão pedida pelo usuário.
- **Download de anexos por área (Storage).** No MVP a área **não** acessa o objeto físico no Supabase Storage (RLS de Storage é separada, depende de `storage_path = <operation_id>/`). A área pode até ver metadados de anexo se a tabela `attachments` entrar no painel, mas o **download fica fora** — decidir no design se mostra metadado ou esconde a seção (recomendado: esconder anexos do painel de área no MVP). Ver RT-M2.
- **Áreas custom por cliente** (áreas seguem sendo internas DRYOS — não há área "do cliente").
- **Auto-atribuição.** Usuário não se coloca numa área; só admin gerencia `profile_areas`.
- **Notificações/Discord** de eventos de área.
- **Migração de dados reais** além do enum→tabela: hoje `profile_areas` e `tasks.area` têm 0 rows de área no banco vivo (confirmado por query), então não há backfill de conteúdo — só a conversão estrutural do enum.
- **Granularidade abaixo de operação** (ex: área vê só uma Frente). Concessão mínima é a operação inteira.

---

## User Stories

### P1: Catálogo dinâmico de áreas ⭐ MVP

**User Story**: Como admin, quero criar/editar/arquivar áreas pela UI para modelar os departamentos reais da DRYOS sem depender de migration.

**Why P1**: É a base — sem tabela `areas`, nada do resto (concessão, FK em tasks) existe. O enum precisa virar tabela antes de qualquer concessão.

**Acceptance Criteria**:

1. WHEN admin abre `/admin/areas` THEN o sistema SHALL listar todas as áreas não-arquivadas com nome e contagem de membros.
2. WHEN admin cria uma área com nome único THEN o sistema SHALL inserir um row em `areas` com `slug` derivado e retornar `ActionResult` ok.
3. WHEN admin tenta criar área com nome/slug duplicado THEN o sistema SHALL retornar `err` tipado (`code: 'validation_failed'` ou `23505`) sem 500.
4. WHEN admin arquiva uma área THEN o sistema SHALL setar `archived_at` (soft-delete, nunca DELETE físico) e a área some das listas ativas mas concessões/vínculos históricos permanecem.
5. WHEN as 3 áreas seed (cs/financeiro/juridico) existem THEN o sistema SHALL preservá-las como rows com slug estável (não podem ser deletadas; podem ser arquivadas).
6. WHEN um non-admin chama qualquer action de CRUD de área THEN o sistema SHALL retornar `err('forbidden')` (guard `requireAdminAction`).

**Independent Test**: Logar como admin, criar área "Tráfego", ver na lista; arquivar, sumir da lista ativa; tentar criar "Tráfego" de novo → erro tratado. Verificar via SQL que `tasks.area` (renomeada/migrada) aponta pra FK válida.

---

### P2: Concessão de acesso por cliente e por operação ⭐ MVP

**User Story**: Como admin, quero conceder a uma área acesso de leitura a clientes inteiros e/ou operações específicas para que a equipe veja só o que lhe diz respeito.

**Why P2 (na prática P1-crítico, mas depende de P1)**: É o coração da feature. Sem isso, áreas voltam a ser só rótulo.

**Acceptance Criteria**:

1. WHEN admin concede um cliente a uma área THEN o sistema SHALL inserir em `area_clients(area_id, client_id)` e a área passa a ler **todas** as operações daquele cliente.
2. WHEN admin concede uma operação a uma área THEN o sistema SHALL inserir em `area_operations(area_id, operation_id)` e a área passa a ler aquela operação específica.
3. WHEN um cliente é concedido E uma operação dele também é concedida explicitamente THEN o sistema SHALL tratar como idempotente (acesso à operação não duplica nem conflita; cliente já cobre).
4. WHEN admin revoga uma concessão THEN o sistema SHALL deletar o row de junção e o acesso da área àquele cliente/operação cessa imediatamente (próximo request já não vê).
5. WHEN concessão é criada/revogada THEN o sistema SHALL `revalidatePath` das rotas afetadas.
6. WHEN non-admin tenta conceder/revogar THEN o sistema SHALL retornar `err('forbidden')`.

**Independent Test**: Conceder cliente A à área "CS"; logar como membro da área CS (sem ser `operation_member`) e ver as operações de A em `/operations`. Revogar; confirmar que somem.

---

### P3: Visibilidade read-only do painel completo ⭐ MVP

**User Story**: Como membro de uma área com acesso concedido, quero ver o painel completo (read-only) dos clientes/operações da minha área para acompanhar sem poder alterar.

**Why P3 (vertical slice de leitura)**: É o que o usuário final da área experimenta. Depende de P1+P2.

**Acceptance Criteria**:

1. WHEN membro de área abre uma operação concedida THEN o sistema SHALL exibir operação, frentes, tarefas de entrega, e pessoas internas da operação — tudo somente leitura. (Anexos: ver RT-M2 / Out of Scope.)
2. WHEN membro de área tenta qualquer mutação (criar/editar/apagar) numa operação só-concedida THEN o sistema SHALL bloquear via RLS (WITH CHECK continua `can_see_operation`, não `can_read_operation`).
3. WHEN membro de área abre o painel só-concedido THEN a UI SHALL esconder/disabled os controles de escrita (botões "Nova frente", "Editar", etc.).
4. WHEN membro de área **também** é `operation_member` da mesma operação THEN o sistema SHALL preservar os poderes de escrita de membro (a concessão de área só **adiciona** leitura, nunca remove escrita).
5. WHEN membro perde o vínculo de área (`profile_areas` removido) OU a concessão é revogada OU a área é arquivada THEN o sistema SHALL cessar a visibilidade no próximo request.
6. WHEN a operação concedida está arquivada THEN o sistema SHALL respeitar o mesmo tratamento de arquivamento que membros têm hoje (sem regressão).
7. WHEN membro de área (não-membro real) lê decisões/reuniões da operação THEN o sistema SHALL expor **apenas** `visibility = 'cliente'`; itens `visibility = 'interno'` SHALL ficar invisíveis. Filtrar sempre pela **inclusão** (`= 'cliente'`), nunca pela exclusão de um literal. Membro real (`operation_member`) continua vendo tudo. (Resolução RT-B1.)

**Independent Test**: Membro da área CS, com cliente A concedido, abre operação de A → vê frentes/tarefas; vê decisão `cliente` mas NÃO a `interno`; botões "Nova frente"/"Editar" ausentes; tentativa de mutação via action retorna erro de RLS/guard.

---

### P4: Tarefa de área referenciando `areas.id`

**User Story**: Como admin/membro de área, quero que a tarefa de área continue funcionando, agora atrelada a uma área do catálogo dinâmico.

**Why P4**: Preserva a feature recém-entregue (AD-013) sob o novo modelo. Não é a parte nova, mas não pode quebrar.

**Acceptance Criteria**:

1. WHEN o enum `task_area` migra THEN `tasks.area` (enum) SHALL virar `tasks.area_id uuid NULL` FK → `areas.id`, mantendo o XOR (entrega: `area_id NULL` + frente; área: `area_id` setado + frente NULL).
2. WHEN `profile_areas.area` (enum) migra THEN SHALL virar `profile_areas.area_id uuid` FK → `areas.id` (PK `(profile_id, area_id)`).
3. WHEN um usuário lê uma tarefa de área THEN o sistema SHALL exigir **área correta E concessão da operação** — gating = `is_admin() OR (é da área `area_id` AND a operação está concedida a essa área)`. NÃO basta `can_see_area` global (Resolução RT-B2). Tarefa de área de operação não-concedida fica invisível mesmo pra quem é da área.
4. WHEN a tarefa de área é criada THEN `area_id` SHALL ser write-once (trigger `enforce_task_area_immutable` adaptado pra `area_id`).
5. WHEN qualquer query `/public` roda THEN SHALL filtrar `area_id IS NULL` (invariante 15 preservada, agora sobre a coluna nova).

**Independent Test**: Criar tarefa de área "CS" numa operação concedida à CS → membro CS vê. Mesma tarefa numa operação NÃO concedida → membro CS não vê. `/public` nunca mostra. Trocar `area_id` em update → bloqueado.

---

## Edge Cases

- WHEN área é arquivada mas tem concessões ativas THEN o sistema SHALL parar de conceder acesso (área arquivada não concede) mas preservar os rows de junção (histórico/reativação).
- WHEN um cliente concedido é arquivado/deletado THEN o acesso da área àquela cadeia SHALL cessar (FK CASCADE em `area_clients`).
- WHEN uma operação concedida é deletada THEN `area_operations` SHALL CASCADE.
- WHEN profile é deletado THEN `profile_areas` SHALL CASCADE (já é o caso).
- WHEN a mesma operação é alcançável por dois caminhos (cliente concedido + operação concedida) THEN `can_read_operation` SHALL retornar true sem duplicar custo lógico (OR curto-circuita).
- WHEN `can_read_operation` é avaliado THEN NÃO SHALL referenciar `tasks` de forma que cause recursão de RLS (a versão atual referencia `tasks` pra cobrir tarefa de área — precisa virar SECURITY DEFINER e não disparar policy de tasks recursivamente).
- WHEN ex-membro de área mantém row em `profile_areas` THEN admin SHALL ter UI pra remover o vínculo (furo #4 do the-fool anterior — fechar com a tela de gestão).
- WHEN RLS avalia leitura de operation-scoped table com OR de duas junções por linha THEN o sistema SHALL ter índices que sustentem (`area_clients(client_id)`, `area_operations(operation_id)`, `profile_areas(profile_id)`).
- WHEN nome de área tem maiúsculas/acentos THEN o `slug` SHALL ser normalizado (lowercase, sem acento, kebab) e único.

---

## Success Criteria

- [ ] Admin cria área nova e ela aparece pra atribuição/concessão sem migration.
- [ ] Membro de área (não `operation_member`) vê o painel completo de um cliente concedido e **nada** fora das concessões.
- [ ] Nenhuma mutação possível por acesso só-de-área (RLS bloqueia + UI esconde).
- [ ] Tarefas de entrega: comportamento idêntico; filtros migram de `area` → `area_id` em todos os call-sites (incl. **todas** as queries `/public`, conferido por grep — invariante 15).
- [ ] Membro de área (não-membro real) NÃO vê decisão/reunião `visibility='interno'` da operação concedida (RT-B1).
- [ ] Tarefa de área de operação NÃO concedida fica invisível mesmo pra quem é da área (RT-B2).
- [ ] `npm run build` (Turbopack) passa; `get_advisors` sem novos warnings de segurança; sem recursão de RLS em `tasks`.
- [ ] Revogar concessão, remover vínculo ou arquivar área corta o acesso no próximo request (sem cache stale).
- [ ] Migração enum→FK aplicada sem perda (validada por asserções em `DO` block + rollback).
- [ ] Docs atualizados: invariante 15 (`area`→`area_id`), `docs/DATABASE_SCHEMA.md`, AD-014 sucedendo AD-013.
