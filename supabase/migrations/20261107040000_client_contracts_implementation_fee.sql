-- cliente: taxa de implantação opcional no contrato (complementa monthly_value; sem novo SKU).

ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS implementation_fee numeric(14,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_client_contracts_implementation_fee'
  ) THEN
    ALTER TABLE public.client_contracts
      ADD CONSTRAINT chk_client_contracts_implementation_fee
      CHECK (implementation_fee IS NULL OR implementation_fee >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.client_contracts.implementation_fee IS
  'cliente: taxa de implantação única (opcional). Mensalidade permanece em monthly_value.';
