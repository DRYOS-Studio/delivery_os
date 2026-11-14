-- Hotfix: trg_log_activity_operations ainda lia colunas financeiras removidas de operations
-- (recurrence, MRR, monthly_fixed_cost, notification_webhook_url). Qualquer UPDATE em operations
-- quebrava com "record new has no field recurrence".

CREATE OR REPLACE FUNCTION public.trg_log_activity_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation', NEW.id, NEW.id, NEW.client_id,
      'created', NULL, NULL,
      jsonb_build_object('name', NEW.name, 'status', NEW.status::text, 'client_id', NEW.client_id),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.product_line IS DISTINCT FROM OLD.product_line THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'product_line', to_jsonb(OLD.product_line), to_jsonb(NEW.product_line), '{}'::jsonb
      );
    END IF;
    IF NEW.response_hours IS DISTINCT FROM OLD.response_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'response_hours', to_jsonb(OLD.response_hours), to_jsonb(NEW.response_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.resolution_hours IS DISTINCT FROM OLD.resolution_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'resolution_hours', to_jsonb(OLD.resolution_hours), to_jsonb(NEW.resolution_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'end_date', to_jsonb(OLD.end_date), to_jsonb(NEW.end_date), '{}'::jsonb
      );
    END IF;
    IF NEW.diagnostic_id IS DISTINCT FROM OLD.diagnostic_id THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'diagnostic_id', to_jsonb(OLD.diagnostic_id), to_jsonb(NEW.diagnostic_id), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_log_activity_operations() IS
  'auditoria: campos operacionais em operations. Financeiro migrou para operation_financials (trg_log_activity_operation_financials).';

-- Auditoria dos campos financeiros (antes em operations; agora operation_financials).

CREATE OR REPLACE FUNCTION public.trg_log_activity_operation_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
  v_op_id uuid;
BEGIN
  v_op_id := COALESCE(NEW.operation_id, OLD.operation_id);
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = v_op_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation', v_op_id, v_op_id, v_client,
      'updated', 'operation_financials', NULL,
      jsonb_build_object(
        'recurrence', NEW.recurrence,
        'monthly_recurring_revenue', NEW.monthly_recurring_revenue,
        'monthly_fixed_cost', NEW.monthly_fixed_cost,
        'tax_rate_pct', NEW.tax_rate_pct,
        'notification_webhook_url', NEW.notification_webhook_url
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.recurrence IS DISTINCT FROM OLD.recurrence THEN
      PERFORM public.log_activity_event_system(
        'operation', v_op_id, v_op_id, v_client,
        'updated', 'recurrence', to_jsonb(OLD.recurrence), to_jsonb(NEW.recurrence), '{}'::jsonb
      );
    END IF;
    IF NEW.monthly_recurring_revenue IS DISTINCT FROM OLD.monthly_recurring_revenue THEN
      PERFORM public.log_activity_event_system(
        'operation', v_op_id, v_op_id, v_client,
        'updated', 'monthly_recurring_revenue',
        to_jsonb(OLD.monthly_recurring_revenue), to_jsonb(NEW.monthly_recurring_revenue), '{}'::jsonb
      );
    END IF;
    IF NEW.monthly_fixed_cost IS DISTINCT FROM OLD.monthly_fixed_cost THEN
      PERFORM public.log_activity_event_system(
        'operation', v_op_id, v_op_id, v_client,
        'updated', 'monthly_fixed_cost',
        to_jsonb(OLD.monthly_fixed_cost), to_jsonb(NEW.monthly_fixed_cost), '{}'::jsonb
      );
    END IF;
    IF NEW.tax_rate_pct IS DISTINCT FROM OLD.tax_rate_pct THEN
      PERFORM public.log_activity_event_system(
        'operation', v_op_id, v_op_id, v_client,
        'updated', 'tax_rate_pct', to_jsonb(OLD.tax_rate_pct), to_jsonb(NEW.tax_rate_pct), '{}'::jsonb
      );
    END IF;
    IF NEW.notification_webhook_url IS DISTINCT FROM OLD.notification_webhook_url THEN
      PERFORM public.log_activity_event_system(
        'operation', v_op_id, v_op_id, v_client,
        'updated', 'notification_webhook_url',
        to_jsonb(OLD.notification_webhook_url), to_jsonb(NEW.notification_webhook_url), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operation_financials_aiu ON public.operation_financials;
CREATE TRIGGER trg_activity_operation_financials_aiu
  AFTER INSERT OR UPDATE ON public.operation_financials
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operation_financials();

NOTIFY pgrst, 'reload schema';
