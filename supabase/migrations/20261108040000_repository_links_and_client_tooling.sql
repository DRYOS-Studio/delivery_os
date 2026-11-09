-- Repositórios Git (múltiplos, por escopo) + stack técnica + softwares do cliente.
--
-- Fase 1 (aditiva, segura com app antigo ainda no ar):
-- 1) Opcional: `20261108030000_git_repository_url.sql`
-- 2) Este arquivo — cria tabelas + importa URLs singulares para `repository_links`
--    (label `Principal`) se as colunas existirem. **Não remove** colunas legadas.
-- 3) Após merge + deploy do app novo: `20261108050000_drop_legacy_git_repository_url_columns.sql`

-- ─── repository_links ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.repository_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  operation_id uuid,
  frente_id uuid,
  label text NOT NULL,
  url text NOT NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_repository_links_client
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_repository_links_operation
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_repository_links_frente
    FOREIGN KEY (frente_id) REFERENCES public.frentes(id) ON DELETE CASCADE,
  CONSTRAINT chk_repository_links_label
    CHECK (char_length(trim(label)) >= 1 AND char_length(trim(label)) <= 120),
  CONSTRAINT chk_repository_links_url
    CHECK (char_length(trim(url)) > 0 AND char_length(url) <= 500),
  CONSTRAINT chk_repository_links_notes
    CHECK (notes IS NULL OR char_length(notes) <= 280),
  CONSTRAINT chk_repository_links_scope CHECK (
    (frente_id IS NOT NULL AND operation_id IS NOT NULL)
    OR (frente_id IS NULL AND operation_id IS NOT NULL)
    OR (frente_id IS NULL AND operation_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_repository_links_client
  ON public.repository_links (client_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_repository_links_operation
  ON public.repository_links (operation_id)
  WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repository_links_frente
  ON public.repository_links (frente_id)
  WHERE frente_id IS NOT NULL;

COMMENT ON TABLE public.repository_links IS
  'cliente: links https para repositórios Git (múltiplos). Escopo via client_id + operation_id/frente_id opcionais.';

DROP TRIGGER IF EXISTS set_repository_links_updated_at ON public.repository_links;
CREATE TRIGGER set_repository_links_updated_at
  BEFORE UPDATE ON public.repository_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── client_tech_items / client_software_items ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_tech_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  url text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_tech_items_client
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_client_tech_name
    CHECK (char_length(trim(name)) >= 1 AND char_length(trim(name)) <= 120),
  CONSTRAINT chk_client_tech_category
    CHECK (category IS NULL OR char_length(trim(category)) <= 80),
  CONSTRAINT chk_client_tech_url
    CHECK (url IS NULL OR char_length(url) <= 500),
  CONSTRAINT chk_client_tech_notes
    CHECK (notes IS NULL OR char_length(notes) <= 280)
);

CREATE TABLE IF NOT EXISTS public.client_software_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  purpose text,
  url text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_client_software_items_client
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_client_software_name
    CHECK (char_length(trim(name)) >= 1 AND char_length(trim(name)) <= 120),
  CONSTRAINT chk_client_software_purpose
    CHECK (purpose IS NULL OR char_length(trim(purpose)) <= 120),
  CONSTRAINT chk_client_software_url
    CHECK (url IS NULL OR char_length(url) <= 500),
  CONSTRAINT chk_client_software_notes
    CHECK (notes IS NULL OR char_length(notes) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_client_tech_items_client
  ON public.client_tech_items (client_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_client_software_items_client
  ON public.client_software_items (client_id, sort_order, created_at);

COMMENT ON TABLE public.client_tech_items IS
  'cliente: stack técnica (linguagens, frameworks, cloud, dados) — desenvolvimento/infra.';

COMMENT ON TABLE public.client_software_items IS
  'cliente: softwares que o cliente já usa (operação/comercial). URL opcional = acesso ao workspace/sistema do cliente.';

COMMENT ON COLUMN public.client_software_items.purpose IS
  'Finalidade no cliente (ex: automação WhatsApp, CRM). Texto livre.';

COMMENT ON COLUMN public.client_software_items.url IS
  'Opcional: link de acesso ao ambiente/workspace do cliente, não só site do fornecedor.';

DROP TRIGGER IF EXISTS set_client_tech_items_updated_at ON public.client_tech_items;
CREATE TRIGGER set_client_tech_items_updated_at
  BEFORE UPDATE ON public.client_tech_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_client_software_items_updated_at ON public.client_software_items;
CREATE TRIGGER set_client_software_items_updated_at
  BEFORE UPDATE ON public.client_software_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Import colunas singulares legadas (se existirem) ───────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, label, url)
    SELECT c.id, 'Principal', trim(c.git_repository_url)
    FROM public.clients c
    WHERE c.git_repository_url IS NOT NULL AND trim(c.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.client_id = c.id AND rl.operation_id IS NULL AND rl.frente_id IS NULL
          AND rl.url = trim(c.git_repository_url)
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operations' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, operation_id, label, url)
    SELECT o.client_id, o.id, 'Principal', trim(o.git_repository_url)
    FROM public.operations o
    WHERE o.git_repository_url IS NOT NULL AND trim(o.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.operation_id = o.id AND rl.frente_id IS NULL
          AND rl.url = trim(o.git_repository_url)
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'frentes' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, operation_id, frente_id, label, url)
    SELECT o.client_id, f.operation_id, f.id, 'Principal', trim(f.git_repository_url)
    FROM public.frentes f
    JOIN public.operations o ON o.id = f.operation_id
    WHERE f.git_repository_url IS NOT NULL AND trim(f.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.frente_id = f.id           AND rl.url = trim(f.git_repository_url)
      );
  END IF;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.repository_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tech_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_software_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repository_links_scoped_select ON public.repository_links;
CREATE POLICY repository_links_scoped_select ON public.repository_links
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      frente_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.frentes f
        WHERE f.id = repository_links.frente_id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      frente_id IS NULL AND operation_id IS NOT NULL
      AND public.can_see_operation(repository_links.operation_id)
    )
    OR (
      operation_id IS NULL AND frente_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = repository_links.client_id
          AND (
            public.is_admin()
            OR EXISTS (
              SELECT 1 FROM public.operations o
              WHERE o.client_id = c.id AND public.can_see_operation(o.id)
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS repository_links_scoped_insert ON public.repository_links;
CREATE POLICY repository_links_scoped_insert ON public.repository_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      frente_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.frentes f
        WHERE f.id = repository_links.frente_id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      frente_id IS NULL AND operation_id IS NOT NULL
      AND public.can_see_operation(repository_links.operation_id)
    )
    OR (
      operation_id IS NULL AND frente_id IS NULL
      AND public.is_admin()
    )
  );

DROP POLICY IF EXISTS repository_links_scoped_update ON public.repository_links;
CREATE POLICY repository_links_scoped_update ON public.repository_links
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      frente_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.frentes f
        WHERE f.id = repository_links.frente_id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      frente_id IS NULL AND operation_id IS NOT NULL
      AND public.can_see_operation(repository_links.operation_id)
    )
    OR (
      operation_id IS NULL AND frente_id IS NULL
      AND public.is_admin()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      frente_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.frentes f
        WHERE f.id = repository_links.frente_id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      frente_id IS NULL AND operation_id IS NOT NULL
      AND public.can_see_operation(repository_links.operation_id)
    )
    OR (
      operation_id IS NULL AND frente_id IS NULL
      AND public.is_admin()
    )
  );

DROP POLICY IF EXISTS repository_links_scoped_delete ON public.repository_links;
CREATE POLICY repository_links_scoped_delete ON public.repository_links
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      frente_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.frentes f
        WHERE f.id = repository_links.frente_id
          AND public.can_see_operation(f.operation_id)
      )
    )
    OR (
      frente_id IS NULL AND operation_id IS NOT NULL
      AND public.can_see_operation(repository_links.operation_id)
    )
    OR (
      operation_id IS NULL AND frente_id IS NULL
      AND public.is_admin()
    )
  );

DROP POLICY IF EXISTS client_tech_items_admin_all ON public.client_tech_items;
CREATE POLICY client_tech_items_admin_write ON public.client_tech_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS client_tech_items_scoped_select ON public.client_tech_items;
CREATE POLICY client_tech_items_scoped_select ON public.client_tech_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tech_items.client_id
        AND EXISTS (
          SELECT 1 FROM public.operations o
          WHERE o.client_id = c.id AND public.can_see_operation(o.id)
        )
    )
  );

DROP POLICY IF EXISTS client_software_items_admin_all ON public.client_software_items;
CREATE POLICY client_software_items_admin_write ON public.client_software_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS client_software_items_scoped_select ON public.client_software_items;
CREATE POLICY client_software_items_scoped_select ON public.client_software_items
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_software_items.client_id
        AND EXISTS (
          SELECT 1 FROM public.operations o
          WHERE o.client_id = c.id AND public.can_see_operation(o.id)
        )
    )
  );
