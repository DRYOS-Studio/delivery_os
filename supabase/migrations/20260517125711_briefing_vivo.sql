-- briefing-vivo: documento estruturado da Operação com versionamento append-only.
-- 1 briefing por Operation (UNIQUE), N versões em briefing_versions.
-- RLS: briefings full crud; briefing_versions SELECT + INSERT only (UPDATE/DELETE bloqueados).

-- ============================================================================
-- TABLE: briefings (1:1 com operations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_briefings_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.briefings IS
  'briefing: documento estruturado 1:1 com operation. Conteúdo vive em briefing_versions (snapshots append-only). Atualizar = nova versão.';

COMMENT ON COLUMN public.briefings.current_version_id IS
  'Denormalização: aponta pra briefing_versions mais recente. Atualizado no save action; fallback via MAX(created_at).';

-- ============================================================================
-- TABLE: briefing_versions (append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.briefing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL,
  contexto text,
  objetivos text,
  escopo_incluido text,
  escopo_excluido text,
  premissas text,
  riscos text,
  stakeholders text,
  observacoes text,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_briefing_versions_briefing_id
    FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE,
  CONSTRAINT fk_briefing_versions_author_id
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.briefing_versions IS
  'briefing: snapshot append-only. Cada save da action cria linha completa. RLS rejeita UPDATE/DELETE (ausência de policy = bloqueado).';

CREATE INDEX IF NOT EXISTS idx_briefing_versions_briefing_created
  ON public.briefing_versions (briefing_id, created_at DESC);

-- ============================================================================
-- FORWARD FK: briefings.current_version_id → briefing_versions(id)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_briefings_current_version_id'
  ) THEN
    ALTER TABLE public.briefings
      ADD CONSTRAINT fk_briefings_current_version_id
      FOREIGN KEY (current_version_id) REFERENCES public.briefing_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- TRIGGER: updated_at em briefings
-- ============================================================================
DROP TRIGGER IF EXISTS set_briefings_updated_at ON public.briefings;
CREATE TRIGGER set_briefings_updated_at
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefing_versions ENABLE ROW LEVEL SECURITY;

-- briefings: full crud pra authenticated
DROP POLICY IF EXISTS briefings_authenticated_full ON public.briefings;
CREATE POLICY briefings_authenticated_full ON public.briefings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- briefing_versions: SELECT + INSERT only; UPDATE/DELETE bloqueados pela ausência de policy
DROP POLICY IF EXISTS briefing_versions_authenticated_select ON public.briefing_versions;
CREATE POLICY briefing_versions_authenticated_select ON public.briefing_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS briefing_versions_authenticated_insert ON public.briefing_versions;
CREATE POLICY briefing_versions_authenticated_insert ON public.briefing_versions
  FOR INSERT TO authenticated WITH CHECK (true);
