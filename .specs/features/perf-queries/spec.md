# Perf de Queries — Specification

> Tema 3 da auditoria `docs/audits/AUDIT-2026-06-11.md` — achados **#9, #10, #11, #12, #13, #14, #15** (todos medium/Perf).
> Issue GitHub: _a criar após aprovação deste spec_.

## Problem Statement

O app tem padrões de query que funcionam na escala atual (6 operações, 13 allocations) mas degradam linearmente ou pior com o crescimento: N+1 no dashboard (3 queries × K operações ativas, com scan da tabela inteira de allocations por chamada), scan org-wide a cada view do link público, 5 FKs quentes sem índice, `auth.getUser()` repetido 2-3× por render em toda página autenticada, e a página de Operação buscando as 9 tabs (19 queries) a cada troca de tab. Além disso, zero `loading.tsx`/`error.tsx`/`Suspense` — toda navegação bloqueia em branco e erro de query vira 500 default.

Nada aqui é vazamento ou exploração (o gate da auditoria rebaixou tudo de HIGH→medium por isso); é **custo que cresce** e UX de navegação. Corrigir agora, com o banco pequeno, custa pouco e evita reescrever sob pressão.

## Goals

- [ ] Dashboard: custo mensal total calculado em **número fixo de queries** (não proporcional a K operações), sem scan org-wide de allocations.
- [ ] Link público: nenhuma query sem filtro de operação server-side; waterfall de 4 ondas seriais reduzido a 2 (token → batch único).
- [ ] `getUser`/`getProfile` deduplicados por render via `React.cache()` — 1 chamada de rede de auth por request, não 2-3.
- [ ] Índices nos 5 FKs quentes (migration única).
- [ ] Página de Operação: `getProfile` dentro do batch; dados pesados buscados só para a tab ativa.
- [ ] `loading.tsx` + `error.tsx` nos dois route groups (`(app)` e `public/[token]`), `not-found.tsx` global + um próprio em `public/[token]`.
- [ ] **Mesmos dados, valores e regras de visibility**: mesmos números nos KPIs, mesmo conteúdo nas páginas. (UX de loading/erro muda de propósito — é a story P2; o que não muda é o DADO exibido.)

## Out of Scope

- Achados #16–#21 da auditoria (security headers, npm audit, cores DS, RLS de `operations`, paginação de `listTasks`) — temas separados.
- Lows de perf (`resolveEmails` ×4, `listProfiles` sequencial, Recharts estático na home, `areas.ts` 1 RPC por área) — registrados na auditoria, ficam para higiene futura.
- Índices FK "frios" do advisor (`created_by` etc.) — advisor os lista, mas nenhuma query real filtra por eles; índice não usado é custo de write.
- Cache de dados entre requests (`unstable_cache`/ISR) — fora do MVP; tudo aqui é dedup intra-request e shape de query.
- Virtualização/paginação de listas no client.

## Constraints

- **Sequenciamento: PR #130 (`feat/public-surface-fixes`) precisa estar mergeado antes deste branch nascer** — este tema edita `src/lib/db/queries/public-report.ts` e `src/app/public/[token]/page.tsx`, ambos modificados no #130.
- Migration de índices segue convenção do repo: idempotente (`CREATE INDEX IF NOT EXISTS`), timestamp UTC, aplicada via Supabase MCP.
- Next.js 16: ler `node_modules/next/dist/docs/` antes de usar `after()`, `loading.tsx` conventions e `Suspense` (AGENTS.md avisa de breaking changes).
- Refactors de query mantêm o padrão da casa: embed com FK hint nomeado, to-one unwrapped defensivamente (`T | T[] | null`), guard JS de defesa em profundidade mantido com comentário.

---

## User Stories

### P1: Dashboard sem N+1 ⭐ MVP

**User Story**: Como admin, quero que o dashboard carregue com custo de query constante, para que o tempo de load não cresça com o número de operações.

**Why P1**: É o achado #9 — o pior padrão do app (3 queries sequenciais × K ops, cada uma escaneando allocations inteira). Página de entrada de toda sessão.

**Acceptance Criteria**:

