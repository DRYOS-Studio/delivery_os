-- PR1/M-C: amplia o SELECT das tabelas operation-scoped pra leitura por área
-- (can_read_operation = can_see_operation OR is_area_granted). Decisões/reuniões só
-- expõem visibility='cliente' à área (RT-B1). diagnostics/operation_costs/public_links/
-- attachments/profiles ficam inalteradas (área não vê). Escrita (WITH CHECK) intacta.
-- tasks/task_assignees/clients/persons/operations já foram tratadas na M-B.

-- ── Diretas (operation_id) — leitura ampliada via can_read_operation ─────────
DROP POLICY IF EXISTS frentes_scoped_select ON public.frentes;
CREATE POLICY frentes_scoped_select ON public.frentes FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS quick_wins_scoped_select ON public.quick_wins;
CREATE POLICY quick_wins_scoped_select ON public.quick_wins FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS operation_villains_scoped_select ON public.operation_villains;
CREATE POLICY operation_villains_scoped_select ON public.operation_villains FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS ovn_scoped_select ON public.operation_villain_narratives;
CREATE POLICY ovn_scoped_select ON public.operation_villain_narratives FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS sla_incidents_scoped_select ON public.sla_incidents;
CREATE POLICY sla_incidents_scoped_select ON public.sla_incidents FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS briefings_scoped_select ON public.briefings;
CREATE POLICY briefings_scoped_select ON public.briefings FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

-- ── Diretas com visibility (R+vis) — área só vê 'cliente' ────────────────────
DROP POLICY IF EXISTS decisions_scoped_select ON public.decisions;
CREATE POLICY decisions_scoped_select ON public.decisions FOR SELECT TO authenticated
  USING (
    public.can_see_operation(operation_id)
    OR (visibility = 'cliente' AND public.is_area_granted(operation_id))
  );

DROP POLICY IF EXISTS meetings_scoped_select ON public.meetings;
CREATE POLICY meetings_scoped_select ON public.meetings FOR SELECT TO authenticated
  USING (
    public.can_see_operation(operation_id)
    OR (visibility = 'cliente' AND public.is_area_granted(operation_id))
  );

-- ── Indiretas ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allocations_scoped_select ON public.allocations;
CREATE POLICY allocations_scoped_select ON public.allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.frentes f
    WHERE f.id = allocations.frente_id AND public.can_read_operation(f.operation_id)
  ));

DROP POLICY IF EXISTS briefing_versions_scoped_select ON public.briefing_versions;
CREATE POLICY briefing_versions_scoped_select ON public.briefing_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.briefings b
    WHERE b.id = briefing_versions.briefing_id AND public.can_read_operation(b.operation_id)
  ));

DROP POLICY IF EXISTS quick_win_impacts_scoped_select ON public.quick_win_impacts;
CREATE POLICY quick_win_impacts_scoped_select ON public.quick_win_impacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quick_wins qw
    WHERE qw.id = quick_win_impacts.quick_win_id AND public.can_read_operation(qw.operation_id)
  ));

-- meeting_attendees: espelha meetings COM o filtro de visibility (RT-M3).
DROP POLICY IF EXISTS meeting_attendees_scoped_select ON public.meeting_attendees;
CREATE POLICY meeting_attendees_scoped_select ON public.meeting_attendees FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_attendees.meeting_id
      AND (public.can_see_operation(m.operation_id)
           OR (m.visibility = 'cliente' AND public.is_area_granted(m.operation_id)))
  ));
