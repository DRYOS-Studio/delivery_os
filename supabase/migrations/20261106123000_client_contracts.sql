-- Contratos por cliente: metadados financeiros + arquivo no Storage. RLS só admin.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_contract_status') THEN
    CREATE TYPE public.client_contract_status AS ENUM ('rascunho', 'vigente', 'encerrada');
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_contracts_admin_read ON storage.objects;
CREATE POLICY storage_contracts_admin_read
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND public.is_admin());

DROP POLICY IF EXISTS storage_contracts_admin_write ON storage.objects;
CREATE POLICY storage_contracts_admin_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND public.is_admin());

DROP POLICY IF EXISTS storage_contracts_admin_delete ON storage.objects;
CREATE POLICY storage_contracts_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND public.is_admin());

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  label                 text NOT NULL,
  monthly_value         numeric(14,2),
  currency              text NOT NULL DEFAULT 'BRL',
  reajuste_notes        text,
  start_date            date,
  end_date              date,
  payment_day_of_month  int,
  status                public.client_contract_status NOT NULL DEFAULT 'rascunho',
  notes                 text,
  storage_path          text NOT NULL,
  filename              text NOT NULL,
  mime_type             text NOT NULL,
  size_bytes            bigint NOT NULL,
  uploaded_by           uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_contracts_client
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_contracts_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_client_contracts_label
    CHECK (char_length(trim(label)) >= 2),
  CONSTRAINT chk_client_contracts_payment_day
    CHECK (payment_day_of_month IS NULL OR (payment_day_of_month >= 1 AND payment_day_of_month <= 28)),
  CONSTRAINT chk_client_contracts_dates
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_client_contracts_size
    CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  CONSTRAINT chk_client_contracts_path_prefix
    CHECK (storage_path LIKE client_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS idx_client_contracts_client_created
  ON public.client_contracts (client_id, created_at DESC);

COMMENT ON TABLE public.client_contracts IS
  'cliente: contrato comercial (arquivo + metadados). Apenas admin (RLS). Path Storage prefixado com client_id/.';

DROP TRIGGER IF EXISTS set_client_contracts_updated_at ON public.client_contracts;
CREATE TRIGGER set_client_contracts_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_contracts_admin_all ON public.client_contracts;
CREATE POLICY client_contracts_admin_all ON public.client_contracts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
