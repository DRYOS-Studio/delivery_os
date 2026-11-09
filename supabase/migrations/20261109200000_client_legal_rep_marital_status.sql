-- Estado civil do representante legal (PJ) — qualificação contratual.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS legal_representative_marital_status text;

COMMENT ON COLUMN public.clients.legal_representative_marital_status IS
  'PJ: estado civil do representante legal (mesmas opções da PF).';
