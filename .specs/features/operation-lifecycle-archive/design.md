# operation-lifecycle-archive Design

Spec aprovado: `./spec.md`. **Este documento não repete critério de aceite** — cita por id
(`AC5`, `AC12b`) e diz apenas onde a prova mora. Um fato, um dono.

## Estratégia de PR

**1 PR, 2 migrations.** Decisão do usuário: os agregados de MRR/custo entram junto porque corrigir
metade produz margem incoerente (`dashboard.ts:131`). `Closes #159`.

**Ordem de deploy (não é detalhe):** as migrations são manuais e a Vercel publica no merge. M1+M2
vão para produção **antes** do merge, senão o primeiro uso do `<select>` novo levanta
`22P02 invalid input value for enum` e a RPC levanta `PGRST202` (função ausente no schema cache).

---

## Decisões de arquitetura (ADR — vira AD-018 no STATE.md)

### D1 — Cascata em função SQL, não em Server Action
`archive_frente_cascade`, `archive_operation_cascade`, `archive_client_cascade` em plpgsql; a action
chama por `supabase.rpc(...)`.
**Razão:** o cliente Supabase JS não abre transação. Escritas soltas deixam estado parcial se a
segunda falhar — Frente arquivada com alocação aberta é o estado que a feature existe para
eliminar. Função = statement único = transação implícita.

### D2 — `is_admin()` **dentro** da função, além do guard na action
Cada função abre com `IF NOT public.is_admin() THEN RAISE … ERRCODE '42501'`, e leva
`REVOKE EXECUTE … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated`.
**Razão 1 (segurança):** a RLS de UPDATE **não é admin-only** em `operations`/`frentes`/
`allocations` — `operations_scoped_update` e `frentes_scoped_update` usam `can_see_operation(...)`
(`20260526190001_operation_members_scope.sql:98-100,110-112`), `allocations_scoped_update` idem via
`frentes` (`:236-244`). Sem o guard interno, membro com linha em `operation_members` chama
`/rest/v1/rpc/…` e contorna o `requireAdminAction`. `service_role` também é fechado por aqui: com a
secret key, `auth.uid()` é NULL ⇒ `is_admin()` false. (`clients` é exceção — `clients_admin_update`
(`…_indirect.sql:25-27`) já é `is_admin()`.)
**Razão 2 (fail-open), verificada:** `can_see_operation` é `public.is_admin() OR EXISTS(…)`
(`…members_scope.sql:61`), então o admin passa em todos os `USING` do caminho e nenhum `UPDATE` é
silenciosamente filtrado. É o guard que garante isso, não coincidência: quem remover o guard
achando que "a RLS basta" reabre **os dois** problemas — o bypass e o fail-open.
**`SECURITY DEFINER` proibido:** contornaria a RLS em vez de respeitá-la.

### D3 — Dois predicados nomeados, um mapa exaustivo
`src/lib/utils/operation-status.ts` exporta
`Record<Database["public"]["Enums"]["operation_status"], StatusMeta>`; dele derivam
`ACTIVE_STATUSES`, `TERMINAL_STATUSES`, `isActiveStatus`, `statusLabel`, `statusPillVariant`,
`selectableStatuses(mode)`. `OPERACAO_ATIVA` e `OPERACAO_VISIVEL` são os predicados de leitura.
**Razão:** um predicado só se contradiz (a spec documenta). O `Record` não-parcial ancorado no enum
gerado é a guarda de compilação — valor novo quebra o build **neste arquivo** (`AC2`).

