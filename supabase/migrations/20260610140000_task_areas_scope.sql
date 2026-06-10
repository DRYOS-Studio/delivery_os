-- Áreas internas (CS/Financeiro/Jurídico) + gating de acesso por área (escopo global).
-- Base pras "tarefas de área": visíveis a admin + quem é da área, em toda a carteira.

-- 1. Enum de áreas (extensível via ALTER TYPE ADD VALUE em migration própria)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_area') THEN
    CREATE TYPE task_area AS ENUM ('cs', 'financeiro', 'juridico');
  END IF;
END $$;

-- 2. profile_areas: vincula o login (profile) a áreas. Profile-based (consistente
-- com operation_members; auth.uid() resolve direto, sem depender de person_id).
CREATE TABLE IF NOT EXISTS public.profile_areas (
  profile_id uuid NOT NULL,
  area       task_area NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT pk_profile_areas PRIMARY KEY (profile_id, area),
  CONSTRAINT fk_profile_areas_profile_id FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_areas_created_by FOREIGN KEY (created_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.profile_areas IS
  'auth/scope: vincula profile a uma área (CS/Financeiro/Jurídico). Escopo GLOBAL: quem está aqui vê tasks daquela área de TODAS as operações. Admin vê tudo sem row. INSERT/DELETE só por admin.';

CREATE INDEX IF NOT EXISTS idx_profile_areas_profile
  ON public.profile_areas(profile_id);

-- RLS: admin gere tudo; member só lê os próprios vínculos.
ALTER TABLE public.profile_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_admin_all ON public.profile_areas;
CREATE POLICY pa_admin_all ON public.profile_areas
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pa_member_select_self ON public.profile_areas;
CREATE POLICY pa_member_select_self ON public.profile_areas
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- 3. Helper de visibilidade por área (espelha can_see_operation)
CREATE OR REPLACE FUNCTION public.can_see_area(a task_area)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profile_areas
    WHERE profile_id = auth.uid() AND area = a
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_area(task_area) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_see_area(task_area) TO authenticated;

COMMENT ON FUNCTION public.can_see_area(task_area) IS
  'auth/scope: true se admin OU profile com row em profile_areas pra essa área. Base da RLS de tasks de área (escopo global).';
