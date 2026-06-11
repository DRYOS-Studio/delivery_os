-- Visibilidade própria de anexo (issue #129, audit AUDIT-2026-06-11 achado #6).
-- Espelha o padrão meeting_visibility/decision_visibility. Default 'cliente'
-- preserva o comportamento dos anexos existentes (princípio 05: tudo como se o
-- cliente fosse ler; interno é exceção explícita).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_visibility') THEN
    CREATE TYPE attachment_visibility AS ENUM ('interno', 'cliente');
  END IF;
END $$;

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS visibility attachment_visibility NOT NULL DEFAULT 'cliente';

COMMENT ON COLUMN public.attachments.visibility IS
  'Controla SÓ a superfície pública (/public/[token]): interno nunca aparece nem baixa no link público. Não é permissão interna — membros/admin veem tudo da operação via RLS. Regra composta no público: anexo cliente E (se meeting_id, meeting também cliente) — diverge de decisions (independente) de propósito.';
