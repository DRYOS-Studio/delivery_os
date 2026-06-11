-- RLS hardening (issue #127, audit AUDIT-2026-06-11 achados #1, #2, #8).
-- Spec/design: .specs/features/rls-hardening/. Ordem das seções: catálogos →
-- search_path → anon/rls_auto_enable → storage (storage por último: maior risco
-- de privilégio — abort parcial deixa o resto já endurecido, nunca o inverso).

-- ============================================================
-- 1. CATÁLOGOS: escrita admin-only (Inv. 06/12)
--    SELECT continua aberto a authenticated; DELETE sem policy = bloqueado
--    (archive-only via archived_at). Seeds rodam como postgres (owner,
--    isento de RLS) — intactos.
-- ============================================================

DROP POLICY IF EXISTS qwc_authenticated_full ON public.quick_win_catalog;
DROP POLICY IF EXISTS qwc_authenticated_select ON public.quick_win_catalog;
CREATE POLICY qwc_authenticated_select ON public.quick_win_catalog
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS qwc_admin_insert ON public.quick_win_catalog;
CREATE POLICY qwc_admin_insert ON public.quick_win_catalog
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS qwc_admin_update ON public.quick_win_catalog;
CREATE POLICY qwc_admin_update ON public.quick_win_catalog
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS service_products_authenticated_full ON public.service_products;
DROP POLICY IF EXISTS service_products_authenticated_select ON public.service_products;
CREATE POLICY service_products_authenticated_select ON public.service_products
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS service_products_admin_insert ON public.service_products;
CREATE POLICY service_products_admin_insert ON public.service_products
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS service_products_admin_update ON public.service_products;
CREATE POLICY service_products_admin_update ON public.service_products
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- villains: SELECT existente (villains_authenticated_select) fica; escrita vira admin.
DROP POLICY IF EXISTS villains_authenticated_insert ON public.villains;
DROP POLICY IF EXISTS villains_authenticated_update ON public.villains;
DROP POLICY IF EXISTS villains_admin_insert ON public.villains;
CREATE POLICY villains_admin_insert ON public.villains
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS villains_admin_update ON public.villains;
CREATE POLICY villains_admin_update ON public.villains
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 2. SEARCH_PATH fixo nas funções flagadas pelo advisor (checklist A9)
-- ============================================================

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.create_profile_for_new_user() SET search_path = public;
ALTER FUNCTION public.lock_operation_villain_initial_severity() SET search_path = public;
ALTER FUNCTION public.validate_quick_win_impact_sum() SET search_path = public;
ALTER FUNCTION public.sync_operation_villain_progress() SET search_path = public;
ALTER FUNCTION public.manage_task_completed_at() SET search_path = public;

-- ============================================================
-- 3. ANON: versionar rls_auto_enable, revokes, default privileges
-- ============================================================

-- Versiona a função do event trigger ensure_rls (existia só no banco vivo).
-- Corpo verbatim do banco — NÃO alterar: o filtro schema_name e o EXCEPTION
-- interno são o que mantém o auto-RLS (Inv. 12) seguro e não-abortivo.
-- search_path fica 'pg_catalog' (não 'public') — definição original.
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

-- Event trigger guardado: já existe em produção; em ambiente fresco cria; se o
-- papel não puder (insufficient_privilege), avisa sem abortar a migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    EXECUTE 'CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable()';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'ensure_rls event trigger não criado: insufficient_privilege (criar manualmente como superuser)';
END $$;

-- anon não executa helper SECURITY DEFINER via REST RPC (advisor
-- anon_security_definer_function_executable ×9).
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_see_operation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_operation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_area_granted(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_in_area(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.area_can_reach_operation(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_see_task(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;

-- Funções de trigger não precisam de EXECUTE do caller (trigger dispara com o
-- privilégio do dono do trigger). GOTCHA: revogar só de anon/authenticated é
-- no-op se PUBLIC mantém o grant implícito de criação — anon herda via PUBLIC.
-- Os helpers antigos já revogavam PUBLIC (20260526190001); estas duas nunca tiveram.
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Fecha a recorrência (validado empiricamente com função-probe no banco):
-- o EXECUTE de anon/authenticated em função nova vem do default BUILT-IN do
-- Postgres (PUBLIC=X), não de grant explícito. Entrada de default privileges
-- POR-SCHEMA não remove o built-in — só adiciona grants (nota da doc do PG) —
-- então `IN SCHEMA public REVOKE` é no-op pra isso; só a entrada GLOBAL
-- substitui o built-in. Resultado: função futura criada como postgres (o
-- caminho das migrations) nasce {postgres=X, service_role=X} — sem
-- PUBLIC/anon/authenticated. Helper de RLS novo precisa do GRANT EXECUTE TO
-- authenticated explícito (padrão que TODAS as migrations de helpers já seguem:
-- 20260526190001, 20260610140000/140001/140002/150001); função de trigger não
-- precisa de grant nenhum.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO service_role;

-- ============================================================
-- 4. STORAGE: policies escopadas por operação (Inv. 11/12)
--    Espelha o RLS da tabela attachments: can_see_operation (membro/admin),
--    NÃO can_read_operation (área não lê storage — AD-014). Path malformado
--    nega pra todos (ELSE false). CASE garante ordem regex→cast (o planner
--    pode reordenar AND — cast cru estouraria exceção por linha).
--    Sem policy UPDATE: substituir = delete + upload novo (move/copy
--    dessincronizariam attachments.storage_path).
-- ============================================================

DROP POLICY IF EXISTS storage_attachments_authenticated_read   ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_authenticated_delete ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_read   ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_insert ON storage.objects;
DROP POLICY IF EXISTS storage_attachments_scoped_delete ON storage.objects;

CREATE POLICY storage_attachments_scoped_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND CASE
      WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_see_operation(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_attachments_scoped_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND CASE
      WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_see_operation(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );

CREATE POLICY storage_attachments_scoped_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND CASE
      WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_see_operation(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );
