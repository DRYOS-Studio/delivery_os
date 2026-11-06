-- integration: tokens estáticos MCP — fingerprint + bcrypt; JWT emitido no app (HS256 com SUPABASE_JWT_SECRET).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mcp_agent_token_scope') THEN
    CREATE TYPE public.mcp_agent_token_scope AS ENUM ('read', 'write');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profile_agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL
    CONSTRAINT fk_pat_profile_id REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_fingerprint text NOT NULL,
  token_hash text NOT NULL,
  scopes public.mcp_agent_token_scope[] NOT NULL DEFAULT ARRAY['read', 'write']::public.mcp_agent_token_scope[],
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid
    CONSTRAINT fk_pat_created_by REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_pat_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120),
  CONSTRAINT chk_pat_expires CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_agent_tokens_fingerprint_active
  ON public.profile_agent_tokens(token_fingerprint)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profile_agent_tokens_profile
  ON public.profile_agent_tokens(profile_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.profile_agent_tokens IS
  'integration: token MCP (fingerprint + bcrypt). Escopos read/write. JWT curto emitido no app com SUPABASE_JWT_SECRET.';

ALTER TABLE public.profile_agent_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_agent_tokens_select ON public.profile_agent_tokens;
CREATE POLICY profile_agent_tokens_select ON public.profile_agent_tokens
  FOR SELECT TO authenticated
  USING (public.is_admin() OR profile_id = auth.uid());

-- Sem INSERT/UPDATE direto — só via RPC SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.mcp_token_fingerprint(p_plaintext text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT substring(encode(extensions.digest(convert_to(trim(p_plaintext), 'UTF8'), 'sha256'), 'hex'), 1, 32);
$$;

CREATE OR REPLACE FUNCTION public.create_mcp_agent_token(
  p_profile_id uuid,
  p_name text,
  p_scopes public.mcp_agent_token_scope[],
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_plain text;
  v_fp text;
  v_hash text;
  v_id uuid;
  v_exists boolean;
  v_scopes public.mcp_agent_token_scope[];
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id)
  INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'code', 'profile_not_found');
  END IF;

  v_scopes := COALESCE(p_scopes, ARRAY['read', 'write']::public.mcp_agent_token_scope[]);

  v_plain :=
    'mcp_agt_' ||
    replace(replace(trim(both '=' FROM encode(extensions.gen_random_bytes(32), 'base64')), '+', '-'), '/', '_');
  v_fp := public.mcp_token_fingerprint(v_plain);
  v_hash := extensions.crypt(v_plain, extensions.gen_salt('bf', 10));

  INSERT INTO public.profile_agent_tokens (
    profile_id, name, token_fingerprint, token_hash, scopes, expires_at, created_by
  )
  VALUES (
    p_profile_id, trim(p_name), v_fp, v_hash, v_scopes, p_expires_at, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_plain, 'scopes', to_jsonb(v_scopes));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'fingerprint_collision');
END;
$$;

REVOKE ALL ON FUNCTION public.create_mcp_agent_token(uuid, text, public.mcp_agent_token_scope[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_mcp_agent_token(uuid, text, public.mcp_agent_token_scope[], timestamptz) TO authenticated;

COMMENT ON FUNCTION public.create_mcp_agent_token IS
  'integration: admin cria token MCP; devolve plaintext uma vez.';

CREATE OR REPLACE FUNCTION public.revoke_mcp_agent_token(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  UPDATE public.profile_agent_tokens
  SET revoked_at = now()
  WHERE id = p_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_mcp_agent_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_mcp_agent_token(uuid) TO authenticated;

-- service_role only: validação sem vazar hash (comparação bcrypt)
CREATE OR REPLACE FUNCTION public.verify_mcp_agent_token(p_token_plaintext text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_fp text;
  r RECORD;
BEGIN
  IF p_token_plaintext IS NULL OR length(trim(p_token_plaintext)) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_format');
  END IF;

  v_fp := public.mcp_token_fingerprint(p_token_plaintext);

  SELECT t.id, t.profile_id, t.scopes, t.token_hash
  INTO r
  FROM public.profile_agent_tokens t
  WHERE t.token_fingerprint = v_fp
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  IF extensions.crypt(p_token_plaintext, r.token_hash) IS DISTINCT FROM r.token_hash THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  UPDATE public.profile_agent_tokens SET last_used_at = now() WHERE id = r.id;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id', r.profile_id,
    'scopes', to_jsonb(r.scopes)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_mcp_agent_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_mcp_agent_token(text) TO service_role;

COMMENT ON FUNCTION public.verify_mcp_agent_token(text) IS
  'integration: valida token MCP (service_role). Atualiza last_used_at.';
