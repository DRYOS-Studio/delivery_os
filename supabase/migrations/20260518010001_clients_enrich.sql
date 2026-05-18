ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_cnpj_length') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_cnpj_length
      CHECK (cnpj IS NULL OR char_length(cnpj) = 14);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_state_length') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_state_length
      CHECK (address_state IS NULL OR char_length(address_state) = 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_zip_length') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_zip_length
      CHECK (address_zip IS NULL OR char_length(address_zip) = 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_email_shape') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_email_shape
      CHECK (primary_contact_email IS NULL OR primary_contact_email LIKE '%_@_%.%');
  END IF;
END $$;

COMMENT ON COLUMN public.clients.cnpj IS 'Só dígitos (14 chars). Sem máscara. Display formata como 00.000.000/0000-00.';
COMMENT ON COLUMN public.clients.address_zip IS 'Só dígitos (8 chars).';
COMMENT ON COLUMN public.clients.address_state IS 'UF (2 chars maiúsculas).';
COMMENT ON COLUMN public.clients.primary_contact_name IS 'Contato principal — texto livre, não FK pra persons.';
