-- activity_events: audit trail para entidades principais (tasks, frentes, operations, clients).
-- Escrita via trigger (SECURITY DEFINER) + RPC opcional; leitura via RLS alinhada ao escopo da entidade.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_subject_type') THEN
    CREATE TYPE public.activity_subject_type AS ENUM (
      'client',
      'operation',
      'frente',
      'task'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activity_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type     public.activity_subject_type NOT NULL,
  subject_id       uuid NOT NULL,
  operation_id     uuid,
  client_id        uuid,
  action           text NOT NULL,
  field_key        text,
  old_value        jsonb,
  new_value        jsonb,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_profile_id uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_activity_events_actor
    FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_events_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_events_client
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_activity_events_action_length
    CHECK (char_length(action) >= 2 AND char_length(action) <= 80)
);

CREATE INDEX IF NOT EXISTS idx_activity_events_subject_time
  ON public.activity_events (subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_operation_time
  ON public.activity_events (operation_id, created_at DESC)
  WHERE operation_id IS NOT NULL;

COMMENT ON TABLE public.activity_events IS
  'audit: histórico de mudanças em client, operation, frente e task. RLS por escopo da entidade; inserts via trigger/RPC SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- Helpers: pode ler o assunto do evento?
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
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.can_read_activity_subject(public.activity_subject_type, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_activity_subject(public.activity_subject_type, uuid) TO authenticated;

COMMENT ON FUNCTION public.can_read_activity_subject IS
  'audit: visibilidade do feed — espelha task/frente/operação/cliente já usados no app.';

-- ---------------------------------------------------------------------------
-- Inserção centralizada (triggers + app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid,
  p_operation_id uuid,
  p_client_id uuid,
  p_action text,
  p_field_key text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'log_activity_event: not authenticated';
  END IF;

  IF NOT public.can_read_activity_subject(p_subject_type, p_subject_id) THEN
    RAISE EXCEPTION 'log_activity_event: forbidden';
  END IF;

  INSERT INTO public.activity_events (
    subject_type,
    subject_id,
    operation_id,
    client_id,
    action,
    field_key,
    old_value,
    new_value,
    metadata,
    actor_profile_id
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_operation_id,
    p_client_id,
    p_action,
    NULLIF(trim(p_field_key), ''),
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb),
    v_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity_event(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity_event(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) TO authenticated;

-- Função interna para triggers (sem revalidar can_read — já estamos no UPDATE da row).
CREATE OR REPLACE FUNCTION public.log_activity_event_system(
  p_subject_type public.activity_subject_type,
  p_subject_id uuid,
  p_operation_id uuid,
  p_client_id uuid,
  p_action text,
  p_field_key text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.activity_events (
    subject_type,
    subject_id,
    operation_id,
    client_id,
    action,
    field_key,
    old_value,
    new_value,
    metadata,
    actor_profile_id
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_operation_id,
    p_client_id,
    p_action,
    NULLIF(trim(p_field_key), ''),
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb),
    v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity_event_system(
  public.activity_subject_type, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Triggers: clients
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_activity_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'client', NEW.id, NULL, NEW.id,
      'created', NULL, NULL,
      jsonb_build_object('name', NEW.name, 'slug', NEW.slug),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'slug', to_jsonb(OLD.slug), to_jsonb(NEW.slug), '{}'::jsonb
      );
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'notes', to_jsonb(OLD.notes), to_jsonb(NEW.notes), '{}'::jsonb
      );
    END IF;
    IF NEW.legal_name IS DISTINCT FROM OLD.legal_name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'legal_name', to_jsonb(OLD.legal_name), to_jsonb(NEW.legal_name), '{}'::jsonb
      );
    END IF;
    IF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'cnpj', to_jsonb(OLD.cnpj), to_jsonb(NEW.cnpj), '{}'::jsonb
      );
    END IF;
    IF NEW.primary_contact_name IS DISTINCT FROM OLD.primary_contact_name THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'primary_contact_name', to_jsonb(OLD.primary_contact_name), to_jsonb(NEW.primary_contact_name), '{}'::jsonb
      );
    END IF;
    IF NEW.primary_contact_email IS DISTINCT FROM OLD.primary_contact_email THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'primary_contact_email', to_jsonb(OLD.primary_contact_email), to_jsonb(NEW.primary_contact_email), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'client', NEW.id, NULL, NEW.id,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_clients_aiud ON public.clients;
CREATE TRIGGER trg_activity_clients_aiud
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_clients();

-- ---------------------------------------------------------------------------
-- Triggers: operations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_activity_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation', NEW.id, NEW.id, NEW.client_id,
      'created', NULL, NULL,
      jsonb_build_object('name', NEW.name, 'status', NEW.status::text, 'client_id', NEW.client_id),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.product_line IS DISTINCT FROM OLD.product_line THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'product_line', to_jsonb(OLD.product_line), to_jsonb(NEW.product_line), '{}'::jsonb
      );
    END IF;
    IF NEW.recurrence IS DISTINCT FROM OLD.recurrence THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'recurrence', to_jsonb(OLD.recurrence), to_jsonb(NEW.recurrence), '{}'::jsonb
      );
    END IF;
    IF NEW.monthly_recurring_revenue IS DISTINCT FROM OLD.monthly_recurring_revenue THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'monthly_recurring_revenue', to_jsonb(OLD.monthly_recurring_revenue), to_jsonb(NEW.monthly_recurring_revenue), '{}'::jsonb
      );
    END IF;
    IF NEW.monthly_fixed_cost IS DISTINCT FROM OLD.monthly_fixed_cost THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'monthly_fixed_cost', to_jsonb(OLD.monthly_fixed_cost), to_jsonb(NEW.monthly_fixed_cost), '{}'::jsonb
      );
    END IF;
    IF NEW.response_hours IS DISTINCT FROM OLD.response_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'response_hours', to_jsonb(OLD.response_hours), to_jsonb(NEW.response_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.resolution_hours IS DISTINCT FROM OLD.resolution_hours THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'resolution_hours', to_jsonb(OLD.resolution_hours), to_jsonb(NEW.resolution_hours), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'end_date', to_jsonb(OLD.end_date), to_jsonb(NEW.end_date), '{}'::jsonb
      );
    END IF;
    IF NEW.notification_webhook_url IS DISTINCT FROM OLD.notification_webhook_url THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'notification_webhook_url', to_jsonb(OLD.notification_webhook_url), to_jsonb(NEW.notification_webhook_url), '{}'::jsonb
      );
    END IF;
    IF NEW.diagnostic_id IS DISTINCT FROM OLD.diagnostic_id THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'diagnostic_id', to_jsonb(OLD.diagnostic_id), to_jsonb(NEW.diagnostic_id), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'operation', NEW.id, NEW.id, NEW.client_id,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operations_aiud ON public.operations;
