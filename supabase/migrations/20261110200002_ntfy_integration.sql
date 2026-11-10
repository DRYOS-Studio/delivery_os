-- integration: ntfy → sla_incidents (tópicos por operação, idempotência, fila não mapeada).

-- ---------------------------------------------------------------------------
-- sla_incidents: campos de origem, dedupe e ntfy
-- ---------------------------------------------------------------------------
ALTER TABLE public.sla_incidents
  ADD COLUMN IF NOT EXISTS source public.sla_incident_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS problem_origin public.sla_problem_origin NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS ntfy_topic text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_occurrence_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_via text,
  ADD COLUMN IF NOT EXISTS ntfy_last_message_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sla_incidents_occurrence_count_positive'
  ) THEN
    ALTER TABLE public.sla_incidents
      ADD CONSTRAINT chk_sla_incidents_occurrence_count_positive
      CHECK (occurrence_count >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sla_incidents_ntfy_dedupe_open
  ON public.sla_incidents (operation_id, ntfy_topic, dedupe_key)
  WHERE status IN ('open', 'responded');

COMMENT ON COLUMN public.sla_incidents.source IS 'Canal de abertura: manual, mcp ou ntfy.';
COMMENT ON COLUMN public.sla_incidents.problem_origin IS 'Origem do problema; vendor excluído do breach SLA Dryos na UI.';
COMMENT ON COLUMN public.sla_incidents.occurrence_count IS 'Ocorrências agrupadas (dedupe ntfy no mesmo incidente aberto).';
COMMENT ON COLUMN public.sla_incidents.closed_via IS 'Como foi fechado (ex. ntfy:tag:resolved).';

-- ---------------------------------------------------------------------------
-- operation_ntfy_topics: um tópico pertence a uma operação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operation_ntfy_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL
    CONSTRAINT fk_operation_ntfy_topics_operation
    REFERENCES public.operations(id) ON DELETE CASCADE,
  topic text NOT NULL,
  label text,
  recovery_tags text[] NOT NULL DEFAULT ARRAY['resolved', 'recovery']::text[],
  default_problem_origin public.sla_problem_origin NOT NULL DEFAULT 'unclassified',
  priority_severity_map jsonb NOT NULL DEFAULT '{"1":"low","2":"low","3":"medium","4":"high","5":"high"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_operation_ntfy_topics_topic UNIQUE (topic),
  CONSTRAINT chk_operation_ntfy_topics_topic_len
    CHECK (char_length(trim(topic)) >= 1 AND char_length(topic) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_operation_ntfy_topics_operation
  ON public.operation_ntfy_topics (operation_id);

COMMENT ON TABLE public.operation_ntfy_topics IS
  'integration: mapeamento tópico ntfy → operação (e cliente via FK). Um tópico global único.';

DROP TRIGGER IF EXISTS set_operation_ntfy_topics_updated_at ON public.operation_ntfy_topics;
CREATE TRIGGER set_operation_ntfy_topics_updated_at
  BEFORE UPDATE ON public.operation_ntfy_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ntfy_message_receipts: idempotência pelo id da mensagem ntfy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ntfy_message_receipts (
  ntfy_message_id text PRIMARY KEY,
  topic text NOT NULL,
  received_at timestamptz NOT NULL,
  incident_id uuid
    CONSTRAINT fk_ntfy_receipts_incident
    REFERENCES public.sla_incidents(id) ON DELETE SET NULL,
  unmapped_alert_id uuid,
  outcome text NOT NULL
    CONSTRAINT chk_ntfy_receipts_outcome
    CHECK (outcome IN ('created', 'deduped', 'recovered', 'unmapped', 'ignored_recovery')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ntfy_message_receipts IS
  'integration: log idempotente de mensagens ntfy ingeridas (service role / API).';

-- ---------------------------------------------------------------------------
-- ntfy_unmapped_alerts: triagem (tópico sem mapeamento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ntfy_unmapped_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ntfy_message_id text NOT NULL UNIQUE,
  topic text NOT NULL,
  title text,
  message text,
  priority smallint,
  tags text[],
  received_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  triage_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_ntfy_unmapped_triage_status
    CHECK (triage_status IN ('pending', 'dismissed', 'mapped')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ntfy_unmapped_pending
  ON public.ntfy_unmapped_alerts (created_at DESC)
  WHERE triage_status = 'pending';

COMMENT ON TABLE public.ntfy_unmapped_alerts IS
  'integration: alertas ntfy sem tópico mapeado; não descartados — fila de triagem admin.';

ALTER TABLE public.ntfy_message_receipts
  DROP CONSTRAINT IF EXISTS fk_ntfy_receipts_unmapped;
ALTER TABLE public.ntfy_message_receipts
  ADD CONSTRAINT fk_ntfy_receipts_unmapped
  FOREIGN KEY (unmapped_alert_id)
  REFERENCES public.ntfy_unmapped_alerts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.operation_ntfy_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ntfy_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ntfy_unmapped_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_ntfy_topics_scoped_select ON public.operation_ntfy_topics;
CREATE POLICY operation_ntfy_topics_scoped_select ON public.operation_ntfy_topics
  FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_ntfy_topics_scoped_insert ON public.operation_ntfy_topics;
CREATE POLICY operation_ntfy_topics_scoped_insert ON public.operation_ntfy_topics
  FOR INSERT TO authenticated
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_ntfy_topics_scoped_update ON public.operation_ntfy_topics;
CREATE POLICY operation_ntfy_topics_scoped_update ON public.operation_ntfy_topics
  FOR UPDATE TO authenticated
  USING (public.can_see_operation(operation_id))
  WITH CHECK (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS operation_ntfy_topics_scoped_delete ON public.operation_ntfy_topics;
CREATE POLICY operation_ntfy_topics_scoped_delete ON public.operation_ntfy_topics
  FOR DELETE TO authenticated
  USING (public.can_see_operation(operation_id));

DROP POLICY IF EXISTS ntfy_unmapped_admin_select ON public.ntfy_unmapped_alerts;
CREATE POLICY ntfy_unmapped_admin_select ON public.ntfy_unmapped_alerts
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS ntfy_unmapped_admin_update ON public.ntfy_unmapped_alerts;
CREATE POLICY ntfy_unmapped_admin_update ON public.ntfy_unmapped_alerts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- receipts: só service_role (sem policy authenticated)

-- ---------------------------------------------------------------------------
-- activity: sla_incident subject + trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_activity_subject(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_subject_type
    WHEN 'client' THEN (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_subject_id
          AND EXISTS (
            SELECT 1 FROM public.operations o
            WHERE o.client_id = c.id
              AND public.can_read_operation(o.id)
          )
      )
    )
    WHEN 'operation' THEN public.can_read_operation(p_subject_id)
    WHEN 'frente' THEN EXISTS (
      SELECT 1 FROM public.frentes f
      WHERE f.id = p_subject_id
        AND public.can_read_operation(f.operation_id)
    )
    WHEN 'task' THEN public.can_see_task(p_subject_id)
    WHEN 'client_contract' THEN public.is_admin()
    WHEN 'profile' THEN public.is_admin()
    WHEN 'meeting' THEN EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = p_subject_id
        AND public.can_see_operation(m.operation_id)
    )
    WHEN 'decision' THEN EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = p_subject_id
        AND public.can_read_operation(d.operation_id)
    )
    WHEN 'operation_risk_blocker' THEN EXISTS (
      SELECT 1 FROM public.operation_risk_blockers rb
      WHERE rb.id = p_subject_id
        AND public.can_see_operation(rb.operation_id)
    )
    WHEN 'sla_incident' THEN EXISTS (
      SELECT 1 FROM public.sla_incidents si
      WHERE si.id = p_subject_id
        AND public.can_read_operation(si.operation_id)
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_log_activity_sla_incidents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'sla_incident', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object(
        'title', NEW.title,
        'severity', NEW.severity,
        'source', NEW.source,
        'problem_origin', NEW.problem_origin
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'sla_incident', NEW.id, NEW.operation_id, v_client,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status),
        COALESCE(to_jsonb(NULLIF(NEW.closed_via, '')), '{}'::jsonb)
      );
    END IF;
    IF NEW.occurrence_count IS DISTINCT FROM OLD.occurrence_count THEN
      PERFORM public.log_activity_event_system(
        'sla_incident', NEW.id, NEW.operation_id, v_client,
        'updated', 'occurrence_count',
        to_jsonb(OLD.occurrence_count), to_jsonb(NEW.occurrence_count),
        jsonb_build_object('ntfy_last_message_id', NEW.ntfy_last_message_id)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_sla_incidents_aiu ON public.sla_incidents;
CREATE TRIGGER trg_activity_sla_incidents_aiu
  AFTER INSERT OR UPDATE ON public.sla_incidents
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_sla_incidents();
