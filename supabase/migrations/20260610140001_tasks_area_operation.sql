-- Tarefas de área no nível da Operação (XOR com tarefas de entrega).
-- Tarefa de entrega: area NULL + frente_id obrigatório (comportamento atual).
-- Tarefa de área:    area setada + frente_id NULL, gated por can_see_area.

-- 1. Colunas
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS area public.task_area NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS operation_id uuid NULL;

-- 2. Backfill operation_id a partir da Frente (ANTES do NOT NULL)
UPDATE public.tasks t
   SET operation_id = f.operation_id
  FROM public.frentes f
 WHERE f.id = t.frente_id AND t.operation_id IS NULL;

-- 3. NOT NULL em operation_id; frente_id passa a ser nullable
ALTER TABLE public.tasks ALTER COLUMN operation_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN frente_id DROP NOT NULL;

-- 4. FK + indexes
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_operation_id;
ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_operation_id FOREIGN KEY (operation_id)
  REFERENCES public.operations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_operation_area
  ON public.tasks(operation_id, area);
CREATE INDEX IF NOT EXISTS idx_tasks_area
  ON public.tasks(area) WHERE area IS NOT NULL;

-- 5. CHECK XOR: entrega <=> tem frente; área <=> sem frente
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_tasks_area_xor_frente;
ALTER TABLE public.tasks ADD CONSTRAINT check_tasks_area_xor_frente
  CHECK (
    (area IS NULL     AND frente_id IS NOT NULL)
    OR
    (area IS NOT NULL AND frente_id IS NULL)
  );

COMMENT ON COLUMN public.tasks.area IS
  'Tarefa de área (CS/Financeiro/Jurídico) quando setada — transversal à Operação, sem Frente, visível só a admin + quem é da área (can_see_area, escopo global). NULL = tarefa de entrega normal.';
COMMENT ON COLUMN public.tasks.operation_id IS
  'Operação da tarefa. Sempre presente. Em tarefa de entrega é derivada da Frente (trigger sync_task_operation); em tarefa de área é informada direto.';

-- 6. Trigger: coerência operation_id vs Frente
CREATE OR REPLACE FUNCTION public.sync_task_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f_op uuid;
BEGIN
  IF NEW.frente_id IS NOT NULL THEN
    SELECT f.operation_id INTO f_op FROM public.frentes f WHERE f.id = NEW.frente_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Frente não encontrada.';
    END IF;
    IF NEW.operation_id IS NULL THEN
      NEW.operation_id := f_op;
    ELSIF NEW.operation_id <> f_op THEN
      RAISE EXCEPTION 'operation_id diverge da Operação da Frente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_task_operation ON public.tasks;
CREATE TRIGGER sync_task_operation
  BEFORE INSERT OR UPDATE OF frente_id, operation_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_operation();

-- 7. enforce_task_parent: tarefa de área é flat (sem subtarefa) no v1
CREATE OR REPLACE FUNCTION public.enforce_task_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_parent uuid;
  parent_frente uuid;
BEGIN
  IF NEW.parent_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.area IS NOT NULL THEN
    RAISE EXCEPTION 'Subtarefa não suportada em tarefa de área.';
  END IF;

  SELECT t.parent_task_id, t.frente_id
    INTO parent_parent, parent_frente
    FROM public.tasks t
    WHERE t.id = NEW.parent_task_id;

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

-- 8. Helper can_see_task (p/ RLS de task_assignees; NÃO usar na RLS de tasks — recursão)
CREATE OR REPLACE FUNCTION public.can_see_task(t_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = t_id
      AND (
        (t.area IS NULL     AND public.can_see_operation(t.operation_id))
        OR
        (t.area IS NOT NULL AND public.can_see_area(t.area))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_see_task(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_see_task(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_see_task(uuid) IS
  'auth/scope: true se o usuário pode ver a task (entrega via can_see_operation, área via can_see_area). Usado pela RLS de task_assignees.';

-- 9. RLS de tasks reescrita (area NULL -> operação; area setada -> área)
DROP POLICY IF EXISTS tasks_scoped_select ON public.tasks;
CREATE POLICY tasks_scoped_select ON public.tasks FOR SELECT TO authenticated
  USING (
    (area IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area IS NOT NULL AND public.can_see_area(area))
  );

DROP POLICY IF EXISTS tasks_scoped_insert ON public.tasks;
CREATE POLICY tasks_scoped_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    (area IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area IS NOT NULL AND public.can_see_area(area))
  );

DROP POLICY IF EXISTS tasks_scoped_update ON public.tasks;
CREATE POLICY tasks_scoped_update ON public.tasks FOR UPDATE TO authenticated
  USING (
    (area IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area IS NOT NULL AND public.can_see_area(area))
  )
  WITH CHECK (
    (area IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area IS NOT NULL AND public.can_see_area(area))
  );

DROP POLICY IF EXISTS tasks_scoped_delete ON public.tasks;
CREATE POLICY tasks_scoped_delete ON public.tasks FOR DELETE TO authenticated
  USING (
    (area IS NULL     AND public.can_see_operation(operation_id))
    OR
    (area IS NOT NULL AND public.can_see_area(area))
  );

-- 10. RLS de task_assignees via can_see_task (a atual joina via frente e quebra com frente NULL)
DROP POLICY IF EXISTS task_assignees_scoped_select ON public.task_assignees;
CREATE POLICY task_assignees_scoped_select ON public.task_assignees
  FOR SELECT TO authenticated
  USING (public.can_see_task(task_id));

DROP POLICY IF EXISTS task_assignees_scoped_insert ON public.task_assignees;
CREATE POLICY task_assignees_scoped_insert ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (public.can_see_task(task_id));

DROP POLICY IF EXISTS task_assignees_scoped_delete ON public.task_assignees;
CREATE POLICY task_assignees_scoped_delete ON public.task_assignees
  FOR DELETE TO authenticated
  USING (public.can_see_task(task_id));

-- 11. COMMENT da tabela (invariante mudou: frente_id NOT NULL -> XOR com area)
COMMENT ON TABLE public.tasks IS
  'frente/operação: tarefas. XOR — tarefa de entrega (area NULL, frente_id obrigatório, visível à Operação) OU tarefa de área (area setada, frente_id NULL, no nível da Operação, visível só a admin + área via can_see_area). operation_id sempre presente. Interna — não aparece em /public.';
