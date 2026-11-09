-- Categoria em operation_costs (unifica custo fixo legado + itens existentes).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_cost_category') THEN
    CREATE TYPE public.operation_cost_category AS ENUM (
      'comissoes',
      'servicos_terceiros',
      'time',
      'infra',
      'a_classificar'
    );
  END IF;
END $$;

ALTER TABLE public.operation_costs
  ADD COLUMN IF NOT EXISTS category public.operation_cost_category NOT NULL DEFAULT 'a_classificar';

COMMENT ON COLUMN public.operation_costs.category IS
  'Categoria do custo. a_classificar = legado/migrado. UI e MCP create usam as 4 categorias principais.';

COMMENT ON COLUMN public.operations.monthly_fixed_cost IS
  'LEGADO: não usar em código novo. Valores migrados para operation_costs (mensal, a_classificar).';

-- Migração do campo único por operação.
INSERT INTO public.operation_costs (
  operation_id,
  label,
  amount,
  recurrence,
  started_at,
  category,
  notes
)
SELECT
  o.id,
  'Custo migrado do campo único',
  o.monthly_fixed_cost,
  'mensal'::public.cost_recurrence,
  CURRENT_DATE,
  'a_classificar'::public.operation_cost_category,
  NULL
FROM public.operations o
WHERE o.monthly_fixed_cost IS NOT NULL
  AND o.monthly_fixed_cost > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.operation_costs c
    WHERE c.operation_id = o.id
      AND c.label = 'Custo migrado do campo único'
      AND c.category = 'a_classificar'::public.operation_cost_category
  );

-- activity_events: custos da operação
ALTER TYPE public.activity_subject_type
  ADD VALUE IF NOT EXISTS 'operation_cost';

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
    WHEN 'operation_cost' THEN EXISTS (
      SELECT 1 FROM public.operation_costs oc
      WHERE oc.id = p_subject_id
        AND public.can_see_operation(oc.operation_id)
    )
    ELSE false
  END;
$$;

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
        'amount', OLD.amount
      ),
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operation_costs_aiud ON public.operation_costs;
CREATE TRIGGER trg_activity_operation_costs_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.operation_costs
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operation_costs();

NOTIFY pgrst, 'reload schema';
