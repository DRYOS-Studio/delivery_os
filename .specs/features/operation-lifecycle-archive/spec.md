# operation-lifecycle-archive Specification

## Problem Statement

Não existe caminho na UI para encerrar um projeto nem para arquivar um Cliente. Verificado no
código e no banco de produção (2026-08-29).

**1. Não existe status terminal.** `operation_status` = `em_construcao | em_operacao |
janela_critica | arquivada` (`20260515000001_initial_schema.sql:26`). O form só oferece os três
primeiros (`OperationForm.tsx:204-209`). Projeto concluído e projeto cancelado não têm como serem
registrados. **Prod: 6/6 operações estão `em_operacao`; 0 linhas em `arquivada`.**

**2. A cadeia de arquivamento tem um beco sem saída.**

| passo | guarda | arquivo |
|---|---|---|
| Cliente | `canArchive={!hasOps}`; conta ops com `archived_at IS NULL AND status <> 'arquivada'` | `clients/[id]/edit/page.tsx:35`, `queries/clients.ts:139-151` |
| Operação | `canArchive={!hasFrentes}`; conta **toda** Frente com `archived_at IS NULL` — ignora `phase` | `operations/[id]/edit/page.tsx:42`, `queries/operations.ts:417-429` |
| Frente | `canArchive={!hasAllocs}`; conta **qualquer alocação que já existiu** — sem filtro de `end_date` | `frentes/[fid]/edit/page.tsx:53`, `queries/frentes.ts:18-28` |

**Prod: 13 alocações, 0 com `end_date`.** Toda Frente que já teve gente alocada é inarquivável ⇒
Operação inarquivável ⇒ Cliente inarquivável. A Frente `encerrada` que existe hoje tem 3 alocações
e está travada exatamente assim.

**3. Quando bloqueia, o botão some.** `ClientForm.tsx:500` e `OperationForm.tsx:525` renderizam
"Arquivar" só quando liberado. Bloqueado = ausente do DOM, sem motivo.

**4. Arquivar é irreversível pela UI.** `restore*Action` só existe para catálogo; `getClient`
filtra `archived_at IS NULL` (`queries/clients.ts:66-76`).

**5. "Ativo" hoje é decidido por dois predicados incompatíveis, e um deles cobra dinheiro.**
`listOperations` (`queries/operations.ts:132,152,165` — três ramos de query) filtra só
`operations.archived_at`; nunca `clients.archived_at` ⇒ Cliente arquivado deixa Operações órfãs
listadas. Pior: `getDashboardSummary` (`queries/dashboard.ts:113-119`) e `getClientSummary`
(`queries/clients.ts:108-113`) calculam `activeOperations` **e `mrrTotal`** por `!archived_at` —
uma Operação cancelada continuaria somando MRR no painel admin.

## Decisões fechadas (com o usuário, 2026-08-29)

Status terminal + arquivamento em cascata (não o fluxo manual bottom-up); botão sempre visível,
`disabled` com motivo; restore incluído para Cliente / Operação / Frente.

## Modelo — dois eixos, e a definição única de "ativa"

- **`status` = ciclo de vida do negócio.** `em_construcao → em_operacao → (janela_critica) →
  concluida | cancelada`. *Encerrar* é ato de negócio, sempre disponível em edição.
- **`archived_at` = visibilidade.**
- **Dois predicados nomeados — e é deliberado que sejam dois.** A R2 do gate mostrou que um
  predicado só se contradiz: se a lista principal usasse a definição estrita, encerrar faria a
  Operação **sumir de `/operations` antes de poder ser arquivada** — o mesmo beco sem saída que
  esta feature existe para matar.

  > **`OPERACAO_ATIVA`** ⇔ `archived_at IS NULL` **E** `status ∈ ACTIVE_STATUSES` **E** Cliente dono
  > não arquivado. → agregados, contagens, pickers, guards de criação. É o que "para de somar MRR".
  >
  > **`OPERACAO_VISIVEL`** ⇔ `archived_at IS NULL` **E** Cliente dono não arquivado. → listas e
  > página de detalhe. Operação terminal continua listada, com a pill do status, e continua
  > alcançável para ser arquivada.
  >
  > `ACTIVE_STATUSES` = `{em_construcao, em_operacao, janela_critica}`;
  > **terminal** = `{concluida, cancelada, arquivada}` = complemento, derivado do mesmo mapa.

  `arquivada` é legado (0 linhas em prod), classificado terminal, nunca alvo de escrita nova.
