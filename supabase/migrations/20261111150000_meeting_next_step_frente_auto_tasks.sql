-- Frente por próximo passo + toggle de criação automática de tarefas na reunião.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS auto_create_tasks_from_next_steps boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.meetings.auto_create_tasks_from_next_steps IS
  'Quando true, próximos passos com frente resolvida viram tarefas ao salvar (UI/MCP).';

ALTER TABLE public.meeting_agenda_next_steps
  ADD COLUMN IF NOT EXISTS frente_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_meeting_agenda_next_steps_frente'
  ) THEN
    ALTER TABLE public.meeting_agenda_next_steps
      ADD CONSTRAINT fk_meeting_agenda_next_steps_frente
        FOREIGN KEY (frente_id) REFERENCES public.frentes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_next_steps_frente
  ON public.meeting_agenda_next_steps (frente_id)
  WHERE frente_id IS NOT NULL;

COMMENT ON COLUMN public.meeting_agenda_next_steps.frente_id IS
  'Frente alvo ao promover passo em tarefa; se NULL, usa a única frente ativa da operação quando existir.';

CREATE OR REPLACE FUNCTION public.enforce_meeting_next_step_frente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_meeting_op uuid;
  v_frente_op uuid;
BEGIN
  IF NEW.frente_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT m.operation_id INTO v_meeting_op
  FROM public.meetings m
  WHERE m.id = NEW.meeting_id;
  IF v_meeting_op IS NULL THEN
    RAISE EXCEPTION 'próximo passo: reunião não encontrada';
  END IF;
  SELECT f.operation_id INTO v_frente_op
  FROM public.frentes f
  WHERE f.id = NEW.frente_id AND f.archived_at IS NULL;
  IF v_frente_op IS NULL THEN
    RAISE EXCEPTION 'frente do próximo passo não encontrada ou arquivada';
  END IF;
  IF v_frente_op IS DISTINCT FROM v_meeting_op THEN
    RAISE EXCEPTION 'frente deve pertencer à mesma operação da reunião';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_next_step_frente ON public.meeting_agenda_next_steps;
CREATE TRIGGER trg_meeting_next_step_frente
  BEFORE INSERT OR UPDATE OF frente_id, meeting_id ON public.meeting_agenda_next_steps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_meeting_next_step_frente();

NOTIFY pgrst, 'reload schema';
