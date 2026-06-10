-- PR1/M-B: migra enum task_area → FK area_id em tasks e profile_areas.
-- Ordem RT-M3: add coluna+backfill → helpers novos → replace funções → drop policies
-- que referenciam coluna/função antiga → drop can_see_area → DDL destrutiva → recriar
-- constraints/triggers/índices/policies → drop type. Idempotente.

-- ── 1. Colunas area_id + backfill (enum-value casa areas.slug) ────────────────
ALTER TABLE public.tasks         ADD COLUMN IF NOT EXISTS area_id uuid;
ALTER TABLE public.profile_areas ADD COLUMN IF NOT EXISTS area_id uuid;

UPDATE public.tasks t
   SET area_id = a.id
  FROM public.areas a
 WHERE t.area IS NOT NULL AND a.slug = t.area::text AND t.area_id IS NULL;

UPDATE public.profile_areas pa
   SET area_id = a.id
  FROM public.areas a
 WHERE a.slug = pa.area::text AND pa.area_id IS NULL;

-- ── 2. Funções-base novas (não tocam tasks → sem recursão) ───────────────────
CREATE OR REPLACE FUNCTION public.area_can_reach_operation(p_area_id uuid, p_op_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.area_operations ao
      WHERE ao.area_id = p_area_id AND ao.operation_id = p_op_id
    ) OR EXISTS (
      SELECT 1 FROM public.area_clients ac
      JOIN public.operations o ON o.client_id = ac.client_id
      WHERE ac.area_id = p_area_id AND o.id = p_op_id
    );