- **Arquivar exige status terminal.** É a única precondição que sobra; nenhuma guarda mecânica
  (alocação órfã, Frente não-arquivada) bloqueia — a cascata resolve.

## Goals

### A — Status terminal e fonte única
- [ ] **A1** Migration 1: `ALTER TYPE public.operation_status ADD VALUE IF NOT EXISTS 'concluida'`
      e `'cancelada'`. **Migration separada** das funções: em PG 17.6 (versão conferida em prod) o
      valor novo não pode ser *usado* na mesma transação que o adiciona.
- [ ] **A2** `OPERATION_STATUS: Record<OperationStatus, {label, active, selectableOn}>` em
      `src/lib/utils/operation-status.ts`, com
      **`type OperationStatus = Database["public"]["Enums"]["operation_status"]`** — ancorado no
      enum gerado, nunca em união escrita à mão. `ACTIVE_STATUSES`, `TERMINAL_STATUSES`,
      `isActiveStatus` e as opções do form derivam **desse** mapa.
- [ ] **A3** Cada ponto abaixo passa a usar o predicado nomeado que lhe cabe. A contagem é
      derivada desta tabela, não de memória (conferida 2026-08-29):

      | # | ponto | hoje decide por | passa a usar |
      |---|---|---|---|
      | 1 | `queries/operations.ts:54` `getActiveOperations` | `.neq('arquivada')` | ATIVA |
      | 2 | `queries/operations.ts:355` `countActiveOperations` | `.neq('arquivada')` | ATIVA |
      | 3 | `queries/operations.ts:386` `listOperationsWithFrentes` | `.neq('arquivada')` | ATIVA |
      | 4 | `queries/clients.ts:148` `clientHasActiveOperations` | `.neq('arquivada')` | ATIVA |
      | 5 | `queries/clients.ts:49` `listClients` → `operationsActive` | filtro JS | ATIVA |
      | 6 | `queries/clients.ts:108-113` `getClientSummary` → `activeOperations` **+ `mrrTotal`** | só `archived_at` | ATIVA |
      | 7 | `queries/dashboard.ts:113-119` `getDashboardSummary` → `activeOperations` **+ `mrrTotal`** | só `archived_at` | ATIVA |
      | 8 | `queries/dashboard.ts:164-171` `getTopClientsByMRR` | só `archived_at` | ATIVA |
      | 9 | `queries/operation-costs.ts:299-325` `getActiveOperationsMonthlyCostsTotal` (**3 filtros**) | só `archived_at` | ATIVA |
      | 10 | `queries/operations.ts:132,152,165` `listOperations` (**3 ramos**) | só `archived_at` | VISÍVEL |
      | 11 | `queries/operations.ts:265` `getOperation` | só `archived_at` | VISÍVEL |
      | 12-14 | `decisions/new:22`, `briefing/edit:22`, `meetings/new:19` | `=== 'arquivada'` | barra qualquer terminal |
      | 15 | `OperationForm.tsx:78` fallback de status | `=== 'arquivada'` | só status não-selecionável (ver A4) |
      | 16 | `queries/dashboard.ts:120` e `queries/clients.ts:109` `archivedOperations` | **complemento** (`ops.length - active`) | contado direto por `archived_at IS NOT NULL` |
      | 17 | `queries/area-grants.ts:44-52` `listGrantableClients` | **nada** | exclui Cliente arquivado |
      | 18 | `queries/area-grants.ts:55-67` `listGrantableOperations` | **nada** | VISÍVEL |
      | 19 | `queries/operations.ts:28` `getActiveOperations` nos 2 call-sites de detalhe (`clients/[id]/page.tsx:33`, `persons/[id]/page.tsx:100`) | `.neq('arquivada')` | VISÍVEL (ver nota) |

      **Ponto 16 é armadilha de complemento.** `archivedOperations` não é lido do banco: é
      `ops.length - activeOperations`. Apertar `activeOperations` sem tocar nele faz o card
      "Operações arquivadas" (`DashboardCountsGrid.tsx:33-34`, `ClientSummarySection.tsx:23-24`)
      **contar Operação concluída como arquivada** — contradiz o próprio modelo (terminal ≠
      arquivada). É a classe do MRR invertida.

      **Ponto 19: `getActiveOperations` tem dois papéis.** Serve o grid do dashboard (agregado →
      ATIVA) e as listas de Operação nas páginas de Cliente e de Pessoa (detalhe → VISÍVEL). Com um
      predicado só, a Operação concluída sumiria da página do Cliente enquanto o diálogo de impacto
      anuncia que ela será arquivada junto. Precisa de parâmetro ou de duas funções.

      **Pontos 17/18 desmentem "dois predicados incompatíveis" do Problem Statement:** há um
      terceiro caso, o de predicado nenhum — depois de `archive_client_cascade(A)`, A1/A2
      continuariam oferecidas para conceder acesso de área. Escolhi VISÍVEL para 18 (área como
      Financeiro ainda precisa alcançar back-office de contrato concluído; arquivado, não).

      **9 e 6/7 andam juntos ou a margem quebra.** `monthlyMarginTotal = mrrTotal -
      monthlyCostsTotal` (`dashboard.ts:131`): corrigir a receita sem corrigir o custo produz
      margem com receita nova e custo velho — incoerente por construção. Hoje os dois estão
      errados juntos; esta feature os desalinharia se parasse no MRR.