1. WHEN o dashboard calcula `monthlyCostsTotal` THEN o sistema SHALL executar um número de queries **independente de K** (operações ativas) — alvo: ≤3 queries para o bloco de custos — E com payload de request também constante: filtrar por "operação ativa" via join embedado (`operation.archived_at IS NULL`), **não** via `.in(activeOpIds)` (lista de K UUIDs na URL é proporcional a K e estoura query string com K grande).
2. WHEN a query de allocations do bloco de custos roda THEN ela SHALL filtrar server-side (`frentes!inner` + condição de operação ativa no embed), nunca trazendo allocations de operações arquivadas pro JS.
3. WHEN o refactor terminar THEN `monthlyCostsTotal` e `monthlyMarginTotal` SHALL retornar **exatamente os mesmos valores** que antes para o mesmo dado (verificado comparando antes/depois no banco real).
4. WHEN a página de Operação chama o breakdown de custos de UMA operação THEN a query de allocations SHALL filtrar por `operation_id` server-side (`frente.operation_id` no embed `!inner`), e o **breakdown completo** (adHocItems, allocations por pessoa, totais) SHALL ser idêntico antes/depois — é o dado da CostsTab, não só o `totalMonthly`.

**Independent Test**: Logar query count do bloco de custos (antes: 3×K+1 queries DB; depois: ≤3). Comparar JSON do `DashboardSummary` antes/depois — idêntico. Comparar JSON do `OperationCostBreakdown` de 1 operação com allocations antes/depois — idêntico.

---

### P1: Link público sem scan org-wide e sem waterfall ⭐ MVP

**User Story**: Como cliente com link público, quero que o relatório carregue rápido e que o servidor não pague custo proporcional ao org inteiro a cada view minha.

**Why P1**: Achados #10 e #11 — página mais visível externamente; `listPublicTeam` escaneia TODAS as allocations do org por view (admin client, sem RLS pra limitar).

**Acceptance Criteria**:

1. WHEN `listPublicTeam` roda THEN ela SHALL filtrar por `frente.operation_id` server-side via `!inner` (+ `frente.archived_at IS NULL` e janela de datas no servidor), retornando só rows da operação do token.
2. WHEN o refactor terminar THEN o time exibido SHALL conter o **mesmo conjunto** de pessoas (comparação order-insensitive por `personId` + `roleLabel` + `kind` — a dedup atual itera rows sem `ORDER BY`, então ordem nunca foi determinística e não é critério).
3. WHEN o resolver de token retorna um link válido THEN `touchPublicLinkAccess` SHALL ser agendado via `after()` (não-bloqueante) **somente após** o resolve bem-sucedido; WHEN o resolver retorna null (inválido/expirado/revogado/op arquivada) THEN o touch SHALL nunca ser agendado. Nota de contrato: `after()` executa mesmo se a página fizer `notFound()` DEPOIS do resolve (ex: op some entre resolver e batch — `after.md`: roda inclusive com notFound/redirect); essa janela residual é **aceita e documentada** — o invariante real é "link que o resolver negou nunca registra acesso".
4. WHEN `getReportContext` roda THEN `fetchOperationTiming` SHALL participar do `Promise.all` (sem onda serial própria).
5. WHEN o resultado de `fetchOperationTiming` for null (op sumiu entre resolver e batch) THEN o sistema SHALL continuar retornando `null` do contexto → 404 (comportamento atual preservado).

**Independent Test**: Fixture com allocations em 2 operações; view do link da op A não retorna rows da op B (verificável por log de query/shape). Página pública responde com 2 ondas de round-trip (token resolve → batch).

---

### P1: Índices FK quentes ⭐ MVP

**User Story**: Como sistema, quero índices nos FKs filtrados em queries reais, para que joins e filtros não degradem para seq scan quando as tabelas crescerem.

**Why P1**: Achado #13 — custo zero de implementar agora, caro de diagnosticar depois. Postgres não auto-indexa FK.

**Acceptance Criteria**:

1. WHEN a migration rodar THEN os índices SHALL existir em: `frentes.operation_id`, `allocations.frente_id`, `allocations.person_id`, `operations.client_id`, `persons.client_id`.
2. WHEN a migration re-rodar THEN ela SHALL ser no-op (`IF NOT EXISTS`).
3. WHEN o advisor `unindexed_foreign_keys` re-rodar THEN os 5 FKs quentes SHALL sumir da lista.

**Independent Test**: `get_advisors` antes/depois; `\di` nas 4 tabelas.

---

### P2: `React.cache` em getUser/getProfile

**User Story**: Como usuário autenticado, quero que cada render faça 1 chamada de auth, não 2-3, para reduzir latência de toda página do app.

**Why P2**: Achado #12 — ganho transversal (toda página autenticada: Sidebar + page chamam os helpers em paralelo), mudança pequena e cirúrgica. P2 só porque o ganho por página é menor que os P1.

