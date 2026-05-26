-- operation-members core (issue #80)
-- Scope visibility by Operation. Member sees only operations they were assigned to;
-- admin bypasses (sees everything). Cascades to all child tables via helper functions.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table: operation_members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operation_members (
  profile_id   uuid NOT NULL,
  operation_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  CONSTRAINT pk_operation_members PRIMARY KEY (profile_id, operation_id),
  CONSTRAINT fk_operation_members_profile
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_members_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_members_created_by
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_members_operation_id
  ON public.operation_members(operation_id);

COMMENT ON TABLE public.operation_members IS
  'auth/scope: vincula profile (member) a operação que ele pode ver. Admin vê tudo sem precisar de row aqui. INSERT/DELETE só por admin.';

ALTER TABLE public.operation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS om_admin_all ON public.operation_members;
DROP POLICY IF EXISTS om_member_select_self ON public.operation_members;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_see_operation(op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.operation_members
    WHERE profile_id = auth.uid() AND operation_id = op_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_operation(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_see_operation(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'auth/scope: true se o user logado tem profiles.role=admin. STABLE SECURITY DEFINER.';
COMMENT ON FUNCTION public.can_see_operation(uuid) IS
  'auth/scope: true se admin OU member com row em operation_members pra essa op. Base de toda RLS de visibilidade por Operação.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. operation_members policies (depend on is_admin)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY om_admin_all ON public.operation_members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY om_member_select_self ON public.operation_members
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS rewrite: tabelas DIRETAS (com operation_id) + allocations/tasks (via frente)
-- ─────────────────────────────────────────────────────────────────────────────

-- operations (próprio id)
DROP POLICY IF EXISTS authenticated_full_access ON public.operations;
CREATE POLICY operations_scoped_select ON public.operations FOR SELECT TO authenticated
  USING (public.can_see_operation(id));
CREATE POLICY operations_scoped_insert ON public.operations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY operations_scoped_update ON public.operations FOR UPDATE TO authenticated
  USING (public.can_see_operation(id))
  WITH CHECK (public.can_see_operation(id));
CREATE POLICY operations_scoped_delete ON public.operations FOR DELETE TO authenticated
  USING (public.is_admin());

-- frentes
DROP POLICY IF EXISTS authenticated_full_access ON public.frentes;
CREATE POLICY frentes_scoped_select ON public.frentes FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY frentes_scoped_insert ON public.frentes FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY frentes_scoped_update ON public.frentes FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY frentes_scoped_delete ON public.frentes FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- briefings
DROP POLICY IF EXISTS briefings_authenticated_full ON public.briefings;
CREATE POLICY briefings_scoped_select ON public.briefings FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY briefings_scoped_insert ON public.briefings FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY briefings_scoped_update ON public.briefings FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY briefings_scoped_delete ON public.briefings FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- meetings
DROP POLICY IF EXISTS meetings_authenticated_full ON public.meetings;
CREATE POLICY meetings_scoped_select ON public.meetings FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY meetings_scoped_insert ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY meetings_scoped_update ON public.meetings FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY meetings_scoped_delete ON public.meetings FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- decisions
DROP POLICY IF EXISTS decisions_authenticated_full ON public.decisions;
CREATE POLICY decisions_scoped_select ON public.decisions FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY decisions_scoped_insert ON public.decisions FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY decisions_scoped_update ON public.decisions FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY decisions_scoped_delete ON public.decisions FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- attachments
DROP POLICY IF EXISTS attachments_authenticated_full ON public.attachments;
CREATE POLICY attachments_scoped_select ON public.attachments FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY attachments_scoped_insert ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY attachments_scoped_update ON public.attachments FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY attachments_scoped_delete ON public.attachments FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- operation_villains
DROP POLICY IF EXISTS operation_villains_authenticated_full ON public.operation_villains;
CREATE POLICY operation_villains_scoped_select ON public.operation_villains FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY operation_villains_scoped_insert ON public.operation_villains FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY operation_villains_scoped_update ON public.operation_villains FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY operation_villains_scoped_delete ON public.operation_villains FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- operation_villain_narratives
DROP POLICY IF EXISTS ovn_authenticated_full ON public.operation_villain_narratives;
CREATE POLICY ovn_scoped_select ON public.operation_villain_narratives FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY ovn_scoped_insert ON public.operation_villain_narratives FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY ovn_scoped_update ON public.operation_villain_narratives FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY ovn_scoped_delete ON public.operation_villain_narratives FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- quick_wins
DROP POLICY IF EXISTS quick_wins_authenticated_full ON public.quick_wins;
CREATE POLICY quick_wins_scoped_select ON public.quick_wins FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY quick_wins_scoped_insert ON public.quick_wins FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY quick_wins_scoped_update ON public.quick_wins FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY quick_wins_scoped_delete ON public.quick_wins FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- operation_costs
DROP POLICY IF EXISTS operation_costs_authenticated_full ON public.operation_costs;
CREATE POLICY operation_costs_scoped_select ON public.operation_costs FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY operation_costs_scoped_insert ON public.operation_costs FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY operation_costs_scoped_update ON public.operation_costs FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY operation_costs_scoped_delete ON public.operation_costs FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- public_links
DROP POLICY IF EXISTS public_links_authenticated_full ON public.public_links;
CREATE POLICY public_links_scoped_select ON public.public_links FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));
CREATE POLICY public_links_scoped_insert ON public.public_links FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY public_links_scoped_update ON public.public_links FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY public_links_scoped_delete ON public.public_links FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- allocations (via frente.operation_id)
DROP POLICY IF EXISTS authenticated_full_access ON public.allocations;
CREATE POLICY allocations_scoped_select ON public.allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = allocations.frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY allocations_scoped_insert ON public.allocations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY allocations_scoped_update ON public.allocations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = allocations.frente_id AND public.can_see_operation(f.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY allocations_scoped_delete ON public.allocations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = allocations.frente_id AND public.can_see_operation(f.operation_id)
  ));

-- tasks (via frente.operation_id)
DROP POLICY IF EXISTS tasks_authenticated_full ON public.tasks;
CREATE POLICY tasks_scoped_select ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = tasks.frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY tasks_scoped_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY tasks_scoped_update ON public.tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = tasks.frente_id AND public.can_see_operation(f.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = frente_id AND public.can_see_operation(f.operation_id)
  ));
CREATE POLICY tasks_scoped_delete ON public.tasks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = tasks.frente_id AND public.can_see_operation(f.operation_id)
  ));
