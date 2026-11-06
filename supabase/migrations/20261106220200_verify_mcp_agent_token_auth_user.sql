-- integration: verify_mcp_agent_token — recusa conta banida ou sem linha em auth.users (JWT emitido só para usuários válidos).

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

  -- Conta Supabase Auth existente e não banida (GoTrue: banned_until > now())
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
    'profile_id', r.profile_id,
    'scopes', to_jsonb(r.scopes)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_mcp_agent_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_mcp_agent_token(text) TO service_role;

COMMENT ON FUNCTION public.verify_mcp_agent_token(text) IS
  'integration: valida token MCP (service_role). Rejeita usuário inexistente ou banido. Atualiza last_used_at.';
