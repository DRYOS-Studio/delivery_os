-- Proposta de backfill product_line → catalog_group (NÃO executar sem aprovação operação a operação).
-- Rafael aplica o mapeamento manualmente; este arquivo serve só de referência.

/*
-- Mapeamento sugerido (legado enum → grupo comercial):
--   core   → dryos_os
--   spark  → funcionarios_digitais  (revisar caso a caso — Sparks variam)
--   studio → studio

UPDATE public.operations o
SET catalog_group = 'dryos_os'::public.catalog_offer_group
WHERE o.catalog_group IS NULL AND o.product_line = 'core';

UPDATE public.operations o
SET catalog_group = 'funcionarios_digitais'::public.catalog_offer_group
WHERE o.catalog_group IS NULL AND o.product_line = 'spark';

UPDATE public.operations o
SET catalog_group = 'studio'::public.catalog_offer_group
WHERE o.catalog_group IS NULL AND o.product_line = 'studio';

-- Produto Revenue (slug revenue) no catálogo — atribuir grupo (dado, não migration):
-- UPDATE public.service_products
-- SET catalog_group = 'revenue'::public.catalog_offer_group
-- WHERE slug = 'revenue' AND catalog_group IS DISTINCT FROM 'revenue'::public.catalog_offer_group;
*/