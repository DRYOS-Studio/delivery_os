-- operation-members cascade (issue #80, phase 2)
-- Indirect RLS: clients (via operations), persons (via allocations OR client), profiles (refined).

-- ─────────────────────────────────────────────────────────────────────────────
-- clients
-- Member vê cliente se tem operação visível desse cliente. Admin vê tudo.
-- Mutation: admin only.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS authenticated_full_access ON public.clients;

CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = clients.id
        AND public.can_see_operation(o.id)
    )
  );

CREATE POLICY clients_admin_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY clients_admin_update ON public.clients FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY clients_admin_delete ON public.clients FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- persons
-- Internal: visível se admin OU alocada em frente de op visível.
-- External: visível se admin OU cliente vinculado tem op visível.
-- Mutation: admin only.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS authenticated_full_access ON public.persons;

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
  );

CREATE POLICY persons_admin_insert ON public.persons FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY persons_admin_update ON public.persons FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY persons_admin_delete ON public.persons FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles (refined)
-- Member vê: si mesmo + colegas atribuídos a mesma operação. Admin vê todos.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_authenticated_select ON public.profiles;

CREATE POLICY profiles_scoped_select ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.operation_members om_self
      JOIN public.operation_members om_other USING (operation_id)
      WHERE om_self.profile_id = auth.uid()
        AND om_other.profile_id = profiles.id
    )
  );

-- profiles_admin_update já existe (não tocar)

-- ─────────────────────────────────────────────────────────────────────────────
-- diagnostics, briefing_versions, meeting_attendees, quick_win_impacts, sla_incidents
-- Catch-up: child tables que não estavam na Phase 1 mas seguem o mesmo padrão de gating.
-- ─────────────────────────────────────────────────────────────────────────────

-- diagnostics (via clients.id)
DROP POLICY IF EXISTS authenticated_full_access ON public.diagnostics;
DROP POLICY IF EXISTS diagnostics_authenticated_full ON public.diagnostics;
CREATE POLICY diagnostics_scoped_select ON public.diagnostics FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = diagnostics.client_id
        AND public.can_see_operation(o.id)
    )
  );
CREATE POLICY diagnostics_admin_insert ON public.diagnostics FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY diagnostics_admin_update ON public.diagnostics FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY diagnostics_admin_delete ON public.diagnostics FOR DELETE TO authenticated USING (public.is_admin());

-- briefing_versions (via briefings.operation_id)
DROP POLICY IF EXISTS authenticated_full_access ON public.briefing_versions;
DROP POLICY IF EXISTS briefing_versions_authenticated_full ON public.briefing_versions;
DROP POLICY IF EXISTS briefing_versions_authenticated_insert ON public.briefing_versions;
DROP POLICY IF EXISTS briefing_versions_authenticated_select ON public.briefing_versions;
CREATE POLICY briefing_versions_scoped_select ON public.briefing_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.briefings b
      WHERE b.id = briefing_versions.briefing_id
        AND public.can_see_operation(b.operation_id)
    )
  );
CREATE POLICY briefing_versions_scoped_insert ON public.briefing_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.briefings b
      WHERE b.id = briefing_id
        AND public.can_see_operation(b.operation_id)
    )
  );
CREATE POLICY briefing_versions_scoped_update ON public.briefing_versions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_versions.briefing_id AND public.can_see_operation(b.operation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND public.can_see_operation(b.operation_id)));
CREATE POLICY briefing_versions_scoped_delete ON public.briefing_versions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_versions.briefing_id AND public.can_see_operation(b.operation_id)));

-- meeting_attendees (via meetings.operation_id)
DROP POLICY IF EXISTS authenticated_full_access ON public.meeting_attendees;
DROP POLICY IF EXISTS meeting_attendees_authenticated_full ON public.meeting_attendees;
CREATE POLICY meeting_attendees_scoped_select ON public.meeting_attendees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_attendees.meeting_id AND public.can_see_operation(m.operation_id)));
CREATE POLICY meeting_attendees_scoped_insert ON public.meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)));
CREATE POLICY meeting_attendees_scoped_update ON public.meeting_attendees FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_attendees.meeting_id AND public.can_see_operation(m.operation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)));
CREATE POLICY meeting_attendees_scoped_delete ON public.meeting_attendees FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_attendees.meeting_id AND public.can_see_operation(m.operation_id)));

-- quick_win_impacts (via quick_wins.operation_id)
DROP POLICY IF EXISTS authenticated_full_access ON public.quick_win_impacts;
DROP POLICY IF EXISTS quick_win_impacts_authenticated_full ON public.quick_win_impacts;
CREATE POLICY quick_win_impacts_scoped_select ON public.quick_win_impacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quick_wins qw WHERE qw.id = quick_win_impacts.quick_win_id AND public.can_see_operation(qw.operation_id)));
CREATE POLICY quick_win_impacts_scoped_insert ON public.quick_win_impacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quick_wins qw WHERE qw.id = quick_win_id AND public.can_see_operation(qw.operation_id)));
CREATE POLICY quick_win_impacts_scoped_update ON public.quick_win_impacts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quick_wins qw WHERE qw.id = quick_win_impacts.quick_win_id AND public.can_see_operation(qw.operation_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quick_wins qw WHERE qw.id = quick_win_id AND public.can_see_operation(qw.operation_id)));
CREATE POLICY quick_win_impacts_scoped_delete ON public.quick_win_impacts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quick_wins qw WHERE qw.id = quick_win_impacts.quick_win_id AND public.can_see_operation(qw.operation_id)));

-- sla_incidents (operation_id direto)
DROP POLICY IF EXISTS authenticated_full_access ON public.sla_incidents;
DROP POLICY IF EXISTS sla_incidents_authenticated_full ON public.sla_incidents;
CREATE POLICY sla_incidents_scoped_select ON public.sla_incidents FOR SELECT TO authenticated USING (public.can_see_operation(operation_id));
CREATE POLICY sla_incidents_scoped_insert ON public.sla_incidents FOR INSERT TO authenticated WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY sla_incidents_scoped_update ON public.sla_incidents FOR UPDATE TO authenticated USING (public.can_see_operation(operation_id)) WITH CHECK (public.can_see_operation(operation_id));
CREATE POLICY sla_incidents_scoped_delete ON public.sla_incidents FOR DELETE TO authenticated USING (public.can_see_operation(operation_id));
