-- activity_events: assunto `profile` para auditoria de convites e vínculos (admin).

ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'profile';

CREATE OR REPLACE FUNCTION public.can_read_activity_subject(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_subject_type
    WHEN 'client' THEN (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_subject_id
          AND EXISTS (
            SELECT 1 FROM public.operations o
            WHERE o.client_id = c.id
              AND public.can_read_operation(o.id)
          )
      )
    )
    WHEN 'operation' THEN public.can_read_operation(p_subject_id)
    WHEN 'frente' THEN EXISTS (
      SELECT 1 FROM public.frentes f
      WHERE f.id = p_subject_id
        AND public.can_read_operation(f.operation_id)
    )
    WHEN 'task' THEN public.can_see_task(p_subject_id)
    WHEN 'client_contract' THEN (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.client_contracts cc
        JOIN public.clients c ON c.id = cc.client_id
        WHERE cc.id = p_subject_id
          AND EXISTS (
            SELECT 1 FROM public.operations o
            WHERE o.client_id = c.id
              AND public.can_read_operation(o.id)
          )
      )
    )
    WHEN 'profile' THEN public.is_admin()
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.can_read_activity_subject(public.activity_subject_type, uuid) IS
  'audit: visibilidade do feed — profile só admin.';
