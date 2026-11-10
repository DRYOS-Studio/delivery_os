-- Desconto por cobrança + activity em campos de desconto.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_charge_discount_kind') THEN
    CREATE TYPE public.client_charge_discount_kind AS ENUM ('none', 'fixed', 'percent');
  END IF;
END $$;

ALTER TABLE public.client_charges
  ADD COLUMN IF NOT EXISTS discount_kind public.client_charge_discount_kind NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_input numeric(14, 4),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.client_charges
  DROP CONSTRAINT IF EXISTS chk_client_charges_discount_amount;
ALTER TABLE public.client_charges
  ADD CONSTRAINT chk_client_charges_discount_amount
    CHECK (discount_amount >= 0 AND discount_amount <= amount);

COMMENT ON COLUMN public.client_charges.discount_kind IS
  'none | fixed (R$ em discount_input) | percent (% em discount_input); valor efetivo em discount_amount.';
COMMENT ON COLUMN public.client_charges.discount_amount IS
  'Desconto em R$ já calculado; líquido = amount - discount_amount.';

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
        'discount_amount', NEW.discount_amount,
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
    IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
      OR NEW.discount_kind IS DISTINCT FROM OLD.discount_kind THEN
      PERFORM public.log_activity_event_system(
        'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
        'updated', 'discount',
        jsonb_build_object(
          'kind', OLD.discount_kind::text,
          'input', OLD.discount_input,
          'amount', OLD.discount_amount
        ),
        jsonb_build_object(
          'kind', NEW.discount_kind::text,
          'input', NEW.discount_input,
          'amount', NEW.discount_amount
        ),
        '{}'::jsonb
      );
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      PERFORM public.log_activity_event_system(
        'client_charge', NEW.id, NEW.operation_id, NEW.client_id,
        'updated', 'charge_fields',
        jsonb_build_object(
          'amount', OLD.amount,
          'due_date', OLD.due_date,
          'notes', OLD.notes
        ),
        jsonb_build_object(
          'amount', NEW.amount,
          'due_date', NEW.due_date,
          'notes', NEW.notes
        ),
        '{}'::jsonb
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

NOTIFY pgrst, 'reload schema';