- [ ] **A4** `selectableOn: ReadonlyArray<'create' | 'edit'>`, **não booleano e não string única**:
      `em_construcao` e `em_operacao` = `['create','edit']` (é o que `OperationForm.tsx:204-209`
      faz hoje), `janela_critica`/`concluida`/`cancelada` = `['edit']`, `arquivada` = `[]`.
      Uma string única não tem valor para "vale nos dois" e a leitura simétrica
      (`filter(s => s.selectableOn === (isEdit ? 'edit' : 'create'))`) **removeria "Em construção" e
      "Em operação" do select de edição** — regressão que passaria em 17 dos 20 ACs. O fallback de
      `OperationForm.tsx:77-80` só reescreve status `'never'`; status terminal selecionável é
      preservado ao salvar. A união hardcoded em `actions/operations.ts:18` e o Zod validator
      derivam do mapa.
- [ ] **A5 (deduplicação, não guarda nova).** Os 4 mapas de label/variante
      (`OperationCard.tsx:14-26`, `OperationsTable.tsx:14-25`, `OperationHero.tsx:18-31`,
      `PublicHero.tsx:11-23`) passam a consumir o `label` de A2. Bateria: os 4 **já quebram o build**
      com valor novo no enum — os 3 primeiros por serem `Record<…>` anotados, `PublicHero` por
      index-access sobre `as const` (`:42-43`). Ou seja, a proteção já
      existe e está correta; o ganho é uma classificação de **label** em vez de quatro. As variantes de pill seguem por tela
      (e `OperationHero` tem dois mapas, `:18-23` e `:26-31`) — dedup parcial, deliberada.

### B — Destravar
- [ ] **B1** `frenteHasActiveAllocations` deixa de ser guarda de arquivamento. Arquivar Frente
      passa a fechar as alocações abertas dela — **e por isso vira função SQL também**:
      `archive_frente_cascade(p_frente_id uuid)`. `archiveFrenteAction`
      (`actions/frentes.ts:168-171`) hoje faz 1 `update`; virariam 2 escritas soltas pelo cliente
      JS, e o argumento de atomicidade que justifica C1/C2 vale igual aqui. `archive_operation_cascade`
      usa a mesma função por Frente. Precondição: nenhuma (arquivar Frente é ato local do admin);
      a única guarda de negócio é a de Operação.
- [ ] **B2** `operationHasActiveFrentes` deixa de bloquear; arquivar Operação cascateia.
- [ ] **B3** `clientHasActiveOperations` passa a contar só Operações **ativas** pela definição
      única. É a única guarda que sobra, e é semântica ("encerre antes").

