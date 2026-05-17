-- status-acionavel-polish: index parcial otimiza queries de staleness.
-- Cobre listFrentesNeedingAttention (ORDER BY since ASC) e countHotCriticalFrentes (COUNT WHERE).

CREATE INDEX IF NOT EXISTS idx_frentes_actionable_status_since_active
  ON public.frentes (actionable_status_since ASC)
  WHERE archived_at IS NULL;
