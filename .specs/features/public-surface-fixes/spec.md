# Superfície Pública — Fixes Specification

> Origem: achados #3 (high), #6, #7, #20 de `docs/audits/AUDIT-2026-06-11.md`.
> Tema: o link público `/public/[token]` é a única superfície que o cliente vê —
> 1 bug de correção de dado + 3 lacunas de controle de exposição.

## Problem Statement

O relatório público omite tarefas silenciosamente: `fetchUpcomingTasks` aplica
`limit(20)` GLOBAL antes de filtrar por operação (em JS) — com >20 tarefas futuras no
org, os "próximos passos" do cliente somem (#3). Anexos de nível operação não têm flag
de visibilidade: TODO arquivo não-meeting é exposto e baixável pelo token, sem como
marcar interno — diverge do princípio 05 e do modelo meetings/decisions (#6).
`public_links.expires_at` existe mas nunca é validado — link "expirado" vive pra
sempre (#7). E operação arquivada continua servindo o relatório completo até revogação
manual do link (#20).

## Goals

- [ ] "Próximos passos" do relatório público mostra as tarefas certas da operação, independente do volume de tarefas de outras operações
- [ ] Anexo tem visibilidade própria (`interno`/`cliente`); só `cliente` aparece e baixa no link público
- [ ] Link com `expires_at` no passado responde 404 (página e download)
- [ ] Operação arquivada responde 404 no link público (página e download)

## Out of Scope

- Perf do link público (waterfall, scans org-wide — #9–#11 do audit) — spec separado "perf de queries". **Exceção deliberada:** o fix do #3 muda a própria query (filtro server-side via `frentes!inner`), o que de carona elimina o scan cross-tenant daquela query — registrar, não expandir.
- Auto-revogar links ao arquivar operação (o 404 no resolve cobre o requisito; revogação em massa é UX de admin, não controle de acesso)
- UI de admin pra **setar** `expires_at` (coluna é setável por SQL hoje; criar form é feature própria). **Exibir** o estado de expiração na listagem entra (P1-C AC7) — sem isso o enforcement é inexplicável.
- Rate limiting, token em URL, security headers (#16) — outros temas
- Validação Zod de `operationId` no upload action (follow-up do code-review do #128 — robustez, não exposição)

---

## User Stories

### P1-A: Próximos passos corretos no relatório ⭐ MVP (achado #3, high)

**User Story**: Como cliente vendo meu relatório público, quero ver as próximas tarefas da MINHA operação, para confiar no que a DRYOS me apresenta.

**Why P1**: Dado errado na superfície mais visível do produto; piora conforme o org cresce (silencioso).

**Acceptance Criteria**:

1. WHEN a operação tem tarefas futuras (due_date ≥ hoje, status ≠ done, frente ativa, `area_id IS NULL`) THEN o relatório SHALL listá-las mesmo que existam 20+ tarefas futuras mais próximas em OUTRAS operações.
2. WHEN o filtro roda THEN ele SHALL ser aplicado server-side ANTES do `.limit()` — sem filtro em JS pós-limit. Forma: manter o hint de FK existente no embed aliasado (`frente:frentes!fk_tasks_frente_id!inner`) + `.eq('frente.operation_id', ...)` + `.is('frente.archived_at', null)` (gate MINOR-6: `frentes!inner` cru perde o hint e pode quebrar o path do filtro).
3. WHEN a operação não tem tarefas futuras THEN a seção SHALL mostrar o mesmo empty state de hoje.
4. Comportamento preservado: ordenação `due_date` asc, fetch limit **20 por fonte** (tasks e meetings) e display cap de **4 itens combinados** no `listPublicNextMoves` (gate MINOR-6: são dois caps distintos).

**Independent Test**: SQL — criar (em transação com rollback ou via fixture) 21+ tarefas futuras numa operação B e 1 na operação A; chamar a query da operação A e ver a tarefa de A retornada. Alternativa sem fixture: revisar a query gerada + teste com os dados reais existentes (operação com tarefa futura aparece; hoje com 17 tasks o bug ainda não dispara — o teste de fixture é o que prova).

---

### P1-B: Visibilidade própria em anexos ⭐ MVP (achado #6)

**User Story**: Como membro do time, quero marcar um anexo como interno, para subir documentos de trabalho na operação sem vazá-los pro cliente.

**Why P1**: Hoje não existe NENHUM jeito de ter anexo interno em nível de operação — princípio 05 exige flag explícita; é a única entidade exposta no público sem ela.

**Decisões de domínio:**
- Coluna `attachments.visibility` enum novo `attachment_visibility ('interno','cliente')`, `NOT NULL DEFAULT 'cliente'`.
- Default `'cliente'`: princípio 05 ("tudo como se cliente fosse ler; interno é exceção explícita") + preserva o comportamento dos anexos existentes. **Trade-off nomeado (gate MAJOR-3):** default-cliente = zero remediação automática do acervo já exposto — por isso a story inclui a action de toggle (AC8) e, pós-merge, revisar manualmente os anexos existentes marcando internos.
- Regra pública composta: anexo aparece/baixa no link público SE `visibility='cliente'` E (se tiver `meeting_id`, a meeting também é `visibility='cliente'`). Racional: preserva o gate de meeting JÁ existente na rota de download e adiciona o gate próprio do anexo. **Nota (gate MAJOR-4): isso diverge deliberadamente de decisions** — decision `cliente` em meeting `interno` aparece no público hoje (visibility independente, Inv. 05); pra anexos a regra é E, não independência — o gate de meeting existente não pode regredir.

**Acceptance Criteria**:

1. WHEN a migration roda THEN `attachments.visibility` existe com default `'cliente'` e os anexos existentes ficam `'cliente'` (comportamento atual preservado).
2. WHEN um anexo é `interno` THEN `listPublicAttachments` NÃO o retorna E o download público (`/public/[token]/attachments/[aid]/download`) responde 404/403 — mesmo com `aid` correto.
3. WHEN um anexo é `cliente` e de nível operação THEN aparece e baixa no público (comportamento atual).
4. WHEN um anexo é `cliente` mas pertence a meeting `interno` THEN continua bloqueado no público (gate da meeting preservado).
5. WHEN o usuário sobe um anexo pelo form THEN pode escolher a visibilidade (default `cliente` pré-selecionado); a action valida com Zod e persiste.
6. WHEN a UI interna lista anexos THEN anexos `interno` são distinguíveis (pill `Interno`, mesmo padrão visual de `MeetingsDecisionsTimeline`) — nas DUAS listagens internas: tab Anexos da operação E anexos da meeting na página de edit. Requer `visibility` em `ATTACHMENT_FIELDS` e no `AttachmentListItem` (hoje não incluem).
7. A lista pública e o download SHALL aplicar o filtro no servidor (query/route), nunca só na renderização.
8. WHEN um membro da operação alterna a visibilidade de um anexo existente (action nova `setAttachmentVisibilityAction`: guard `requireUserAction`, Zod, UPDATE só da coluna) THEN a mudança vale imediatamente no público. Pré-requisito a verificar no design: existência de policy UPDATE em `attachments` (se não houver, a migration adiciona `attachments_scoped_update` com `can_see_operation`, restrita via trigger/policy à coluna ou aceitando update geral — decisão de design).
9. Bloqueio público SHALL responder **404 uniforme** (não 403): o 403 atual do gate de meeting na rota de download vira 404 nesta mudança — 403 em superfície sem auth é oráculo de existência (gate MINOR-5).

**Independent Test**: subir 2 anexos (1 interno, 1 cliente) numa operação com link público; a página pública lista só o cliente; curl no download do interno → 404; do cliente → 200/redirect.

---

### P1-C: `expires_at` enforced ⭐ MVP (achado #7)

**User Story**: Como admin, quero que um link com prazo de expiração pare de funcionar depois do prazo, para que o acesso externo não viva mais que o combinado.

**Why P1**: A coluna existe, é setável via SQL e a query de admin já a busca — mas a UI a descarta silenciosamente (`PublicLinksSection` não renderiza `expiresAt`). O deferral de MVP está documentado na própria migration; o MVP acabou. Foot-gun duplo: quem setar acredita que funciona, e quando o enforcement chegar o 404 será inexplicável na UI — por isso AC7 inclui exibir o estado.

**Acceptance Criteria**:

1. WHEN `expires_at` < agora THEN a página pública responde `notFound()` (mesmo comportamento de link revogado) — ANTES de qualquer fetch de dado da operação.
2. WHEN `expires_at` < agora THEN o download de anexo responde 404 — mesma validação na rota.
3. WHEN `expires_at IS NULL` THEN o link não expira (comportamento atual).
4. WHEN `expires_at` ≥ agora THEN o link funciona normalmente.
5. `getPublicLinkByToken` SHALL selecionar e retornar `expires_at` (hoje nem seleciona).
6. A comparação SHALL usar o relógio do servidor em UTC (timestamptz vs `new Date()`/`now()` — sem ambiguidade de timezone).
7. WHEN a listagem de links de admin renderiza um link com `expires_at` THEN ela SHALL mostrar o estado ("Expira em DD/MM" ou pill "Expirado") — o dado já chega mapeado em `PublicLinksSection` e é descartado hoje; sem isso o 404 do enforcement é inexplicável na UI (gate MAJOR-1).

**Independent Test**: setar `expires_at` no passado num link de teste via SQL; página → 404; download → 404; limpar `expires_at` → volta a funcionar.

---

### P1-D: Operação arquivada some do público ⭐ MVP (achado #20)

**User Story**: Como admin, quero que o link público morra junto com o offboarding (archive da operação), para o ex-cliente não continuar vendo o painel.

**Why P1**: Pós-offboarding o relatório fica vivo até alguém lembrar de revogar o link manualmente.

**Acceptance Criteria**:

1. WHEN a operação do link tem `archived_at NOT NULL` THEN a página pública responde `notFound()`.
2. WHEN a operação do link está arquivada THEN o download de anexo responde 404 (a rota valida também — não depende só da página).
3. WHEN a operação é desarquivada (restore) THEN o link volta a funcionar sem ação extra (o check é no resolve, não um estado persistido).
4. O check SHALL acontecer no ponto único de resolução do token: `getPublicLinkByToken` SHALL embedar a operação (`operations.archived_at` via FK) e tratar arquivada como link inválido (null/flag) — a MESMA chamada cobre página e rota de download, e garante que `touchPublicLinkAccess` só roda após link válido (gate MAJOR-2: sem essa AC, o caminho de menor diff checa `op.archivedAt` DEPOIS do `Promise.all`, violando a ordem do touch e duplicando o check na rota).

**Independent Test**: arquivar operação de teste → página e download 404; restaurar → 200.

---

## Edge Cases

- WHEN o link é revogado E expirado E a operação arquivada THEN 404 (qualquer condição basta; ordem de check irrelevante pro resultado).
- WHEN `touchPublicLinkAccess` roda pra um link expirado/arquivado THEN NÃO deve registrar acesso (o 404 vem antes do touch).
- WHEN um anexo `interno` é o único da operação THEN a seção de anexos do público mostra o empty state (não a seção vazia quebrada).
- WHEN um anexo de meeting `cliente` tem `visibility='interno'` THEN bloqueado (a regra composta é E, não OU).
- WHEN types são regenerados THEN `attachment_visibility` aparece em `src/lib/db/types.ts` e o código compila sem `any`.
- WHEN o RLS interno avalia anexos THEN NADA muda — `visibility` só controla a superfície pública; membros/admin continuam vendo tudo da operação (visibility ≠ permissão interna).

## Constraints

- Migration nova (timestamp UTC > `20260611040158`), idempotente, RLS intocado (coluna nova não muda policies), `COMMENT ON COLUMN` explicando a semântica pública. Rodar `gen:types` após (Types commitados).
- Server Actions seguem `ActionResult<T>` + guard de auth + Zod (convenções do repo).
- Toda query pública continua via `createAdmin` amarrada ao `link.operationId` do token (padrão B4 do checklist — não introduzir caminho novo).
- Issue no GitHub antes do PR; PR com `Closes #N`.
- Docs: `docs/DATABASE_SCHEMA.md` (coluna nova + migration) no mesmo branch.
- UI nova mínima: select de visibilidade no `AttachmentUploadForm` + pill na listagem interna — dentro do DS (pill canônica, sem variante nova).

## Success Criteria

- [ ] Fixture de 21+ tarefas cross-op prova que o relatório da operação certa mostra as tarefas certas (#3)
- [ ] Anexo interno invisível e não-baixável no público; cliente visível; meeting interna continua bloqueando (#6)
- [ ] Link expirado/operação arquivada → 404 em página E download; restore/des-expiração reverte (#7, #20)
- [ ] Checklist da auditoria: B3 (expiry) vira PASS; achados #3, #6, #20 fecham
- [ ] Zero regressão nos fluxos internos (upload, listagem, download autenticado)
