-- Hardening: área só com membership; catálogo/financeiro/cofre/webhook/link público.

-- ── 1. Escopo: área exige operation_members ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_area_granted(p_op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR (
      public.can_see_operation(p_op_id)
      AND EXISTS (
        SELECT 1 FROM public.profile_areas pa
        JOIN public.areas a ON a.id = pa.area_id AND a.archived_at IS NULL
        WHERE pa.profile_id = auth.uid()
          AND public.area_can_reach_operation(pa.area_id, p_op_id)
      )
    );
$$;

COMMENT ON FUNCTION public.is_area_granted(uuid) IS
  'auth/scope: admin OU membro da operação com concessão de área que alcança a operação.';

CREATE OR REPLACE FUNCTION public.can_read_operation(op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_see_operation(op_id) OR public.is_area_granted(op_id);
$$;

COMMENT ON FUNCTION public.can_read_operation(uuid) IS
  'auth/scope: leitura. Membro da operação OU área concedida na mesma operação. Não usar em WITH CHECK.';

CREATE OR REPLACE FUNCTION public.can_see_task(t_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = t_id
      AND (
        (t.area_id IS NULL AND public.can_read_operation(t.operation_id))
        OR (
          t.area_id IS NOT NULL
          AND (
            public.is_admin()
            OR (
              public.can_see_operation(t.operation_id)
              AND public.user_in_area(t.area_id)
              AND public.area_can_reach_operation(t.area_id, t.operation_id)
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS clients_scoped_select ON public.clients;
CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = clients.id
        AND public.can_see_operation(o.id)
    )
  );

DROP POLICY IF EXISTS persons_scoped_select ON public.persons;
CREATE POLICY persons_scoped_select ON public.persons FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      kind = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.allocations a
        JOIN public.frentes f ON f.id = a.frente_id
        WHERE a.person_id = persons.id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      kind = 'external'
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.operations o
        WHERE o.client_id = persons.client_id
          AND public.can_see_operation(o.id)
      )
    )
    OR (
      kind = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.task_assignees ta
        JOIN public.tasks t ON t.id = ta.task_id
        WHERE ta.person_id = persons.id
          AND t.area_id IS NOT NULL
          AND public.can_see_operation(t.operation_id)
          AND public.user_in_area(t.area_id)
          AND public.area_can_reach_operation(t.area_id, t.operation_id)
      )
    )
  );

-- ── 2. Cofre: só admin ou membro de operação ativa do cliente ────────────────

CREATE OR REPLACE FUNCTION public.can_access_client_vault(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = p_client_id
        AND o.archived_at IS NULL
        AND public.can_see_operation(o.id)
    );
$$;

COMMENT ON FUNCTION public.can_access_client_vault(uuid) IS
  'auth/scope: admin OU membro (operation_members) de operação ativa do cliente. Área isolada não concede cofre.';

-- ── 3. operation_costs: somente admin ────────────────────────────────────────

DROP POLICY IF EXISTS operation_costs_scoped_select ON public.operation_costs;
DROP POLICY IF EXISTS operation_costs_scoped_insert ON public.operation_costs;
DROP POLICY IF EXISTS operation_costs_scoped_update ON public.operation_costs;
DROP POLICY IF EXISTS operation_costs_scoped_delete ON public.operation_costs;

CREATE POLICY operation_costs_admin_select ON public.operation_costs
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY operation_costs_admin_insert ON public.operation_costs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY operation_costs_admin_update ON public.operation_costs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY operation_costs_admin_delete ON public.operation_costs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── 4. Campos financeiros da operação: escrita só admin ─────────────────────

CREATE OR REPLACE FUNCTION public.guard_operation_financial_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.monthly_recurring_revenue IS NOT NULL
       OR NEW.monthly_fixed_cost IS NOT NULL
       OR NEW.tax_rate_pct IS NOT NULL
       OR NEW.recurrence IS NOT NULL THEN
      RAISE EXCEPTION 'campos financeiros da operação são admin-only'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.monthly_recurring_revenue IS DISTINCT FROM OLD.monthly_recurring_revenue
     OR NEW.monthly_fixed_cost IS DISTINCT FROM OLD.monthly_fixed_cost
     OR NEW.tax_rate_pct IS DISTINCT FROM OLD.tax_rate_pct
     OR NEW.recurrence IS DISTINCT FROM OLD.recurrence THEN
    RAISE EXCEPTION 'campos financeiros da operação são admin-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operations_guard_financial ON public.operations;
CREATE TRIGGER trg_operations_guard_financial
  BEFORE INSERT OR UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.guard_operation_financial_write();

-- Pessoas: taxa/valores internos só admin altera
CREATE OR REPLACE FUNCTION public.guard_person_compensation_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.hourly_rate IS NOT NULL OR NEW.monthly_compensation IS NOT NULL THEN
      RAISE EXCEPTION 'compensação de pessoa é admin-only' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.monthly_compensation IS DISTINCT FROM OLD.monthly_compensation THEN
    RAISE EXCEPTION 'compensação de pessoa é admin-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_persons_guard_compensation ON public.persons;
CREATE TRIGGER trg_persons_guard_compensation
  BEFORE INSERT OR UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.guard_person_compensation_write();

-- ── 5. Catálogo admin-only; leitura derivada da operação ─────────────────────

DROP POLICY IF EXISTS qwc_authenticated_select ON public.quick_win_catalog;
CREATE POLICY qwc_admin_select ON public.quick_win_catalog
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY qwc_member_via_quick_win ON public.quick_win_catalog
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_wins qw
      WHERE qw.catalog_id = quick_win_catalog.id
        AND public.can_see_operation(qw.operation_id)
    )
  );

