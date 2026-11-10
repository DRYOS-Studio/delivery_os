-- Cobranças previstas/recebidas por contrato (Fase 1 — sem gateway).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_charge_type') THEN
    CREATE TYPE public.client_charge_type AS ENUM (
      'mensalidade',
      'implantacao',
      'avulsa'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_charge_status') THEN
    CREATE TYPE public.client_charge_status AS ENUM (
      'prevista',
      'emitida',
      'paga',
      'atrasada',
      'cancelada'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.client_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL,
  client_contract_id  uuid,
  operation_id        uuid,
  charge_type         public.client_charge_type NOT NULL,
  competence          date NOT NULL,
  due_date            date NOT NULL,
  amount              numeric(14, 2) NOT NULL,
  status              public.client_charge_status NOT NULL DEFAULT 'prevista',
  paid_at             date,
  paid_amount         numeric(14, 2),
  payment_method      text,
  notes               text,
  external_provider   text,
  external_id         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_charges_client
    FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_charges_contract
    FOREIGN KEY (client_contract_id) REFERENCES public.client_contracts (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_charges_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations (id) ON DELETE SET NULL,
  CONSTRAINT chk_client_charges_amount_positive
    CHECK (amount > 0),
  CONSTRAINT chk_client_charges_paid_amount_nonneg
    CHECK (paid_amount IS NULL OR paid_amount >= 0),
  CONSTRAINT chk_client_charges_paid_lte_amount
    CHECK (paid_amount IS NULL OR paid_amount <= amount),
  CONSTRAINT chk_client_charges_due_after_competence
    CHECK (due_date >= competence),
  CONSTRAINT chk_client_charges_avulsa_no_contract
    CHECK (
      charge_type <> 'avulsa'::public.client_charge_type
      OR client_contract_id IS NULL
    ),
  CONSTRAINT chk_client_charges_contract_required
    CHECK (
      charge_type = 'avulsa'::public.client_charge_type
      OR client_contract_id IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_charges_contract_type_competence
  ON public.client_charges (client_contract_id, charge_type, competence)
  WHERE client_contract_id IS NOT NULL
    AND charge_type IN (
      'mensalidade'::public.client_charge_type,
      'implantacao'::public.client_charge_type
    );

CREATE INDEX IF NOT EXISTS idx_client_charges_client_due
  ON public.client_charges (client_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_charges_contract
  ON public.client_charges (client_contract_id, competence DESC);

COMMENT ON TABLE public.client_charges IS
  'Cobranças previstas/recebidas por cliente/contrato. Admin-only (RLS). Integração externa via external_provider/external_id.';
COMMENT ON COLUMN public.client_charges.competence IS
  'Competência (1º dia do mês da mensalidade ou data de referência da implantação).';
COMMENT ON COLUMN public.client_charges.status IS
  'Estado persistido; atrasada também pode ser derivada no app quando vencida e não quitada.';

DROP TRIGGER IF EXISTS set_client_charges_updated_at ON public.client_charges;
CREATE TRIGGER set_client_charges_updated_at
  BEFORE UPDATE ON public.client_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_charges_admin_all ON public.client_charges;
CREATE POLICY client_charges_admin_all ON public.client_charges
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- activity: client_charge (enum em 20261110100000)
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
    WHEN 'client_charge' THEN public.is_admin()
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

CREATE OR REPLACE FUNCTION public.trg_log_activity_client_charges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
      'created', NULL, NULL,
      jsonb_build_object(
        'charge_type', NEW.charge_type::text,
        'amount', NEW.amount,
        'due_date', NEW.due_date,
        'status', NEW.status::text
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
        'updated', 'status', to_jsonb(OLD.status::text), to_jsonb(NEW.status::text),
        jsonb_build_object('charge_type', NEW.charge_type::text)
      );
    END IF;
    IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
      PERFORM public.log_activity_event_system(
        'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
        'updated', 'paid_amount', to_jsonb(OLD.paid_amount), to_jsonb(NEW.paid_amount),
        jsonb_build_object('status', NEW.status::text)
      );
    END IF;
    IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
      PERFORM public.log_activity_event_system(
        'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
        'updated', 'paid_at', to_jsonb(OLD.paid_at), to_jsonb(NEW.paid_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity_event_system(
      'client_charge', OLD.id, OLD.operation_id, OLD.client_id,
      'deleted', NULL, NULL,
      jsonb_build_object(
        'charge_type', OLD.charge_type::text,
        'amount', OLD.amount,
        'due_date', OLD.due_date
      ),
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_client_charges_aiud ON public.client_charges;
CREATE TRIGGER trg_activity_client_charges_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.client_charges
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_client_charges();

NOTIFY pgrst, 'reload schema';
