-- meetings-decisions: registro temporal da Operação.
-- meetings (com N:N attendees) + decisions standalone com FK opcional pra meeting.
-- Inv. 02 (decisão ≠ tarefa) + Inv. 05 (decisão tem visibility própria).

-- ============================================================================
-- ENUMS (separados pra explicitar Inv. 05)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_visibility') THEN
    CREATE TYPE meeting_visibility AS ENUM ('interno', 'cliente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_visibility') THEN
    CREATE TYPE decision_visibility AS ENUM ('interno', 'cliente');
  END IF;
END $$;

-- ============================================================================
-- TABLE: meetings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  visibility meeting_visibility NOT NULL DEFAULT 'interno',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_meetings_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_operation_scheduled
  ON public.meetings (operation_id, scheduled_at DESC);

COMMENT ON TABLE public.meetings IS
  'reunião: registro temporal com cliente ou interna. Liga a uma Operação. Visibility própria (Inv. 05).';

DROP TRIGGER IF EXISTS set_meetings_updated_at ON public.meetings;
CREATE TRIGGER set_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE: meeting_attendees (N:N)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  meeting_id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, person_id),
  CONSTRAINT fk_meeting_attendees_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_attendees_person_id
    FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.meeting_attendees IS
  'junção N:N entre meetings e persons. RESTRICT em person pra preservar histórico.';

-- ============================================================================
-- TABLE: decisions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  meeting_id uuid,
  title text NOT NULL,
  context text,
  decision text NOT NULL,
  visibility decision_visibility NOT NULL DEFAULT 'cliente',
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_decisions_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_decisions_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_operation_decided
  ON public.decisions (operation_id, decided_at DESC);

COMMENT ON TABLE public.decisions IS
  'decisão: registro perpétuo (Inv. 02). Standalone (operation_id NOT NULL) com meeting_id opcional (SET NULL).';

COMMENT ON COLUMN public.decisions.visibility IS
  'Visibility independente da meeting (Inv. 05): reunião com cliente pode ter decisões internas.';

DROP TRIGGER IF EXISTS set_decisions_updated_at ON public.decisions;
CREATE TRIGGER set_decisions_updated_at
  BEFORE UPDATE ON public.decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_authenticated_full ON public.meetings;
CREATE POLICY meetings_authenticated_full ON public.meetings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS meeting_attendees_authenticated_full ON public.meeting_attendees;
CREATE POLICY meeting_attendees_authenticated_full ON public.meeting_attendees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS decisions_authenticated_full ON public.decisions;
CREATE POLICY decisions_authenticated_full ON public.decisions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
