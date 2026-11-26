-- Fixture local — cenário tipo Dra. Richaeny (onboarding_pendente + 1 op ativa).
-- Aplicar após migrations: `psql` ou Supabase SQL após `db reset`.

INSERT INTO public.clients (id, name, slug, journey_status)
VALUES (
  '78c99b9d-9281-48f5-8094-c9e7ddf872ea',
  'Dra. Richaeny (fixture)',
  'dra-richaeny-fixture',
  'onboarding_pendente'::public.client_journey_status
)
ON CONFLICT (id) DO UPDATE SET
  journey_status = EXCLUDED.journey_status,
  name = EXCLUDED.name;

INSERT INTO public.operations (
  id, client_id, product_line, name, status,
  monthly_recurring_revenue, recurrence, start_date
)
SELECT
  '1a36d7fa-89d0-44e2-bd7a-01f689046477',
  '78c99b9d-9281-48f5-8094-c9e7ddf872ea',
  'core'::public.product_line,
  'Richaeny Core (fixture)',
  'em_operacao'::public.operation_status,
  4200.00,
  'mensal'::public.recurrence,
  current_date - interval '14 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.operations WHERE id = '1a36d7fa-89d0-44e2-bd7a-01f689046477'
);

INSERT INTO public.frentes (
  id, operation_id, name, cycle_type, domain,
  actionable_status, actionable_status_since, phase
)
SELECT
  '344467a0-b9d1-4c98-851b-d40361c57ffd',
  '1a36d7fa-89d0-44e2-bd7a-01f689046477',
  'Infra',
  'c'::public.frente_cycle_type,
  'infra'::public.frente_domain,
  'aguardando alinhamento de onboarding com cliente',
  now() - interval '2 days',
  'execucao'::public.frente_phase
WHERE NOT EXISTS (
  SELECT 1 FROM public.frentes WHERE id = '344467a0-b9d1-4c98-851b-d40361c57ffd'
);