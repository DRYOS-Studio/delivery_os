-- Hardening (code-review do follow-up M2): área ARQUIVADA não deve alcançar
-- operação nenhuma — nem leitura nem escrita. Antes, area_can_reach_operation
-- não checava archived_at, então o WITH CHECK de INSERT/UPDATE de tarefa de área
-- (que usa user_in_area + area_can_reach_operation) permitiria criar em área
-- arquivada via request forjado. A UI já filtrava, mas o invariante tem que
-- viver no banco (invariante 04/12). Uma troca de função fecha READ e WRITE.
-- is_area_granted mantém seu JOIN archived (redundante agora, inofensivo).

CREATE OR REPLACE FUNCTION public.area_can_reach_operation(p_area_id uuid, p_op_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.areas a
                 WHERE a.id = p_area_id AND a.archived_at IS NULL)
    AND (
      EXISTS (
        SELECT 1 FROM public.area_operations ao
        WHERE ao.area_id = p_area_id AND ao.operation_id = p_op_id
      ) OR EXISTS (
        SELECT 1 FROM public.area_clients ac
        JOIN public.operations o ON o.client_id = ac.client_id
        WHERE ac.area_id = p_area_id AND o.id = p_op_id
      )
    );
$$;

COMMENT ON FUNCTION public.area_can_reach_operation(uuid, uuid) IS
  'auth/scope: concessão pura (sem auth) — área NÃO-ARQUIVADA alcança operação via area_operations OU area_clients. NÃO toca tasks (evita recursão de RLS).';
