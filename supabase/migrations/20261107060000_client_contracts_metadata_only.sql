-- Contratos sem arquivo anexo (ex. aceite WhatsApp em notes).

ALTER TABLE public.client_contracts
  ALTER COLUMN storage_path DROP NOT NULL,
  ALTER COLUMN filename DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN size_bytes DROP NOT NULL,
  ALTER COLUMN size_bytes SET DEFAULT 0;

ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS chk_client_contracts_size;
ALTER TABLE public.client_contracts
  ADD CONSTRAINT chk_client_contracts_size
  CHECK (
    (
      storage_path IS NULL
      AND filename IS NULL
      AND mime_type IS NULL
      AND (size_bytes IS NULL OR size_bytes = 0)
    )
    OR (
      storage_path IS NOT NULL
      AND filename IS NOT NULL
      AND mime_type IS NOT NULL
      AND size_bytes > 0
      AND size_bytes <= 52428800
    )
  );

ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS chk_client_contracts_path_prefix;
ALTER TABLE public.client_contracts
  ADD CONSTRAINT chk_client_contracts_path_prefix
  CHECK (storage_path IS NULL OR storage_path LIKE client_id::text || '/%');

COMMENT ON COLUMN public.client_contracts.storage_path IS
  'cliente: path Storage; NULL quando contrato é só metadados (sem PDF).';
