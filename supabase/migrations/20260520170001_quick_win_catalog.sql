-- quick_win_catalog
-- Tipos pre-definidos de Quick Win com vilao sugerido e impacto sugerido.
-- Admin gerencia em /catalog/quick-wins; form de QW em Operacao usa pra auto-fill.

CREATE TABLE IF NOT EXISTS public.quick_win_catalog (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  suggested_villain_id  uuid,
  default_impact_pct    smallint,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_qwc_villain') THEN
    ALTER TABLE public.quick_win_catalog
      ADD CONSTRAINT fk_qwc_villain FOREIGN KEY (suggested_villain_id)
      REFERENCES public.villains(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_qwc_title_min') THEN
    ALTER TABLE public.quick_win_catalog
      ADD CONSTRAINT chk_qwc_title_min CHECK (length(trim(title)) BETWEEN 3 AND 120);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_qwc_impact_range') THEN
    ALTER TABLE public.quick_win_catalog
      ADD CONSTRAINT chk_qwc_impact_range
      CHECK (default_impact_pct IS NULL OR (default_impact_pct >= 1 AND default_impact_pct <= 100));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_qwc_title_unique_ci
  ON public.quick_win_catalog (lower(trim(title)));

CREATE INDEX IF NOT EXISTS idx_qwc_archived_active
  ON public.quick_win_catalog (title) WHERE archived_at IS NULL;

ALTER TABLE public.quick_win_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qwc_authenticated_full ON public.quick_win_catalog;
CREATE POLICY qwc_authenticated_full
  ON public.quick_win_catalog FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_qwc_updated_at ON public.quick_win_catalog;
CREATE TRIGGER trg_qwc_updated_at
  BEFORE UPDATE ON public.quick_win_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.quick_win_catalog IS
  'catalog: tipos pre-definidos de Quick Win com vilao sugerido e impacto sugerido. Admin gerencia em /catalog/quick-wins; form de QW em Operacao usa pra auto-fill (nao persiste origem). Archive-only via archived_at.';

COMMENT ON COLUMN public.quick_win_catalog.suggested_villain_id IS
  'Vilao mais comumente atacado por este tipo de QW. Nullable; FK ON DELETE SET NULL (archive de vilao nao bloqueia).';

COMMENT ON COLUMN public.quick_win_catalog.default_impact_pct IS
  'Impacto sugerido no vilao (1-100). Nullable. CHECK chk_qwc_impact_range valida range.';

-- Seed: 21 entradas (3 por vilao)
INSERT INTO public.quick_win_catalog
  (title, description, suggested_villain_id, default_impact_pct)
SELECT * FROM (VALUES
  -- Manualis
  ('Automacao de relatorio recorrente', 'Substituir geracao manual de relatorio por job programado com snapshot versionado.', (SELECT id FROM public.villains WHERE slug='manualis'), 15::smallint),
  ('Eliminacao de copia manual entre sistemas', 'Pipeline (webhook ou ETL) substitui copy-paste entre planilha/CRM.', (SELECT id FROM public.villains WHERE slug='manualis'), 12::smallint),
  ('Templates padronizados de comunicacao', 'Library de mensagens pre-aprovadas reduz redacao manual em casos repetidos.', (SELECT id FROM public.villains WHERE slug='manualis'), 8::smallint),
  -- Silos
  ('Integracao entre sistemas via API/webhook', 'Conectar dois sistemas que antes so conversavam via export manual.', (SELECT id FROM public.villains WHERE slug='silos'), 15::smallint),
  ('Base unificada de leads/contas', 'Dedup + merge cria fonte unica; deixa de ter "qual sistema tem o dado certo?"', (SELECT id FROM public.villains WHERE slug='silos'), 12::smallint),
  ('Single source of truth definido', 'Documentar e enforcar qual sistema e canonico pra cada entidade.', (SELECT id FROM public.villains WHERE slug='silos'), 10::smallint),
  -- Retrabalho
  ('Checklist de qualidade pre-entrega', 'Lista padronizada de verificacao reduz devolucoes pos-entrega.', (SELECT id FROM public.villains WHERE slug='retrabalho'), 10::smallint),
  ('Revisao estruturada com cliente', 'Reuniao curta de validacao com prompts especificos antes do entregavel final.', (SELECT id FROM public.villains WHERE slug='retrabalho'), 12::smallint),
  ('Versionamento de assets/documentos', 'Branch/PR pra docs evita perda de mudancas e conflito de versao.', (SELECT id FROM public.villains WHERE slug='retrabalho'), 8::smallint),
  -- Lento
  ('Reuniao semanal de desbloqueio', 'Touchpoint curto remove impedimentos antes que viram bottleneck.', (SELECT id FROM public.villains WHERE slug='lento'), 8::smallint),
  ('SLA acionavel definido por etapa', 'Tempo maximo por fase com responsavel e alerta automatico.', (SELECT id FROM public.villains WHERE slug='lento'), 10::smallint),
  ('Caminho critico mapeado', 'Identificar e medir so as dependencias que bloqueiam o resto do fluxo.', (SELECT id FROM public.villains WHERE slug='lento'), 8::smallint),
  -- Achismo
  ('Dashboard executivo entregue', 'KPIs principais em 1 tela atualizada em tempo real.', (SELECT id FROM public.villains WHERE slug='achismo'), 15::smallint),
  ('Forecast quantitativo de receita', 'Modelo (mesmo simples) de projecao substitui chute do gestor.', (SELECT id FROM public.villains WHERE slug='achismo'), 12::smallint),
  ('A/B test estruturado', 'Validar mudanca com hipotese, metrica e amostra antes de roll-out.', (SELECT id FROM public.villains WHERE slug='achismo'), 10::smallint),
  -- Drenador
  ('Analise de custo por entrega', 'Custo unitario expoe margens negativas escondidas em medias.', (SELECT id FROM public.villains WHERE slug='drenador'), 10::smallint),
  ('Substituicao de SaaS redundante', 'Cancelar/consolidar ferramenta que duplicava funcao de outra.', (SELECT id FROM public.villains WHERE slug='drenador'), 8::smallint),
  ('Renegociacao de fornecedor critico', 'Re-tier ou volume discount cortando custo fixo recorrente.', (SELECT id FROM public.villains WHERE slug='drenador'), 8::smallint),
  -- Enganador
  ('North star metric definida', 'Metrica unica que alinha o time e expoe vaidade de outras.', (SELECT id FROM public.villains WHERE slug='enganador'), 12::smallint),
  ('Funil de retencao mapeado', 'Cohort por safra revela churn real escondido em "MRR cresceu".', (SELECT id FROM public.villains WHERE slug='enganador'), 10::smallint),
  ('Coorte de receita por safra', 'Receita por mes de aquisicao revela payback period e LTV verdadeiros.', (SELECT id FROM public.villains WHERE slug='enganador'), 10::smallint)
) AS seed_data(title, description, suggested_villain_id, default_impact_pct)
WHERE NOT EXISTS (
  SELECT 1 FROM public.quick_win_catalog
  WHERE lower(trim(quick_win_catalog.title)) = lower(trim(seed_data.title))
);
