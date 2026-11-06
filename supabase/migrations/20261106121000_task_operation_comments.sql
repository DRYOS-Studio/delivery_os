-- Comentários em tarefas e na Operação (discussão interna). RLS alinhado a task / operação.

CREATE TABLE IF NOT EXISTS public.task_comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            uuid NOT NULL,
  body               text NOT NULL,
  author_profile_id  uuid NOT NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_task_comments_task
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_comments_author
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_task_comments_body_len
    CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
  ON public.task_comments (task_id, created_at DESC);

COMMENT ON TABLE public.task_comments IS
  'comentários em tarefa. Leitura via can_see_task; escrita quem vê a tarefa; editar/apagar só autor ou admin.';

DROP TRIGGER IF EXISTS set_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER set_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.operation_comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id       uuid NOT NULL,
  body               text NOT NULL,
  author_profile_id  uuid NOT NULL DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_comments_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_comments_author
    FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_operation_comments_body_len
    CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_operation_comments_op_created
  ON public.operation_comments (operation_id, created_at DESC);

COMMENT ON TABLE public.operation_comments IS
  'comentários na Operação (discussão). RLS: leitura can_read_operation; escrita can_see_operation; editar autor ou admin.';

DROP TRIGGER IF EXISTS set_operation_comments_updated_at ON public.operation_comments;
CREATE TRIGGER set_operation_comments_updated_at
  BEFORE UPDATE ON public.operation_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity: comentários geram linhas no feed da tarefa/operação
CREATE OR REPLACE FUNCTION public.trg_log_activity_task_comments()
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
      'comment_created', 'comment',
      NULL,
      jsonb_build_object('id', NEW.id, 'preview', left(trim(NEW.body), 200)),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity_event_system(
      'task', NEW.task_id, v_op, v_client,
      'comment_updated', 'comment',
      jsonb_build_object('id', OLD.id, 'preview', left(trim(OLD.body), 200)),
      jsonb_build_object('id', NEW.id, 'preview', left(trim(NEW.body), 200)),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity_event_system(
      'task', OLD.task_id, v_op, v_client,
      'comment_deleted', 'comment',
      jsonb_build_object('id', OLD.id, 'preview', left(trim(OLD.body), 200)),
      NULL,
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_task_comments_aiud ON public.task_comments;
CREATE TRIGGER trg_activity_task_comments_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_task_comments();

CREATE OR REPLACE FUNCTION public.trg_log_activity_operation_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT o.client_id INTO v_client FROM public.operations o WHERE o.id = COALESCE(NEW.operation_id, OLD.operation_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity_event_system(
      'operation', NEW.operation_id, NEW.operation_id, v_client,
      'comment_created', 'comment',
      NULL,
      jsonb_build_object('id', NEW.id, 'preview', left(trim(NEW.body), 200)),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity_event_system(
      'operation', NEW.operation_id, NEW.operation_id, v_client,
      'comment_updated', 'comment',
      jsonb_build_object('id', OLD.id, 'preview', left(trim(OLD.body), 200)),
      jsonb_build_object('id', NEW.id, 'preview', left(trim(NEW.body), 200)),
      '{}'::jsonb
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity_event_system(
      'operation', OLD.operation_id, OLD.operation_id, v_client,
      'comment_deleted', 'comment',
      jsonb_build_object('id', OLD.id, 'preview', left(trim(OLD.body), 200)),
      NULL,
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_operation_comments_aiud ON public.operation_comments;
CREATE TRIGGER trg_activity_operation_comments_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.operation_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity_operation_comments();

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_scoped_select ON public.task_comments;
CREATE POLICY task_comments_scoped_select ON public.task_comments
  FOR SELECT TO authenticated
  USING (public.can_see_task(task_id));

DROP POLICY IF EXISTS task_comments_scoped_insert ON public.task_comments;
CREATE POLICY task_comments_scoped_insert ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_see_task(task_id)
    AND author_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS task_comments_author_update ON public.task_comments;
CREATE POLICY task_comments_author_update ON public.task_comments
  FOR UPDATE TO authenticated
  USING (
    public.can_see_task(task_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  )
  WITH CHECK (
    public.can_see_task(task_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  );

DROP POLICY IF EXISTS task_comments_author_delete ON public.task_comments;
CREATE POLICY task_comments_author_delete ON public.task_comments
  FOR DELETE TO authenticated
  USING (
    public.can_see_task(task_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  );

ALTER TABLE public.operation_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_comments_scoped_select ON public.operation_comments;
CREATE POLICY operation_comments_scoped_select ON public.operation_comments
  FOR SELECT TO authenticated
  USING (public.can_read_operation(operation_id));

DROP POLICY IF EXISTS operation_comments_scoped_insert ON public.operation_comments;
CREATE POLICY operation_comments_scoped_insert ON public.operation_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_see_operation(operation_id)
    AND author_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS operation_comments_author_update ON public.operation_comments;
CREATE POLICY operation_comments_author_update ON public.operation_comments
  FOR UPDATE TO authenticated
  USING (
    public.can_read_operation(operation_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  )
  WITH CHECK (
    public.can_read_operation(operation_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  );

DROP POLICY IF EXISTS operation_comments_author_delete ON public.operation_comments;
CREATE POLICY operation_comments_author_delete ON public.operation_comments
  FOR DELETE TO authenticated
  USING (
    public.can_read_operation(operation_id)
    AND (author_profile_id = auth.uid() OR public.is_admin())
  );
