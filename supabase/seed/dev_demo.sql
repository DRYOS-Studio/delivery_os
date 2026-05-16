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