### C — Cascata atômica, escopada e admin-only
- [ ] **C1** Migration 2: `archive_operation_cascade(p_operation_id uuid)` — `SECURITY INVOKER`.
      Arquiva a Operação, arquiva as Frentes **daquela** Operação, fecha **toda** alocação aberta
      cuja Frente pertença a `p_operation_id` — inclusive as penduradas em Frente que já estava
      arquivada, senão sobra alocação aberta sob Operação arquivada. Toda cláusula `WHERE` amarrada
      a `p_operation_id`.
- [ ] **C2** `archive_client_cascade(p_client_id uuid)` — arquiva o Cliente e cascateia em cada
      Operação **daquele** Cliente. Qualquer Operação do Cliente em status **não-terminal** ⇒
      `23514` e a transação inteira aborta; nunca "pula" a não-terminal, que produziria Cliente
      arquivado com Operação ativa — invisível em `/operations` por C6 e ainda não arquivada.
- [ ] **C3 (segurança).** A RLS **não** entrega admin-only: `operations_scoped_update` e
      `frentes_scoped_update` usam `can_see_operation(...)`
      (`20260526190001_operation_members_scope.sql:98-100,110-112`) — qualquer membro com linha em
      `operation_members` faz UPDATE. Portanto cada função: (a) abre com
      `IF NOT public.is_admin() THEN RAISE EXCEPTION USING ERRCODE='42501'`; (b) recebe
      `REVOKE EXECUTE … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated`, padrão já usado 7×
      no repo (ex. `…members_scope.sql:51-52`). Sem isso a função fica exposta em
      `/rest/v1/rpc/…` e o `requireAdminAction` da Server Action é contornável.
- [ ] **C0 (convenção).** As **8 funções + 1 trigger** (contagem no design, inclui a função do trigger) levam `CREATE OR REPLACE` (idempotência), `COMMENT ON
      FUNCTION` no formato do repo (`…members_scope.sql:70-73`) e entram em
      `docs/DATABASE_SCHEMA.md`. Doc-sync completo, senão o gate de conformance reprova depois:
      `DATABASE_SCHEMA.md:98` e `:677` (valores de `operation_status`), `:390` (regra do resolver de
      link público, que E3 altera) e `docs/prd.md` (ciclo de vida da Operação — o `CLAUDE.md` mapeia
      "mudança de escopo/princípio" → `prd.md`).
- [ ] **C4** Status não-terminal ⇒ `RAISE EXCEPTION` com `ERRCODE='23514'`, mapeado pela action
      para `err(..., 'state_conflict')` — nunca mensagem crua do Postgres no toast.
- [ ] **C5** `getArchiveImpact(kind: 'operation' | 'client', id)` devolve as contagens que a
      confirmação exibe, contando **só** o que será de fato alterado (Frentes `archived_at IS NULL`,
      alocações com `end_date IS NULL` **e** `frente.operation_id = p_operation_id`,
      independente de `frentes.archived_at`; para Cliente, também as Operações `archived_at IS
      NULL`). O conjunto de alocações do impacto é **o mesmo** que a cascata fecha em C1 — se
      divergirem, o diálogo mente.
- [ ] **C6** A cláusula "Cliente dono não arquivado" entra nos dois predicados, portanto nas 11
      leituras 1-11 de A3 — incluindo os **3 ramos** de `listOperations` (`:132,152,165`), não só o
      primeiro. Fecha o órfão do item 5 do Problem Statement.

### D — UX de bloqueio
- [ ] **D1** Botão "Arquivar" sempre renderizado em modo edição para admin; bloqueado ⇒ `disabled`
      + motivo com contagem ("2 Operações ainda ativas — encerre-as antes").
- [ ] **D2** Confirmação lista o impacto vindo de C5.

### E — Restore
- [ ] **E1** `restoreClientAction`, `restoreOperationAction`, `restoreFrenteAction`, admin-only,
      **sem cascata**. Restaurar filho exige pai não-arquivado, senão `state_conflict`.
