ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost numeric(12,2);

ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_recurrence') THEN
    CREATE TYPE cost_recurrence AS ENUM ('mensal', 'unica');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operation_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL,
  recurrence cost_recurrence NOT NULL DEFAULT 'mensal',
  started_at date NOT NULL DEFAULT current_date,
  ended_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_costs_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT check_operation_costs_label CHECK (char_length(label) >= 2),
  CONSTRAINT check_operation_costs_amount CHECK (amount >= 0),
  CONSTRAINT check_operation_costs_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.operation_costs IS
  'operação: itens de custo manuais (mensal recorrente ou unica). Custo fixo principal vive em operations.monthly_fixed_cost. Custos derivados de pessoas vêm de allocations × persons.hourly_rate (não materializados). Admin-only via action layer (Inv. 14).';
COMMENT ON COLUMN public.operations.monthly_fixed_cost IS
  'Custo mensal fixo (BRL). Admin-only via UI; sem gate de RLS — gating no action.';
COMMENT ON COLUMN public.persons.hourly_rate IS
  'Taxa horária (BRL/h). Admin-only via UI; usada no cálculo de custos derivados de allocations.';

CREATE INDEX IF NOT EXISTS idx_operation_costs_operation_recurrence
  ON public.operation_costs(operation_id, recurrence);

DROP TRIGGER IF EXISTS set_operation_costs_updated_at ON public.operation_costs;
CREATE TRIGGER set_operation_costs_updated_at
  BEFORE UPDATE ON public.operation_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.operation_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_costs_authenticated_full ON public.operation_costs;
CREATE POLICY operation_costs_authenticated_full ON public.operation_costs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
