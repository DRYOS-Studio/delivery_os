-- DRYOS Delivery — seed de demonstração (dev only).
-- Popula 3 Clientes + 3 Operações + 3 Frentes + 2 Pessoas internas + 3 Alocações.
-- Idempotente via ON CONFLICT (slug) e WHERE NOT EXISTS.
-- NÃO é migration permanente — aplicar manualmente via MCP execute_sql ou Supabase SQL editor.
--
-- Re-rodar não duplica nem corrompe dados existentes.

-- ============================================================================
-- 1. Clients (slug é UNIQUE)
-- ============================================================================

INSERT INTO public.clients (name, slug) VALUES
  ('Acme', 'acme'),
  ('Beta', 'beta'),
  ('Gama', 'gama')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. Operations (name não é UNIQUE — usa WHERE NOT EXISTS)
-- ============================================================================

INSERT INTO public.operations (client_id, product_line, name, status, monthly_recurring_revenue, recurrence, start_date)
SELECT
  (SELECT id FROM public.clients WHERE slug = 'acme'),
  'core'::public.product_line,
  'Acme Core',
  'em_operacao'::public.operation_status,
  8500.00,
  'mensal'::public.recurrence,
  current_date - interval '90 days'
WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Acme Core');

INSERT INTO public.operations (client_id, product_line, name, status, monthly_recurring_revenue, recurrence, start_date)
SELECT
  (SELECT id FROM public.clients WHERE slug = 'beta'),
  'spark'::public.product_line,
  'Beta Spark Inbox',
  'em_operacao'::public.operation_status,
  3200.00,
  'mensal'::public.recurrence,
  current_date - interval '45 days'
WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Beta Spark Inbox');

INSERT INTO public.operations (client_id, product_line, name, status, monthly_recurring_revenue, recurrence, start_date)
SELECT
  (SELECT id FROM public.clients WHERE slug = 'gama'),
  'studio'::public.product_line,
  'Gama Studio Launch — Edicao 12',
  'janela_critica'::public.operation_status,
  NULL,
  'unica'::public.recurrence,
  current_date - interval '21 days'
WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Gama Studio Launch — Edicao 12');

-- ============================================================================
-- 3. Frentes (uma por Operação — status acionável >= 15 chars e NÃO genérico)
-- ============================================================================

INSERT INTO public.frentes (operation_id, name, cycle_type, domain, actionable_status, actionable_status_since, phase)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Acme Core'),
  'Infra',
  'c'::public.frente_cycle_type,
  'infra'::public.frente_domain,
  'aguardando aprovacao do briefing tecnico do cliente',
  now() - interval '3 days',
  'execucao'::public.frente_phase
WHERE NOT EXISTS (
  SELECT 1 FROM public.frentes
  WHERE operation_id = (SELECT id FROM public.operations WHERE name = 'Acme Core')
    AND name = 'Infra'
);

INSERT INTO public.frentes (operation_id, name, cycle_type, domain, actionable_status, actionable_status_since, phase)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Beta Spark Inbox'),
  'Infra',
  'c'::public.frente_cycle_type,
  'infra'::public.frente_domain,
  'aguardando handoff do design pelo cliente',
  now() - interval '1 days',
  'execucao'::public.frente_phase
WHERE NOT EXISTS (
  SELECT 1 FROM public.frentes
  WHERE operation_id = (SELECT id FROM public.operations WHERE name = 'Beta Spark Inbox')
    AND name = 'Infra'
);

INSERT INTO public.frentes (operation_id, name, cycle_type, domain, actionable_status, actionable_status_since, phase)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Gama Studio Launch — Edicao 12'),
  'Infra',
  'a'::public.frente_cycle_type,
  'infra'::public.frente_domain,
  'aguardando review do tech lead antes do go-live',
  now() - interval '6 hours',
  'entrega'::public.frente_phase
WHERE NOT EXISTS (
  SELECT 1 FROM public.frentes
  WHERE operation_id = (SELECT id FROM public.operations WHERE name = 'Gama Studio Launch — Edicao 12')
    AND name = 'Infra'
);

-- ============================================================================
-- 4. Persons (internal — name não é UNIQUE; idempotência por nome+kind)
-- ============================================================================

INSERT INTO public.persons (kind, name, specialty, email)
SELECT 'internal'::public.person_kind, 'Rafael', 'Engenharia', 'rafaelemeth@gmail.com'
WHERE NOT EXISTS (
  SELECT 1 FROM public.persons WHERE name = 'Rafael' AND kind = 'internal'
);

INSERT INTO public.persons (kind, name, specialty)
SELECT 'internal'::public.person_kind, 'Gabi', 'Marketing'
WHERE NOT EXISTS (
  SELECT 1 FROM public.persons WHERE name = 'Gabi' AND kind = 'internal'
);

