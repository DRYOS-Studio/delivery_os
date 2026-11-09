-- Custos mensais detalhados por categoria (substitui operations.monthly_fixed_cost na lógica de margem).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_monthly_cost_category') THEN
    CREATE TYPE public.operation_monthly_cost_category AS ENUM (
      'comissoes',
      'servicos_terceiros',
      'time',
      'infra',
      'a_classificar'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operation_monthly_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  category public.operation_monthly_cost_category NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_monthly_cost_items_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations (id) ON DELETE CASCADE,
  CONSTRAINT chk_operation_monthly_cost_items_amount CHECK (amount >= 0),
  CONSTRAINT chk_operation_monthly_cost_items_description
    CHECK (description IS NULL OR char_length(trim(description)) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_operation_monthly_cost_items_operation
  ON public.operation_monthly_cost_items (operation_id, category);

COMMENT ON TABLE public.operation_monthly_cost_items IS
  'Itens de custo mensal categorizado por operação. Soma substitui operations.monthly_fixed_cost nos cálculos de margem.';
COMMENT ON COLUMN public.operations.monthly_fixed_cost IS
  'LEGADO: não usar em código novo. Dados migrados para operation_monthly_cost_items (categoria a_classificar).';

-- Migração: um item por operação que tinha custo único preenchido.
INSERT INTO public.operation_monthly_cost_items (operation_id, category, amount, description)
SELECT o.id,
       'a_classificar'::public.operation_monthly_cost_category,
       o.monthly_fixed_cost,
       'Custo migrado do campo único'
FROM public.operations o
WHERE o.monthly_fixed_cost IS NOT NULL
  AND o.monthly_fixed_cost > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.operation_monthly_cost_items i
    WHERE i.operation_id = o.id
  );

DROP TRIGGER IF EXISTS set_operation_monthly_cost_items_updated_at
  ON public.operation_monthly_cost_items;
CREATE TRIGGER set_operation_monthly_cost_items_updated_at
  BEFORE UPDATE ON public.operation_monthly_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.operation_monthly_cost_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_monthly_cost_items_scoped_select
  ON public.operation_monthly_cost_items;
CREATE POLICY operation_monthly_cost_items_scoped_select
  ON public.operation_monthly_cost_items FOR SELECT TO authenticated
  USING (
    public.can_see_operation(operation_id)
    OR public.is_area_granted(operation_id)
  );

DROP POLICY IF EXISTS operation_monthly_cost_items_scoped_insert
  ON public.operation_monthly_cost_items;
CREATE POLICY operation_monthly_cost_items_scoped_insert
  ON public.operation_monthly_cost_items FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_monthly_cost_items_scoped_update
  ON public.operation_monthly_cost_items;
CREATE POLICY operation_monthly_cost_items_scoped_update
  ON public.operation_monthly_cost_items FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_monthly_cost_items_scoped_delete
  ON public.operation_monthly_cost_items;
CREATE POLICY operation_monthly_cost_items_scoped_delete
  ON public.operation_monthly_cost_items FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

-- activity_events
ALTER TYPE public.activity_subject_type
  ADD VALUE IF NOT EXISTS 'operation_monthly_cost_item';

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
    WHEN 'operation_monthly_cost_item' THEN EXISTS (
      SELECT 1 FROM public.operation_monthly_cost_items ci
      WHERE ci.id = p_subject_id
        AND public.can_see_operation(ci.operation_id)
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_activity_operation_monthly_cost_items()
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
      'operation_monthly_cost_item', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object(
        'category', NEW.category::text,
        'amount', NEW.amount,
        'description', NEW.description
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
        'operation_monthly_cost_item', NEW.id, NEW.operation_id, v_client,
        'updated', 'amount', to_jsonb(OLD.amount), to_jsonb(NEW.amount),
        jsonb_build_object('category', NEW.category::text)
      );
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      PERFORM public.log_activity_event_system(
        'operation_monthly_cost_item', NEW.id, NEW.operation_id, v_client,
        'updated', 'category', to_jsonb(OLD.category::text), to_jsonb(NEW.category::text),
        '{}'::jsonb
      );
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.log_activity_event_system(
        'operation_monthly_cost_item', NEW.id, NEW.operation_id, v_client,
        'updated', 'description', to_jsonb(OLD.description), to_jsonb(NEW.description),
        jsonb_build_object('category', NEW.category::text)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT o.client_id INTO v_client
    FROM public.operations o
    WHERE o.id = OLD.operation_id;
    PERFORM public.log_activity_event_system(
      'operation_monthly_cost_item', OLD.id, OLD.operation_id, v_client,
      'deleted', NULL, NULL,
      jsonb_build_object(
        'category', OLD.category::text,
        'amount', OLD.amount,
        'description', OLD.description
      ),
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operation_monthly_cost_items_aiud
  ON public.operation_monthly_cost_items;
CREATE TRIGGER trg_activity_operation_monthly_cost_items_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.operation_monthly_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operation_monthly_cost_items();

NOTIFY pgrst, 'reload schema';
