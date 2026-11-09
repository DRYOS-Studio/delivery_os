-- Convites de autocadastro de cliente (link público). Apenas admin via RLS; leitura pública via service role + token.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_registration_invitation_status') THEN
    CREATE TYPE public.client_registration_invitation_status AS ENUM (
      'enviado',
      'preenchido',
      'aprovado',
      'expirado',
      'cancelado'
    );
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS formal_email text,
  ADD COLUMN IF NOT EXISTS focal_point_name text,
  ADD COLUMN IF NOT EXISTS focal_point_email text,
  ADD COLUMN IF NOT EXISTS focal_point_phone text,
  ADD COLUMN IF NOT EXISTS financial_contact_name text,
  ADD COLUMN IF NOT EXISTS financial_contact_email text,
  ADD COLUMN IF NOT EXISTS financial_contact_phone text,
  ADD COLUMN IF NOT EXISTS legal_representative_name text,
  ADD COLUMN IF NOT EXISTS legal_representative_role text,
  ADD COLUMN IF NOT EXISTS legal_representative_cpf text,
  ADD COLUMN IF NOT EXISTS legal_representative_email text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_person_type') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_person_type
      CHECK (person_type IS NULL OR person_type IN ('pf', 'pj'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_cpf_length') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_cpf_length
      CHECK (cpf IS NULL OR char_length(cpf) = 11);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_formal_email_shape') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_formal_email_shape
      CHECK (formal_email IS NULL OR formal_email LIKE '%_@_%.%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_clients_legal_rep_cpf_length') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT check_clients_legal_rep_cpf_length
      CHECK (legal_representative_cpf IS NULL OR char_length(legal_representative_cpf) = 11);
  END IF;
END $$;

COMMENT ON COLUMN public.clients.person_type IS 'pf ou pj — qualificação para contrato.';
COMMENT ON COLUMN public.clients.cpf IS 'CPF só dígitos (11). Pessoa física ou rep. legal.';
COMMENT ON COLUMN public.clients.formal_email IS 'E-mail para comunicações formais / contrato.';

CREATE TABLE IF NOT EXISTS public.client_registration_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  token_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL,
  status public.client_registration_invitation_status NOT NULL DEFAULT 'enviado',
  prefill_contact_name text NOT NULL,
  prefill_contact_phone text NOT NULL,
  invite_note text,
  submitted_payload jsonb,
  submitted_at timestamptz,
  lgpd_consented_at timestamptz,
  created_by uuid,
  approved_client_id uuid,
  approved_at timestamptz,
  approved_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_reg_inv_created_by
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_client_reg_inv_approved_client
    FOREIGN KEY (approved_client_id) REFERENCES public.clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_client_reg_inv_approved_by
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_client_reg_inv_prefill_name
    CHECK (char_length(trim(prefill_contact_name)) >= 2),
  CONSTRAINT chk_client_reg_inv_prefill_phone
    CHECK (char_length(trim(prefill_contact_phone)) >= 8),
  CONSTRAINT uq_client_reg_inv_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_client_reg_inv_status_created
  ON public.client_registration_invitations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_reg_inv_approved_client
  ON public.client_registration_invitations (approved_client_id)
  WHERE approved_client_id IS NOT NULL;

COMMENT ON TABLE public.client_registration_invitations IS
  'cliente: convite de autocadastro por link. Token armazenado como hash; submissão em JSON até aprovação admin.';

COMMENT ON COLUMN public.client_registration_invitations.token_hash IS
  'SHA-256 hex do token bruto (32+ bytes aleatórios). Nunca expor na API autenticada.';

COMMENT ON COLUMN public.client_registration_invitations.token_encrypted IS
  'Token bruto cifrado (AES-256-GCM) para ação copiar link no admin; só service role descriptografa.';

DROP TRIGGER IF EXISTS set_client_registration_invitations_updated_at ON public.client_registration_invitations;
CREATE TRIGGER set_client_registration_invitations_updated_at
  BEFORE UPDATE ON public.client_registration_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_registration_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_registration_invitations_admin_all ON public.client_registration_invitations;
CREATE POLICY client_registration_invitations_admin_all ON public.client_registration_invitations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
