-- Reuniões: pauta e próximos passos em tabelas filhas; sugestão editável de import (Granola)
-- em `meetings`; decisões podem referenciar item de pauta (`decisions.agenda_item_id`).
-- RLS espelha `meeting_attendees` (operação via meeting).

-- ── meetings: colunas Granola (sugestão editável, não substitui pauta estruturada) ──
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS granola_suggestion_text text,
  ADD COLUMN IF NOT EXISTS granola_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS granola_source_ref text;

COMMENT ON COLUMN public.meetings.granola_suggestion_text IS
  'Texto colado/importado do Granola ou outra fonte; editável antes de virar itens de pauta oficiais.';
COMMENT ON COLUMN public.meetings.granola_captured_at IS
  'Quando a sugestão foi capturada (opcional, para auditoria leve).';
COMMENT ON COLUMN public.meetings.granola_source_ref IS
  'Identificador externo opcional (ex.: id de nota no Granola), texto livre.';

-- ── meeting_agenda_items ──
CREATE TABLE IF NOT EXISTS public.meeting_agenda_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id              uuid NOT NULL,
  sort_order              int NOT NULL DEFAULT 0,
  title                   text NOT NULL,
  notes                   text,
  source                  text NOT NULL DEFAULT 'manual',
  granola_line            text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_meeting_agenda_items_meeting
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE,
  CONSTRAINT chk_meeting_agenda_items_title
    CHECK (char_length(trim(title)) >= 1),
  CONSTRAINT chk_meeting_agenda_items_source
    CHECK (source IN ('manual', 'granola'))
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting_sort
  ON public.meeting_agenda_items (meeting_id, sort_order);

COMMENT ON TABLE public.meeting_agenda_items IS
  'reunião: item de pauta ordenado. Decisões podem apontar para um item via decisions.agenda_item_id.';

DROP TRIGGER IF EXISTS set_meeting_agenda_items_updated_at ON public.meeting_agenda_items;
CREATE TRIGGER set_meeting_agenda_items_updated_at
  BEFORE UPDATE ON public.meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_agenda_items_scoped_select ON public.meeting_agenda_items;
CREATE POLICY meeting_agenda_items_scoped_select ON public.meeting_agenda_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_items.meeting_id
      AND (public.can_see_operation(m.operation_id)
           OR (m.visibility = 'cliente' AND public.is_area_granted(m.operation_id)))
  ));

DROP POLICY IF EXISTS meeting_agenda_items_scoped_insert ON public.meeting_agenda_items;
CREATE POLICY meeting_agenda_items_scoped_insert ON public.meeting_agenda_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)
  ));

DROP POLICY IF EXISTS meeting_agenda_items_scoped_update ON public.meeting_agenda_items;
CREATE POLICY meeting_agenda_items_scoped_update ON public.meeting_agenda_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_items.meeting_id AND public.can_see_operation(m.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)
  ));

DROP POLICY IF EXISTS meeting_agenda_items_scoped_delete ON public.meeting_agenda_items;
CREATE POLICY meeting_agenda_items_scoped_delete ON public.meeting_agenda_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_items.meeting_id AND public.can_see_operation(m.operation_id)
  ));

-- ── meeting_agenda_next_steps ──
CREATE TABLE IF NOT EXISTS public.meeting_agenda_next_steps (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id              uuid NOT NULL,
  sort_order              int NOT NULL DEFAULT 0,
  description             text NOT NULL,
  due_date                date,
  task_id                 uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_meeting_agenda_next_steps_meeting
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_agenda_next_steps_task
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  CONSTRAINT chk_meeting_agenda_next_steps_description
    CHECK (char_length(trim(description)) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_next_steps_meeting_sort
  ON public.meeting_agenda_next_steps (meeting_id, sort_order);

COMMENT ON TABLE public.meeting_agenda_next_steps IS
  'reunião: próximo passo acordado; pode promover para tasks (task_id) mantendo o vínculo.';

DROP TRIGGER IF EXISTS set_meeting_agenda_next_steps_updated_at ON public.meeting_agenda_next_steps;
CREATE TRIGGER set_meeting_agenda_next_steps_updated_at
  BEFORE UPDATE ON public.meeting_agenda_next_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meeting_agenda_next_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_agenda_next_steps_scoped_select ON public.meeting_agenda_next_steps;
CREATE POLICY meeting_agenda_next_steps_scoped_select ON public.meeting_agenda_next_steps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_next_steps.meeting_id
      AND (public.can_see_operation(m.operation_id)
           OR (m.visibility = 'cliente' AND public.is_area_granted(m.operation_id)))
  ));

DROP POLICY IF EXISTS meeting_agenda_next_steps_scoped_insert ON public.meeting_agenda_next_steps;
CREATE POLICY meeting_agenda_next_steps_scoped_insert ON public.meeting_agenda_next_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)
  ));

DROP POLICY IF EXISTS meeting_agenda_next_steps_scoped_update ON public.meeting_agenda_next_steps;
CREATE POLICY meeting_agenda_next_steps_scoped_update ON public.meeting_agenda_next_steps FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_next_steps.meeting_id AND public.can_see_operation(m.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND public.can_see_operation(m.operation_id)
  ));

DROP POLICY IF EXISTS meeting_agenda_next_steps_scoped_delete ON public.meeting_agenda_next_steps;
CREATE POLICY meeting_agenda_next_steps_scoped_delete ON public.meeting_agenda_next_steps FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_agenda_next_steps.meeting_id AND public.can_see_operation(m.operation_id)
  ));

-- ── decisions.agenda_item_id (opcional; só faz sentido com meeting_id preenchido) ──
ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS agenda_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_decisions_agenda_item_id'
  ) THEN
    ALTER TABLE public.decisions
      ADD CONSTRAINT fk_decisions_agenda_item_id
        FOREIGN KEY (agenda_item_id) REFERENCES public.meeting_agenda_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decisions_agenda_item
  ON public.decisions (agenda_item_id)
  WHERE agenda_item_id IS NOT NULL;

COMMENT ON COLUMN public.decisions.agenda_item_id IS
  'Opcional: decisão ligada a um item específico da pauta da reunião referenciada por meeting_id.';

ALTER TABLE public.decisions DROP CONSTRAINT IF EXISTS chk_decisions_agenda_requires_meeting;
ALTER TABLE public.decisions
  ADD CONSTRAINT chk_decisions_agenda_requires_meeting
  CHECK (agenda_item_id IS NULL OR meeting_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.enforce_decision_agenda_item_meeting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_meeting uuid;
BEGIN
  IF NEW.agenda_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.meeting_id IS NULL THEN
    RAISE EXCEPTION 'decisão com agenda_item_id exige meeting_id';
  END IF;
  SELECT mai.meeting_id INTO item_meeting
  FROM public.meeting_agenda_items mai
  WHERE mai.id = NEW.agenda_item_id;
  IF item_meeting IS NULL THEN
    RAISE EXCEPTION 'item de pauta não encontrado';
  END IF;
  IF item_meeting <> NEW.meeting_id THEN
    RAISE EXCEPTION 'item de pauta não pertence à reunião referenciada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decisions_agenda_item_meeting ON public.decisions;
CREATE TRIGGER trg_decisions_agenda_item_meeting
  BEFORE INSERT OR UPDATE OF agenda_item_id, meeting_id ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_decision_agenda_item_meeting();
