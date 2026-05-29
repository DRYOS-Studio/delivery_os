-- discord-notifications MVP (issue #90)
-- Outbound webhook config per Operação + audit/dedup log.

-- 1. Webhook URL per Operation
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS notification_webhook_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_operations_notification_webhook_url'
  ) THEN
    ALTER TABLE public.operations
      ADD CONSTRAINT check_operations_notification_webhook_url
      CHECK (notification_webhook_url IS NULL OR length(notification_webhook_url) > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.operations.notification_webhook_url IS
  'URL do n8n pra outbound de notificações (frente_stale, sla_breach). NULL = não envia (no-op silencioso). Per-Operação.';

-- 2. Notifications log (audit + dedup window)
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    uuid NOT NULL,
  event_type      text NOT NULL,
  subject_kind    text NOT NULL,
  subject_id      uuid NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL,
  response_status int,
  CONSTRAINT fk_notifications_log_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT check_notifications_log_event_type
    CHECK (event_type IN ('frente_stale', 'sla_breach')),
  CONSTRAINT check_notifications_log_subject_kind
    CHECK (subject_kind IN ('frente', 'sla_incident'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_dedup
  ON public.notifications_log (operation_id, event_type, subject_id, sent_at DESC);

COMMENT ON TABLE public.notifications_log IS
  'notifications: audit + dedup. Cada disparo (sucesso ou falha) registra com response_status. Index permite checar "já enviei esse evento pra esse subject nas últimas 24h?".';

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_log_admin_select ON public.notifications_log;
DROP POLICY IF EXISTS notifications_log_admin_insert ON public.notifications_log;

-- Admin lê tudo. Member não vê (notificação é interna).
CREATE POLICY notifications_log_admin_select ON public.notifications_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- INSERT autenticado só por admin (Server Actions de SLA). Cron usa service-role
-- (createAdmin) que bypassa RLS, então não precisa de policy pra isso.
CREATE POLICY notifications_log_admin_insert ON public.notifications_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
