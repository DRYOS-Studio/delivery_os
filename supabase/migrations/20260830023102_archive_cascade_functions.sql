-- operation-lifecycle-archive (issue #159) — parte 2 de 2.
-- 8 funcoes + 1 trigger. Todas SECURITY INVOKER: a RLS continua valendo dentro delas.
-- O guard is_admin() interno NAO e' redundante com requireAdminAction: a RLS de UPDATE em
-- operations/frentes/allocations e' can_see_operation (20260526190001:98-100,110-112,236-244),
-- ou seja, qualquer membro passa. Sem o guard, /rest/v1/rpc/ contorna a Server Action.
-- SECURITY DEFINER e' proibido aqui: contornaria a RLS em vez de respeita-la.

-- ── impacto (leitura) ────────────────────────────────────────────────────────
-- Mesmo WHERE das cascatas, coladas de proposito: se divergirem, o dialogo de
-- confirmacao mente. "Alocacao aberta" usa o predicado dos leitores
-- (operation-costs.ts:266,325; public-report.ts:188,223), nao "end_date IS NULL".

CREATE OR REPLACE FUNCTION public.archive_operation_impact(p_operation_id uuid)
RETURNS TABLE(frentes integer, alocacoes integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.frentes f
      WHERE f.operation_id = p_operation_id AND f.archived_at IS NULL),
    (SELECT count(*)::int FROM public.allocations a
       JOIN public.frentes f2 ON f2.id = a.frente_id
      WHERE f2.operation_id = p_operation_id
        AND (a.end_date IS NULL OR a.end_date > current_date));
END $$;

CREATE OR REPLACE FUNCTION public.archive_client_impact(p_client_id uuid)
RETURNS TABLE(operacoes integer, frentes integer, alocacoes integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.operations o
      WHERE o.client_id = p_client_id AND o.archived_at IS NULL),
    (SELECT count(*)::int FROM public.frentes f
       JOIN public.operations o2 ON o2.id = f.operation_id
      WHERE o2.client_id = p_client_id AND f.archived_at IS NULL),
    (SELECT count(*)::int FROM public.allocations a
       JOIN public.frentes f2 ON f2.id = a.frente_id
       JOIN public.operations o3 ON o3.id = f2.operation_id
      WHERE o3.client_id = p_client_id
        AND (a.end_date IS NULL OR a.end_date > current_date));
END $$;

-- ── cascatas ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_frente_cascade(p_frente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin arquiva' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.frentes
   WHERE id = p_frente_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'frente inexistente ou ja arquivada' USING ERRCODE = 'P0002';
  END IF;

  -- LEAST normaliza start futuro: sem isso a linha sairia com end_date > current_date,
  -- ou seja, ainda "aberta" pelo predicado canonico.
  UPDATE public.allocations
     SET end_date = current_date, start_date = LEAST(start_date, current_date)
   WHERE frente_id = p_frente_id
     AND (end_date IS NULL OR end_date > current_date);

  UPDATE public.frentes SET archived_at = now() WHERE id = p_frente_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'cascata nao arquivou a frente' USING ERRCODE = 'P0004';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.archive_operation_cascade(p_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_status public.operation_status; v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin arquiva' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM public.operations
   WHERE id = p_operation_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operacao inexistente ou ja arquivada' USING ERRCODE = 'P0002';
  END IF;

  -- Complemento, nao lista de ativos: valor novo no enum cai no ramo que BLOQUEIA.
  IF v_status NOT IN ('concluida', 'cancelada', 'arquivada') THEN
    RAISE EXCEPTION 'operacao precisa estar encerrada' USING ERRCODE = '23514';
  END IF;

  -- TODA alocacao aberta da operacao, inclusive sob Frente ja arquivada: senao sobra
  -- alocacao aberta sob operacao arquivada.
  UPDATE public.allocations a
     SET end_date = current_date, start_date = LEAST(a.start_date, current_date)
    FROM public.frentes f
   WHERE a.frente_id = f.id AND f.operation_id = p_operation_id
     AND (a.end_date IS NULL OR a.end_date > current_date);

  UPDATE public.frentes SET archived_at = now()
   WHERE operation_id = p_operation_id AND archived_at IS NULL;

  UPDATE public.operations SET archived_at = now() WHERE id = p_operation_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    -- Tripwire de concorrencia/no-op. NAO detecta fail-open por RLS (membro sem guard
    -- tambem passaria em operations_scoped_update). Codigo proprio pra nao cair no
    -- ramo 'forbidden' do mapa de erro atribuindo culpa errada.
    RAISE EXCEPTION 'cascata nao arquivou a operacao' USING ERRCODE = 'P0004';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.archive_client_cascade(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin arquiva' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.clients WHERE id = p_client_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente inexistente ou ja arquivado' USING ERRCODE = 'P0002';
  END IF;

  -- Nunca "pula" a nao-terminal: aborta a transacao inteira.
  IF EXISTS (SELECT 1 FROM public.operations
              WHERE client_id = p_client_id AND archived_at IS NULL
                AND status NOT IN ('concluida', 'cancelada', 'arquivada')) THEN
    RAISE EXCEPTION 'cliente tem operacao nao encerrada' USING ERRCODE = '23514';
  END IF;

  FOR r IN SELECT id FROM public.operations
            WHERE client_id = p_client_id AND archived_at IS NULL LOOP
    PERFORM public.archive_operation_cascade(r.id);
  END LOOP;

  UPDATE public.clients SET archived_at = now() WHERE id = p_client_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'cascata nao arquivou o cliente' USING ERRCODE = 'P0004';
  END IF;
END $$;

-- ── restore ──────────────────────────────────────────────────────────────────
-- Revoga ANTES de desarquivar. Se a ordem fosse inversa e a 2a escrita falhasse, o
-- token antigo voltaria a servir /public/<token> (publicLinks.ts:87 e' o gate unico).

CREATE OR REPLACE FUNCTION public.restore_operation(p_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_client_archived timestamptz; v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin restaura' USING ERRCODE = '42501';
  END IF;

  SELECT c.archived_at INTO v_client_archived
    FROM public.operations o JOIN public.clients c ON c.id = o.client_id
   WHERE o.id = p_operation_id AND o.archived_at IS NOT NULL
   FOR UPDATE OF o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operacao inexistente ou nao arquivada' USING ERRCODE = 'P0002';
  END IF;
  IF v_client_archived IS NOT NULL THEN
    RAISE EXCEPTION 'cliente esta arquivado' USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.public_links SET revoked_at = now()
   WHERE operation_id = p_operation_id AND revoked_at IS NULL;

  UPDATE public.operations SET archived_at = NULL WHERE id = p_operation_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'restore nao desarquivou a operacao' USING ERRCODE = 'P0004';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.restore_frente(p_frente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_op_archived timestamptz; v_rows integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas admin restaura' USING ERRCODE = '42501';
  END IF;

  SELECT o.archived_at INTO v_op_archived
    FROM public.frentes f JOIN public.operations o ON o.id = f.operation_id
   WHERE f.id = p_frente_id AND f.archived_at IS NOT NULL
   FOR UPDATE OF f;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'frente inexistente ou nao arquivada' USING ERRCODE = 'P0002';
  END IF;
  IF v_op_archived IS NOT NULL THEN
    RAISE EXCEPTION 'operacao esta arquivada' USING ERRCODE = 'P0003';
  END IF;

  UPDATE public.frentes SET archived_at = NULL WHERE id = p_frente_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'restore nao desarquivou a frente' USING ERRCODE = 'P0004';
  END IF;
END $$;

-- ── trigger: revoga link publico ao cancelar OU ao arquivar ──────────────────
-- Trigger e nao codigo na action: atomico com o UPDATE por construcao, e nenhum
-- caminho de escrita escapa (action, RPC futura, SQL manual).
-- As DUAS condicoes importam: a cascata escreve archived_at e NUNCA status, entao
-- um WHEN so de status nao dispararia no caminho de arquivamento.

CREATE OR REPLACE FUNCTION public.tg_revoke_links_on_terminal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.public_links SET revoked_at = now()
   WHERE operation_id = NEW.id AND revoked_at IS NULL;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_operations_revoke_links ON public.operations;
CREATE TRIGGER trg_operations_revoke_links
  AFTER UPDATE ON public.operations
  FOR EACH ROW
  WHEN (   (NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada')
        OR (NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL) )
  EXECUTE FUNCTION public.tg_revoke_links_on_terminal();

-- ── privilegios ──────────────────────────────────────────────────────────────
-- Padrao do repo (20260526190001:51-52). Sem o REVOKE, funcao nova fica exposta em
-- /rest/v1/rpc/ para qualquer papel com EXECUTE por default.

REVOKE EXECUTE ON FUNCTION public.archive_operation_impact(uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_client_impact(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_frente_cascade(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_operation_cascade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.archive_client_cascade(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_operation(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_frente(uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_revoke_links_on_terminal()   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.archive_operation_impact(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_client_impact(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_frente_cascade(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_operation_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_client_cascade(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_operation(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_frente(uuid)            TO authenticated;

COMMENT ON FUNCTION public.archive_operation_cascade(uuid) IS
  'operacao: arquiva a Operacao, suas Frentes e fecha as alocacoes abertas, atomicamente. Exige status terminal e admin.';
COMMENT ON FUNCTION public.archive_client_cascade(uuid) IS
  'cliente: arquiva o Cliente cascateando em cada Operacao. Aborta se alguma Operacao nao estiver encerrada.';
COMMENT ON FUNCTION public.archive_frente_cascade(uuid) IS
  'frente: arquiva a Frente e fecha suas alocacoes abertas, atomicamente. Admin.';
COMMENT ON FUNCTION public.restore_operation(uuid) IS
  'operacao: desarquiva. Revoga os public_links ANTES de desarquivar; exige Cliente nao arquivado.';
COMMENT ON FUNCTION public.restore_frente(uuid) IS
  'frente: desarquiva. Exige Operacao nao arquivada.';
COMMENT ON FUNCTION public.archive_operation_impact(uuid) IS
  'operacao: contagem do que a cascata vai alterar. STABLE. NAO tornar SECURITY DEFINER — viraria oraculo de contagem cross-tenant.';
COMMENT ON FUNCTION public.archive_client_impact(uuid) IS
  'cliente: contagem do que a cascata vai alterar. STABLE. NAO tornar SECURITY DEFINER — mesmo motivo.';
COMMENT ON FUNCTION public.tg_revoke_links_on_terminal() IS
  'operacao: revoga public_links ao cancelar OU arquivar. As duas condicoes: a cascata escreve archived_at, nunca status.';
