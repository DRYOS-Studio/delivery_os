# RLS Hardening — Design

> Spec: `./spec.md` (aprovado pós-gate the-fool). Issue: #127.
> Entregável: **1 migration SQL** + 2 updates de doc. Zero TypeScript.

## Overview

Uma migration única `supabase/migrations/20260611<HHMMSS>_rls_hardening.sql` com 4 seções
independentes e idempotentes, aplicada via MCP `apply_migration`:

1. **Storage** — policies de `storage.objects` escopadas por operação
2. **Catálogos** — escrita admin-only em `quick_win_catalog`, `service_products`, `villains`
3. **search_path** — `ALTER FUNCTION ... SET search_path` nas 6 funções flagadas
4. **anon + default privileges** — versionar `rls_auto_enable`/`ensure_rls`, revogar EXECUTE de `anon` nos 9 helpers, fechar recorrência via `ALTER DEFAULT PRIVILEGES`

## Decisões de arquitetura (ADR — vira AD-015 no STATE.md)

**D1 — Storage espelha `can_see_operation`, não `can_read_operation`.**
A tabela `attachments` deliberadamente não foi ampliada pra concessão de área (AD-014);
storage segue a tabela. `can_read_operation` daria a leitores de área acesso raw a arquivos
que o RLS da tabela nega.

