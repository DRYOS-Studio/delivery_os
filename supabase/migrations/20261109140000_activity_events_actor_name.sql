-- activity_events: actor_name denormalizado (snapshot no INSERT) para exibir ator sem depender de RLS em profiles.

ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS actor_name text;

COMMENT ON COLUMN public.activity_events.actor_name IS
  'audit: rótulo do ator no momento do evento (profiles.name ou parte local do e-mail). Definido em INSERT via SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION public.resolve_activity_actor_name(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name text;
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

  IF v_email IS NOT NULL AND position('@' IN v_email) > 1 THEN
    RETURN split_part(v_email, '@', 1);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_activity_actor_name(uuid) FROM PUBLIC;

COMMENT ON FUNCTION public.resolve_activity_actor_name(uuid) IS
  'audit: nome exibível do perfil (sem RLS); usado só em funções SECURITY DEFINER de activity_events.';

-- ---------------------------------------------------------------------------
-- log_activity_event (RPC autenticada)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid,
  p_operation_id uuid,
  p_client_id uuid,
  p_action text,
  p_field_key text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_actor_name text;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'log_activity_event: not authenticated';
  END IF;

  IF NOT public.can_read_activity_subject(p_subject_type, p_subject_id) THEN
    RAISE EXCEPTION 'log_activity_event: forbidden';
  END IF;

  v_actor_name := public.resolve_activity_actor_name(v_actor);

  INSERT INTO public.activity_events (
    subject_type,
    subject_id,
    operation_id,
    client_id,
    action,
    field_key,
    old_value,
    new_value,
    metadata,
    actor_profile_id,
    actor_name
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_operation_id,
    p_client_id,
    p_action,
    NULLIF(trim(p_field_key), ''),
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb),
    v_actor,
    v_actor_name
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity_event(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity_event(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_activity_event_system (triggers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity_event_system(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid,
  p_operation_id uuid,
  p_client_id uuid,
  p_action text,
  p_field_key text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  v_actor_name := public.resolve_activity_actor_name(v_actor);

  INSERT INTO public.activity_events (
    subject_type,
    subject_id,
    operation_id,
    client_id,
    action,
    field_key,
    old_value,
    new_value,
    metadata,
    actor_profile_id,
    actor_name
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_operation_id,
    p_client_id,
    p_action,
    NULLIF(trim(p_field_key), ''),
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb),
    v_actor,
    v_actor_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity_event_system(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC;

-- Backfill histórico (idempotente)
UPDATE public.activity_events ae
SET actor_name = public.resolve_activity_actor_name(ae.actor_profile_id)
WHERE ae.actor_profile_id IS NOT NULL
  AND (ae.actor_name IS NULL OR trim(ae.actor_name) = '');