-- ============================================================================
-- 5. Allocations (Rafael em Acme + Beta; Gabi responsável em Gama)
-- ============================================================================

INSERT INTO public.allocations (person_id, frente_id, role, capacity_weekly_pct)
SELECT
  (SELECT id FROM public.persons WHERE name = 'Rafael' AND kind = 'internal'),
  (SELECT f.id FROM public.frentes f
   JOIN public.operations o ON o.id = f.operation_id
   WHERE o.name = 'Acme Core' AND f.name = 'Infra'),
  'executor'::public.allocation_role,
  40
WHERE NOT EXISTS (
  SELECT 1 FROM public.allocations a
  WHERE a.person_id = (SELECT id FROM public.persons WHERE name = 'Rafael' AND kind = 'internal')
    AND a.frente_id = (SELECT f.id FROM public.frentes f
                       JOIN public.operations o ON o.id = f.operation_id
                       WHERE o.name = 'Acme Core' AND f.name = 'Infra')
    AND a.role = 'executor'
);

INSERT INTO public.allocations (person_id, frente_id, role, capacity_weekly_pct)
SELECT
  (SELECT id FROM public.persons WHERE name = 'Rafael' AND kind = 'internal'),
  (SELECT f.id FROM public.frentes f
   JOIN public.operations o ON o.id = f.operation_id
   WHERE o.name = 'Beta Spark Inbox' AND f.name = 'Infra'),
  'executor'::public.allocation_role,
  30
WHERE NOT EXISTS (
  SELECT 1 FROM public.allocations a
  WHERE a.person_id = (SELECT id FROM public.persons WHERE name = 'Rafael' AND kind = 'internal')
    AND a.frente_id = (SELECT f.id FROM public.frentes f
                       JOIN public.operations o ON o.id = f.operation_id
                       WHERE o.name = 'Beta Spark Inbox' AND f.name = 'Infra')
    AND a.role = 'executor'
);

INSERT INTO public.allocations (person_id, frente_id, role, capacity_weekly_pct)
SELECT
  (SELECT id FROM public.persons WHERE name = 'Gabi' AND kind = 'internal'),
  (SELECT f.id FROM public.frentes f
   JOIN public.operations o ON o.id = f.operation_id
   WHERE o.name = 'Gama Studio Launch — Edicao 12' AND f.name = 'Infra'),
  'responsavel'::public.allocation_role,
  50
WHERE NOT EXISTS (
  SELECT 1 FROM public.allocations a
  WHERE a.person_id = (SELECT id FROM public.persons WHERE name = 'Gabi' AND kind = 'internal')
    AND a.frente_id = (SELECT f.id FROM public.frentes f
                       JOIN public.operations o ON o.id = f.operation_id
                       WHERE o.name = 'Gama Studio Launch — Edicao 12' AND f.name = 'Infra')
    AND a.role = 'responsavel'
);

-- ============================================================================
-- 6. Custos demo (após migration 20261109250000_operation_costs_category)
-- Acme Core: legado migrado + exemplos categorizados para aba Custos.
-- ============================================================================

UPDATE public.operations
SET monthly_fixed_cost = 1200.00
WHERE name = 'Acme Core'
  AND (monthly_fixed_cost IS NULL OR monthly_fixed_cost = 0);

INSERT INTO public.operation_costs (
  operation_id, label, amount, recurrence, started_at, category, notes
)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Acme Core'),
  'Custo migrado do campo único',
  1200.00,
  'mensal'::public.cost_recurrence,
  current_date - interval '60 days',
  'a_classificar'::public.operation_cost_category,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.operation_costs c
  WHERE c.operation_id = (SELECT id FROM public.operations WHERE name = 'Acme Core')
    AND c.label = 'Custo migrado do campo único'
    AND c.category = 'a_classificar'::public.operation_cost_category
);

INSERT INTO public.operation_costs (
  operation_id, label, amount, recurrence, started_at, category, notes
)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Acme Core'),
  'Ferramentas de observabilidade',
  350.00,
  'mensal'::public.cost_recurrence,
  current_date - interval '30 days',
  'infra'::public.operation_cost_category,
  'Datadog + logs'
WHERE NOT EXISTS (
  SELECT 1 FROM public.operation_costs c
  WHERE c.operation_id = (SELECT id FROM public.operations WHERE name = 'Acme Core')
    AND c.label = 'Ferramentas de observabilidade'
);

INSERT INTO public.operation_costs (
  operation_id, label, amount, recurrence, started_at, category, notes
)
SELECT
  (SELECT id FROM public.operations WHERE name = 'Acme Core'),
  'Squads de entrega',
  2800.00,
  'mensal'::public.cost_recurrence,
  current_date - interval '90 days',
  'time'::public.operation_cost_category,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.operation_costs c
  WHERE c.operation_id = (SELECT id FROM public.operations WHERE name = 'Acme Core')
    AND c.label = 'Squads de entrega'
);
