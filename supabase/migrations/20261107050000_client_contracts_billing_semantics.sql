-- Datas de cobrança distintas: onboarding (start_date) vs 1ª cobrança calendário completa.

ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS first_billing_date date,
  ADD COLUMN IF NOT EXISTS implementation_fee_paid boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_client_contracts_first_billing_after_start'
  ) THEN
    ALTER TABLE public.client_contracts
      ADD CONSTRAINT chk_client_contracts_first_billing_after_start
      CHECK (
        first_billing_date IS NULL
        OR start_date IS NULL
        OR first_billing_date >= start_date
      );
  END IF;
END $$;

COMMENT ON COLUMN public.client_contracts.first_billing_date IS
  'cliente: data da primeira cobrança recorrente (YYYY-MM-DD). Distinto de payment_day_of_month (dia fixo mensal).';
COMMENT ON COLUMN public.client_contracts.implementation_fee_paid IS
  'cliente: taxa de implantação quitada (boolean — sem data de pagamento obrigatória).';
