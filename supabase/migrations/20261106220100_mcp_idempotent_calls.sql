-- integration: respostas cacheadas por idempotency_key (MCP writes). Só service_role no app.

CREATE TABLE IF NOT EXISTS public.mcp_idempotent_responses (
  profile_id uuid NOT NULL,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_mcp_idempotent PRIMARY KEY (profile_id, scope, idempotency_key),
  CONSTRAINT chk_mcp_idempotent_scope_len CHECK (char_length(scope) <= 80),
  CONSTRAINT chk_mcp_idempotent_key_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 200)
);

ALTER TABLE public.mcp_idempotent_responses
  DROP CONSTRAINT IF EXISTS fk_mcp_idempotent_profile_id;
ALTER TABLE public.mcp_idempotent_responses
  ADD CONSTRAINT fk_mcp_idempotent_profile_id
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON TABLE public.mcp_idempotent_responses IS
  'integration: cache de resposta por idempotency (MCP). Escrita/leitura só server service_role.';

ALTER TABLE public.mcp_idempotent_responses ENABLE ROW LEVEL SECURITY;

-- Sem policy para authenticated — inacessível ao cliente; service_role bypassa RLS.
