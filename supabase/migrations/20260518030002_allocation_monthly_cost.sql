ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS monthly_cost numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_allocations_monthly_cost_nonneg') THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT check_allocations_monthly_cost_nonneg
      CHECK (monthly_cost IS NULL OR monthly_cost >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.allocations.monthly_cost IS
  'Valor mensal fechado pra esta alocação (BRL/mês). Quando preenchido, vira o custo direto e ignora cálculo por horas. Útil quando o trabalho é negociado por valor, não por horas.';
