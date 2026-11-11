-- Cofre de senhas por cliente (segredos cifrados no app; AES-256-GCM + key_version).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_credential_audit_action') THEN
    CREATE TYPE public.client_credential_audit_action AS ENUM (
      'create',
      'update',
      'archive',
      'delete',
      'reveal',
      'copy'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.client_credentials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  operation_id          uuid,
  service_name          text NOT NULL,
  url                   text,
  login_username        text,
  password_ciphertext   text NOT NULL,
  notes_ciphertext      text,
  two_factor_ciphertext text,
  key_version           smallint NOT NULL DEFAULT 1,
  created_by            uuid NOT NULL,
  updated_by            uuid NOT NULL,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_credentials_client
    FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_credentials_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations (id) ON DELETE SET NULL,
  CONSTRAINT fk_client_credentials_created_by
    FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT fk_client_credentials_updated_by
    FOREIGN KEY (updated_by) REFERENCES auth.users (id),
  CONSTRAINT chk_client_credentials_service_name
    CHECK (char_length(trim(service_name)) >= 1 AND char_length(service_name) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_client_credentials_client_active
  ON public.client_credentials (client_id, archived_at NULLS FIRST, service_name);

COMMENT ON TABLE public.client_credentials IS
  'Cofre: metadados em claro; senha/notas/2FA em password_ciphertext etc. (AES-256-GCM no app).';
COMMENT ON COLUMN public.client_credentials.password_ciphertext IS
  'Senha cifrada (IV+tag+ct, base64url); nunca texto puro.';
COMMENT ON COLUMN public.client_credentials.key_version IS
  'Versão da chave VAULT_ENCRYPTION_KEY para rotação futura.';

DROP TRIGGER IF EXISTS set_client_credentials_updated_at ON public.client_credentials;
CREATE TRIGGER set_client_credentials_updated_at
  BEFORE UPDATE ON public.client_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_client_vault(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.operations o
      WHERE o.client_id = p_client_id
        AND public.can_read_operation(o.id)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_client_vault(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_client_vault(uuid) TO authenticated;

ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_credentials_scoped_all ON public.client_credentials;
CREATE POLICY client_credentials_scoped_all ON public.client_credentials
  FOR ALL TO authenticated
  USING (public.can_access_client_vault(client_id))
  WITH CHECK (public.can_access_client_vault(client_id));

CREATE TABLE IF NOT EXISTS public.client_credential_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id   uuid,
  client_id       uuid NOT NULL,
  action          public.client_credential_audit_action NOT NULL,
  actor_user_id   uuid,
  actor_mcp       boolean NOT NULL DEFAULT false,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_credential_audit_client
    FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_credential_audit_client_created
  ON public.client_credential_audit_logs (client_id, created_at DESC);

COMMENT ON TABLE public.client_credential_audit_logs IS
  'Auditoria append-only do cofre (revelação, cópia, CRUD).';

ALTER TABLE public.client_credential_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_credential_audit_select ON public.client_credential_audit_logs;
CREATE POLICY client_credential_audit_select ON public.client_credential_audit_logs
  FOR SELECT TO authenticated
  USING (public.can_access_client_vault(client_id));

DROP POLICY IF EXISTS client_credential_audit_insert ON public.client_credential_audit_logs;
CREATE POLICY client_credential_audit_insert ON public.client_credential_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_client_vault(client_id));

NOTIFY pgrst, 'reload schema';