**D2 — Parse do prefixo via expressão `CASE` inline, deny-all em path malformado.**
```sql
CASE
  WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN public.can_see_operation(((storage.foldername(name))[1])::uuid)
  ELSE false
END
```
Por quê `CASE` e não `AND` encadeado: o planner do Postgres pode reordenar conjuntos de
`AND` por custo — o cast cru poderia rodar antes do regex e estourar exceção por linha
(o snippet literal do audit #1 tem esse bug latente). `CASE` garante a ordem. `ELSE false`
nega objetos malformados pra todos os papéis (em vez de `can_see_operation(NULL)`, que
deixaria admin ver — deny-all é mais simples de testar e mais correto: objeto malformado
é anomalia, não dado). Sem helper function nova — expressão inline nas 3 policies; se um
dia precisar de mais buckets, aí sim extrair `storage_operation_id(text)`.

**D3 — DELETE de storage permanece `can_see_operation` (membro permitido).**
Decisão do spec (gate MAJOR-1): espelha a tabela; apertar pra admin-only quebraria o
rollback de upload (`uploadAttachmentAction` deleta com client RLS-bound do membro).
Risco residual aceito e registrado.

**D4 — Sem policy UPDATE em `storage.objects`.**
Status quo deliberado (`20260517174018:29`): substituir = delete + upload novo. `move()`/
`copy()` continuam bloqueados — protege a sincronia `attachments.storage_path` ↔ objeto.

**D5 — Catálogos: SELECT aberto, INSERT/UPDATE `is_admin()`, DELETE sem policy.**
Espelha `villains` (que já não tinha DELETE) nos 3. Actions de admin usam `createServer`
(JWT do admin) → `is_admin()` true → zero regressão. Seeds rodam como `postgres`
(owner, RLS-exempt) → intactos.

**D6 — Versionar `rls_auto_enable` + `ensure_rls`, não dropar.**
O event trigger auto-habilita RLS em toda `CREATE TABLE` do `public` — é o enforcement
automático do Inv. 12, vale manter. `CREATE OR REPLACE FUNCTION` com a definição viva
**byte-exata** (gate Fase 2, MAJOR-2: qualquer drift — filtro `schema_name IN ('public')`,
o `EXCEPTION WHEN OTHERS` interno, ou trocar o `search_path` pra `public` copiando o padrão
D8 — desabilita o auto-RLS silenciosamente, sem sinal de advisor; manter
`SET search_path TO 'pg_catalog'`; corpo canônico verbatim no apêndice abaixo) +
`CREATE EVENT TRIGGER` guardado por
`IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname='ensure_rls')` dentro de
`DO $$`, com `EXCEPTION WHEN insufficient_privilege` → `RAISE WARNING` (não aborta): em
ambiente onde o papel da migration não puder criar event trigger, a migration passa e o
warning documenta. Depois de versionada, o `REVOKE ... FROM anon` nela não precisa de guard.

**D7 — Recorrência do anon fechada no default ACL do `postgres`.**
`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;`
rodando como `postgres` altera o default ACL de quem cria as funções via migration
(verificado em `pg_default_acl`: o grant de anon vem de `postgres=...` defaults). Defaults
do `supabase_admin` (objetos de plataforma) ficam intactos — intencional. Convenção
registrada na skill `dryos-conventions`: função nova nasce sem EXECUTE de `anon`; conceder
explicitamente apenas se houver RPC pública deliberada.

**D9 — Revogar EXECUTE de `authenticated` nas 2 funções de trigger (gate Fase 2, MINOR-3).**
`create_profile_for_new_user` (trigger em `auth.users`, dispara como `supabase_auth_admin`)
e `rls_auto_enable` (event trigger) nunca são chamadas por policy de RLS nem por código do
app — trigger executa independente de privilégio EXECUTE do caller. `REVOKE EXECUTE FROM
authenticated` nelas derruba o residual `authenticated_security_definer_function_executable`
de 9 pra 7 sem risco ao fluxo de signup. Os 7 helpers de RLS mantêm o GRANT (necessário
pras policies).

**D10 — Ordem das seções: storage por último.**
Gate Fase 2 (assunção de risco #3): se `apply_migration` não embrulhar tudo numa transação
única, falha no meio deixaria estado parcial — com storage (a seção de maior risco de
privilégio, ver D11) por último, um abort parcial deixa catálogos/search_path/anon já
endurecidos e storage no estado antigo (conhecido), nunca o inverso.

**D11 — Probe de privilégio em `storage.objects` antes da migration (gate Fase 2, MAJOR-1).**
`storage.objects` é owned por `supabase_storage_admin`; `postgres` não é owner/membro/super
(verificado). A migration original de policies passou pelo mesmo caminho (evidência de que
funciona), mas antes de aplicar: probe via `execute_sql` —
`CREATE POLICY _probe ON storage.objects FOR SELECT TO authenticated USING (false); DROP POLICY _probe ON storage.objects;`.
Se 42501: o check de idempotência da seção storage roda via segundo `apply_migration`
(não `execute_sql`), e documentar que policies de storage só são gerenciáveis por esse caminho.

**D8 — `SET search_path = public` nas 6 funções.**
Consistente com os helpers existentes. Corpos verificados pelo gate: schema-qualificados
ou só `NEW`/`now()` — mudança é behavior-safe. `ALTER FUNCTION` sem guard: as 6 nascem em
migrations versionadas, existem em qualquer ambiente.

## Estrutura da migration

Ordem real no arquivo (D10): **catálogos → search_path → anon → storage**. Numeração
abaixo mantida por legibilidade temática.

```sql
-- ============================================================
-- 1. STORAGE: policies escopadas por operação (audit #1, Inv. 11/12)
--    [ÚLTIMA seção no arquivo — D10]
-- ============================================================
DROP POLICY IF EXISTS storage_attachments_authenticated_read   ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_authenticated_delete ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_read   ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_delete ON storage.objects;

CREATE POLICY storage_attachments_scoped_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND <CASE-expr D2>);
CREATE POLICY storage_attachments_scoped_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND <CASE-expr D2>);
CREATE POLICY storage_attachments_scoped_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND <CASE-expr D2>);
-- Sem UPDATE (D4).

-- ============================================================
-- 2. CATÁLOGOS: escrita admin-only (audit #2, Inv. 06/12)
-- ============================================================
-- quick_win_catalog: ALL→(SELECT true | INSERT/UPDATE is_admin | sem DELETE)
DROP POLICY IF EXISTS qwc_authenticated_full ON public.quick_win_catalog;
DROP POLICY IF EXISTS qwc_authenticated_select ON public.quick_win_catalog;  -- re-runs
CREATE POLICY qwc_authenticated_select ON public.quick_win_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS qwc_admin_insert ON public.quick_win_catalog;
CREATE POLICY qwc_admin_insert ON public.quick_win_catalog FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS qwc_admin_update ON public.quick_win_catalog;
CREATE POLICY qwc_admin_update ON public.quick_win_catalog FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- service_products: idem (drop service_products_authenticated_full → 3 policies)
-- villains: mantém villains_authenticated_select; drop INSERT/UPDATE true → is_admin()

-- ============================================================
-- 3. SEARCH_PATH: 6 funções (audit #8, checklist A9)
-- ============================================================
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.create_profile_for_new_user() SET search_path = public;
ALTER FUNCTION public.lock_operation_villain_initial_severity() SET search_path = public;
ALTER FUNCTION public.validate_quick_win_impact_sum() SET search_path = public;
ALTER FUNCTION public.sync_operation_villain_progress() SET search_path = public;
ALTER FUNCTION public.manage_task_completed_at() SET search_path = public;

-- ============================================================
-- 4. ANON: versionar rls_auto_enable, revokes, default privileges
-- ============================================================
CREATE OR REPLACE FUNCTION public.rls_auto_enable() ... (definição viva, verbatim);
DO $$ ... CREATE EVENT TRIGGER ensure_rls (guardado, D6) ... $$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
-- ... (9 funções, assinaturas confirmadas no banco vivo:
--  is_admin(), can_see_operation(uuid), can_read_operation(uuid), is_area_granted(uuid),
--  user_in_area(uuid), area_can_reach_operation(uuid,uuid), can_see_task(uuid),
--  create_profile_for_new_user(), rls_auto_enable())
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM authenticated; -- D9
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;             -- D9
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
```

### Apêndice — corpo canônico de `rls_auto_enable` (verbatim do banco vivo, D6)

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
```

## Fluxos afetados (matriz de regressão)

| Fluxo | Client | Pós-migration |
|---|---|---|
| Upload anexo (action) | `createServer` (membro) | OK — INSERT no próprio prefixo passa WITH CHECK |
| Rollback de upload | `createServer` (membro) | OK — DELETE no próprio prefixo (D3) |
| Download app (`/api/attachments/[id]/download`) | `createServer` → signed URL | OK — SELECT do membro no próprio prefixo |
| Download público (`/public/[token]/.../download`) | `createAdmin` (service role) | OK — bypassa RLS |
| CRUD admin catálogos (`/catalog/*`, villains) | `createServer` (admin) | OK — `is_admin()` true |
| Membro lê catálogos (forms, selects) | `createServer` | OK — SELECT aberto |
| Seeds / `db reset` | `postgres` owner | OK — RLS-exempt; event trigger guardado |
| Signup → profile (trigger auth) | `supabase_auth_admin` | OK — trigger function inalterada além do search_path |
| Cron notificações | `createAdmin` | OK — bypassa RLS |

## Plano de validação (Fase 4)

0. **Probe de privilégio (D11):** `CREATE POLICY _probe ON storage.objects ... ; DROP POLICY _probe ...` via `execute_sql`. Decide o caminho do passo 2.
1. **Pré:** snapshot `pg_policies` (storage + 3 catálogos) e `proconfig`/`proacl` das funções.
2. Aplicar migration via MCP `apply_migration`; idempotência: re-aplicar via `execute_sql` se o probe passou, senão via segundo `apply_migration`.
3. **Bypass tests** via `execute_sql` (transação com `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', '{"sub":"<uuid do member>","role":"authenticated"}', true)`):
   - storage SELECT cross-op → 0 rows; DELETE cross-op → 0 rows; INSERT cross-op → 42501; mesmos no próprio prefixo → passam (INSERT em `storage.objects` direto via SQL simula o WITH CHECK).
   - catálogos: UPDATE/DELETE → 0 rows; INSERT → 42501 (membro); UPDATE passa / DELETE 0 rows (admin).
   - path malformado: inserir row de teste em `storage.objects` como postgres com `name='garbage/x.txt'` (nota do gate: postgres tem BYPASSRLS — o seed bypassa a policy por design, não testa WITH CHECK; antes, confirmar que nenhum trigger BEFORE INSERT de `storage.objects` reescreve `name`) → SELECT como membro E como admin retorna 0 rows, sem erro de cast; remover row de teste. Casos de borda já verificados pelo gate: `foldername('file.txt')`→`[]` (NULL→deny), `'/a/b'`→`['','a']` (deny), `'X/../Y/f'`→`[1]='X'` (sem traversal).
4. **Advisors:** `get_advisors(security)` → zero nos 3 lints-alvo; `get_advisors(performance)` sem regressão nova.
5. **Smoke app (Vercel preview/prod):** upload + download de anexo como membro; editar item de catálogo como admin; criar quick win com impacto (trigger `sync_operation_villain_progress`).
6. `proconfig` das 6 funções mostra `search_path=public`; `has_function_privilege('anon', fn, 'EXECUTE')` = false nas 9; `has_function_privilege('authenticated', ...)` = false nas 2 do D9; residual `authenticated_security_definer_function_executable` = 7 (só os helpers de RLS).

> Nota de citação (gate MINOR-4): a migration original de storage é o arquivo
> `20260517174018_attachments.sql`, mas o banco registra a versão aplicada como
> `20260517174054` — drift arquivo×registro pré-existente, sem impacto (drops são por nome).

## Riscos e mitigações

- **Planner reordenando boolean** → `CASE` (D2), não `AND`.
- **Event trigger sem privilégio em algum ambiente** → `DO` + `EXCEPTION insufficient_privilege` com WARNING (D6); a seção 4 nunca aborta a migration.
- **`storage.foldername` indisponível** em ambiente sem extensão de storage (CLI local sem stack completo) — risco teórico; o projeto não usa stack local (AD-007, tudo via remoto/MCP). Aceito.
- **Objeto legado órfão** — 1 objeto hoje, UUID-prefixado (verificado). Nenhum backfill necessário.
- **Performance por linha no list do Storage** — bucket com 1 objeto; threshold de re-check: ~1k objetos (spec).

## Docs no mesmo branch

- `docs/DATABASE_SCHEMA.md`: nota na seção de anexos (policies de storage escopadas) + data.
- `.claude/skills/dryos-conventions/SKILL.md`: convenção D7 (default privileges / anon).
- `.specs/project/STATE.md`: AD-015 (este ADR) + estado da feature.
