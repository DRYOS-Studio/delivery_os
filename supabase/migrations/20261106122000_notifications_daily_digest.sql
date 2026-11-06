-- daily_digest: amplia notifications_log para evento agregado (resumo diário).

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS fk_notifications_log_operation;

ALTER TABLE public.notifications_log
  ALTER COLUMN operation_id DROP NOT NULL;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT fk_notifications_log_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS check_notifications_log_event_type;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT check_notifications_log_event_type
  CHECK (event_type IN ('frente_stale', 'sla_breach', 'daily_digest'));

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS check_notifications_log_subject_kind;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT check_notifications_log_subject_kind
  CHECK (subject_kind IN ('frente', 'sla_incident', 'daily_digest'));

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS check_notifications_log_digest_operation;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT check_notifications_log_digest_operation
  CHECK (
    (event_type = 'daily_digest' AND operation_id IS NULL)
    OR (event_type <> 'daily_digest' AND operation_id IS NOT NULL)
  );

COMMENT ON TABLE public.notifications_log IS
  'notifications: audit + dedup. daily_digest pode ter operation_id NULL (webhook global). Demais eventos exigem operation_id.';
