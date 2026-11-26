-- integration: Google Calendar org-wide OAuth + sync fields on meetings.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'google_calendar_sync_status') THEN
    CREATE TYPE public.google_calendar_sync_status AS ENUM (
      'synced',
      'pending',
      'failed',
      'skipped'
    );
  END IF;
END $$;

-- ── Conexão única da organização (tokens só no servidor; RLS admin) ──
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key text NOT NULL DEFAULT 'dryos',
  account_email text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_summary text,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  access_token_key_version integer NOT NULL DEFAULT 1,
  refresh_token_key_version integer NOT NULL DEFAULT 1,
  token_expires_at timestamptz NOT NULL,
  connected_by uuid
    CONSTRAINT fk_google_calendar_connections_connected_by
    REFERENCES auth.users(id) ON DELETE SET NULL,
  scopes text NOT NULL DEFAULT 'https://www.googleapis.com/auth/calendar.events',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_google_calendar_connections_singleton UNIQUE (singleton_key),
  CONSTRAINT chk_google_calendar_connections_email_len
    CHECK (char_length(trim(account_email)) >= 3)
);

COMMENT ON TABLE public.google_calendar_connections IS
  'integration: OAuth Google Calendar da organização (singleton). Tokens cifrados; apenas admin via RLS; leitura de tokens só server-side com service role.';

COMMENT ON COLUMN public.google_calendar_connections.access_token_ciphertext IS
  'Access token OAuth cifrado (AES-GCM, mesma chave VAULT_ENCRYPTION_KEY). Nunca expor ao cliente.';

DROP TRIGGER IF EXISTS set_google_calendar_connections_updated_at ON public.google_calendar_connections;
CREATE TRIGGER set_google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_calendar_connections_admin ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_admin ON public.google_calendar_connections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── meetings: metadados Google Calendar ──
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_html_link text,
  ADD COLUMN IF NOT EXISTS google_meet_link text,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_status public.google_calendar_sync_status,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_error text,
  ADD COLUMN IF NOT EXISTS google_calendar_send_invites boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.meetings.google_event_id IS
  'ID do evento no Google Calendar (calendar.events). Null se nunca sincronizado ou integração ausente.';
COMMENT ON COLUMN public.meetings.google_calendar_sync_status IS
  'Estado da última tentativa de sync com Google Calendar: synced, pending (sync pendente), failed, skipped (sem integração).';
COMMENT ON COLUMN public.meetings.google_calendar_send_invites IS
  'Última escolha do checkbox "Enviar convite aos participantes" (controla sendUpdates no Google).';