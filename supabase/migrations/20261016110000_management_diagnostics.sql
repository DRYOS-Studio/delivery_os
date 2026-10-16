-- management_diagnostics: expande diagnostics com questionário de gestão de 13 dimensões
-- Permite histórico (múltiplos diagnósticos por cliente), rascunhos (status 'draft'/'completed')
-- e armazena profile_data, answers, na_answers, computed_scores, flags e action_plan em JSONB.

-- 1. Remoção da unicidade rígida para permitir reavaliações no tempo
ALTER TABLE public.diagnostics
  DROP CONSTRAINT IF EXISTS diagnostics_client_id_key;

-- 2. Relaxamento de notes NOT NULL (o formulário estruturado passa a ser a fonte principal)
ALTER TABLE public.diagnostics
  ALTER COLUMN notes DROP NOT NULL;

ALTER TABLE public.diagnostics
  DROP CONSTRAINT IF EXISTS chk_diagnostics_notes_length;

ALTER TABLE public.diagnostics
  ADD CONSTRAINT chk_diagnostics_notes_length
  CHECK (notes IS NULL OR (length(notes) >= 10 AND length(notes) <= 10000));

-- 3. Novas colunas estruturadas para o Diagnóstico de Gestão
ALTER TABLE public.diagnostics
  ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'estruturacao_processos',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS na_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS computed_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS action_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Constraint para status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_diagnostics_status'
  ) THEN
    ALTER TABLE public.diagnostics
      ADD CONSTRAINT chk_diagnostics_status
      CHECK (status IN ('draft', 'completed'));
  END IF;
END $$;

-- 4. Índice de performance para buscar diagnósticos do cliente por data
CREATE INDEX IF NOT EXISTS idx_diagnostics_client_conducted
  ON public.diagnostics (client_id, conducted_at DESC, created_at DESC);

-- 5. Comments canônicos
COMMENT ON COLUMN public.diagnostics.form_type IS
  'Tipo/modelo do diagnóstico (ex: estruturacao_processos, identidade, infra_tech).';
COMMENT ON COLUMN public.diagnostics.status IS
  'Status do diagnóstico: draft (rascunho em preenchimento) ou completed (finalizado com relatório).';
COMMENT ON COLUMN public.diagnostics.version IS
  'Versão do modelo do formulário (v1 = 13 dimensões e 61 perguntas).';
COMMENT ON COLUMN public.diagnostics.profile_data IS
  'Dados de perfil: respondente, cargo, setor, faixa de colaboradores, faturamento, dores, objetivos.';
COMMENT ON COLUMN public.diagnostics.answers IS
  'Respostas indexadas por ID da pergunta (escala 1-5, índice de escolha única ou array múltiplo).';
COMMENT ON COLUMN public.diagnostics.na_answers IS
  'IDs das perguntas marcadas como Não sei / não se aplica.';
COMMENT ON COLUMN public.diagnostics.computed_scores IS
  'Scores calculados: notas das 13 dimensões (0-100), índice geral de maturidade (0-100) e nível (1-5).';
COMMENT ON COLUMN public.diagnostics.flags IS
  'Sinais de alerta identificados pelas 23 regras de criticidade (alta/média).';
COMMENT ON COLUMN public.diagnostics.action_plan IS
  'Plano de ação derivado das dimensões mais fracas (quick wins 30d, 90d, 12m).';

-- 6. RLS: manter consistente com can_read_operation
DROP POLICY IF EXISTS diagnostics_scoped_select ON public.diagnostics;
CREATE POLICY diagnostics_scoped_select ON public.diagnostics FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = diagnostics.client_id
        AND public.can_read_operation(o.id)
    )
  );

DROP POLICY IF EXISTS diagnostics_admin_insert ON public.diagnostics;
CREATE POLICY diagnostics_admin_insert ON public.diagnostics FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = diagnostics.client_id
        AND public.can_see_operation(o.id)
    )
  );

DROP POLICY IF EXISTS diagnostics_admin_update ON public.diagnostics;
CREATE POLICY diagnostics_admin_update ON public.diagnostics FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = diagnostics.client_id
        AND public.can_see_operation(o.id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.operations o
      WHERE o.client_id = diagnostics.client_id
        AND public.can_see_operation(o.id)
    )
  );
