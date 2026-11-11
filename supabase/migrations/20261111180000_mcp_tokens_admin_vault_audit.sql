-- MCP tokens: prefixo de exibição, validade opcional, verify devolve token_id; auditoria do cofre.

ALTER TABLE public.profile_agent_tokens
  ADD COLUMN IF NOT EXISTS token_prefix text;

COMMENT ON COLUMN public.profile_agent_tokens.token_prefix IS
  'Primeiros caracteres do secret (só identificação; secret completo só na criação).';

ALTER TABLE public.profile_agent_tokens
  ALTER COLUMN expires_at DROP NOT NULL;

ALTER TABLE public.profile_agent_tokens
  DROP CONSTRAINT IF EXISTS chk_pat_expires;

ALTER TABLE public.profile_agent_tokens
  ADD CONSTRAINT chk_pat_expires
  CHECK (expires_at IS NULL OR expires_at > created_at);

ALTER TABLE public.client_credential_audit_logs
  ADD COLUMN IF NOT EXISTS actor_mcp_token_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_client_credential_audit_mcp_token'
  ) THEN
    ALTER TABLE public.client_credential_audit_logs
      ADD CONSTRAINT fk_client_credential_audit_mcp_token
        FOREIGN KEY (actor_mcp_token_id)
        REFERENCES public.profile_agent_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

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
    profile_id, name, token_fingerprint, token_hash, token_prefix, scopes, expires_at, created_by
  )
  VALUES (
    p_profile_id,
    trim(p_name),
    v_fp,
    v_hash,
    left(v_plain, 20),
    v_scopes,
    p_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'token', v_plain,
    'token_prefix', left(v_plain, 20),
    'scopes', to_jsonb(v_scopes)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'fingerprint_collision');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_mcp_agent_token(p_token_plaintext text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_fp text;
  r RECORD;
  v_has_user boolean;
  v_banned boolean;
BEGIN
  IF p_token_plaintext IS NULL OR length(trim(p_token_plaintext)) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_format');
  END IF;

  v_fp := public.mcp_token_fingerprint(p_token_plaintext);

  SELECT t.id, t.profile_id, t.scopes, t.token_hash, t.name
  INTO r
  FROM public.profile_agent_tokens t
  WHERE t.token_fingerprint = v_fp
    AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  IF extensions.crypt(p_token_plaintext, r.token_hash) IS DISTINCT FROM r.token_hash THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.profile_id)
  INTO v_has_user;

  IF NOT v_has_user THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = r.profile_id
        AND u.banned_until IS NOT NULL
        AND u.banned_until > now()
    )
  INTO v_banned;

  IF v_banned THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_or_expired');
  END IF;

  UPDATE public.profile_agent_tokens SET last_used_at = now() WHERE id = r.id;

  RETURN jsonb_build_object(
    'ok', true,
    'token_id', r.id,
    'token_name', r.name,
    'profile_id', r.profile_id,
    'scopes', to_jsonb(r.scopes)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