- [ ] **E2** Seção "Arquivados" colapsada (padrão `catalog/products/page.tsx:75-99`) em **três**
      lugares — `/clients`, `/operations` e **o detalhe da Operação, para as Frentes**. Sem a
      terceira, `restoreFrenteAction` nasce sem invocador: `getFrente` (`queries/frentes.ts:12`) e o
      embed de `getOperation` (`queries/operations.ts:293`) filtram Frente arquivada, então uma
      Frente arquivada pela cascata seria irrecuperável pelo produto.
      **Só as três telas** recebem os arquivados, via `includeArchived` default `false` (ou função
      separada). `listClients` tem 5 call-sites e **4 são picker de Cliente** —
      `operations/new:11`, `operations/[id]/edit:25`, `persons/new:6`, `persons/[id]/edit:24`.
      Relaxar o `.is("archived_at", null)` (`queries/clients.ts:36`) sem escopo põe **Cliente
      arquivado como opção no select ao criar Operação/Pessoa**, recriando por outra porta o órfão
      Cliente-arquivado × Operação-ativa do item 5.
- [ ] **E3** Restaurar Operação **não** reabre link público: `getPublicLinkByToken`
      (`queries/publicLinks.ts:87`) invalida só por `operations.archived_at`, então o restore
      reativaria em silêncio todo token não-revogado. O restore revoga os links ativos **daquela**
      Operação (`revoked_at = now()`); reabrir é ato deliberado.
      **Decisão registrada (W1 da R2):** *encerrar* (status terminal) **não** fecha o link público —
      contrato concluído ainda quer o relatório na mão do cliente. Só arquivar/revogar fecha.
      `getPublicLinkByToken` (`queries/publicLinks.ts:87`) segue invalidando por `archived_at`.

**Decisão registrada (W6 da R3):** Frente de Operação terminal **continua** aparecendo em
"precisam de atenção" (`listFrentesNeedingAttention`, `queries/frentes.ts:41-60`, e
`frentesHealthy/Stale`, `dashboard.ts:56-58,123-129`, que filtram só `frentes.archived_at`).
Coerente com VISÍVEL: contrato concluído e não arquivado ainda tem trabalho pendente de fechamento.
Some ao arquivar.

## Out of Scope

- **Restore em cascata.** Sem coluna de proveniência não dá para saber quem foi arquivado pela
  cascata; inventá-la é escopo novo. Restore é item a item.
- **Reabrir alocação fechada pela cascata** — fica com o `end_date` de quando foi encerrada.
- **Deletar Cliente/Operação/Frente** — segue inexistente (FK `ON DELETE RESTRICT`).
- **Status terminal em Frente** — `frente_phase` já tem `encerrada`.
- **Encerramento automático** por `end_date` vencido. Nenhum job.
- **Backfill de dado legado** — nada em prod está em estado incoerente hoje (0 arquivados).

## Invariantes tocadas

- **Inv. 12 (RLS):** nenhuma tabela nova. `SECURITY INVOKER` mantém a RLS valendo dentro das
  funções — mas **não** é o que entrega admin-only; isso é C3. `SECURITY DEFINER` está proibido.
- **Inv. 13/14 (ActionResult + guard de auth):** actions novas são admin-only; C4 garante código de
  erro tipado em vez de erro cru.
- **Inv. 3 (Operação C/E sem `end_date`):** inalterado — status terminal não escreve
  `operations.end_date`. O `end_date` de B1 é em `allocations`.

## User Stories

**P1 ⭐** Encerro a Operação como Concluída/Cancelada; ela **sai dos agregados e para de somar
MRR**, e **continua listada** em `/operations` com a pill do status — senão eu não conseguiria
alcançá-la para arquivar, que é o beco sem saída original.
**P2 ⭐** Arquivo a Operação encerrada num passo; Frentes e alocações vão junto e eu vejo antes o
que vai acontecer.
**P3 ⭐** Arquivo o Cliente depois que tudo está encerrado; as Operações vão junto e somem de
`/operations`.
**P4** Quando não posso arquivar, vejo o motivo e a contagem — não um botão ausente.
**P5** Encontro o registro em "Arquivados" e restauro.

## Critérios de aceite — cada um com a mutação que ele mata

Guarda: **SQL** = asserção executada contra o banco (branch Supabase) · **TS** = `npm run
typecheck` · **GREP-AUSÊNCIA** = grep provando que o padrão antigo sumiu (determinístico para
ausência, ao contrário de grep de presença) · **MAN** = app rodando.