$$;
REVOKE EXECUTE ON FUNCTION public.area_can_reach_operation(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.area_can_reach_operation(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.area_can_reach_operation(uuid, uuid) IS
  'auth/scope: concessão pura (sem auth) — área alcança operação via area_operations OU area_clients. NÃO toca tasks (evita recursão de RLS).';

CREATE OR REPLACE FUNCTION public.is_area_granted(p_op_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profile_areas pa
    JOIN public.areas a ON a.id = pa.area_id AND a.archived_at IS NULL
    WHERE pa.profile_id = auth.uid()
      AND public.area_can_reach_operation(pa.area_id, p_op_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_area_granted(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_area_granted(uuid) TO authenticated;
COMMENT ON FUNCTION public.is_area_granted(uuid) IS
  'auth/scope: true se admin OU sou de uma área (não-arquivada) que alcança a operação. Base da leitura de painel por área.';

CREATE OR REPLACE FUNCTION public.user_in_area(p_area_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profile_areas pa
    WHERE pa.profile_id = auth.uid() AND pa.area_id = p_area_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_in_area(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_in_area(uuid) TO authenticated;
COMMENT ON FUNCTION public.user_in_area(uuid) IS
  'auth/scope: true se admin OU sou membro da área (substitui can_see_area(task_area)).';

-- ── 3. Replace can_read_operation (tira o ramo que derivava de tasks) ─────────
-- Mantém o nome do parâmetro `op_id` (CREATE OR REPLACE não pode renomear param).
CREATE OR REPLACE FUNCTION public.can_read_operation(op_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_see_operation(op_id) OR public.is_area_granted(op_id);
$$;
COMMENT ON FUNCTION public.can_read_operation(uuid) IS
  'auth/scope: leitura. can_see_operation OU concessão de área (is_area_granted). NÃO usar em WITH CHECK (escrita continua can_see_operation).';

-- ── 4. Replace can_see_task (usa area_id + concessão; não chama can_see_area) ──
CREATE OR REPLACE FUNCTION public.can_see_task(t_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = t_id
      AND (
        (t.area_id IS NULL  AND public.can_read_operation(t.operation_id))
        OR
        (t.area_id IS NOT NULL AND (public.is_admin()
            OR (public.user_in_area(t.area_id)
                AND public.area_can_reach_operation(t.area_id, t.operation_id))))
      )
  );
$$;

-- ── 5. Drop policies que referenciam coluna `area` ou can_see_area ───────────
DROP POLICY IF EXISTS tasks_scoped_select ON public.tasks;
DROP POLICY IF EXISTS tasks_scoped_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_scoped_update ON public.tasks;
DROP POLICY IF EXISTS tasks_scoped_delete ON public.tasks;
DROP POLICY IF EXISTS task_assignees_scoped_select ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_scoped_insert ON public.task_assignees;
DROP POLICY IF EXISTS task_assignees_scoped_delete ON public.task_assignees;
DROP POLICY IF EXISTS clients_scoped_select ON public.clients;
DROP POLICY IF EXISTS persons_scoped_select ON public.persons;

-- ── 6. Drop can_see_area(task_area) (agora sem referências) ───────────────────
DROP FUNCTION IF EXISTS public.can_see_area(public.task_area);

-- ── 7. DDL destrutiva em tasks ───────────────────────────────────────────────
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_tasks_area_xor_frente;
DROP TRIGGER IF EXISTS enforce_task_area_immutable ON public.tasks;
DROP INDEX IF EXISTS public.idx_tasks_area;
DROP INDEX IF EXISTS public.idx_tasks_operation_area;

-- enforce_task_parent: NEW.area → NEW.area_id
CREATE OR REPLACE FUNCTION public.enforce_task_parent()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  parent_parent uuid;
  parent_frente uuid;
BEGIN
  IF NEW.parent_task_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.area_id IS NOT NULL THEN
    RAISE EXCEPTION 'Subtarefa não suportada em tarefa de área.';
  END IF;
  SELECT t.parent_task_id, t.frente_id INTO parent_parent, parent_frente
    FROM public.tasks t WHERE t.id = NEW.parent_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa-pai não encontrada.';
  END IF;
  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Subtarefa não pode ter subtarefa (hierarquia de 1 nível).';
  END IF;
  IF parent_frente IS DISTINCT FROM NEW.frente_id THEN
    RAISE EXCEPTION 'Subtarefa precisa estar na mesma Frente da tarefa-pai.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.parent_task_id = NEW.id) THEN
    RAISE EXCEPTION 'Tarefa com subtarefas não pode virar subtarefa.';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.tasks DROP COLUMN IF EXISTS area;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_area_id;
ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_area_id FOREIGN KEY (area_id)
  REFERENCES public.areas(id) ON DELETE RESTRICT;

ALTER TABLE public.tasks ADD CONSTRAINT check_tasks_area_xor_frente
  CHECK (
    (area_id IS NULL     AND frente_id IS NOT NULL)
    OR
    (area_id IS NOT NULL AND frente_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tasks_operation_area ON public.tasks(operation_id, area_id);
CREATE INDEX IF NOT EXISTS idx_tasks_area ON public.tasks(area_id) WHERE area_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.area_id IS
  'Tarefa de área (FK areas) quando setada — transversal à Operação, sem Frente, visível a admin + quem é da área COM concessão da operação (area_can_reach_operation). NULL = tarefa de entrega.';

-- enforce_task_area_immutable: OF area_id
CREATE OR REPLACE FUNCTION public.enforce_task_area_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.area_id IS DISTINCT FROM OLD.area_id THEN
    RAISE EXCEPTION 'A área da tarefa é imutável após a criação.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_task_area_immutable ON public.tasks;
CREATE TRIGGER enforce_task_area_immutable
  BEFORE UPDATE OF area_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_area_immutable();

-- ── 8. DDL destrutiva em profile_areas (PK enum→FK) ──────────────────────────
ALTER TABLE public.profile_areas DROP CONSTRAINT IF EXISTS pk_profile_areas;
ALTER TABLE public.profile_areas DROP COLUMN IF EXISTS area;
ALTER TABLE public.profile_areas ALTER COLUMN area_id SET NOT NULL;
ALTER TABLE public.profile_areas ADD CONSTRAINT pk_profile_areas PRIMARY KEY (profile_id, area_id);
ALTER TABLE public.profile_areas DROP CONSTRAINT IF EXISTS fk_profile_areas_area_id;
ALTER TABLE public.profile_areas ADD CONSTRAINT fk_profile_areas_area_id FOREIGN KEY (area_id)
  REFERENCES public.areas(id) ON DELETE CASCADE;

-- ── 9. Drop o type task_area (sem mais usos) ─────────────────────────────────
DROP TYPE IF EXISTS public.task_area;

-- ── 10. Recriar policies (lista nominal RT-B2) ───────────────────────────────
-- tasks: leitura = entrega via can_read_operation; área via área+concessão.
CREATE POLICY tasks_scoped_select ON public.tasks FOR SELECT TO authenticated
  USING (
    (area_id IS NULL     AND public.can_read_operation(operation_id))
    OR
    (area_id IS NOT NULL AND (public.is_admin()
        OR (public.user_in_area(area_id) AND public.area_can_reach_operation(area_id, operation_id))))
  );
-- escrita: entrega = can_see_operation (read-only pra área); bucket de área = área+concessão.
CREATE POLICY tasks_scoped_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    (area_id IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area_id IS NOT NULL AND (public.is_admin()
        OR (public.user_in_area(area_id) AND public.area_can_reach_operation(area_id, operation_id))))
  );
CREATE POLICY tasks_scoped_update ON public.tasks FOR UPDATE TO authenticated
  USING (
    (area_id IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area_id IS NOT NULL AND (public.is_admin()
        OR (public.user_in_area(area_id) AND public.area_can_reach_operation(area_id, operation_id))))
  )
  WITH CHECK (
    (area_id IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area_id IS NOT NULL AND (public.is_admin()
        OR (public.user_in_area(area_id) AND public.area_can_reach_operation(area_id, operation_id))))
  );
CREATE POLICY tasks_scoped_delete ON public.tasks FOR DELETE TO authenticated
  USING (
    (area_id IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area_id IS NOT NULL AND (public.is_admin()
        OR (public.user_in_area(area_id) AND public.area_can_reach_operation(area_id, operation_id))))
  );

-- task_assignees: via can_see_task; insert preserva guard kind='internal' (RT-B2).
CREATE POLICY task_assignees_scoped_select ON public.task_assignees FOR SELECT TO authenticated
  USING (public.can_see_task(task_id));
CREATE POLICY task_assignees_scoped_insert ON public.task_assignees FOR INSERT TO authenticated
  WITH CHECK (
    public.can_see_task(task_id)
    AND EXISTS (SELECT 1 FROM public.persons p WHERE p.id = person_id AND p.kind = 'internal')
  );
CREATE POLICY task_assignees_scoped_delete ON public.task_assignees FOR DELETE TO authenticated
  USING (public.can_see_task(task_id));

-- clients: admin OU operação visível (can_read_operation cobre membro + área).
CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.operations o
               WHERE o.client_id = clients.id AND public.can_read_operation(o.id))
  );

-- persons: interna via allocations (can_read_operation) ou via tarefa de área concedida;
-- externa só can_see_operation (área não vê contato do cliente).
CREATE POLICY persons_scoped_select ON public.persons FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (kind = 'internal' AND EXISTS (
          SELECT 1 FROM public.allocations a
          JOIN public.frentes f ON f.id = a.frente_id
          WHERE a.person_id = persons.id AND public.can_read_operation(f.operation_id)))
    OR (kind = 'external' AND client_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.operations o
          WHERE o.client_id = persons.client_id AND public.can_see_operation(o.id)))
    OR (kind = 'internal' AND EXISTS (
          SELECT 1 FROM public.task_assignees ta
          JOIN public.tasks t ON t.id = ta.task_id
          WHERE ta.person_id = persons.id
            AND t.area_id IS NOT NULL
            AND public.user_in_area(t.area_id)
            AND public.area_can_reach_operation(t.area_id, t.operation_id)))
  );
