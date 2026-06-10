-- Subtarefas: hierarquia pai->filho de 1 nível, dentro da mesma Frente.

-- 1. Coluna self-FK
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS fk_tasks_parent_task_id;
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_parent_task_id FOREIGN KEY (parent_task_id)
    REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS check_tasks_not_self_parent;
ALTER TABLE public.tasks
  ADD CONSTRAINT check_tasks_not_self_parent
    CHECK (parent_task_id IS NULL OR parent_task_id <> id);

COMMENT ON COLUMN public.tasks.parent_task_id IS
  'Subtarefa: aponta pra tarefa pai. NULL = top-level. Hierarquia trava em 1 nível e mesma Frente (trigger enforce_task_parent). ON DELETE CASCADE: deletar pai apaga subtarefas.';

CREATE INDEX IF NOT EXISTS idx_tasks_parent
  ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- 2. Trigger: garante hierarquia de 1 nível + mesma Frente
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

  IF parent_frente <> NEW.frente_id THEN
    RAISE EXCEPTION 'Subtarefa precisa estar na mesma Frente da tarefa-pai.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.parent_task_id = NEW.id) THEN
    RAISE EXCEPTION 'Tarefa com subtarefas não pode virar subtarefa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_parent ON public.tasks;
CREATE TRIGGER enforce_task_parent
  BEFORE INSERT OR UPDATE OF parent_task_id, frente_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_parent();
