-- Áreas como grupos de acesso (substitui o enum task_area por catálogo dinâmico).
-- PR1/M-A: tabelas + RLS + seeds. A migração enum→FK vem na M-B (150001).

-- 1. areas: catálogo dinâmico de áreas (CS/Financeiro/Jurídico + custom).
CREATE TABLE IF NOT EXISTS public.areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  name        text NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  CONSTRAINT uq_areas_slug UNIQUE (slug),
  CONSTRAINT fk_areas_created_by FOREIGN KEY (created_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.areas IS
  'auth/scope: catálogo dinâmico de áreas (CS/Financeiro/Jurídico + custom). Grupo de acesso read-only: concede leitura via area_clients/area_operations. Soft-delete via archived_at (nunca DELETE — espelha vilões). slug write-once estável (casa o enum antigo no backfill).';
COMMENT ON COLUMN public.areas.slug IS
  'Identificador estável (lower, sem acento, kebab). Seeds: cs/financeiro/juridico casam o enum task_area antigo.';

-- 2. area_clients: concessão de cliente inteiro (todas as operações do cliente).
CREATE TABLE IF NOT EXISTS public.area_clients (
  area_id    uuid NOT NULL,
  client_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT pk_area_clients PRIMARY KEY (area_id, client_id),
  CONSTRAINT fk_area_clients_area_id FOREIGN KEY (area_id)
    REFERENCES public.areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_area_clients_client_id FOREIGN KEY (client_id)
    REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_area_clients_created_by FOREIGN KEY (created_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.area_clients IS
  'auth/scope: concessão de leitura de uma área a um cliente inteiro (todas as operações dele). Gerido só por admin.';

-- 3. area_operations: concessão de operação específica.
CREATE TABLE IF NOT EXISTS public.area_operations (
  area_id      uuid NOT NULL,
  operation_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  CONSTRAINT pk_area_operations PRIMARY KEY (area_id, operation_id),
  CONSTRAINT fk_area_operations_area_id FOREIGN KEY (area_id)
    REFERENCES public.areas(id) ON DELETE CASCADE,
  CONSTRAINT fk_area_operations_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_area_operations_created_by FOREIGN KEY (created_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.area_operations IS
  'auth/scope: concessão de leitura de uma área a uma operação específica. Gerido só por admin.';

-- 4. Índices (RLS faz OR de duas junções por linha — sustentar os EXISTS).
CREATE INDEX IF NOT EXISTS idx_area_clients_area      ON public.area_clients(area_id);
CREATE INDEX IF NOT EXISTS idx_area_clients_client    ON public.area_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_area_operations_area   ON public.area_operations(area_id);
CREATE INDEX IF NOT EXISTS idx_area_operations_op      ON public.area_operations(operation_id);

-- 5. Seeds (slug = enum-value antigo, estável p/ backfill na M-B).
INSERT INTO public.areas (slug, name) VALUES
  ('cs', 'CS'),
  ('financeiro', 'Financeiro'),
  ('juridico', 'Jurídico')
ON CONFLICT (slug) DO NOTHING;

-- 6. RLS.
ALTER TABLE public.areas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_operations ENABLE ROW LEVEL SECURITY;

-- areas: admin gere; todos os autenticados LEEM o catálogo (labels de tarefa de área, selects).
DROP POLICY IF EXISTS areas_admin_all ON public.areas;
CREATE POLICY areas_admin_all ON public.areas
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS areas_authenticated_select ON public.areas;
CREATE POLICY areas_authenticated_select ON public.areas
  FOR SELECT TO authenticated
  USING (true);

-- area_clients / area_operations: dado de concessão = admin-only (CUD + SELECT).
DROP POLICY IF EXISTS area_clients_admin_all ON public.area_clients;
CREATE POLICY area_clients_admin_all ON public.area_clients
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS area_operations_admin_all ON public.area_operations;
CREATE POLICY area_operations_admin_all ON public.area_operations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