### D4 — Duas migrations, na ordem
M1 só `ALTER TYPE … ADD VALUE IF NOT EXISTS`; M2 as funções.
**Razão, corrigida:** a razão que publiquei na R1 ("o valor novo não pode ser usado na mesma
transação") **não foi verificada para este caso** e provavelmente não se aplica — corpo de plpgsql
é late-bound, os literais não são resolvidos no `CREATE FUNCTION`. Mantenho separadas mesmo assim,
por dois motivos que valem: o custo é zero, e M2 pode vir a ter statement SQL direto com o literal
(onde a restrição **é** real). Registrado como conservadorismo, não como necessidade provada.

### D5 — Guard de status escrito como complemento, fail-closed
`IF v_status NOT IN ('concluida','cancelada','arquivada') THEN RAISE`.
**Razão:** valor novo no enum cai no ramo que **bloqueia**. O inverso seria fail-open — status novo
arquivaria sem ninguém decidir. Análogo SQL do `Record` exaustivo do D3.

### D6 — Restore de Operação também é RPC transacional
`restore_operation(p_operation_id)`, **nesta ordem**, numa transação:
1. guard de admin (`42501`);
2. `SELECT o.archived_at, c.archived_at INTO … FROM operations o JOIN clients c ON c.id =
   o.client_id WHERE o.id = p_operation_id AND o.archived_at IS NOT NULL FOR UPDATE OF o`;
   `IF NOT FOUND THEN RAISE 'P0002'`;
3. **`IF v_client_archived IS NOT NULL THEN RAISE … ERRCODE 'P0003'`** — precondição de pai
   não-arquivado que `E1`/`AC15` exigem. Sem ela, restaurar A1 sob Cliente A arquivado produz
   Operação com `archived_at IS NULL` que `OPERACAO_VISIVEL` exclui (cláusula do Cliente) **e** que
   a seção "Arquivados" também exclui (filtra `archived_at IS NOT NULL`): invisível nas duas listas
   e não mais arquivável pela UI — o beco sem saída original, recriado pela porta do restore;
4. `UPDATE public_links SET revoked_at = now() WHERE operation_id = $1 AND revoked_at IS NULL`;
5. `UPDATE operations SET archived_at = NULL`, com `GET DIAGNOSTICS`.
**Razão (BLOCKER do security-gate):** na R1 eu tinha isso como segunda escrita solta pelo cliente
JS. Entre desarquivar e revogar existe janela em que `getPublicLinkByToken`
(`queries/publicLinks.ts:66-92`, gate único das duas superfícies públicas) revalida o token antigo.
E a rota de download emite **signed URL de `SIGNED_URL_TTL_SECONDS`**
(`public/[token]/attachments/[aid]/download/route.ts:59-62`), que a revogação posterior **não**
invalida — a janela vira minutos de exfiltração de todo anexo `visibility='cliente'`. Se a segunda
escrita falhasse, o token ficaria vivo permanentemente com o admin vendo um toast de erro. Ordem
revogar-antes já seria fail-closed; a transação fecha de vez.
**`restore_frente(p_frente_id)` também é RPC**, espelhando o D6: guard de admin, `FOR UPDATE`,
`P0002`, e `IF operations.archived_at IS NOT NULL THEN RAISE 'P0003'` (código próprio, distinto do
`23514` de "não encerrada" — ver mapa de erro). Na R3 eu tinha escrito "action basta": aí a precondição de pai que `E1` exige não teria onde
morar, e a metade-Frente do `AC15` está classificada **SQL** — script SQL não executa Server Action
TS, então reimplementar a checagem no script provaria o script, não o código. Estado que isso
deixava alcançável: Frente com `archived_at IS NULL` sob Operação arquivada, que volta a
`getDashboardSummary` (`dashboard.ts:55-58` filtra só `frentes.archived_at`, sem join com
`operations`) com a Operação inalcançável pela UI para desfazer.
`restoreClientAction` segue como escrita única — não tem pai.

### D12 — Cancelar revoga os links públicos; concluir não (decisão do usuário)
**Mecanismo: trigger `AFTER UPDATE ... FOR EACH ROW` em `operations`** (`FOR EACH ROW` explícito —
`WHEN` referenciando OLD/NEW não existe em trigger statement-level), com **duas** condições:

```sql
WHEN (   (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada')
      OR (NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL) )
```

→ revoga os `public_links` ativos daquela Operação.
⚠️ **A segunda condição não é zelo, é correção de um erro meu.** Na R3 eu escrevi que "a cascata de
arquivamento também passa a revogar" com o `WHEN` só de status. É **falso**:
`archive_operation_cascade` escreve `archived_at`, **nunca `status`** — arquivar uma Operação
`concluida` não dispararia o trigger, e a defesa continuaria sendo só o resolver
(`publicLinks.ts:87`), deixando alcançável "Operação arquivada com `revoked_at IS NULL`" que
`listPublicLinksByOperation` (`queries/publicLinks.ts:21-43`) exibe ao admin como link ativo.
**Razão do mecanismo, não só da regra:** `PublicHero.tsx:42-43` renderiza a pill de status no
portal do cliente, e `E3` decidiu que encerrar não fecha o link — então marcar "Cancelada"
mostraria uma pill vermelha ao cliente antes da conversa comercial. Trigger e não código na action
porque (a) é atômico com o `UPDATE` por construção, sem segundo round-trip, e (b) **nenhum caminho
de escrita escapa** — action, RPC futura ou SQL manual. Assimetria deliberada: `concluida` continua
servindo o relatório (contrato entregue), `cancelada` fecha.
**Consequência registrada:** a cascata de arquivamento também passa a revogar (era W4 do
security-gate — defesa em dado, não só no resolver `publicLinks.ts:87`).
**Guard novo que o D12 obriga:** `updateOperationAction` exige só `requireUserAction`
(`actions/operations.ts:124`) e `operations_scoped_update` usa `can_see_operation` — com o trigger,
um **membro não-admin** passaria a revogar permanentemente todos os links públicos da Operação só
marcando-a `cancelada`, ação que `revokePublicLinkAction` reserva a admin (`actions/publicLinks.ts:37-38`)
e que não tem desfazer. Portanto: **escrever status terminal exige admin**, na action e no trigger.

**Furo conhecido, fora deste diff:** `createPublicLinkAction` (`actions/publicLinks.ts:12-14`) exige
só `requireUserAction`, enquanto revogar exige admin (`:37-38`) — um membro pode criar link novo
depois. A frase do spec "reabrir é ato deliberado" só se sustenta para admin. Não corrijo aqui
(fora do escopo), fica registrado.

### D7 — `includeArchived` com default `false`, não relaxar o filtro
`listClients`/`listOperations` ganham parâmetro; só `/clients`, `/operations` e o detalhe da
Operação passam `true`.
**Razão:** `listClients` tem 5 call-sites e **4 são picker de Cliente** (`operations/new:11`,
`operations/[id]/edit:25`, `persons/new:6`, `persons/[id]/edit:24`). Relaxar na query poria Cliente
arquivado no select de nova Operação.

### D8 — O conjunto do impacto tem **um** dono, e é o SQL
`archive_operation_impact(p_operation_id) RETURNS TABLE(frentes int, alocacoes int)` e
`archive_client_impact(p_client_id)` vivem na M2, **coladas** nas funções de cascata; o TS só chama
por `rpc`.
**Razão:** na R1 eu tinha `getArchiveImpact` reimplementando o `WHERE` em supabase-js. Dois donos
da mesma regra em linguagens diferentes, sem guarda de compilação e sem test runner: editar o
`WHERE` da cascata sem editar o da query não quebra nada, e o diálogo passa a mentir. Com uma
função por lado no mesmo arquivo, a divergência fica visível na revisão.
**Bônus:** elimina a armadilha do supabase-js apontada pelo gate (`frentes!inner` obrigatório,
senão o `.eq("frentes.operation_id", …)` não filtra e conta alocação do mundo inteiro).

### D9 — Pill: `concluida` = `ok`, `cancelada` = `critical`
**Razão:** princípio 09 do `CLAUDE.md` — cor é decisão deliberada. As 6 canônicas são
`neutral | oak | sage | ok | warning | critical` (`Pill.tsx:3`); `sage` e `warning` já são
`em_operacao` e `janela_critica`; `neutral` é `em_construcao`/`arquivada`. `ok` para entrega
cumprida e `critical` para contrato cancelado são as duas livres que carregam o sinal certo, e o DS restringe cor
funcional a pills e ícones pequenos — `dryos-design-system/SKILL.md:654` é uma **proibição** ("❌
cores funcionais em superfícies grandes — só em pills e ícones pequenos"), não uma autorização; a
conclusão vale porque pill é justamente a exceção, mas na R2 eu citei a linha invertendo o sentido
da fonte. **Decidido pelo usuário** (2026-08-29), junto com D12.

### D10 — `window.confirm`, sem componente de Dialog novo
**Razão:** não existe Dialog/Modal em `src/components/ui/` e `window.confirm` é o padrão em 10
call-sites (`OperationForm.tsx:191`, `FrenteForm.tsx:184`, `ClientForm.tsx:151`, …). Mensagem
multi-linha (`\n`) dá a lista itemizada que D2 da spec pede. Introduzir modal seria construir o que
ninguém pediu. Estado assíncrono: `isArchiving` (padrão já existente) cobre o round-trip do impacto
antes do `confirm`.

---

## Schema — migration 1 (`*_operation_status_terminal.sql`)

```sql
ALTER TYPE public.operation_status ADD VALUE IF NOT EXISTS 'concluida';
ALTER TYPE public.operation_status ADD VALUE IF NOT EXISTS 'cancelada';

COMMENT ON COLUMN public.operations.status IS
  'ciclo de vida do contrato. Ativos: em_construcao, em_operacao, janela_critica. Terminais: '
  'concluida, cancelada (e arquivada, legado — nunca escrito). Terminal e archived_at sao eixos '
  'distintos: terminal sai dos agregados, archived_at tira da vista.';
```

## Schema — migration 2 (`*_archive_cascade_functions.sql`)

**Oito funções + um trigger** — contagem derivada da lista, não de memória:
`archive_operation_cascade`, `archive_frente_cascade`, `archive_client_cascade`,
`restore_operation`, **`restore_frente`**, `archive_operation_impact`, `archive_client_impact`,
**`tg_revoke_links_on_terminal()`** (todo `CREATE TRIGGER` exige uma FUNCTION própria — ela ficara
de fora do ritual do C0 e, sem `SET search_path`, trigger function é classe clássica de
escalonamento), mais o trigger que a chama.
(Histórico do quantificador: R2 dizia "cinco" e enumerava seis; R3 dizia "seis" e esquecia a função
do trigger; o `C0` da spec dizia "as 3 funções".)
Todas `LANGUAGE plpgsql`, `SECURITY INVOKER`, `SET search_path = public`, com `REVOKE EXECUTE …
FROM PUBLIC, anon` + `GRANT … TO authenticated` + `COMMENT ON FUNCTION` (padrão
`…members_scope.sql:38-52,70-73`).

> **As duas de impacto também levam `is_admin()`**, apesar de só lerem. Hoje não há exposição —
> `SECURITY INVOKER` mantém `operations_scoped_select`/`frentes_scoped_select`/
> `allocations_scoped_select` (`…members_scope.sql:94-95,106-107,226-230`), então membro fora do
> escopo recebe `0`, não a contagem real. O guard existe para o dia em que alguém trocar para
> `SECURITY DEFINER` "pra contagem bater com a do admin" e convertê-las em oráculo cross-tenant. O
> `COMMENT ON FUNCTION` delas diz isso em uma linha.

```sql
CREATE OR REPLACE FUNCTION public.archive_operation_cascade(p_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_status public.operation_status; v_rows int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin arquiva' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.operations
   WHERE id = p_operation_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operacao inexistente ou ja arquivada' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('concluida','cancelada','arquivada') THEN      -- D5, fail-closed
    RAISE EXCEPTION 'operacao precisa estar encerrada' USING ERRCODE = '23514';
  END IF;

  -- TODA alocacao aberta da operacao, inclusive sob Frente ja arquivada. Mesmo conjunto
  -- que archive_operation_impact conta (D8). "Aberta" = o predicado que os LEITORES usam
  -- (operation-costs.ts:266,325 e public-report.ts:188,223), nao "end_date IS NULL":
  -- alocacao com end_date futuro tambem esta aberta para eles.
  -- GREATEST estava ERRADO: alocacao com start_date futuro sairia com end_date futuro e
  -- continuaria "aberta" pelo predicado canonico. allocations.start_date nao tem CHECK de
  -- teto (initial_schema.sql:204), entao start futuro e' alcancavel pelo form.
  UPDATE public.allocations a
     SET end_date   = current_date,
         start_date = LEAST(a.start_date, current_date)   -- unico lugar que normaliza start
    FROM public.frentes f
   WHERE a.frente_id = f.id AND f.operation_id = p_operation_id
     AND (a.end_date IS NULL OR a.end_date > current_date);

  UPDATE public.frentes SET archived_at = now()
   WHERE operation_id = p_operation_id AND archived_at IS NULL;

  UPDATE public.operations SET archived_at = now() WHERE id = p_operation_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    -- Tripwire de concorrencia/no-op. NAO detecta fail-open por RLS: um membro sem o guard
    -- tambem passa em operations_scoped_update, e ROW_COUNT seria 1. Codigo proprio para
    -- nao cair no ramo 'forbidden' do mapa de erro.
    RAISE EXCEPTION 'cascata nao arquivou a operacao' USING ERRCODE = 'P0004';
  END IF;
END $$;
```

- `archive_frente_cascade(p_frente_id)`: guard de admin; `SELECT … FOR UPDATE` + `IF NOT FOUND`
  (senão id inexistente devolve sucesso sobre no-op); fecha alocações abertas **da Frente**;
  arquiva a Frente. Sem guard de status — arquivar Frente é ato local.
- `archive_client_cascade(p_client_id)`: guard de admin; `IF EXISTS (operação do Cliente com
  `archived_at IS NULL` e status não-terminal) THEN RAISE 23514`; laço `PERFORM
  archive_operation_cascade(id)`; `UPDATE clients`. **`RAISE` em qualquer iteração aborta a
  transação inteira** — é o que garante "nunca pula a não-terminal".
- `restore_operation(p_operation_id)`: D6 — revoga links, depois desarquiva.
- `archive_operation_impact` / `archive_client_impact`: D8, `STABLE`, mesmo `WHERE` das cascatas.

## TypeScript — **tabela completa** (a da R1 omitia as guardas velhas e as páginas de edit)

| arquivo | mudança |
|---|---|
| `src/lib/utils/operation-status.ts` **(novo)** | mapa D3 + derivados. É onde `AC2` prova |
| `src/lib/db/types.ts` | `npm run gen:types` após M1+M2 — sem isso `rpc("archive_operation_cascade")` não compila (`Functions` é record fechado) e o `Record` do D3 não tem as chaves novas |
| **`actions/frentes.ts:159-165`** | **remover o pré-check `frenteHasActiveAllocations`** — é o fundo do beco sem saída. `:168-171` → `rpc` |
| **`actions/operations.ts:166-172`** | **remover o pré-check `operationHasActiveFrentes`**; `:174-178` → `rpc`; `restoreOperationAction` → `rpc` (D6) |
| `actions/clients.ts` | `archiveClientAction` → `rpc`; `restoreClientAction` (escrita única) |
| **`operations/[id]/edit/page.tsx:24,42`** | origem de `canArchive` muda: `!hasFrentes` → status terminal |
| **`clients/[id]/edit/page.tsx:23,35`** | `clientHasActiveOperations` já corrigido pelo ponto 4 de A3; o `canArchive` passa a alimentar o motivo, não a esconder |
| **`operations/[id]/frentes/[fid]/edit/page.tsx:29,53`** | `canArchive` vira sempre `true` para admin |
| `queries/operations.ts` | pontos 1-3, 10, 11, 19 de A3; `getActiveOperations` ganha `scope`; `includeArchived` |
| `queries/clients.ts` | pontos 4-6, 16; `includeArchived` (D7) |
| `queries/dashboard.ts` | pontos 7, 8, 16 **e o KPI de tarefas (`:77-82`)** — ver D11 |
| `queries/operation-costs.ts` | ponto 9 (3 filtros) — par de `mrrTotal`, ver `AC11b` |
| `queries/area-grants.ts` | pontos 17, 18 |
| `queries/frentes.ts` | `listArchivedFrentesByOperation` (novo, 3ª seção de E2) |
| `queries/tasks.ts` | **zero referências a `archived_at` hoje** — ver D11 |
| **`OperationCard.tsx:14-26`, `OperationsTable.tsx:14-25`, `OperationHero.tsx:18-31`, `PublicHero.tsx:11-23`** | **quebram o build com o enum novo** (a bateria da spec provou). Passam a consumir `statusLabel`/`statusPillVariant` do D3/D9 |
| `validators/operation.ts:71` | enum Zod = `ACTIVE_STATUSES ∪ {concluida, cancelada}` — **não** `Object.keys` do mapa, que aceitaria `arquivada` na escrita. Schema é compartilhado por create e update (`actions/operations.ts:101,130`), então a distinção create×edit do `AC12b` vive **só no form** |
| 3 guards de rota + `OperationForm.tsx:78` | pontos 12-15 |
| `OperationForm`, `ClientForm`, `FrenteForm` | botão incondicional + `disabled` + motivo + `isAdmin` nos três (`OperationForm.tsx:525` é o que não tem) |
| `OperationForm.tsx:204-209` | o `<select>` de status — onde A4, `AC12b` e a P1 inteira acontecem; `allowedStatus` passa a vir de `selectableStatuses(mode)` |
| `actions/frentes.ts` | `restoreFrenteAction` (novo) |
| `actions/archive-impact.ts` **(novo)** | Server Action que chama as 2 RPCs de impacto — o consumidor é client component, então precisa de action própria com `requireAdminAction` (Inv. 14) e `createServer()`, **nunca** `createAdmin()` |
| **órfãos criados por este PR** | removidos os pré-checks, `frenteHasActiveAllocations` (`queries/frentes.ts:18-28`) e `operationHasActiveFrentes` (`queries/operations.ts:417-429`) ficam sem call-site → **deletar**. (`countAllOpenTasks`, `tasks.ts:220`, já é código morto hoje com 0 call-sites — **pré-existente, não tocar**.) |
| `clients/page.tsx`, `operations/page.tsx`, `operations/[id]/page.tsx` | seção "Arquivados". **Não colapsável** — o precedente citado (`catalog/products/page.tsx:75-99`) é `<section>` estática renderizada quando `archived.length > 0`; a spec dizia "colapsada", o precedente não tem toggle. **A seção de `/operations` aplica também a cláusula "Cliente dono não arquivado"**: depois de `archive_client_cascade(A)`, as Operações de A só reaparecem quando o Cliente for restaurado — senão a lista mostraria arquivados órfãos |

### D11 — Tarefas de Operação arquivada (escopo que o fool-gate expôs)
`queries/tasks.ts` não tem **nenhuma** referência a `archived_at` (grep: 0) e o KPI de tarefas
abertas (`dashboard.ts:77-82`) não filtra Operação. Hoje é latente — nada é arquivado. Tornar o
arquivamento possível **manifesta** a incoerência: o painel mostraria `activeOperations` sem A e
"tarefas abertas" com as de A, e `TaskListItem.tsx:82` linkaria para rota que passa a 404.
**Decisão:** entra no PR, dimensionado. São **4 call-sites**, não 2 — e o quarto é o mais visível:

| call-site | superfície |
|---|---|
| `dashboard.ts:77-82` | KPI "tarefas abertas" do painel |
| `tasks.ts:317` `listTasks` | a lista `/tasks` |
| `tasks.ts:353` `countTasks` | paginação de `/tasks` |
| `tasks.ts:383` `countMyOpenTasks` | **badge do `Sidebar.tsx:31`** |

**Forma do join, decidida — via Operação, nunca via Frente.** `tasks.operation_id` existe e é
`NOT NULL` na prática (`fk_tasks_operation_id`, `20260610140001_tasks_area_operation.sql:7,21`),
então `operations!fk_tasks_operation_id!inner(archived_at)` + `.is("operations.archived_at", null)`
cobre tarefa de entrega **e** tarefa de área. Via `frentes!inner` sumiria toda tarefa de área
(`frente_id IS NULL`, Inv. 15) da tela, silenciosamente.
⚠️ **O `!inner` é obrigatório**: sem ele o supabase-js descarta o filtro do embed **em silêncio** —
a mesma armadilha que o D8 cita como razão para tirar o impacto do TS. `AC19` existe para pegar
exatamente isso.

**Mapa de erro** (`ActionResult`, Inv. 13), **com ramo default**: `42501` → `'forbidden'`;
`23514` → `err('Encerre a Operação antes de arquivar.', 'state_conflict')`; **`P0003` →
`err('Restaure o registro pai antes.', 'state_conflict')`** — código distinto porque reusar
`23514` faria uma falha de **restore** exibir mensagem sobre **arquivar**, e `AC15` só exige
`state_conflict`, então o mutante passaria; `P0002` →
`'not_found'`; `PGRST202` → `err('Migration pendente — avise o time.', 'schema_stale')`; `22P02` →
mesma coisa; **qualquer outro** → mensagem genérica + `code: 'db_error'`. Nunca a string crua do
Postgres no toast.

**Restore lê entidade arquivada:** `getOperation`/`getClient`/`getFrente` filtram
`archived_at IS NULL` (`operations.ts:287`, `clients.ts:72`, `frentes.ts:12`) — usá-las no restore
devolveria `not_found` em 100% dos casos. O restore consome as variantes `includeArchived` (D7).

## Onde cada AC prova

| AC | onde a prova mora |
|---|---|
| `AC1`, `AC5`, `AC5b`, `AC6`, `AC7`, `AC8`, `AC9`, `AC10`, `AC11`, `AC11b`, `AC11c`, `AC12`, `AC15`, `AC16` | script SQL em **branch Supabase**, sob o ritual de identidade abaixo |
| `AC2` | `npm run typecheck` com valor extra no enum de `types.ts`; o erro tem de apontar `operation-status.ts` |
| `AC3` | asserção SQL reproduzindo as queries de `getDashboardSummary`/`getClientSummary` |
| `AC4`, `AC14` | grep de ausência (parcial em `AC14`) + app rodando |
| `AC12b`, `AC13`, `AC14b`, `AC14c`, `AC17`, **`AC18`** | app rodando (Fase 4) — **não fechar por leitura de código** |

### Como as ACs de SQL são provadas — ambiente apurado por execução

Os dois caminhos que o design supunha caíram, e o terceiro foi verificado:

| caminho | resultado (2026-08-29) |
|---|---|
| Supabase MCP `execute_sql` | conecta como `supabase_read_only_user`, **`rolbypassrls = t`**, `pg_has_role(…,'authenticated')= f` → `SET ROLE` devolve `42501`. **Provaria com RLS desligada.** |
| Branch Supabase | `create_branch` → `PaymentRequiredException`: branching exige plano Pro; a org está abaixo |
| **Stack local** (`supabase start`) | **funciona** — é o caminho |

Bloco-fumaça rodado no stack local, antes de qualquer AC:

```
current_user=postgres | rolbypassrls=t | pg_has_role(…,'authenticated')=t
BEGIN; SET LOCAL ROLE authenticated; set_config('request.jwt.claims', {"sub":"1111…"}, true);
  → current_user = authenticated | auth.uid() = 1111…
  → SELECT count(*) FROM clients  = 0   (postgres via 1)   ⇒ a RLS morde
  → is_admin() = f
```

⇒ o ritual `BEGIN` + `SET LOCAL ROLE authenticated` + `request.jwt.claims` **executa e a RLS é
aplicada** sob o papel trocado. É por isso que ele vale como prova aqui e não valia no MCP.

| classe | caminho |
|---|---|
| `AC1` | stack local, sem identidade (`enum_range` não depende dela) |
| `AC5`, `AC5b`, `AC6`, `AC7`, `AC8`, `AC10`, `AC12`, `AC15`, `AC16`, `AC20` | stack local, cada bloco sob o ritual acima, identidade **admin** |
| `AC9` | stack local, ritual com identidade **member** para as 8 funções; e repetido pelo caminho real (`@supabase/supabase-js` contra o `localhost:54321`) para exercitar `/rest/v1/rpc/` |
| `AC3`, `AC11`, `AC11b`, `AC11c` | stack local, identidade admin |

Fixture criado **como `postgres`** (fora do `SET ROLE`): `clients_admin_insert`/`persons_admin_insert`
exigem `is_admin()`. `profiles.id` é FK para `auth.users` (`20260517225505_profiles.sql:17-18`),
então as 2 linhas de `auth.users` vêm primeiro.

⚠️ **Nenhum AC fechado por asserção rodada como `postgres`** — com `rolbypassrls`, `AC6` e `AC15`
passariam com a RLS desligada.

## Doc-sync (obrigatório no mesmo PR)

`docs/DATABASE_SCHEMA.md` (:98 e :677 valores de `operation_status`; :390 resolver de link público;
as 5 funções novas) · `docs/prd.md` (ciclo de vida da Operação) · `.specs/project/STATE.md`
(AD-018) · **`CLAUDE.md`** — invariante nova: *`archived_at` de `clients`/`operations`/`frentes` só
se escreve pela função de cascata; `update({archived_at})` direto é bug*. Sem isso o próximo PR
reintroduz o padrão solto, que ainda existe como molde em `actions/persons.ts:185`,
`villains.ts:102`, `areas.ts:92`.

## Riscos aceitos

- **Restore item-a-item** depois de cascata grande. Sem coluna de proveniência, o alternativo é
  adivinhar.
- **`AC12b`/`AC17`/`AC18` sem guarda automatizada** — o repo não tem test runner. São os primeiros
  itens da checklist manual da Fase 4.
- **Detectores de notificação** (`notifications/detectors/frente-stale.ts:77,90`,
  `sla-breach.ts:152`) seguem disparando para Operação `concluida` não arquivada — filtram só
  `archived_at`. Coerente com `OPERACAO_VISIVEL` (contrato concluído ainda tem fechamento
  pendente), mas é caminho **externo** (Discord): registrado como decisão, não como omissão.
- **Concorrência residual, sem eufemismo.** O `FOR UPDATE` trava a linha de `operations` — impede
  troca de status concorrente, **não** impede `INSERT` de Frente ou alocação nova. Na R2 eu tinha um
  segundo `UPDATE allocations` com o comentário "fecha a janela": **é falso e foi removido.** Sob
  READ COMMITTED cada statement vê o snapshot do seu próprio início, então um INSERT que commita
  depois dele e antes do nosso COMMIT sobrevive aberto sob Operação arquivada. Fechar de verdade
  pediria `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE`, desproporcional aqui. Janela aceita pelo
  volume real: 6 operações, 1 admin.
- **Signed URL já emitida sobrevive ao arquivamento e à revogação.** `SIGNED_URL_TTL_SECONDS = 300`
  (`download/route.ts:6`, emitida em `:61`) — nada no Storage invalida uma URL já assinada. Exige
  token válido no momento do download; janela de 5 min. Aceito e registrado, já que o D6 usa
  justamente a signed URL como razão da ordem.
- **D8 não tem guarda automática de sincronia.** Impacto e cascata compartilham o `WHERE` por
  adjacência no mesmo arquivo e por `AC12`, não por CTE/view. Melhor que duplicação TS+SQL da R1,
  mas o guard real é um AC manual — o repo não tem CI de teste.
