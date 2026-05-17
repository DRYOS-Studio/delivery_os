-- sla: SLA prometido na Operação + tabela de incidentes com timestamps de resposta/resolução.
-- Breach calculado em runtime via helper utils/sla.ts.

-- ============================================================================
-- ALTER operations: response_hours + resolution_hours
-- ============================================================================
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS response_hours integer,
  ADD COLUMN IF NOT EXISTS resolution_hours integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_operations_response_hours_range'
  ) THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT chk_operations_response_hours_range
      CHECK (response_hours IS NULL OR (response_hours >= 0 AND response_hours <= 720));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_operations_resolution_hours_range'
  ) THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT chk_operations_resolution_hours_range
      CHECK (resolution_hours IS NULL OR (resolution_hours >= 0 AND resolution_hours <= 720));
  END IF;
END $$;

COMMENT ON COLUMN public.operations.response_hours IS
  'SLA prometido pra primeira resposta, em horas corridas (0-720). Null = sem SLA.';
COMMENT ON COLUMN public.operations.resolution_hours IS
  'SLA prometido pra resolução total, em horas corridas (0-720). Null = sem SLA.';

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_severity') THEN
    CREATE TYPE sla_severity AS ENUM ('low', 'medium', 'high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sla_incident_status') THEN
    CREATE TYPE sla_incident_status AS ENUM ('open', 'responded', 'resolved', 'cancelled');
  END IF;
END $$;

-- ============================================================================
-- TABLE sla_incidents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sla_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  severity sla_severity NOT NULL DEFAULT 'medium',
  status sla_incident_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  opened_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sla_incidents_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sla_incidents_opened_by
    FOREIGN KEY (opened_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sla_incidents_responded_after_opened
    CHECK (responded_at IS NULL OR responded_at >= opened_at),
  CONSTRAINT chk_sla_incidents_resolved_after_responded
    CHECK (resolved_at IS NULL OR responded_at IS NULL OR resolved_at >= responded_at),
  CONSTRAINT chk_sla_incidents_status_requires_responded
    CHECK (status NOT IN ('responded', 'resolved') OR responded_at IS NOT NULL),
  CONSTRAINT chk_sla_incidents_status_resolved_requires_resolved_at
    CHECK (status != 'resolved' OR resolved_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sla_incidents_operation_opened
  ON public.sla_incidents (operation_id, opened_at DESC);

COMMENT ON TABLE public.sla_incidents IS
  'sla_incident: registro de incidente operacional com timestamps de resposta/resolução. Breach calculado em runtime vs operations.response_hours/resolution_hours.';

DROP TRIGGER IF EXISTS set_sla_incidents_updated_at ON public.sla_incidents;
CREATE TRIGGER set_sla_incidents_updated_at
  BEFORE UPDATE ON public.sla_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.sla_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sla_incidents_authenticated_full ON public.sla_incidents;
CREATE POLICY sla_incidents_authenticated_full
  ON public.sla_incidents FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