**Acceptance Criteria**:

1. WHEN `getUser()` ou `getProfile()` for chamado N vezes no mesmo render de servidor THEN a chamada de rede (`auth.getUser()` / query `profiles`) SHALL executar 1 vez (dedup via `React.cache()`).
2. WHEN `getProfile()` roda THEN ela SHALL **reusar o `getUser()` cacheado** em vez de chamar `supabase.auth.getUser()` direto — sem isso, `requireUser()` + `getProfile()` (padrão em 5 pages + Sidebar) continuam sendo 2 entradas de cache distintas e 2 chamadas de rede.
3. WHEN requests diferentes chegam THEN cada um SHALL ter cache próprio (semântica per-request do `React.cache` — nunca vazar sessão entre usuários).

**Independent Test**: Contar chamadas a `auth.getUser` num render da página de Operação (antes ≥2, depois 1) via log/interceptação local. (Nota: `requireAdminAction` tem query inline própria e não passa por `getProfile` — fora do alcance desta story, sem AC vácuo sobre ela.)

---

### P2: Página de Operação — batch enxuto

**User Story**: Como membro, quero que trocar de tab na página de Operação não re-busque as 9 tabs inteiras, para que a navegação seja proporcional ao que estou vendo.

**Why P2**: Achado #14 — maior refactor do tema (a page é o hub do app). P2 porque exige reestruturação com risco de regressão nas 9 tabs; os P1 são ganho maior por esforço menor.

**Baseline real**: o `Promise.all` tem 19 entradas, mas `getBaseUrl` não é query DB e `getOperationMonthlyCosts` executa 3 queries internas → **~21 queries DB** por render, em toda troca de tab. Alvo numérico por tab é entregável do Design (matriz query→shell/tab), não deste spec.

**Acceptance Criteria**:

1. WHEN a page renderiza THEN `getProfile()` SHALL participar do batch `Promise.all` (não serial antes dele).
2. WHEN a tab ativa é X THEN as queries de **conteúdo de tab** das outras tabs SHALL não executar. A classificação shell vs tab é uma **matriz explícita no design.md** cobrindo as ~21 queries, com estas regras fixas: (a) shell = hero + counts das tabs + gates (`canWrite`, `showAreaTab`, `isAdmin`); (b) badges SHALL vir **sempre** de queries `head: true` do shell, em toda tab — nunca de `lista.length` (gate do design: listas com `limit 20` fazem o badge flip-flopar entre tabs; exceção única: badge de frentes via embed uncapped do `getOperation`). **Mudança de dado deliberada**: badge de eventos passa a mostrar o total real em vez do capped em 40; (c) **`costsBreakdown` é caso especial**: alimenta `margin` no hero (admin) E a tab custos — SHALL rodar **só quando `isAdmin`** (hoje roda pra todo mundo e o resultado é descartado pra member — corrigir é ganho, não regressão), e quando admin, roda inteiro no batch (mantém margin + count idênticos em qualquer tab); (d) os tab-links do `TabsNav` SHALL usar `prefetch={false}` — o prefetch full atual re-executa a page ~9× em background por visita e suprime o pending state do `useLinkStatus`.
3. WHEN qualquer tab renderiza THEN o conteúdo exibido SHALL ser idêntico ao atual (mesmos componentes, mesmos dados).
4. WHEN o usuário não tem acesso à tab (interno/custos) THEN as regras de gating atuais SHALL permanecer (normalizeTab + showAreaTab + isAdmin).

**Independent Test**: Log de queries por tab — tab "visao" não dispara `listIncidentsByOperation` etc.; counts das tabs corretos em todas; pra member, zero queries de custos; pra admin, margin idêntica em todas as tabs.

---

### P2: loading/error/not-found

**User Story**: Como qualquer usuário, quero feedback visual durante navegação e erro tratado com página digna, em vez de tela branca e 500 default.

**Why P2**: Achado #15 — UX transversal, esforço baixo, mas não altera custo de query.

**Acceptance Criteria**:

1. WHEN navegação para página de **detalhe sem searchParams** dentro de `(app)` está pendente THEN o sistema SHALL exibir `loading.tsx` (skeleton no padrão DS). Escopo restringido pelo gate do design: a regra dura é "nenhum `loading.tsx` ancestral de página dirigida por searchParams" — e as listas filtráveis (`?q=`, `?view=`, `?filter=`) são searchParams-driven igual às tabs; boundary nelas flasharia skeleton a cada filtro. Listas e dashboard mantêm o comportamento atual (conteúdo anterior visível durante a navegação). Limite adicional conhecido (doc do Next): na entrada no route group, o layout (`Sidebar` → `getProfile()`) bloqueia antes do fallback.
2. WHEN o usuário troca de tab via `?tab=` (página de Operação e relatório público) OU aplica filtro via searchParams em lista THEN o sistema SHALL **NÃO** flashar skeleton full-page a cada clique — feedback de tab pendente é pontual (`useLinkStatus` no `TabsNav`), nunca remount visual da página inteira.
3. WHEN navegação em `public/[token]` está pendente THEN o sistema SHALL exibir loading próprio (sem chrome interno do app), respeitando o AC2.
4. WHEN uma query lança erro em `(app)` THEN `error.tsx` do route group SHALL renderizar com mensagem genérica + retry — **sem ecoar `e.message`** (pode conter detalhe de infra). WHEN o erro vem do **layout** (queries do Sidebar) THEN um `error.tsx` **root** (`src/app/error.tsx`) SHALL capturá-lo — boundary de segmento não pega erro do próprio layout.
5. WHEN erro ocorre em `public/[token]` THEN o cliente externo SHALL ver página de erro neutra (sem stack, sem detalhe interno, sem chrome do app).
6. WHEN rota não existe em `(app)` THEN `not-found.tsx` global SHALL renderizar no padrão DS; WHEN `notFound()` dispara em `public/[token]` (token inválido/expirado/revogado) THEN um `not-found.tsx` **próprio do segmento público** SHALL renderizar — neutro, sem chrome interno (cliente externo nunca vê a 404 interna do app).

**Independent Test**: Throttle de rede → skeleton em soft nav entre páginas; clique de tab → SEM skeleton full-page; forçar throw numa query → error boundary sem detalhe interno; token inválido → 404 neutra pública.

---

## Edge Cases

- WHEN não há operação ativa (K=0) THEN o bloco de custos do dashboard SHALL retornar 0 (com filtro via join por `archived_at`, K=0 só significa resultado vazio — sem caso especial de `IN ()`).
- WHEN uma operação ativa não tem frentes/allocations THEN o total dela SHALL ser só `monthly_fixed_cost + ad hoc` (hoje já é; preservar).
- WHEN allocation aponta pra frente arquivada ou pessoa arquivada THEN ela SHALL continuar excluída do custo e do time público (filtros atuais preservados, server-side onde possível).
- WHEN `after()` do touch falhar (DB down pós-resposta) THEN a página já respondeu — falha SHALL ser silenciosa/logada, nunca 500 pro cliente.
- WHEN `React.cache` envolver função cujo resultado é um throw (ex: `redirect()` dentro de `require*`) THEN atenção: `React.cache` **memoiza erros/rejections** para os mesmos args no mesmo render — pro `redirect()` o re-throw cacheado é inócuo (mesmo redirect), mas só as funções de LEITURA (`getUser`/`getProfile`) recebem cache; `require*` ficam fora do wrapper e chamam as cacheadas.
- WHEN duas tabs compartilham dado (ex: meetings em "eventos" e count no shell) THEN o count SHALL vir de query `head: true` barata, não da lista completa.

---

## Success Criteria

- [ ] Bloco de custos do dashboard: queries fixas (≤3) independente de K, payload constante (sem `.in(K uuids)`); valores de KPI idênticos antes/depois (diff no banco real).
- [ ] Breakdown de custos single-op: JSON completo (`adHocItems`, `allocations`, totais) idêntico antes/depois — cobre a CostsTab, não só o dashboard.
- [ ] `listPublicTeam`: zero rows de outras operações trafegadas; mesmo **conjunto** de pessoas (order-insensitive).
- [ ] Página pública: 2 ondas de round-trip; `last_accessed_at` continua atualizando em acesso válido e nunca é tocado por link que o resolver negou.
- [ ] 5 índices criados; advisor limpo para esses FKs.
- [ ] 1 chamada `auth.getUser` por render (antes ≥2) — `getProfile` reusa `getUser` cacheado.
- [ ] Página de Operação: tab "visao" sem queries de incidents/quick-wins/attachments pesados; member sem queries de custos; todas as tabs renderizando idêntico; matriz query→shell/tab documentada no design.
- [ ] `loading.tsx`/`error.tsx` nos route groups + `not-found.tsx` global e público; troca de tab SEM flash de skeleton full-page; erro não ecoa detalhe interno.
- [ ] `tsc` limpo, lint limpo, `get_advisors` sem regressão de segurança.
