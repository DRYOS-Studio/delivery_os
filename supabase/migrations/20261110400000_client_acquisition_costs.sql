-- CAC: custos pontuais de aquisição por cliente (não entram na margem mensal da operação).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_acquisition_cost_category') THEN
    CREATE TYPE public.client_acquisition_cost_category AS ENUM (
      'anuncios_midia',
      'horas_venda_diagnostico',
      'comissao_indicacao',
      'ferramentas',
      'outros'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.client_acquisition_costs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL,
  spent_on    date NOT NULL,
  description text NOT NULL,
  category    public.client_acquisition_cost_category NOT NULL,
  amount      numeric(14, 2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_acquisition_costs_client
    FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE CASCADE,
  CONSTRAINT chk_client_acquisition_costs_amount_positive
    CHECK (amount > 0),
  CONSTRAINT chk_client_acquisition_costs_description_len
    CHECK (char_length(trim(description)) >= 1 AND char_length(description) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_client_acquisition_costs_client_spent
  ON public.client_acquisition_costs (client_id, spent_on DESC);

COMMENT ON TABLE public.client_acquisition_costs IS
  'Custos de aquisição (CAC) do cliente — pontuais, fora da margem mensal da operação. Admin-only.';

DROP TRIGGER IF EXISTS set_client_acquisition_costs_updated_at ON public.client_acquisition_costs;
CREATE TRIGGER set_client_acquisition_costs_updated_at
  BEFORE UPDATE ON public.client_acquisition_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_acquisition_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_acquisition_costs_admin_all ON public.client_acquisition_costs;
CREATE POLICY client_acquisition_costs_admin_all ON public.client_acquisition_costs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
