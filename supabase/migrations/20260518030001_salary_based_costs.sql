ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS monthly_compensation numeric(12,2),
  ADD COLUMN IF NOT EXISTS contracted_weekly_hours numeric(5,2);

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS weekly_hours numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_persons_monthly_compensation_nonneg') THEN
    ALTER TABLE public.persons
      ADD CONSTRAINT check_persons_monthly_compensation_nonneg
      CHECK (monthly_compensation IS NULL OR monthly_compensation >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_persons_contracted_hours_pos') THEN
    ALTER TABLE public.persons
      ADD CONSTRAINT check_persons_contracted_hours_pos
      CHECK (contracted_weekly_hours IS NULL OR contracted_weekly_hours > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_allocations_weekly_hours_nonneg') THEN
    ALTER TABLE public.allocations
      ADD CONSTRAINT check_allocations_weekly_hours_nonneg
      CHECK (weekly_hours IS NULL OR weekly_hours >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.persons.monthly_compensation IS
  'Salário/compensação mensal bruto (BRL/mês). Usado com contracted_weekly_hours pra derivar taxa horária no cálculo de custos. Admin-only via UI.';
COMMENT ON COLUMN public.persons.contracted_weekly_hours IS
  'Horas contratadas por semana (ex: 40 CLT). Junto com monthly_compensation, deriva taxa horária. Admin-only via UI.';
COMMENT ON COLUMN public.allocations.weekly_hours IS
  'Horas/semana alocadas nesta Frente (substitui o uso de capacity_weekly_pct quando preenchido). Custo mensal: rate × weekly_hours × 4.';
