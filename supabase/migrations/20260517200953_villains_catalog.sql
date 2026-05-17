-- villains-catalog: catálogo da marca DRYOS — 7 vilões canon.
-- Inv. 06: nunca deletar, só archive. RLS sem policy DELETE (defense-in-depth).

CREATE TABLE IF NOT EXISTS public.villains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  quote text NOT NULL,
  description text NOT NULL,
  icon_name text NOT NULL,
  pill_variant text NOT NULL,
  display_order integer NOT NULL UNIQUE,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_villains_pill_variant
    CHECK (pill_variant IN ('neutral', 'oak', 'sage', 'ok', 'warning', 'critical')),
  CONSTRAINT chk_villains_slug_format
    CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 60),
  CONSTRAINT chk_villains_display_order_range
    CHECK (display_order > 0)
);

CREATE INDEX IF NOT EXISTS idx_villains_display_order
  ON public.villains (display_order ASC);

CREATE INDEX IF NOT EXISTS idx_villains_active
  ON public.villains (display_order ASC)
  WHERE archived_at IS NULL;

COMMENT ON TABLE public.villains IS
  'villain: catálogo da marca DRYOS, 7 registros canon. Inv. 06: nunca delete, só archive (sem policy DELETE).';
COMMENT ON COLUMN public.villains.icon_name IS
  'Nome do componente Lucide React (ex: ClipboardList). Mapeado em src/lib/constants/villain-icons.ts.';
COMMENT ON COLUMN public.villains.pill_variant IS
  'Variante do componente Pill UI. CHECK enforça valores válidos.';

-- ============================================================================
-- TRIGGER updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS set_villains_updated_at ON public.villains;
CREATE TRIGGER set_villains_updated_at
  BEFORE UPDATE ON public.villains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS — Inv. 06: sem policy DELETE
-- ============================================================================
ALTER TABLE public.villains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS villains_authenticated_select ON public.villains;
CREATE POLICY villains_authenticated_select
  ON public.villains FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS villains_authenticated_insert ON public.villains;
CREATE POLICY villains_authenticated_insert
  ON public.villains FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS villains_authenticated_update ON public.villains;
CREATE POLICY villains_authenticated_update
  ON public.villains FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED 7 vilões canon — idempotente
-- ============================================================================
INSERT INTO public.villains (name, slug, quote, description, icon_name, pill_variant, display_order)
VALUES
  ('Capitão Manualis', 'manualis',
   'Sempre foi assim.',
   'Processos manuais repetitivos que consomem horas semanais do time e travam escala.',
   'ClipboardList', 'oak', 1),
  ('Senhor dos Silos', 'silos',
   'Esse dado é do nosso setor.',
   'Dados isolados em planilhas, CRMs e cabeças diferentes — sem visão integrada.',
   'Database', 'warning', 2),
  ('Dama do Retrabalho', 'retrabalho',
   'Já fiz isso semana passada...',
   'Mesmo trabalho refeito por falta de versionamento, padrão ou comunicação.',
   'RotateCcw', 'oak', 3),
  ('General Lento', 'lento',
   'Não dá pra acelerar.',
   'Ciclos de decisão e entrega que se arrastam por hábito, fricção ou falta de prioridade.',
   'Hourglass', 'warning', 4),
  ('Oráculo do Achismo', 'achismo',
   'Eu acho que tá vendendo bem...',
   'Decisões tomadas no feeling, sem indicador objetivo nem evidência.',
   'HelpCircle', 'critical', 5),
  ('Drenador', 'drenador',
   'Só uma reuniãozinha rápida.',
   'Reuniões, status e demandas paralelas que drenam o tempo profundo do time.',
   'Droplet', 'critical', 6),
  ('Enganador', 'enganador',
   'Olha como bateu a meta!',
   'Métricas otimizadas pra parecer boas em vez de gerar valor real ao negócio.',
   'EyeOff', 'critical', 7)
ON CONFLICT (slug) DO NOTHING;
