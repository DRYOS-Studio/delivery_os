-- Comissões em % sobre MRR (paridade com imposto). Demais categorias seguem amount em R$.

ALTER TABLE public.operation_costs
  ADD COLUMN IF NOT EXISTS commission_percent numeric(6, 3);

COMMENT ON COLUMN public.operation_costs.commission_percent IS
  'Somente categoria comissoes: % sobre monthly_recurring_revenue. amount fica NULL. Legado: percent NULL e amount em R$.';

ALTER TABLE public.operation_costs
  ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.operation_costs
  DROP CONSTRAINT IF EXISTS check_operation_costs_value_shape;

ALTER TABLE public.operation_costs
  ADD CONSTRAINT check_operation_costs_commission_percent CHECK (
    commission_percent IS NULL
    OR (commission_percent > 0 AND commission_percent <= 100)
  );

ALTER TABLE public.operation_costs
  ADD CONSTRAINT check_operation_costs_value_shape CHECK (
  (
    category IS DISTINCT FROM 'comissoes'::public.operation_cost_category
    AND commission_percent IS NULL
    AND amount IS NOT NULL
    AND amount >= 0
  )
  OR (
    category = 'comissoes'::public.operation_cost_category
    AND (
      (
        commission_percent IS NOT NULL
        AND amount IS NULL
      )
      OR (
        commission_percent IS NULL
        AND amount IS NOT NULL
        AND amount >= 0
      )
    )
  )
  );

CREATE OR REPLACE FUNCTION public.trg_log_activity_operation_costs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT o.client_id INTO v_client
    FROM public.operations o
    WHERE o.id = NEW.operation_id;
    PERFORM public.log_activity_event_system(
      'operation_cost', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object(
        'label', NEW.label,
        'category', NEW.category::text,
        'amount', NEW.amount,
        'commission_percent', NEW.commission_percent,
        'recurrence', NEW.recurrence::text
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT o.client_id INTO v_client
    FROM public.operations o
    WHERE o.id = NEW.operation_id;
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      PERFORM public.log_activity_event_system(
        'operation_cost', NEW.id, NEW.operation_id, v_client,
        'updated', 'amount', to_jsonb(OLD.amount), to_jsonb(NEW.amount),
        jsonb_build_object('category', NEW.category::text, 'label', NEW.label)
      );
    END IF;
    IF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent THEN
      PERFORM public.log_activity_event_system(
        'operation_cost', NEW.id, NEW.operation_id, v_client,
        'updated', 'commission_percent',
        to_jsonb(OLD.commission_percent), to_jsonb(NEW.commission_percent),
        jsonb_build_object('category', NEW.category::text, 'label', NEW.label)
      );
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      PERFORM public.log_activity_event_system(
        'operation_cost', NEW.id, NEW.operation_id, v_client,
        'updated', 'category', to_jsonb(OLD.category::text), to_jsonb(NEW.category::text),
        jsonb_build_object('label', NEW.label)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT o.client_id INTO v_client
    FROM public.operations o
    WHERE o.id = OLD.operation_id;
    PERFORM public.log_activity_event_system(
      'operation_cost', OLD.id, OLD.operation_id, v_client,
      'deleted', NULL, NULL,
      jsonb_build_object(
        'label', OLD.label,
        'category', OLD.category::text,
        'amount', OLD.amount,
        'commission_percent', OLD.commission_percent
      ),
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
