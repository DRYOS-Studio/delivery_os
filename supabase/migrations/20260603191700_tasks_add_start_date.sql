-- tasks: adiciona data de início (start_date) ao lado do prazo (due_date).
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date date;

COMMENT ON COLUMN public.tasks.start_date IS
  'Data de início planejada (granularidade dia), nullable. CHECK check_tasks_start_before_due garante start_date <= due_date quando ambos preenchidos.';

-- Invariante: início não pode ser depois do prazo (quando ambos existem).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS check_tasks_start_before_due;
ALTER TABLE public.tasks ADD CONSTRAINT check_tasks_start_before_due
  CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
