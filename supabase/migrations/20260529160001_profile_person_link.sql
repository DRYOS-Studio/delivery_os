-- Liga o usuário autenticado (profiles) à sua Pessoa interna.
-- Fonte da verdade pra "Minhas Tasks": tasks.assignee_person_id -> persons,
-- que até agora não tinha vínculo com o usuário logado.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_person_id;
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_person_id
  FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.person_id IS
  'Liga o usuário autenticado à sua Pessoa interna (assignee de tasks/alocações). Fonte da verdade pra "Minhas Tasks". Nullable: usuário pode não ter pessoa vinculada.';

CREATE INDEX IF NOT EXISTS idx_profiles_person_id
  ON public.profiles(person_id) WHERE person_id IS NOT NULL;

-- Backfill: casa o email do usuário com uma Pessoa interna não-arquivada.
UPDATE public.profiles p
SET person_id = pe.id
FROM public.persons pe, auth.users u
WHERE p.id = u.id
  AND p.person_id IS NULL
  AND pe.kind = 'internal'
  AND pe.archived_at IS NULL
  AND u.email IS NOT NULL
  AND lower(pe.email) = lower(u.email);