**Fixture obrigatório de toda asserção de cascata** — sem ele os ACs 4/6 são cegos ao mutante que
importa: **Cliente A** com Operação A1 (`concluida`; 2 Frentes ativas; 3 alocações abertas; +1 Frente **já
arquivada** que carrega 1 alocação **ainda aberta** e 1 já fechada; +1 `public_link` ativo,
`revoked_at IS NULL`, não expirado; a alocação "já fechada" tem `end_date` **no passado**; **+1
alocação com `end_date` futuro e +1 com `start_date` futuro**, que são o que separa o predicado
`end_date IS NULL` do predicado canônico `end_date IS NULL OR end_date > current_date` — sem elas
as duas leituras dão o mesmo número e nenhum AC arbitra) e Operação A2 (`em_operacao`, 1 Frente,
1 alocação, **1 `public_link` ativo** — sem ele o `AC20` é vacuamente verdadeiro e uma
implementação sem trigger nenhum passa) e Operação A2 (`em_operacao`, 1 Frente, 1 alocação);
**Cliente B** com Operação B1 (`em_operacao`, 1 Frente ativa, 2 alocações abertas, 1 `public_link`
ativo), que **nenhuma** operação de cascata pode tocar.

**Identidades** (sem elas o script de prova não prova nada — `is_admin()` lê `auth.uid()`, e
rodado como `postgres` **todas** as chamadas levantam `42501`, fazendo `AC9` passar vacuamente):
2 `profiles`, um `role='admin'` e um `role='member'` com linha em `operation_members` de A1. Cada
bloco de asserção roda sob `SET LOCAL ROLE authenticated` + `request.jwt.claims` do profile
correspondente — nunca como `postgres`, que é BYPASSRLS e tornaria `AC6` e `AC15` decorativos.

Cada elemento existe para discriminar um mutante nomeado: Cliente B mata a cascata sem escopo; a
Frente já arquivada + alocação já fechada matam a contagem de impacto sem filtro; a alocação aberta
sob Frente arquivada mata a cascata que fecha só o que ela própria arquivou; os `public_link` matam
AC17 vácuo e o restore sem escopo.

