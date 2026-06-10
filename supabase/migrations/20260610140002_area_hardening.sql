-- Hardening das tarefas de área (pós red-team / the-fool no PR #110):
--   #1 (opção B, read-only): área enxerga Operação/Cliente/Pessoa das suas tarefas.
--   #2: `area` imutável após criação (sem conversão área↔entrega por update).
--   #3: responsável de tarefa só pode ser pessoa interna.

-- ── #1 Opção B (read-only): can_read_operation ────────────────────────────────
-- Leitura amplia pra quem é de uma área que tem tarefa na operação. Escrita
-- continua só can_see_operation (membro/admin) — não alarga poder de escrita.
CREATE OR REPLACE FUNCTION public.can_read_operation(op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_see_operation(op_id)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.operation_id = op_id
        AND t.area IS NOT NULL
        AND public.can_see_area(t.area)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_operation(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_read_operation(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_read_operation(uuid) IS
  'auth/scope: leitura. can_see_operation OU é de uma área com tarefa nessa operação. Usado só em SELECT de operations/clients/persons pra tarefa de área mostrar contexto (opção B, read-only). NÃO usar em WITH CHECK.';

-- operations: SELECT passa a usar can_read_operation (write inalterado)
DROP POLICY IF EXISTS operations_scoped_select ON public.operations;
CREATE POLICY operations_scoped_select ON public.operations FOR SELECT TO authenticated
  USING (public.can_read_operation(id));

-- clients: + bridge (cliente de operação com tarefa da minha área)
DROP POLICY IF EXISTS clients_scoped_select ON public.clients;
CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = clients.id
        AND public.can_see_operation(o.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.operations o
      JOIN public.tasks t ON t.operation_id = o.id
      WHERE o.client_id = clients.id
        AND t.area IS NOT NULL
        AND public.can_see_area(t.area)
    )
  );

-- persons: + bridge (pessoa interna responsável por tarefa de área que eu vejo)
DROP POLICY IF EXISTS persons_scoped_select ON public.persons;
CREATE POLICY persons_scoped_select ON public.persons FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      kind = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.allocations a
        JOIN public.frentes f ON f.id = a.frente_id
        WHERE a.person_id = persons.id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      kind = 'external'
      AND client_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.operations o
        WHERE o.client_id = persons.client_id
          AND public.can_see_operation(o.id)
      )
    )
    OR (
      kind = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.task_assignees ta
        JOIN public.tasks t ON t.id = ta.task_id
        WHERE ta.person_id = persons.id
          AND t.area IS NOT NULL
          AND public.can_see_area(t.area)
      )
    )
  );

-- ── #2 area imutável após criação ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_task_area_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.area IS DISTINCT FROM OLD.area THEN
    RAISE EXCEPTION 'A área da tarefa é imutável após a criação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_area_immutable ON public.tasks;
CREATE TRIGGER enforce_task_area_immutable
  BEFORE UPDATE OF area ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_area_immutable();

-- ── #3 responsável só pode ser pessoa interna ────────────────────────────────
DROP POLICY IF EXISTS task_assignees_scoped_insert ON public.task_assignees;
CREATE POLICY task_assignees_scoped_insert ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_see_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.persons p
      WHERE p.id = person_id AND p.kind = 'internal'
    )
  );
