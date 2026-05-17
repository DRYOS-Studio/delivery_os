-- public-link-skeleton: token de acesso externo (sem auth) à Operação.
-- Múltiplos links por Op, revogáveis individualmente. expires_at reservado pra v2.

CREATE TABLE IF NOT EXISTS public.public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_public_links_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_public_links_operation_created
  ON public.public_links (operation_id, created_at DESC);

COMMENT ON TABLE public.public_links IS
  'public_link: token de acesso externo (sem auth) à Operação. Múltiplos por Op, revogáveis. expires_at reservado (não validado MVP).';

COMMENT ON COLUMN public.public_links.last_accessed_at IS
  'Fire-and-forget update em cada GET válido. Métrica de uso.';

DROP TRIGGER IF EXISTS set_public_links_updated_at ON public.public_links;
CREATE TRIGGER set_public_links_updated_at
  BEFORE UPDATE ON public.public_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.public_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_links_authenticated_full ON public.public_links;
CREATE POLICY public_links_authenticated_full
  ON public.public_links FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
