-- Operação: alíquota de imposto sobre o valor cobrado (MRR), descontada da margem como custo mensal derivado.
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric(5, 2);

ALTER TABLE public.operations
  DROP CONSTRAINT IF EXISTS check_operations_tax_rate_pct;

ALTER TABLE public.operations
  ADD CONSTRAINT check_operations_tax_rate_pct
  CHECK (tax_rate_pct IS NULL OR (tax_rate_pct >= 0 AND tax_rate_pct <= 100));

COMMENT ON COLUMN public.operations.tax_rate_pct IS
  'operação: alíquota de imposto em % sobre monthly_recurring_revenue (valor cobrado). Null ou 0 = sem imposto na margem. Admin-only via UI/MCP.';