CREATE TRIGGER trg_activity_operations_aiud
  AFTER INSERT OR UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operations();

-- ---------------------------------------------------------------------------
-- Triggers: frentes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_activity_frentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'frente', NEW.id, NEW.operation_id, NULL,
      'created', NULL, NULL,
      jsonb_build_object(
        'name', NEW.name,
        'operation_id', NEW.operation_id,
        'actionable_status', NEW.actionable_status
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'name', to_jsonb(OLD.name), to_jsonb(NEW.name), '{}'::jsonb
      );
    END IF;
    IF NEW.cycle_type IS DISTINCT FROM OLD.cycle_type THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'cycle_type', to_jsonb(OLD.cycle_type), to_jsonb(NEW.cycle_type), '{}'::jsonb
      );
    END IF;
    IF NEW.domain IS DISTINCT FROM OLD.domain THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'domain', to_jsonb(OLD.domain), to_jsonb(NEW.domain), '{}'::jsonb
      );
    END IF;
    IF NEW.phase IS DISTINCT FROM OLD.phase THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'phase', to_jsonb(OLD.phase), to_jsonb(NEW.phase), '{}'::jsonb
      );
    END IF;
    IF NEW.actionable_status IS DISTINCT FROM OLD.actionable_status THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'actionable_status', to_jsonb(OLD.actionable_status), to_jsonb(NEW.actionable_status), '{}'::jsonb
      );
    END IF;
    IF NEW.responsible_person_id IS DISTINCT FROM OLD.responsible_person_id THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'responsible_person_id', to_jsonb(OLD.responsible_person_id), to_jsonb(NEW.responsible_person_id), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'end_date', to_jsonb(OLD.end_date), to_jsonb(NEW.end_date), '{}'::jsonb
      );
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      PERFORM public.log_activity_event_system(
        'frente', NEW.id, NEW.operation_id, NULL,
        'updated', 'archived_at', to_jsonb(OLD.archived_at), to_jsonb(NEW.archived_at), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_frentes_aiud ON public.frentes;
CREATE TRIGGER trg_activity_frentes_aiud
  AFTER INSERT OR UPDATE ON public.frentes
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_frentes();

-- ---------------------------------------------------------------------------
-- Triggers: tasks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_activity_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client
  FROM public.operations o
  WHERE o.id = NEW.operation_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'task', NEW.id, NEW.operation_id, v_client,
      'created', NULL, NULL,
      jsonb_build_object(
        'title', NEW.title,
        'status', NEW.status::text,
        'operation_id', NEW.operation_id,
        'frente_id', NEW.frente_id
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'title', to_jsonb(OLD.title), to_jsonb(NEW.title), '{}'::jsonb
      );
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'description', to_jsonb(OLD.description), to_jsonb(NEW.description), '{}'::jsonb
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status), '{}'::jsonb
      );
    END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'due_date', to_jsonb(OLD.due_date), to_jsonb(NEW.due_date), '{}'::jsonb
      );
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'start_date', to_jsonb(OLD.start_date), to_jsonb(NEW.start_date), '{}'::jsonb
      );
    END IF;
    IF NEW.frente_id IS DISTINCT FROM OLD.frente_id THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'frente_id', to_jsonb(OLD.frente_id), to_jsonb(NEW.frente_id), '{}'::jsonb
      );
    END IF;
    IF NEW.area_id IS DISTINCT FROM OLD.area_id THEN
      PERFORM public.log_activity_event_system(
        'task', NEW.id, NEW.operation_id, v_client,
        'updated', 'area_id', to_jsonb(OLD.area_id), to_jsonb(NEW.area_id), '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_tasks_aiud ON public.tasks;
CREATE TRIGGER trg_activity_tasks_aiud
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_tasks();

CREATE OR REPLACE FUNCTION public.trg_log_activity_task_assignees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op uuid;
  v_client uuid;
BEGIN
  SELECT t.operation_id INTO v_op FROM public.tasks t WHERE t.id = COALESCE(NEW.task_id, OLD.task_id);
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = v_op;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'task', NEW.task_id, v_op, v_client,
      'assignee_added', 'assignees', NULL, to_jsonb(NEW.person_id), '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity_event_system(
      'task', OLD.task_id, v_op, v_client,
      'assignee_removed', 'assignees', to_jsonb(OLD.person_id), NULL, '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_task_assignees_ad ON public.task_assignees;
CREATE TRIGGER trg_activity_task_assignees_ad
  AFTER INSERT OR DELETE ON public.task_assignees
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_task_assignees();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_scoped_select ON public.activity_events;
CREATE POLICY activity_events_scoped_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (public.can_read_activity_subject(subject_type, subject_id));

-- Sem política INSERT/UPDATE/DELETE para authenticated — uso via funções DEFINER.
