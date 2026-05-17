-- diagnostico-quickwins: diagnósticos por cliente + quick wins com impactos em vilões.
-- Inv. 08 enforced: soma de impact_pct por operation_villain capped 100% (trigger BEFORE).
-- progress_pct de operation_villains agora é DERIVED via trigger AFTER.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_recommendation') THEN
    CREATE TYPE product_recommendation AS ENUM ('core', 'spark', 'studio');
  END IF;
END $$;

-- ============================================================================
-- TABLE diagnostics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  notes text NOT NULL,
  recommended_product product_recommendation,
  conducted_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_diagnostics_client_id
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_diagnostics_notes_length
    CHECK (length(notes) >= 10 AND length(notes) <= 10000)
);

COMMENT ON TABLE public.diagnostics IS
  'Diagnóstico precede a Operação (PRD §04). 1 por cliente no MVP; revisões viram v2.';

DROP TRIGGER IF EXISTS set_diagnostics_updated_at ON public.diagnostics;
CREATE TRIGGER set_diagnostics_updated_at
  BEFORE UPDATE ON public.diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ALTER operations: diagnostic_id
-- ============================================================================
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS diagnostic_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_operations_diagnostic_id'
  ) THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT fk_operations_diagnostic_id
      FOREIGN KEY (diagnostic_id) REFERENCES public.diagnostics(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.operations.diagnostic_id IS
  'Link opcional pro diagnóstico do Cliente que originou esta Operação.';

-- ============================================================================
-- TABLE quick_wins
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quick_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  frente_id uuid,
  executor_id uuid,
  title text NOT NULL,
  description text,
  happened_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_quick_wins_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_quick_wins_frente_id
    FOREIGN KEY (frente_id) REFERENCES public.frentes(id) ON DELETE SET NULL,
  CONSTRAINT fk_quick_wins_executor_id
    FOREIGN KEY (executor_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_quick_wins_title_length
    CHECK (length(title) >= 3 AND length(title) <= 200),
  CONSTRAINT chk_quick_wins_description_length
    CHECK (description IS NULL OR length(description) <= 5000)
);

CREATE INDEX IF NOT EXISTS idx_quick_wins_operation_happened
  ON public.quick_wins (operation_id, happened_at DESC);

COMMENT ON TABLE public.quick_wins IS
  'Quick Win: unidade de avanço narrativo. Vinculada a Operação (e opcionalmente Frente). Impactos em vilões via quick_win_impacts.';

DROP TRIGGER IF EXISTS set_quick_wins_updated_at ON public.quick_wins;
CREATE TRIGGER set_quick_wins_updated_at
  BEFORE UPDATE ON public.quick_wins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE quick_win_impacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quick_win_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_win_id uuid NOT NULL,
  operation_villain_id uuid NOT NULL,
  impact_pct integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_quick_win_impacts_quick_win_id
    FOREIGN KEY (quick_win_id) REFERENCES public.quick_wins(id) ON DELETE CASCADE,
  CONSTRAINT fk_quick_win_impacts_operation_villain_id
    FOREIGN KEY (operation_villain_id) REFERENCES public.operation_villains(id) ON DELETE CASCADE,
  CONSTRAINT uq_quick_win_impacts_qw_ov
    UNIQUE (quick_win_id, operation_villain_id),
  CONSTRAINT chk_quick_win_impacts_pct_range
    CHECK (impact_pct >= 1 AND impact_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_quick_win_impacts_operation_villain
  ON public.quick_win_impacts (operation_villain_id);

COMMENT ON TABLE public.quick_win_impacts IS
  'M:N entre quick_win e operation_villain. Soma de impact_pct por operation_villain capped 100% (Inv. 08, trigger).';

-- ============================================================================
-- TRIGGER validate_quick_win_impact_sum (Inv. 08)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_quick_win_impact_sum()
RETURNS TRIGGER AS $$
DECLARE
  current_sum int;
BEGIN
  SELECT COALESCE(SUM(impact_pct), 0)
    INTO current_sum
    FROM public.quick_win_impacts
    WHERE operation_villain_id = NEW.operation_villain_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF current_sum + NEW.impact_pct > 100 THEN
    RAISE EXCEPTION 'Soma de impactos excede 100%% para este vilão (atual: %, novo: %, total: %). Inv. 08.',
      current_sum, NEW.impact_pct, current_sum + NEW.impact_pct
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_quick_win_impacts_sum ON public.quick_win_impacts;
CREATE TRIGGER validate_quick_win_impacts_sum
  BEFORE INSERT OR UPDATE ON public.quick_win_impacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_quick_win_impact_sum();

-- ============================================================================
-- TRIGGER sync_operation_villain_progress (deriva progress_pct)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_operation_villain_progress()
RETURNS TRIGGER AS $$
DECLARE
  target_ov_id uuid;
  new_sum int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_ov_id := OLD.operation_villain_id;
  ELSE
    target_ov_id := NEW.operation_villain_id;
  END IF;

  SELECT COALESCE(SUM(impact_pct), 0)
    INTO new_sum
    FROM public.quick_win_impacts
    WHERE operation_villain_id = target_ov_id;

  UPDATE public.operation_villains
    SET progress_pct = new_sum
    WHERE id = target_ov_id;

  IF TG_OP = 'UPDATE' AND OLD.operation_villain_id IS DISTINCT FROM NEW.operation_villain_id THEN
    SELECT COALESCE(SUM(impact_pct), 0)
      INTO new_sum
      FROM public.quick_win_impacts
      WHERE operation_villain_id = OLD.operation_villain_id;
    UPDATE public.operation_villains
      SET progress_pct = new_sum
      WHERE id = OLD.operation_villain_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_operation_villain_progress_after ON public.quick_win_impacts;
CREATE TRIGGER sync_operation_villain_progress_after
  AFTER INSERT OR UPDATE OR DELETE ON public.quick_win_impacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_operation_villain_progress();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_win_impacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diagnostics_authenticated_full ON public.diagnostics;
CREATE POLICY diagnostics_authenticated_full
  ON public.diagnostics FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS quick_wins_authenticated_full ON public.quick_wins;
CREATE POLICY quick_wins_authenticated_full
  ON public.quick_wins FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS quick_win_impacts_authenticated_full ON public.quick_win_impacts;
CREATE POLICY quick_win_impacts_authenticated_full
  ON public.quick_win_impacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
