-- Múltiplos responsáveis por tarefa (todos iguais, N:N).
-- Substitui tasks.assignee_person_id por tabela de junção task_assignees.

-- 1. Tabela de junção
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id    uuid NOT NULL,
  person_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_task_assignees PRIMARY KEY (task_id, person_id),
  CONSTRAINT fk_task_assignees_task_id FOREIGN KEY (task_id)
    REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_assignees_person_id FOREIGN KEY (person_id)
    REFERENCES public.persons(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.task_assignees IS
  'frente: responsáveis (N:N) de uma tarefa, todos iguais (sem principal). Substitui tasks.assignee_person_id. Inv.: RLS espelha tasks via task->frente->operation.';

CREATE INDEX IF NOT EXISTS idx_task_assignees_person
  ON public.task_assignees(person_id);

-- 2. Backfill ANTES de dropar a coluna (irreversível pós-merge)
INSERT INTO public.task_assignees (task_id, person_id)
SELECT id, assignee_person_id
FROM public.tasks
WHERE assignee_person_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop da coluna single-assignee (fonte única passa a ser a junção)
DROP INDEX IF EXISTS public.idx_tasks_assignee;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS fk_tasks_assignee_person_id;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS assignee_person_id;

-- 4. RLS — espelha o gating de tasks (visível se a operação da Frente da task é visível)
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_assignees_scoped_select ON public.task_assignees;
CREATE POLICY task_assignees_scoped_select ON public.task_assignees
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.frentes f ON f.id = t.frente_id
    WHERE t.id = task_assignees.task_id
      AND public.can_see_operation(f.operation_id)
  ));

DROP POLICY IF EXISTS task_assignees_scoped_insert ON public.task_assignees;
CREATE POLICY task_assignees_scoped_insert ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.frentes f ON f.id = t.frente_id
    WHERE t.id = task_assignees.task_id
      AND public.can_see_operation(f.operation_id)
  ));

DROP POLICY IF EXISTS task_assignees_scoped_delete ON public.task_assignees;
CREATE POLICY task_assignees_scoped_delete ON public.task_assignees
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.frentes f ON f.id = t.frente_id
    WHERE t.id = task_assignees.task_id
      AND public.can_see_operation(f.operation_id)
  ));