| # | Critério | Mutação que ele TEM de reprovar | Guarda |
|---|---|---|---|
| AC1 | `enum_range(NULL::operation_status)` contém `concluida` e `cancelada` | migration sem os valores | SQL |
| AC2 | Adicionar valor a `operation_status` em `types.ts` produz erro de tipo **apontando para `src/lib/utils/operation-status.ts`** | (a) `Partial<Record<…>>`; (b) lista solta + `default`; (c) `type OperationStatus` escrito à mão — **cego, verificado**. Note que (c) ainda assim quebra o build em `OperationCard.tsx` &co, então um AC que só dissesse "o build quebra" seria decorativo: por isso o AC nomeia o arquivo | TS |
| AC3 | Operação `cancelada` **não** entra em `activeOperations` nem em `mrrTotal` de `getDashboardSummary` e `getClientSummary` | trocar só os 4 `.neq` e deixar `dashboard.ts:113` — o mutante que um AC baseado na string `"arquivada"` deixa passar | SQL |
| AC4 | Operação `concluida` é recusada em `/decisions/new`, `/briefing/edit`, `/meetings/new` | guards de rota inalterados (só barram `arquivada`) | MAN + GREP-AUSÊNCIA (`=== "arquivada"` em `src/app/` → 0) |
| AC5 | `archive_operation_cascade(A1)` ⇒ A1 arquivada, suas 2 Frentes ativas arquivadas, e **6** alocações fechadas; pós-condição escrita como *nenhuma alocação de A1 satisfaz `end_date IS NULL OR end_date > current_date`* — mata tanto o mutante `end_date IS NULL` quanto o do `GREATEST`, que deixaria a de `start_date` futuro aberta | função que fecha só as alocações das Frentes que ela própria arquivou: deixa alocação aberta sob Operação arquivada | SQL |
| AC5b | `archive_frente_cascade(F)` avulso ⇒ F arquivada **e** suas alocações abertas fechadas, numa escrita só | `archiveFrenteAction` com 2 `update()` soltos pelo cliente JS: se o 2º falha, sobra Frente arquivada com alocação aberta — o estado que a feature existe para eliminar | SQL |
| AC6 | **Após AC5, A2 e B1 estão byte-a-byte inalteradas** (Frentes ativas, alocações abertas, `archived_at` nulo) | `UPDATE allocations SET end_date=current_date WHERE end_date IS NULL` sem join até `operation_id`; idem `UPDATE frentes … WHERE archived_at IS NULL`. **Passa AC5 com nota máxima e zera o banco inteiro** | SQL |
| AC7 | `archive_operation_cascade(A2)` (status `em_operacao`) levanta `23514` e **nenhuma linha muda** | função sem guard de status terminal | SQL |
| AC8 | `archive_client_cascade(A)` com A1/A2 terminais ⇒ Cliente A e as 2 Operações arquivados; **Cliente B e B1 inalterados** | guard/escopo só na primeira Operação da lista; `WHERE` sem `client_id` | SQL |
| AC9 | **As 8 funções** (3 cascatas + `restore_operation` + `restore_frente` + as 2 de impacto + a do trigger) chamadas por JWT de **membro não-admin** com linha em `operation_members` levantam `42501`; e `REVOKE`/`GRANT` estão na migration para as 3 | guard implementado só na primeira, deixando as outras duas chamáveis por `/rest/v1/rpc/`; e confiar na RLS: `operations_scoped_update` usa `can_see_operation`, então o membro consegue o UPDATE. É bypass real, não teórico | SQL |
| AC10 | `clientHasActiveOperations(A)` = `false` quando A1/A2 são terminais/arquivadas | predicado atual (`archived_at IS NULL AND status <> 'arquivada'`) | SQL |
| AC11 | `listOperations` não devolve Operação de Cliente arquivado **nos 3 ramos** — sem busca, buscando pelo nome da Operação, buscando pelo nome do Cliente | filtro adicionado só no ramo sem busca; o órfão volta ao digitar | SQL |
| AC11b | Operação `cancelada` **não** entra em `getTopClientsByMRR` nem em `getActiveOperationsMonthlyCostsTotal`; `mrrTotal` e `monthlyCostsTotal` do mesmo cenário produzem margem coerente | corrigir só `getDashboardSummary`: o painel passa a mostrar receita sem a Operação cancelada e custo **com** ela — margem errada por construção, pior que o estado atual | SQL |
| AC11c | Operação `concluida` **continua** aparecendo em `/operations` e em `getOperation` | aplicar `OPERACAO_ATIVA` às listas: encerrar faria a Operação sumir antes de ser arquivável — recria o beco sem saída original | SQL |
| AC12 | `getArchiveImpact(A1)` devolve exatamente `{frentes: 2, alocações: 6}` — o mesmo conjunto que a cascata fecha em `AC5` | medidos contra o fixture: predicado `end_date IS NULL` → **5**; escopo só nas Frentes que a cascata arquiva (perde a órfã sob Frente já arquivada) → **5**; sem filtro nenhum → **7** | SQL |
| AC12b | O `<select>` oferece **exatamente** `{em_construcao, em_operacao}` em criação e `{em_construcao, em_operacao, janela_critica, concluida, cancelada}` em edição; escolher Concluída e salvar persiste no banco (a) filtro invertido: os dois nunca aparecem, **a feature toda funciona e o usuário não encerra nada** — os demais ACs passam porque consomem status terminal criado por SQL no fixture; (b) `selectableOn` string única, que apaga `em_construcao`/`em_operacao` da edição | MAN |
| AC13 | Editar e salvar uma Operação `concluida` **preserva** o status | `selectable` booleano + fallback de `OperationForm.tsx:77-80` generalizado ⇒ volta para `em_operacao` em silêncio, apagando o ato de negócio que a feature existe para registrar | MAN |
| AC14 | Botão "Arquivar" presente no DOM e `disabled`, com motivo, quando há Operação ativa | manter o render condicional | MAN + GREP-AUSÊNCIA (`canArchive &&` nos dois forms → 0) |
| AC15 | `restoreOperationAction` sobre Operação de Cliente arquivado ⇒ `state_conflict`, nada muda. Idem `restoreFrenteAction` sob Operação arquivada. Ambas recusam não-admin | restore que só faz `UPDATE … SET archived_at = NULL` | SQL |
| AC16 | Restaurar A1 deixa **os links dela** `revoked_at IS NOT NULL` **e o link de B1 intacto** | (a) restore que não toca em `public_links` — token antigo volta a servir o cliente; (b) `UPDATE public_links SET revoked_at=now() WHERE revoked_at IS NULL` sem `operation_id`, que revoga o link de todo mundo. Sem link no fixture o AC seria vacuamente verdadeiro | SQL |
| AC14b | Cliente arquivado **não** aparece no `<select>` de Cliente em `/operations/new` e `/persons/new` | `listClients` passa a trazer arquivados sem escopo: os 4 pickers herdam e o Cliente arquivado vira opção | MAN |
| AC14c | Botão "Arquivar" não aparece para membro não-admin em nenhum dos 3 forms | `OperationForm.tsx:525` é o único dos três sem `isAdmin` (`ClientForm.tsx:500` e `FrenteForm.tsx:400` têm); tornar o render incondicional sem adicionar a checagem expõe o botão ao membro | MAN |
| AC19 | Depois de arquivar A1, a tarefa dela some do KPI do painel, de `/tasks`, da paginação **e do badge do `Sidebar.tsx:31`**; tarefa de **área** continua aparecendo | (a) filtrar em 2 dos 4 call-sites — o badge do sidebar é o mais visível e o mais fácil de esquecer; (b) join via `frentes!inner`, que derruba toda tarefa de área (`frente_id IS NULL`) da tela sem erro; (c) embed **sem** `!inner`, que o supabase-js descarta em silêncio — o filtro vira no-op e nada muda | MAN |
| AC20 | A2 tem ≥1 link ativo **antes**; marcá-la `cancelada` deixa os links dela `revoked_at IS NOT NULL` e o de B1 intacto; `concluida` não revoga; **e arquivar A1 (`concluida`) revoga os dela** | (a) revogar na Server Action em vez do trigger: qualquer outro caminho de escrita (RPC, SQL manual) escapa; (b) revogar também no `concluida`, matando o relatório de contrato entregue; (c) `UPDATE public_links` sem `operation_id`; (d) `WHEN` só de status: a cascata escreve `archived_at`, nunca `status`, então arquivar não dispararia e sobraria Operação arquivada com link ativo | SQL |
| AC18 | **Arquivar A1 pela interface**: abrir `/operations/<A1>/edit` como admin, clicar Arquivar, confirmar — e a cascata acontece (A1 + 2 Frentes arquivadas, 4 alocações fechadas) | os pré-checks antigos permanecerem: `actions/frentes.ts:159-165` (`frenteHasActiveAllocations`) e `actions/operations.ts:166-172` (`operationHasActiveFrentes`) devolvem `err(...)` **antes** de chegar na RPC. A feature inteira funciona por SQL e **não funciona pela UI** — os outros 17 ACs passam, porque todos chamam a função direto | MAN |
| AC17 | Seção "Arquivados" lista os arquivados em `/clients`, `/operations` **e no detalhe da Operação (Frentes)**, e o Restaurar funciona nos três | seção só nos dois primeiros: Frente arquivada pela cascata fica sem tela e `restoreFrenteAction` sem invocador | listagem que segue filtrando `archived_at IS NULL` em tudo | MAN |

**Guarda MAN (AC4, AC13, AC14, AC17):** o repo não tem test runner (`package.json` → só
`dev/build/start/typecheck/gen:types`). Onde havia guarda mais forte disponível, ela foi puxada
para dentro do AC: grep **de ausência** mata deterministicamente o mutante de AC4 (`=== "arquivada"` → 0 fecha a
classe). Em **AC14 a guarda é parcial e está registrada como tal**: `canArchive &&` → 0 é
satisfeito por `{canArchive ? <Button/> : null}`, que mantém o botão fora do DOM — quem fecha ali
é a parte MAN. O que sobra genuinamente manual é AC13 e AC17, verificados com o app rodando na Fase 4 —
**não declarar fechados por leitura de código.**

**Atomicidade:** C1/C2 são função SQL única porque o cliente Supabase JS não abre transação — três
`update()` soltos deixariam estado parcial se o segundo falhasse. É propriedade do design, não AC
executável: não sei forçar a falha do passo intermediário sem instrumentar o banco, e AC que não
sei reprovar não é AC.
