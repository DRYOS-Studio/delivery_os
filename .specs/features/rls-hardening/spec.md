# RLS Hardening Specification

> Origem: achados #1 (high), #2 (high) e #8 (medium) de `docs/audits/AUDIT-2026-06-11.md`.
> Tema: o RLS do banco está mais frouxo que a action layer — quem fala com a API do
> Supabase diretamente (JWT de membro + publishable key) bypassa os guards do app.
> Revisado pós-gate the-fool (2026-06-11): APPROVE-WITH-FIXES — 3 MAJOR + 7 MINOR incorporados.

## Problem Statement

As policies de `storage.objects` checam apenas `bucket_id='attachments'`, então qualquer
usuário autenticado lê, sobe ou deleta arquivos de QUALQUER operação via Storage API,
bypassando o RLS per-operation da tabela `attachments` (Inv. 11/12). Os catálogos
(`quick_win_catalog`, `service_products`) têm policy `ALL USING(true)` que permite a
qualquer membro DELETE real (quebra archive-only, Inv. 06), e `villains` aceita
INSERT/UPDATE irrestritos (membro pode reescrever o catálogo da marca). Além disso,
`create_profile_for_new_user` (SECURITY DEFINER) e 5 trigger functions não fixam
`search_path` — vetor clássico de escalação via schema hijack.

## Goals

- [ ] Storage: acesso a objetos do bucket `attachments` espelha o RLS da tabela `attachments` — gate por `public.can_see_operation(<operation_id do prefixo do path>)` (membro da operação ou admin). **Não** usar `can_read_operation` (que inclui concessão de área — a tabela `attachments` deliberadamente NÃO foi ampliada pra áreas, AD-014)
- [ ] Catálogos: escrita restrita a `is_admin()`; DELETE sem policy (bloqueado) nos 3 catálogos
- [ ] Todas as funções SECURITY DEFINER e trigger functions com `SET search_path` fixo
- [ ] `get_advisors(security)`: zero `rls_policy_always_true`, zero `function_search_path_mutable`, zero `anon_security_definer_function_executable`

**Residual aceito nos advisors** (não é critério de falha): `authenticated_security_definer_function_executable` ×7 — os 7 helpers de RLS, cujo GRANT a `authenticated` é necessário pras policies (gate Fase 2 corrigiu a contagem: eram 9 ao todo; as 2 funções de trigger — `create_profile_for_new_user`, `rls_auto_enable` — saem do residual via `REVOKE FROM authenticated`, seguro porque trigger executa independente de EXECUTE do caller) — e `auth_leaked_password_protection` (config de Auth, fora de escopo).

## Out of Scope

