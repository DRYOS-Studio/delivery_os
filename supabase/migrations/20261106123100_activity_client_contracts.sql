-- Auditoria de contratos de cliente no feed (activity_events).

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'client_contract';

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
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_activity_client_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'client_contract', NEW.id, NULL, NEW.client_id,
      'created', NULL, NULL,
      jsonb_build_object('label', NEW.label, 'status', NEW.status::text),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.label IS DISTINCT FROM OLD.label THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'label', to_jsonb(OLD.label), to_jsonb(NEW.label), '{}'::jsonb
      );
    END IF;
    IF NEW.monthly_value IS DISTINCT FROM OLD.monthly_value THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'monthly_value', to_jsonb(OLD.monthly_value), to_jsonb(NEW.monthly_value), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'status', to_jsonb(OLD.status::text), to_jsonb(NEW.status::text), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'end_date', to_jsonb(OLD.end_date), to_jsonb(NEW.end_date), '{}'::jsonb
      );
    END IF;
    IF NEW.payment_day_of_month IS DISTINCT FROM OLD.payment_day_of_month THEN
      PERFORM public.log_activity_event_system(
        'client_contract', NEW.id, NULL, NEW.client_id,
        'updated', 'payment_day_of_month', to_jsonb(OLD.payment_day_of_month), to_jsonb(NEW.payment_day_of_month), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity_event_system(
      'client_contract', OLD.id, NULL, OLD.client_id,
      'deleted', NULL, to_jsonb(OLD.label), NULL, '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_client_contracts_aiud ON public.client_contracts;
CREATE TRIGGER trg_activity_client_contracts_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_client_contracts();
