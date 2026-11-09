-- Reuniões: horário de término, responsável em próximo passo, vínculo tarefa↔reunião.
-- Riscos/bloqueios operacionais (fora do SLA Dryos) + auditoria em activity_events.

-- ── meetings.ended_at ──
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN public.meetings.ended_at IS
  'Horário de término da reunião (opcional). Deve ser >= scheduled_at.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_meetings_ended_after_start'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT chk_meetings_ended_after_start
      CHECK (ended_at IS NULL OR ended_at >= scheduled_at);
  END IF;
END $$;

-- ── meeting_agenda_next_steps.assignee_person_id ──
ALTER TABLE public.meeting_agenda_next_steps
  ADD COLUMN IF NOT EXISTS assignee_person_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_meeting_agenda_next_steps_assignee'
  ) THEN
    ALTER TABLE public.meeting_agenda_next_steps
      ADD CONSTRAINT fk_meeting_agenda_next_steps_assignee
        FOREIGN KEY (assignee_person_id) REFERENCES public.persons(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_next_steps_assignee
  ON public.meeting_agenda_next_steps (assignee_person_id)
  WHERE assignee_person_id IS NOT NULL;

COMMENT ON COLUMN public.meeting_agenda_next_steps.assignee_person_id IS
  'Responsável opcional (pessoa interna ou externa do cliente da operação).';

-- ── tasks.source_meeting_id ──
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_meeting_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_source_meeting_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_source_meeting_id
        FOREIGN KEY (source_meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_source_meeting
  ON public.tasks (source_meeting_id)
  WHERE source_meeting_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.source_meeting_id IS
  'Reunião de origem quando a tarefa nasceu de um próximo passo; link de volta na UI.';

-- Valida assignee de próximo passo: interno ou externo do cliente da operação.
CREATE OR REPLACE FUNCTION public.enforce_meeting_next_step_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_op_client uuid;
  v_person_kind public.person_kind;
  v_person_client uuid;
BEGIN
  IF NEW.assignee_person_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT o.client_id
  INTO STRICT v_op_client
  FROM public.meetings m
  JOIN public.operations o ON o.id = m.operation_id
  WHERE m.id = NEW.meeting_id;

  SELECT p.kind, p.client_id
  INTO v_person_kind, v_person_client
  FROM public.persons p
  WHERE p.id = NEW.assignee_person_id AND p.archived_at IS NULL;

  IF v_person_kind IS NULL THEN
    RAISE EXCEPTION 'responsável do próximo passo: pessoa não encontrada ou arquivada';
  END IF;
  IF v_person_kind = 'external' AND v_person_client IS DISTINCT FROM v_op_client THEN
    RAISE EXCEPTION 'responsável externo deve pertencer ao cliente da operação';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_next_step_assignee ON public.meeting_agenda_next_steps;
CREATE TRIGGER trg_meeting_next_step_assignee
  BEFORE INSERT OR UPDATE OF assignee_person_id, meeting_id ON public.meeting_agenda_next_steps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_meeting_next_step_assignee();

-- ── operation_risk_blockers ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_risk_kind') THEN
    CREATE TYPE public.operation_risk_kind AS ENUM ('risk', 'blocker');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_risk_severity') THEN
    CREATE TYPE public.operation_risk_severity AS ENUM ('low', 'medium', 'high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_risk_status') THEN
    CREATE TYPE public.operation_risk_status AS ENUM ('open', 'mitigated', 'resolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_risk_origin') THEN
    CREATE TYPE public.operation_risk_origin AS ENUM ('dryos', 'client', 'vendor');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operation_risk_blockers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id           uuid NOT NULL,
  title                  text NOT NULL,
  description            text,
  kind                   public.operation_risk_kind NOT NULL,
  severity               public.operation_risk_severity NOT NULL DEFAULT 'medium',
  status                 public.operation_risk_status NOT NULL DEFAULT 'open',
  origin                 public.operation_risk_origin NOT NULL DEFAULT 'dryos',
  responsible_person_id  uuid,
  meeting_id             uuid,
  decision_id            uuid,
  task_id                uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_risk_blockers_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_risk_blockers_responsible
    FOREIGN KEY (responsible_person_id) REFERENCES public.persons(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_risk_blockers_meeting
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_risk_blockers_decision
    FOREIGN KEY (decision_id) REFERENCES public.decisions(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_risk_blockers_task
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  CONSTRAINT chk_operation_risk_blockers_title
    CHECK (char_length(trim(title)) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_operation_risk_blockers_operation_status
  ON public.operation_risk_blockers (operation_id, status, updated_at DESC);

COMMENT ON TABLE public.operation_risk_blockers IS
  'operação: risco ou bloqueio de entrega (não é sla_incident — problema de fornecedor/cliente não conta no SLA Dryos).';

DROP TRIGGER IF EXISTS set_operation_risk_blockers_updated_at ON public.operation_risk_blockers;
CREATE TRIGGER set_operation_risk_blockers_updated_at
  BEFORE UPDATE ON public.operation_risk_blockers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_operation_risk_blocker_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_person_kind public.person_kind;
  v_person_client uuid;
BEGIN
  SELECT client_id INTO v_client FROM public.operations WHERE id = NEW.operation_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'operação inválida';
  END IF;

  IF NEW.meeting_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.meetings m WHERE m.id = NEW.meeting_id AND m.operation_id = NEW.operation_id
    ) THEN
      RAISE EXCEPTION 'reunião não pertence à operação';
    END IF;
  END IF;

  IF NEW.decision_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.decisions d WHERE d.id = NEW.decision_id AND d.operation_id = NEW.operation_id
    ) THEN
      RAISE EXCEPTION 'decisão não pertence à operação';
    END IF;
  END IF;

  IF NEW.task_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = NEW.task_id AND t.operation_id = NEW.operation_id
    ) THEN
      RAISE EXCEPTION 'tarefa não pertence à operação';
    END IF;
  END IF;

  IF NEW.responsible_person_id IS NOT NULL THEN
    SELECT p.kind, p.client_id INTO v_person_kind, v_person_client
    FROM public.persons p
    WHERE p.id = NEW.responsible_person_id AND p.archived_at IS NULL;
    IF v_person_kind IS NULL THEN
      RAISE EXCEPTION 'responsável: pessoa não encontrada ou arquivada';
    END IF;
    IF v_person_kind = 'external' AND v_person_client IS DISTINCT FROM v_client THEN
      RAISE EXCEPTION 'responsável externo deve pertencer ao cliente da operação';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operation_risk_blocker_links ON public.operation_risk_blockers;
CREATE TRIGGER trg_operation_risk_blocker_links
  BEFORE INSERT OR UPDATE ON public.operation_risk_blockers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operation_risk_blocker_links();

ALTER TABLE public.operation_risk_blockers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_risk_blockers_scoped_select ON public.operation_risk_blockers;
CREATE POLICY operation_risk_blockers_scoped_select ON public.operation_risk_blockers FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id)
         OR public.is_area_granted(operation_id));

DROP POLICY IF EXISTS operation_risk_blockers_scoped_insert ON public.operation_risk_blockers;
CREATE POLICY operation_risk_blockers_scoped_insert ON public.operation_risk_blockers FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_risk_blockers_scoped_update ON public.operation_risk_blockers;
CREATE POLICY operation_risk_blockers_scoped_update ON public.operation_risk_blockers FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_risk_blockers_scoped_delete ON public.operation_risk_blockers;
CREATE POLICY operation_risk_blockers_scoped_delete ON public.operation_risk_blockers FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));
