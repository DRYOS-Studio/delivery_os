-- Enum task_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('todo', 'doing', 'blocked', 'done');
  END IF;
END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frente_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo',
  assignee_person_id uuid,
  due_date date,
  tags text[],
  quick_win_id uuid,
  sla_incident_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT fk_tasks_frente_id FOREIGN KEY (frente_id)
    REFERENCES public.frentes(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee_person_id FOREIGN KEY (assignee_person_id)
    REFERENCES public.persons(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_quick_win_id FOREIGN KEY (quick_win_id)
    REFERENCES public.quick_wins(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_sla_incident_id FOREIGN KEY (sla_incident_id)
    REFERENCES public.sla_incidents(id) ON DELETE SET NULL,
  CONSTRAINT check_tasks_title_length CHECK (char_length(title) >= 3)
);

COMMENT ON TABLE public.tasks IS
  'frente: tarefas planejadas de execução. Inv. de família: frente_id NOT NULL (Task não existe sem Frente). Interna — sem visibility, não aparece em /public.';
COMMENT ON COLUMN public.tasks.completed_at IS
  'Auto-managed por trigger manage_task_completed_at: set quando status → done, clear quando sai de done.';
COMMENT ON COLUMN public.tasks.tags IS
  'Tags livres (sem catálogo). Dedup é responsabilidade do front.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_frente_status
  ON public.tasks(frente_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON public.tasks(assignee_person_id) WHERE assignee_person_id IS NOT NULL;

-- Trigger: updated_at
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: manage completed_at
CREATE OR REPLACE FUNCTION public.manage_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'done') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
      NEW.completed_at := now();
    ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS manage_task_completed_at ON public.tasks;
CREATE TRIGGER manage_task_completed_at
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.manage_task_completed_at();

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_authenticated_full ON public.tasks;
CREATE POLICY tasks_authenticated_full ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
