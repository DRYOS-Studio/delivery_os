ALTER TABLE public.operation_costs
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

COMMENT ON COLUMN public.operation_costs.voided_at IS
  'Quando preenchido, o lançamento foi anulado (erro de cadastro) e fica fora de listagens e cálculos.';
COMMENT ON COLUMN public.operation_costs.void_reason IS
  'Motivo opcional da anulação (admin).';

CREATE INDEX IF NOT EXISTS idx_operation_costs_operation_voided
  ON public.operation_costs(operation_id)
  WHERE voided_at IS NULL;

NOTIFY pgrst, 'reload schema';
