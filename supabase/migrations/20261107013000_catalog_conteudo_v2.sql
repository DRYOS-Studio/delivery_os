-- catalog: hierarquia grupo / produto / plano / categoria Studio — fonte dryos-conteudo (main).
-- Arquivamento automático SOMENTE dos slugs do seed legado 20260519160001 (lista explícita).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_offer_group') THEN
    CREATE TYPE public.catalog_offer_group AS ENUM (
      'funcionarios_digitais',
      'automacoes',
      'dryos_os',
      'studio'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalog_offer_kind') THEN
    CREATE TYPE public.catalog_offer_kind AS ENUM ('product', 'plan', 'studio_category');
  END IF;
END $$;

ALTER TABLE public.service_products
  ADD COLUMN IF NOT EXISTS catalog_group public.catalog_offer_group,
  ADD COLUMN IF NOT EXISTS catalog_kind public.catalog_offer_kind NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_ref text;

COMMENT ON COLUMN public.service_products.catalog_group IS
  'catalog: linha comercial (conteúdo) — FD, Automações, DRYOS OS, Studio.';
COMMENT ON COLUMN public.service_products.catalog_kind IS
  'catalog: product (oferta), plan (Basic/Pro/Max), studio_category (6 categorias Studio).';
COMMENT ON COLUMN public.service_products.sort_order IS
  'catalog: ordem de exibição dentro do grupo.';
COMMENT ON COLUMN public.service_products.content_ref IS
  'catalog: path relativo no repo dryos-conteudo (referência, sem preço).';

-- Arquivar ofertas legadas comprovadas (não toca slugs custom nem já arquivados por decisão manual).
UPDATE public.service_products
SET archived_at = COALESCE(archived_at, now())
WHERE archived_at IS NULL
  AND slug = ANY (
    ARRAY[
      'core',
      'spark-inbox',
      'spark-bridge',
      'spark-specialist',
      'spark-pulse',
      'spark-cobra',
      'studio-launch',
      'studio-custom',
      'studio-insight',
      'studio-bridge-plus',
      'studio-agent',
      'evergreen'
    ]::text[]
  );

-- Ofertas canônicas (idempotente via slug)
INSERT INTO public.service_products (
  name, slug, description, default_cycle_type, catalog_group, catalog_kind, sort_order, content_ref, archived_at
) VALUES
  (
    'Íris',
    'fd-iris',
    'Funcionário Digital — atendimento e triagem comercial (WhatsApp, BANT, agendamento). Sem preço público; setup + mensalidade após diagnóstico.',
    'c',
    'funcionarios_digitais',
    'product',
    1,
    'dryos/agentes/comercial/conhecimento/17-fd-iris.txt',
    NULL
  ),
  (
    'Theo',
    'fd-theo',
    'Funcionário Digital — régua financeira (vencimentos, Pix/boleto, renegociação).',
    'c',
    'funcionarios_digitais',
    'product',
    2,
    'dryos/agentes/comercial/conhecimento/18-fd-theo.txt',
    NULL
  ),
  (
    'Nero',
    'fd-nero',
    'Funcionário Digital — indicadores e desvios entregues de manhã.',
    'c',
    'funcionarios_digitais',
    'product',
    3,
    'dryos/agentes/comercial/conhecimento/19-fd-nero.txt',
    NULL
  ),
  (
    'Atlas',
    'fd-atlas',
    'Funcionário Digital — entrada de novos clientes (documentos, acessos, repositórios).',
    'c',
    'funcionarios_digitais',
    'product',
    4,
    'dryos/agentes/comercial/conhecimento/20-fd-atlas.txt',
    NULL
  ),
  (
    'Automação de atendimento',
    'auto-atendimento',
    'Escopo fixo: 1ª camada WhatsApp/e-mail, qualificação, handoff, CRM, painel. Prazo publicado: 10 dias úteis. Recorrente mensal.',
    'c',
    'automacoes',
    'product',
    1,
    'dryos/agentes/automacoes/conhecimento/05-automacao-atendimento.txt',
    NULL
  ),
  (
    'Integração entre sistemas',
    'auto-integracao-sistemas',
    'Escopo fixo: mapa de dados, integrações ponto a ponto, dedup, log e alerta. Prazo: 14 dias úteis.',
    'c',
    'automacoes',
    'product',
    2,
    'dryos/agentes/automacoes/conhecimento/06-integracao-sistemas.txt',
    NULL
  ),
  (
    'Agente de IA especializado',
    'auto-agente-ia-especializado',
    'Escopo fixo: ingestão de docs, limites em contrato, fallback humano. Prazo: 14 dias úteis.',
    'c',
    'automacoes',
    'product',
    3,
    'dryos/agentes/automacoes/conhecimento/07-agente-ia-especializado.txt',
    NULL
  ),
  (
    'Relatórios e dashboards',
    'auto-relatorios-dashboards',
    'Escopo fixo: KPIs, dashboard em tempo real, relatório semanal IA, alertas. Prazo: 14 dias úteis.',
    'c',
    'automacoes',
    'product',
    4,
    'dryos/agentes/automacoes/conhecimento/08-automacao-relatorios.txt',
    NULL
  ),
  (
    'Cobrança e conciliação',
    'auto-cobranca-conciliacao',
    'Escopo fixo: régua WhatsApp, NF, boleto/Pix, conciliação, painel inadimplência. Prazo: 10 dias úteis.',
    'c',
    'automacoes',
    'product',
    5,
    'dryos/agentes/automacoes/conhecimento/09-automacao-cobranca.txt',
    NULL
  ),
  (
    'DRYOS OS Basic',
    'dryos-os-basic',
    'Plano Basic: inbox WhatsApp, contatos/histórico, automações essenciais, 1 canal até 3 atendentes. Investimento sob diagnóstico.',
    'c',
    'dryos_os',
    'plan',
    1,
    'dryos/agentes/core/conhecimento/19-core-planos.txt',
    NULL
  ),
  (
    'DRYOS OS Pro',
    'dryos-os-pro',
    'Plano Pro: Basic + CRM com funil, builder de fluxos completo, gatilhos por inatividade/horário.',
    'c',
    'dryos_os',
    'plan',
    2,
    'dryos/agentes/core/conhecimento/19-core-planos.txt',
    NULL
  ),
  (
    'DRYOS OS Max',
    'dryos-os-max',
    'Plano Max: Pro + BYOK com failover entre provedores.',
    'c',
    'dryos_os',
    'plan',
    3,
    'dryos/agentes/core/conhecimento/19-core-planos.txt',
    NULL
  ),
  (
    'Projetos sob medida',
    'studio-projetos-sob-medida',
    'Studio / engenharia: sistemas dedicados, infraestrutura e desenvolvimento contínuo quando o diagnóstico aponta projeto dedicado.',
    'a',
    'studio',
    'product',
    0,
    'dryos/agentes/studio/conhecimento/20-projetos-em-producao.txt',
    NULL
  ),
  (
    'Consultoria',
    'studio-consultoria',
    'Categoria Studio (organização interna Delivery). Escopo definido no diagnóstico/contrato — sem detalhe comercial fixo no conteúdo.',
    'a',
    'studio',
    'studio_category',
    1,
    NULL,
    NULL
  ),
  (
    'Processos',
    'studio-processos',
    'Categoria Studio (organização interna Delivery).',
    'a',
    'studio',
    'studio_category',
    2,
    NULL,
    NULL
  ),
  (
    'Infraestrutura',
    'studio-infraestrutura',
    'Categoria Studio (organização interna Delivery).',
    'a',
    'studio',
    'studio_category',
    3,
    NULL,
    NULL
  ),
  (
    'Growth',
    'studio-growth',
    'Categoria Studio (organização interna Delivery).',
    'a',
    'studio',
    'studio_category',
    4,
    NULL,
    NULL
  ),
  (
    'Performance',
    'studio-performance',
    'Categoria Studio (organização interna Delivery).',
    'a',
    'studio',
    'studio_category',
    5,
    NULL,
    NULL
  ),
  (
    'Desenvolvimento',
    'studio-desenvolvimento',
    'Categoria Studio (organização interna Delivery).',
    'a',
    'studio',
    'studio_category',
    6,
    NULL,
    NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_cycle_type = EXCLUDED.default_cycle_type,
  catalog_group = EXCLUDED.catalog_group,
  catalog_kind = EXCLUDED.catalog_kind,
  sort_order = EXCLUDED.sort_order,
  content_ref = EXCLUDED.content_ref,
  archived_at = NULL,
  updated_at = now();

COMMENT ON TABLE public.service_products IS
  'catalog: ofertas comerciais DRYOS (fonte: dryos-conteudo). FK opcional em frentes.product_id. Legado Core/Spark arquivado por slug explícito.';