DROP POLICY IF EXISTS service_products_authenticated_select ON public.service_products;
CREATE POLICY service_products_admin_select ON public.service_products
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY service_products_member_via_frente ON public.service_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.frentes f
      WHERE f.product_id = service_products.id
        AND public.can_see_operation(f.operation_id)
    )
  );

DROP POLICY IF EXISTS villains_authenticated_select ON public.villains;
CREATE POLICY villains_admin_select ON public.villains
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY villains_member_via_operation ON public.villains
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operation_villains ov
      WHERE ov.villain_id = villains.id
        AND public.can_see_operation(ov.operation_id)
    )
  );
-- Picker de vilões na Operação (lista canônica; /catalog segue admin-only na app).
CREATE POLICY villains_member_operation_team ON public.villains
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operation_members om
      WHERE om.profile_id = auth.uid()
    )
  );

CREATE POLICY qwc_member_operation_team ON public.quick_win_catalog
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operation_members om
      WHERE om.profile_id = auth.uid()
    )
  );

CREATE POLICY service_products_member_operation_team ON public.service_products
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operation_members om
      WHERE om.profile_id = auth.uid()
    )
  );

-- ── 6. Link público: criar só admin ─────────────────────────────────────────

DROP POLICY IF EXISTS public_links_scoped_insert ON public.public_links;
CREATE POLICY public_links_admin_insert ON public.public_links
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ── 7. Webhook n8n → client_tech_items (stack) ────────────────────────────

ALTER TABLE public.client_tech_items
  ADD COLUMN IF NOT EXISTS operation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_tech_items_operation'
  ) THEN
    ALTER TABLE public.client_tech_items
      ADD CONSTRAINT fk_client_tech_items_operation
        FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_tech_items_operation
  ON public.client_tech_items (operation_id)
  WHERE operation_id IS NOT NULL;

COMMENT ON COLUMN public.client_tech_items.operation_id IS
  'Opcional: escopo por operação (ex.: webhook n8n category=n8n_webhook).';

INSERT INTO public.client_tech_items (
  client_id, operation_id, name, category, url, sort_order
)
SELECT
  o.client_id,
  o.id,
  'Webhook n8n',
  'n8n_webhook',
  trim(o.notification_webhook_url),
  -100
FROM public.operations o
WHERE o.notification_webhook_url IS NOT NULL
  AND char_length(trim(o.notification_webhook_url)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.client_tech_items t
    WHERE t.operation_id = o.id
      AND t.category = 'n8n_webhook'
  );

CREATE OR REPLACE FUNCTION public.resolve_operation_notification_webhook(p_operation_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT trim(t.url)
      FROM public.client_tech_items t
      WHERE t.operation_id = p_operation_id
        AND t.category = 'n8n_webhook'
        AND t.url IS NOT NULL
        AND char_length(trim(t.url)) > 0
      ORDER BY t.sort_order, t.created_at
      LIMIT 1
    ),
    (
      SELECT trim(o.notification_webhook_url)
      FROM public.operations o
      WHERE o.id = p_operation_id
        AND o.notification_webhook_url IS NOT NULL
        AND char_length(trim(o.notification_webhook_url)) > 0
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_operation_notification_webhook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_operation_notification_webhook(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_operation_notification_webhook(uuid) IS
  'notificação: URL do webhook n8n — prioriza client_tech_items (category=n8n_webhook), fallback operations.notification_webhook_url.';

-- Edição de stack com operation_id: admin ou membro da operação
DROP POLICY IF EXISTS client_tech_items_scoped_insert ON public.client_tech_items;
CREATE POLICY client_tech_items_scoped_insert ON public.client_tech_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      operation_id IS NOT NULL
      AND public.can_see_operation(operation_id)
    )
    OR (
      operation_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.operations o
        WHERE o.client_id = client_tech_items.client_id
          AND public.can_see_operation(o.id)
      )
    )
  );

NOTIFY pgrst, 'reload schema';