- Achados da superfície pública (#3 limit-before-filter, #6 visibility de anexos, #7 `expires_at`, #20 operação arquivada) — spec separado "superfície pública"
- Achados de performance (#9–#15) — spec separado "perf de queries"
- Security headers (#16), npm audit (#17), DS (#18), exposição de campos comerciais a áreas (#19)
- Mudança no comportamento da action layer (já é admin-gated corretamente; nada muda pra fluxos legítimos)
- Apertar o DELETE de anexos pra admin-only (tabela E storage) — ver decisão registrada em P1-A
- UI nova de qualquer tipo

---

## User Stories

### P1-A: Storage escopado por operação ⭐ MVP

**User Story**: Como admin da DRYOS, quero que arquivos de uma operação sejam acessíveis via Storage API apenas por quem pode ver aquela operação, para que um membro de uma operação não leia/delete arquivos de outra.

**Why P1**: Achado high #1 — exploração direta com credencial de membro; quebra Inv. 11/12.

**Decisão de escopo (gate the-fool, MAJOR-1):** as policies de storage **espelham a tabela** (`can_see_operation` — membro permitido em SELECT/INSERT/DELETE no próprio prefixo). Risco residual aceito e nomeado: membro pode deletar anexo da própria operação via API direta, enquanto a UI restringe delete a admin (`deleteAttachmentAction` é admin-gated). Apertar storage-DELETE pra admin-only quebraria silenciosamente o rollback best-effort do upload (`uploadAttachmentAction` remove o objeto recém-subido com o client RLS-bound do membro quando o INSERT na tabela falha — `attachments.ts:93-104`, com `.catch()` que engoliria a regressão). Fechar essa assimetria é fora de escopo deste spec.

**Acceptance Criteria**:

1. WHEN um membro da operação X chama a Storage API (SELECT/createSignedUrl/INSERT/DELETE) num path `X/<file>` THEN o sistema SHALL permitir (comportamento atual preservado).
2. WHEN um usuário autenticado que NÃO é membro da operação Y (nem admin) acessa objeto com prefixo `Y/` THEN o sistema SHALL negar, com observáveis **por comando**: SELECT → 0 rows; DELETE → 0 rows afetadas; INSERT → erro `42501` (WITH CHECK violation); Storage REST → 400/403/404 conforme endpoint.
3. WHEN um admin acessa qualquer prefixo THEN o sistema SHALL permitir.
4. WHEN o path do objeto não tem primeiro segmento UUID válido THEN a policy SHALL negar **sem exceção de cast** — parse guardado (regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` no segmento antes do `::uuid`, ou cast dentro de `CASE`). **Não copiar o snippet literal do achado #1 do audit** (`((storage.foldername(name))[1])::uuid` sem guard): policy SELECT avalia por linha — um único objeto malformado envenenaria todo list/read do bucket com erro de cast.
5. WHEN o link público gera signed URL de anexo (rota `/public/[token]/attachments/[aid]/download`, via service role) THEN o sistema SHALL continuar funcionando (service role bypassa RLS).
6. WHEN o fluxo autenticado de upload/download do app roda (action `createAttachment` com rollback de storage, rota `/api/attachments/[id]/download`) THEN o sistema SHALL continuar funcionando para membros da operação.
7. O sistema SHALL manter **nenhuma policy UPDATE** em `storage.objects` (status quo deliberado — `20260517174018:29` "substituir = delete + upload novo"); `move()`/`copy()` continuam bloqueados pra papéis não-service, evitando dessincronizar `attachments.storage_path` do nome do objeto.

**Independent Test**: via `execute_sql` simulando JWT (`set_config('request.jwt.claims', ...)` + `SET ROLE authenticated`) com um profile membro de apenas uma operação: SELECT em `storage.objects` do prefixo da outra operação retorna 0 rows; DELETE no prefixo alheio afeta 0 rows; INSERT no prefixo alheio falha com 42501; mesmos comandos no prefixo próprio passam. Depois, smoke test no app: upload + download de anexo numa operação como membro.

---

### P1-B: Catálogos com escrita admin-only ⭐ MVP

**User Story**: Como admin da DRYOS, quero que apenas admins consigam mutar os catálogos da marca (vilões, produtos, quick wins), para que um membro com JWT não delete/reescreva o universo da marca via PostgREST direto.

**Why P1**: Achado high #2 — quebra do Inv. 06 (archive-only) na camada que deveria garanti-lo (Inv. 12).

**Acceptance Criteria**:

1. WHEN um usuário `authenticated` não-admin tenta INSERT/UPDATE/DELETE em `quick_win_catalog`, `service_products` ou `villains` via PostgREST THEN o sistema SHALL negar (INSERT → 42501; UPDATE/DELETE → 0 rows).
2. WHEN um admin executa as actions existentes de catálogo (create/update/archive em `/catalog/*` e villains) THEN o sistema SHALL permitir (zero regressão na UI).
3. WHEN qualquer usuário autenticado lê os catálogos THEN o sistema SHALL permitir (SELECT continua aberto — catálogos são universo compartilhado; `rls_policy_always_true` não flagra SELECT USING(true), então isso é compatível com o goal de zerar o lint).
4. WHEN qualquer papel (incluindo admin) tenta DELETE via PostgREST THEN o sistema SHALL negar (ausência de policy DELETE; archive-only via `archived_at`).
5. WHEN migrations e seeds rodam THEN os INSERTs de seed SHALL continuar passando — eles executam como `postgres` (owner da tabela, isento de RLS): seeds de catálogo vivem dentro de migrations (`20260517200953`, `20260519160001`, `20260520170001`) e `supabase/seed/dev_demo.sql` roda via `db reset`. Service role não está envolvido nos seeds (premissa corrigida pelo gate).

**Independent Test**: via `execute_sql` simulando JWT de membro: `UPDATE villains SET name='x'` afeta 0 rows; `DELETE FROM service_products` afeta 0 rows; `INSERT INTO quick_win_catalog` falha com 42501. Como admin: UPDATE passa, DELETE continua 0 rows.

---

### P1-C: search_path fixo em funções ⭐ MVP

**User Story**: Como operador do sistema, quero que toda função SECURITY DEFINER e trigger function tenha `search_path` fixo, para eliminar o vetor de escalação por schema hijack e zerar os advisors.

**Why P1**: Achado #8 + checklist A9 FAIL; correção barata (1 `ALTER FUNCTION` por função), risco ~zero — gate verificou que os corpos das 6 funções qualificam schema (`public.profiles` etc.) ou só tocam `NEW`/`now()`.

**Acceptance Criteria**:

1. WHEN a migration roda THEN as 6 funções flagadas (`create_profile_for_new_user`, `set_updated_at`, `lock_operation_villain_initial_severity`, `validate_quick_win_impact_sum`, `sync_operation_villain_progress`, `manage_task_completed_at`) SHALL ter `proconfig` com `search_path` definido.
2. WHEN `get_advisors(security)` roda após a migration THEN o sistema SHALL retornar zero `function_search_path_mutable`.
3. WHEN os triggers disparam (criar usuário → profile; update em row com `updated_at`; quick win → progresso de vilão; task completada) THEN o sistema SHALL manter o comportamento atual.

**Independent Test**: query em `pg_proc.proconfig` pós-migration mostra `search_path` em todas; smoke: criar uma quick win com impacto e ver `progress_pct` sincronizar.

---

### P2: Revogar EXECUTE de `anon` nos helpers SECURITY DEFINER + fechar a recorrência

**User Story**: Como operador, quero que os 9 helpers SECURITY DEFINER flagados (`is_admin`, `can_see_operation`, `can_read_operation`, `is_area_granted`, `user_in_area`, `area_can_reach_operation`, `can_see_task`, `create_profile_for_new_user`, `rls_auto_enable`) não sejam executáveis por `anon` via REST RPC — e que função futura não reabra o furo.

**Why P2**: Advisor `anon_security_definer_function_executable` ×9; sem vazamento prático hoje (retornam false com `auth.uid()` NULL), mas é higiene barata no mesmo tema.

**Contexto do gate (MAJOR-3):** o leak NÃO vem de REVOKE faltante nas migrations — elas já fazem `REVOKE FROM PUBLIC; GRANT TO authenticated`. Vem dos **default privileges** do Supabase: `anon` recebe EXECUTE na criação de toda função (verificado: `has_function_privilege('anon', ...)` = true nas 17 funções do `public`). Um REVOKE one-shot resolve as 9 de hoje e a próxima `CREATE FUNCTION` reabre o advisor.

**Acceptance Criteria**:

1. WHEN `anon` chama `/rest/v1/rpc/<helper>` THEN o sistema SHALL retornar erro de permissão (nas 9 funções).
2. WHEN policies RLS avaliam os helpers para usuários `authenticated` THEN o sistema SHALL manter o comportamento atual (GRANT a `authenticated` preservado).
3. A migration SHALL incluir `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon` (e registrar a convenção na skill `dryos-conventions`: função nova nasce sem EXECUTE de anon; conceder explicitamente se um dia houver RPC pública).
4. WHEN a migration roda num ambiente onde `rls_auto_enable` **não existe** (a função vive só no banco de produção — não está em nenhuma migration; `db reset`/branch fresco não a têm) THEN a migration SHALL passar mesmo assim — REVOKEs guardados com `DO $$ ... IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL`.
5. WHEN `get_advisors(security)` roda THEN SHALL retornar zero `anon_security_definer_function_executable`.

**Drift flagrado (resolver no design):** `rls_auto_enable` existe só no banco vivo, fora do versionamento — decidir entre versionar a função numa migration ou dropá-la. Deixar como está torna a cadeia de migrations irreproduzível.

---

## Edge Cases

- WHEN existe objeto no Storage anterior à migration (1 anexo hoje, path UUID-prefixado verificado) THEN membros da operação dona SHALL continuar acessando após a mudança de policy.
- WHEN um path no bucket não casa `<uuid>/...` THEN a policy SHALL negar sem exceção (ver P1-A AC4 — guard é critério, não nice-to-have).
- WHEN um membro é removido da operação THEN **novas chamadas** à Storage API SHALL ser negadas imediatamente; signed URLs emitidas **antes** da remoção continuam válidas até o TTL (300s) — bypass por design do signing, aceito.
- WHEN `can_see_operation` é avaliada por linha em listagens do Storage THEN a performance SHALL ser aceitável no volume atual (função STABLE, EXISTS indexado); **re-checar quando o bucket passar de ~1k objetos** (threshold de re-avaliação registrado).
- WHEN a migration roda 2× (re-apply) THEN SHALL ser idempotente (DROP POLICY IF EXISTS + CREATE; ALTER FUNCTION idempotente; REVOKEs guardados — ver P2 AC4).
- WHEN um fluxo futuro (Edge Function, n8n) usar a publishable key THEN ele herda as policies apertadas — comportamento desejado, mas registrar no doc de payload do n8n que escrita exige service role ou membership.

## Constraints

- Migrations versionadas em `supabase/migrations/` (timestamp UTC > última), idempotentes **e reproduzíveis em ambiente fresco** (db reset/branch — nada pode referenciar objeto que só existe em produção sem guard).
- RLS via migration nunca pela UI (convenção do repo). Aplicar via Supabase MCP `apply_migration`; rodar `get_advisors` (security + performance) antes do PR.
- Nenhuma mudança de types (policies/ALTER FUNCTION não afetam `src/lib/db/types.ts`).
- Issue no GitHub antes do PR (convenção do repo); PR com `Closes #N`.
- **Zero mudança de código TypeScript esperada** — válido SOB a decisão de P1-A (storage DELETE espelha a tabela, membro permitido). Se o smoke test revelar fluxo do app que dependia do RLS frouxo, isso é bug a corrigir no fluxo, não razão pra afrouxar a policy.
- Atualizar `docs/DATABASE_SCHEMA.md` (data de última análise + nota das policies) e a skill `dryos-conventions` (convenção de default privileges, P2 AC3) no mesmo branch.

## Success Criteria

- [ ] Teste de bypass com JWT de membro falha nos 3 vetores (storage cross-op, catálogo write, DELETE catálogo) com os observáveis por comando de P1-A AC2 / P1-B AC1
- [ ] `get_advisors(security)`: zero `rls_policy_always_true`, zero `function_search_path_mutable`, zero `anon_security_definer_function_executable`; residuais aceitos documentados (ver Goals)
- [ ] Fluxos legítimos intactos: upload (com rollback) + download de anexo (app + link público), CRUD admin de catálogos, triggers de invariante (smoke)
- [ ] Migration passa em ambiente fresco (sem `rls_auto_enable`) e re-aplicada 2× sem erro
- [ ] Checklist da auditoria re-rodável: A3 e A9 viram PASS; D1 (policies) vira PASS
