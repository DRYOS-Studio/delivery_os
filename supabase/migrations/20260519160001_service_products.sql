-- service_products
-- Catalogo de produtos comerciais DRYOS (Core, Sparks, Studios, Evergreen).
-- Referenciado opcionalmente por frentes via product_id.

CREATE TABLE IF NOT EXISTS public.service_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  default_cycle_type  public.frente_cycle_type,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_products_name_min') THEN
    ALTER TABLE public.service_products
      ADD CONSTRAINT chk_service_products_name_min CHECK (length(trim(name)) >= 2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_products_slug_format') THEN
    ALTER TABLE public.service_products
      ADD CONSTRAINT chk_service_products_slug_format
      CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_products_slug ON public.service_products(slug);

CREATE INDEX IF NOT EXISTS idx_service_products_archived_active
  ON public.service_products (name) WHERE archived_at IS NULL;

ALTER TABLE public.service_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_products_authenticated_full ON public.service_products;
CREATE POLICY service_products_authenticated_full
  ON public.service_products
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_service_products_updated_at ON public.service_products;
CREATE TRIGGER trg_service_products_updated_at
  BEFORE UPDATE ON public.service_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.service_products IS
  'catalog: produtos comerciais DRYOS (Core, Sparks, Studios, Evergreen). Referenciado opcionalmente por frentes via product_id. Archive-only via archived_at, nunca delete real.';

COMMENT ON COLUMN public.service_products.slug IS
  'URL-safe (kebab-case). UNIQUE. CHECK regex impede maiusculas/espacos.';

COMMENT ON COLUMN public.service_products.default_cycle_type IS
  'Ciclo padrao sugerido ao usar este produto numa Frente. Nullable (produto generico sem ciclo natural).';

-- FK em frentes
ALTER TABLE public.frentes
  ADD COLUMN IF NOT EXISTS product_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_frentes_product_id') THEN
    ALTER TABLE public.frentes
      ADD CONSTRAINT fk_frentes_product_id FOREIGN KEY (product_id)
      REFERENCES public.service_products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_frentes_product_id
  ON public.frentes(product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.frentes.product_id IS
  'Produto comercial DRYOS associado a esta Frente. Opcional. FK ON DELETE SET NULL preserva Frente.';

-- Seed: 12 produtos DRYOS
INSERT INTO public.service_products (name, slug, default_cycle_type, description) VALUES
  ('DRYOS Core', 'core', 'c', 'Plataforma premium com 8 modulos integrados (CRM, Deals, Inbox, Reach, Flow, Insights, Guard, Aegis). Operacao continua recorrente.'),
  ('Spark Inbox', 'spark-inbox', 'c', 'Atendimento com IA na caixa de entrada. Sprint recorrente mensal.'),
  ('Spark Bridge', 'spark-bridge', 'c', 'Integracoes sob medida entre sistemas. Sprint recorrente mensal.'),
  ('Spark Specialist', 'spark-specialist', 'c', 'Agente IA especializado em dominio. Sprint recorrente mensal.'),
  ('Spark Pulse', 'spark-pulse', 'c', 'Dashboards e indicadores operacionais. Sprint recorrente mensal.'),
  ('Spark Cobra', 'spark-cobra', 'c', 'Cobranca automatizada. Sprint recorrente mensal.'),
  ('Studio Launch', 'studio-launch', 'd', 'Infra tecnica completa para lancamentos digitais. Edicoes episodicas.'),
  ('Studio Custom', 'studio-custom', 'a', 'Sistemas internos sob medida. Projeto finito.'),
  ('Studio Insight', 'studio-insight', 'a', 'Plataformas de inteligencia customizadas. Projeto finito.'),
  ('Studio Bridge+', 'studio-bridge-plus', 'a', 'Integracoes complexas com legacy. Projeto finito.'),
  ('Studio Agent', 'studio-agent', 'a', 'Agentes IA com requisitos unicos. Projeto finito.'),
  ('Evergreen', 'evergreen', 'e', 'Manutencao continuada de plataformas entregues. Tipo E.')
ON CONFLICT (slug) DO NOTHING;
