-- Nome exibível de perfil: profiles.name → persons (e-mail) → prefixo do e-mail.
-- View + funções SECURITY DEFINER para comentários e histórico sem depender só de profiles.name vazio.

CREATE OR REPLACE FUNCTION public.resolve_profile_display_name(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name text;
  v_person_name text;
  v_email text;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT NULLIF(trim(p.name), ''), u.email
  INTO v_name, v_email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_profile_id;

  IF v_name IS NOT NULL THEN
    RETURN v_name;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT NULLIF(trim(pe.name), '')
    INTO v_person_name
    FROM public.persons pe
    WHERE pe.kind = 'internal'
      AND pe.archived_at IS NULL
      AND pe.email IS NOT NULL
      AND lower(trim(pe.email)) = lower(trim(v_email))
    ORDER BY pe.created_at
    LIMIT 1;

    IF v_person_name IS NOT NULL THEN
      RETURN v_person_name;
    END IF;

    IF position('@' IN v_email) > 1 THEN
      RETURN split_part(v_email, '@', 1);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_display_name(uuid) TO authenticated;

COMMENT ON FUNCTION public.resolve_profile_display_name(uuid) IS
  'auth/scope: rótulo exibível do perfil (name → pessoa interna por e-mail → prefixo). SECURITY DEFINER; só expõe string de display.';

CREATE OR REPLACE FUNCTION public.resolve_activity_actor_name(p_profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.resolve_profile_display_name(p_profile_id);
$$;

REVOKE ALL ON FUNCTION public.resolve_activity_actor_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_activity_actor_name(uuid) TO authenticated;

COMMENT ON FUNCTION public.resolve_activity_actor_name(uuid) IS
  'audit: alias de resolve_profile_display_name para activity_events e triggers.';

CREATE OR REPLACE VIEW public.profile_display_names
WITH (security_invoker = true) AS
SELECT
  p.id AS profile_id,
  public.resolve_profile_display_name(p.id) AS display_name
FROM public.profiles p;

COMMENT ON VIEW public.profile_display_names IS
  'auth/scope: nome exibível por profile_id; RLS de profiles limita linhas visíveis.';

GRANT SELECT ON public.profile_display_names TO authenticated;

-- ---------------------------------------------------------------------------
-- Editar profiles.name (self ou admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_profile_display_name(
  p_profile_id uuid,
  p_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_profile_display_name: not authenticated';
  END IF;

  IF p_profile_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'set_profile_display_name: forbidden';
  END IF;

  UPDATE public.profiles
  SET name = NULLIF(trim(p_name), '')
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_display_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_display_name(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_profile_display_name(uuid, text) IS
  'auth/scope: atualiza apenas profiles.name do próprio usuário ou qualquer perfil (admin).';

-- Backfill actor_name gravado só como prefixo de e-mail (pode evoluir p/ nome da pessoa).
UPDATE public.activity_events ae
SET actor_name = public.resolve_activity_actor_name(ae.actor_profile_id)
WHERE ae.actor_profile_id IS NOT NULL
  AND ae.actor_name IS NOT NULL
  AND trim(ae.actor_name) <> ''
  AND EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = ae.actor_profile_id
      AND u.email IS NOT NULL
      AND position('@' IN u.email) > 1
      AND ae.actor_name = split_part(u.email, '@', 1)
  )
  AND public.resolve_activity_actor_name(ae.actor_profile_id) IS DISTINCT FROM ae.actor_name;

NOTIFY pgrst, 'reload schema';
