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

-- ── 4. Financeiro/compensação fora de tabelas legíveis por member (RLS admin) ─

CREATE TABLE IF NOT EXISTS public.operation_financials (
  operation_id uuid PRIMARY KEY,
  recurrence public.recurrence,
  monthly_recurring_revenue numeric(14, 2),
  monthly_fixed_cost numeric(14, 2),
  tax_rate_pct numeric(5, 2),
  notification_webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_financials_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.operation_financials IS
  'financeiro: MRR, recorrência, custo fixo, taxa e webhook legado — admin-only (RLS).';

CREATE TABLE IF NOT EXISTS public.person_compensation (
  person_id uuid PRIMARY KEY,
  hourly_rate numeric(10, 2),
  monthly_compensation numeric(12, 2),
  contracted_weekly_hours numeric(5, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_person_compensation_person
    FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.person_compensation IS
  'financeiro/pessoa: taxa e salário internos — admin-only (RLS).';

CREATE TABLE IF NOT EXISTS public.allocation_cost_metrics (
  allocation_id uuid PRIMARY KEY,
  weekly_hours numeric(5, 2),
  monthly_cost numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_allocation_cost_metrics_allocation
    FOREIGN KEY (allocation_id) REFERENCES public.allocations(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.allocation_cost_metrics IS
  'financeiro/alocação: horas e custo mensal materializado — admin-only (RLS).';

INSERT INTO public.operation_financials (
  operation_id, recurrence, monthly_recurring_revenue, monthly_fixed_cost,
  tax_rate_pct, notification_webhook_url
)
SELECT
  o.id, o.recurrence, o.monthly_recurring_revenue, o.monthly_fixed_cost,
  o.tax_rate_pct, o.notification_webhook_url
FROM public.operations o
ON CONFLICT (operation_id) DO UPDATE SET
  recurrence = EXCLUDED.recurrence,
  monthly_recurring_revenue = EXCLUDED.monthly_recurring_revenue,
  monthly_fixed_cost = EXCLUDED.monthly_fixed_cost,
  tax_rate_pct = EXCLUDED.tax_rate_pct,
  notification_webhook_url = EXCLUDED.notification_webhook_url;

INSERT INTO public.person_compensation (
  person_id, hourly_rate, monthly_compensation, contracted_weekly_hours
)
SELECT p.id, p.hourly_rate, p.monthly_compensation, p.contracted_weekly_hours
FROM public.persons p
WHERE p.hourly_rate IS NOT NULL
   OR p.monthly_compensation IS NOT NULL
   OR p.contracted_weekly_hours IS NOT NULL
ON CONFLICT (person_id) DO UPDATE SET
  hourly_rate = EXCLUDED.hourly_rate,
  monthly_compensation = EXCLUDED.monthly_compensation,
  contracted_weekly_hours = EXCLUDED.contracted_weekly_hours;

INSERT INTO public.allocation_cost_metrics (allocation_id, weekly_hours, monthly_cost)
SELECT a.id, a.weekly_hours, a.monthly_cost
FROM public.allocations a
WHERE a.weekly_hours IS NOT NULL OR a.monthly_cost IS NOT NULL
ON CONFLICT (allocation_id) DO UPDATE SET
  weekly_hours = EXCLUDED.weekly_hours,
  monthly_cost = EXCLUDED.monthly_cost;

ALTER TABLE public.operations DROP COLUMN IF EXISTS recurrence;
ALTER TABLE public.operations DROP COLUMN IF EXISTS monthly_recurring_revenue;
ALTER TABLE public.operations DROP COLUMN IF EXISTS monthly_fixed_cost;
ALTER TABLE public.operations DROP COLUMN IF EXISTS tax_rate_pct;
ALTER TABLE public.operations DROP COLUMN IF EXISTS notification_webhook_url;

ALTER TABLE public.persons DROP COLUMN IF EXISTS hourly_rate;
ALTER TABLE public.persons DROP COLUMN IF EXISTS monthly_compensation;
ALTER TABLE public.persons DROP COLUMN IF EXISTS contracted_weekly_hours;

ALTER TABLE public.allocations DROP COLUMN IF EXISTS weekly_hours;
ALTER TABLE public.allocations DROP COLUMN IF EXISTS monthly_cost;

DROP TRIGGER IF EXISTS trg_operations_guard_financial ON public.operations;
DROP FUNCTION IF EXISTS public.guard_operation_financial_write();
DROP TRIGGER IF EXISTS trg_persons_guard_compensation ON public.persons;
DROP FUNCTION IF EXISTS public.guard_person_compensation_write();

ALTER TABLE public.operation_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_cost_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY operation_financials_admin_all ON public.operation_financials
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY person_compensation_admin_all ON public.person_compensation
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY allocation_cost_metrics_admin_all ON public.allocation_cost_metrics
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_operation_financials_updated_at ON public.operation_financials;
CREATE TRIGGER trg_operation_financials_updated_at
  BEFORE UPDATE ON public.operation_financials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_person_compensation_updated_at ON public.person_compensation;
CREATE TRIGGER trg_person_compensation_updated_at
  BEFORE UPDATE ON public.person_compensation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_allocation_cost_metrics_updated_at ON public.allocation_cost_metrics;
CREATE TRIGGER trg_allocation_cost_metrics_updated_at
  BEFORE UPDATE ON public.allocation_cost_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
      WHERE lower(trim(qw.title)) = lower(trim(quick_win_catalog.title))
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
-- Pickers (catálogo completo id+nome): RPC security definer, não abre a tabela.
CREATE OR REPLACE FUNCTION public.catalog_picker_villains(p_operation_id uuid)
RETURNS TABLE (id uuid, name text, slug text, icon_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, v.slug, v.icon_name
  FROM public.villains v
  WHERE v.archived_at IS NULL
    AND (public.is_admin() OR public.can_see_operation(p_operation_id))
    AND NOT EXISTS (
      SELECT 1 FROM public.operation_villains ov
      WHERE ov.operation_id = p_operation_id AND ov.villain_id = v.id
    )
  ORDER BY v.display_order, v.name;
$$;

CREATE OR REPLACE FUNCTION public.catalog_picker_quick_wins(p_operation_id uuid)
RETURNS TABLE (id uuid, title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.title
  FROM public.quick_win_catalog q
  WHERE q.archived_at IS NULL
    AND (public.is_admin() OR public.can_see_operation(p_operation_id))
  ORDER BY q.title;
$$;

CREATE OR REPLACE FUNCTION public.catalog_picker_service_products(p_operation_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  default_cycle_type public.frente_cycle_type,
  catalog_group text,
  catalog_kind text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id, sp.name, sp.slug, sp.default_cycle_type,
    sp.catalog_group::text, sp.catalog_kind::text, sp.sort_order
  FROM public.service_products sp
  WHERE sp.archived_at IS NULL
    AND (public.is_admin() OR public.can_see_operation(p_operation_id))
  ORDER BY sp.sort_order, sp.name;
$$;

REVOKE EXECUTE ON FUNCTION public.catalog_picker_villains(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.catalog_picker_quick_wins(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.catalog_picker_service_products(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_picker_villains(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_picker_quick_wins(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_picker_service_products(uuid) TO authenticated, service_role;

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
  trim(f.notification_webhook_url),
  -100
FROM public.operations o
JOIN public.operation_financials f ON f.operation_id = o.id
WHERE f.notification_webhook_url IS NOT NULL
  AND char_length(trim(f.notification_webhook_url)) > 0
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
      SELECT trim(f.notification_webhook_url)
      FROM public.operation_financials f
      WHERE f.operation_id = p_operation_id
        AND f.notification_webhook_url IS NOT NULL
        AND char_length(trim(f.notification_webhook_url)) > 0
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_operation_notification_webhook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_operation_notification_webhook(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_operation_notification_webhook(uuid) IS
  'notificação: URL do webhook n8n — prioriza client_tech_items (category=n8n_webhook), fallback operation_financials.notification_webhook_url.';

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
