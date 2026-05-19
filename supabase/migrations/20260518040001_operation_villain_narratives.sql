-- operation_villain_narratives
-- Narrativa textual do progresso de um vilao naquela Operacao em um mes especifico.
-- Editavel pelo time interno; lida no link publico.

CREATE TABLE IF NOT EXISTS public.operation_villain_narratives (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id     uuid NOT NULL,
  villain_id       uuid NOT NULL,
  period_yyyymm    text NOT NULL,
  narrative_text   text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ovn_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ovn_villain_id FOREIGN KEY (villain_id)
    REFERENCES public.villains(id) ON DELETE RESTRICT
);

-- CHECKs (idempotente via DO $$ pattern)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ovn_period_format'
  ) THEN
    ALTER TABLE public.operation_villain_narratives
      ADD CONSTRAINT ovn_period_format
      CHECK (period_yyyymm ~ '^\d{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ovn_narrative_min_length'
  ) THEN
    ALTER TABLE public.operation_villain_narratives
      ADD CONSTRAINT ovn_narrative_min_length
      CHECK (length(trim(narrative_text)) >= 20);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ovn_unique_per_period'
  ) THEN
    ALTER TABLE public.operation_villain_narratives
      ADD CONSTRAINT ovn_unique_per_period
      UNIQUE (operation_id, villain_id, period_yyyymm);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ovn_op_period
  ON public.operation_villain_narratives (operation_id, period_yyyymm);

ALTER TABLE public.operation_villain_narratives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ovn_authenticated_full ON public.operation_villain_narratives;
CREATE POLICY ovn_authenticated_full
  ON public.operation_villain_narratives
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_ovn_updated_at ON public.operation_villain_narratives;
CREATE TRIGGER trg_ovn_updated_at
  BEFORE UPDATE ON public.operation_villain_narratives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.operation_villain_narratives IS
  'public-report: narrativa textual do progresso de um vilao naquela Operacao em um mes especifico. Editavel pelo time interno; lida no link publico. UNIQUE(operation_id, villain_id, period_yyyymm).';

COMMENT ON COLUMN public.operation_villain_narratives.period_yyyymm IS
  'Periodo no formato YYYY-MM (CHECK valida formato). Mes do relatorio.';

COMMENT ON COLUMN public.operation_villain_narratives.narrative_text IS
  'Texto narrativo do progresso. CHECK exige >= 20 chars apos trim.';
