-- operation-villains: M:N entre operations e villains.
-- Inv. 07: initial_severity write-once (trigger BEFORE UPDATE).
-- Inv. 08 parcial: progress_pct capped 0-100 (CHECK). Cap soma 100% por vilão via quick_wins.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_level') THEN
    CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operation_villains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  villain_id uuid NOT NULL,
  initial_severity severity_level NOT NULL,
  progress_pct integer NOT NULL DEFAULT 0,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_villains_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_villains_villain_id
    FOREIGN KEY (villain_id) REFERENCES public.villains(id) ON DELETE RESTRICT,
  CONSTRAINT uq_operation_villains_op_villain
    UNIQUE (operation_id, villain_id),
  CONSTRAINT chk_operation_villains_progress_range
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  CONSTRAINT chk_operation_villains_evidence_length
    CHECK (evidence IS NULL OR length(evidence) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_operation_villains_operation_created
  ON public.operation_villains (operation_id, created_at DESC);

COMMENT ON TABLE public.operation_villains IS
  'M:N entre operation e villain. Inv. 07: initial_severity write-once via trigger. Inv. 08: progress_pct capped 0-100.';
COMMENT ON COLUMN public.operation_villains.initial_severity IS
  'Write-once: vem do diagnóstico, não muda. Trigger BEFORE UPDATE bloqueia mudanças.';

-- ============================================================================
-- TRIGGER write-once em initial_severity (Inv. 07)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lock_operation_villain_initial_severity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.initial_severity IS DISTINCT FROM OLD.initial_severity THEN
    RAISE EXCEPTION 'initial_severity é write-once (Inv. 07). Para mudar, delete e recrie a atribuição.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_operation_villains_initial_severity
  ON public.operation_villains;
CREATE TRIGGER lock_operation_villains_initial_severity
  BEFORE UPDATE ON public.operation_villains
  FOR EACH ROW EXECUTE FUNCTION public.lock_operation_villain_initial_severity();

-- ============================================================================
-- TRIGGER updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS set_operation_villains_updated_at
  ON public.operation_villains;
CREATE TRIGGER set_operation_villains_updated_at
  BEFORE UPDATE ON public.operation_villains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.operation_villains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_villains_authenticated_full ON public.operation_villains;
CREATE POLICY operation_villains_authenticated_full
  ON public.operation_villains FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
