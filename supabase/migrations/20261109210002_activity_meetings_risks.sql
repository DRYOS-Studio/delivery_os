-- activity_events: assuntos meeting, decision, operation_risk_blocker + triggers.

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'decision';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'operation_risk_blocker';

CREATE OR REPLACE FUNCTION public.can_read_activity_subject(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_subject_type
    WHEN 'client' THEN (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_subject_id
          AND EXISTS (
            SELECT 1 FROM public.operations o
            WHERE o.client_id = c.id
              AND public.can_read_operation(o.id)
          )
      )
    )
    WHEN 'operation' THEN public.can_read_operation(p_subject_id)
    WHEN 'frente' THEN EXISTS (
      SELECT 1 FROM public.frentes f
      WHERE f.id = p_subject_id
        AND public.can_read_operation(f.operation_id)
    )
    WHEN 'task' THEN public.can_see_task(p_subject_id)
    WHEN 'client_contract' THEN public.is_admin()
    WHEN 'profile' THEN public.is_admin()
    WHEN 'meeting' THEN EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = p_subject_id
        AND public.can_see_operation(m.operation_id)
    )
    WHEN 'decision' THEN EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = p_subject_id
        AND public.can_read_operation(d.operation_id)
    )
    WHEN 'operation_risk_blocker' THEN EXISTS (
      SELECT 1 FROM public.operation_risk_blockers rb
      WHERE rb.id = p_subject_id
        AND public.can_see_operation(rb.operation_id)
    )
    ELSE false
  END;
$$;

-- meetings
CREATE OR REPLACE FUNCTION public.trg_log_activity_meetings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'meeting', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object('title', NEW.title, 'scheduled_at', NEW.scheduled_at),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity_event_system(
        'meeting', NEW.id, NEW.operation_id, v_client,
        'updated', 'title', to_jsonb(OLD.title), to_jsonb(NEW.title), '{}'::jsonb
      );
    END IF;
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
      PERFORM public.log_activity_event_system(
        'meeting', NEW.id, NEW.operation_id, v_client,
        'updated', 'scheduled_at', to_jsonb(OLD.scheduled_at), to_jsonb(NEW.scheduled_at), '{}'::jsonb
      );
    END IF;
    IF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      PERFORM public.log_activity_event_system(
        'meeting', NEW.id, NEW.operation_id, v_client,
        'updated', 'ended_at', to_jsonb(OLD.ended_at), to_jsonb(NEW.ended_at), '{}'::jsonb
      );
    END IF;
    IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
      PERFORM public.log_activity_event_system(
        'meeting', NEW.id, NEW.operation_id, v_client,
        'updated', 'visibility', to_jsonb(OLD.visibility), to_jsonb(NEW.visibility), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_meetings_aiud ON public.meetings;
CREATE TRIGGER trg_activity_meetings_aiud
  AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_meetings();

-- decisions
CREATE OR REPLACE FUNCTION public.trg_log_activity_decisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'decision', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object('title', NEW.title, 'meeting_id', NEW.meeting_id),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity_event_system(
        'decision', NEW.id, NEW.operation_id, v_client,
        'updated', 'title', to_jsonb(OLD.title), to_jsonb(NEW.title), '{}'::jsonb
      );
    END IF;
    IF NEW.decision IS DISTINCT FROM OLD.decision THEN
      PERFORM public.log_activity_event_system(
        'decision', NEW.id, NEW.operation_id, v_client,
        'updated', 'decision', to_jsonb(OLD.decision), to_jsonb(NEW.decision), '{}'::jsonb
      );
    END IF;
    IF NEW.meeting_id IS DISTINCT FROM OLD.meeting_id THEN
      PERFORM public.log_activity_event_system(
        'decision', NEW.id, NEW.operation_id, v_client,
        'updated', 'meeting_id', to_jsonb(OLD.meeting_id), to_jsonb(NEW.meeting_id), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_decisions_aiud ON public.decisions;
CREATE TRIGGER trg_activity_decisions_aiud
  AFTER INSERT OR UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_decisions();

-- operation_risk_blockers
CREATE OR REPLACE FUNCTION public.trg_log_activity_operation_risk_blockers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation_risk_blocker', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object('title', NEW.title, 'kind', NEW.kind::text, 'status', NEW.status::text),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity_event_system(
        'operation_risk_blocker', NEW.id, NEW.operation_id, v_client,
        'updated', 'title', to_jsonb(OLD.title), to_jsonb(NEW.title), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'operation_risk_blocker', NEW.id, NEW.operation_id, v_client,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.severity IS DISTINCT FROM OLD.severity THEN
      PERFORM public.log_activity_event_system(
        'operation_risk_blocker', NEW.id, NEW.operation_id, v_client,
        'updated', 'severity', to_jsonb(OLD.severity), to_jsonb(NEW.severity), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operation_risk_blockers_aiud ON public.operation_risk_blockers;
CREATE TRIGGER trg_activity_operation_risk_blockers_aiud
  AFTER INSERT OR UPDATE ON public.operation_risk_blockers
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operation_risk_blockers();

-- tasks.source_meeting_id no feed da tarefa
CREATE OR REPLACE FUNCTION public.trg_log_activity_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client
  FROM public.operations o
  WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'task', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object(
        'title', NEW.title,
        'status', NEW.status::text,
        'operation_id', NEW.operation_id,
        'frente_id', NEW.frente_id,
        'source_meeting_id', NEW.source_meeting_id
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'title', to_jsonb(OLD.title), to_jsonb(NEW.title), '{}'::jsonb
      );
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'description', to_jsonb(OLD.description), to_jsonb(NEW.description), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'due_date', to_jsonb(OLD.due_date), to_jsonb(NEW.due_date), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.frente_id IS DISTINCT FROM OLD.frente_id THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'frente_id', to_jsonb(OLD.frente_id), to_jsonb(NEW.frente_id), '{}'::jsonb
      );
    END IF;
    IF NEW.area_id IS DISTINCT FROM OLD.area_id THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'area_id', to_jsonb(OLD.area_id), to_jsonb(NEW.area_id), '{}'::jsonb
      );
    END IF;
    IF NEW.source_meeting_id IS DISTINCT FROM OLD.source_meeting_id THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'source_meeting_id',
        to_jsonb(OLD.source_meeting_id), to_jsonb(NEW.source_meeting_id), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
