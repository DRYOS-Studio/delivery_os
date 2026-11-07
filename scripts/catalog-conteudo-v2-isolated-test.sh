#!/usr/bin/env bash
# Disposable Postgres: full migrations + catalog v2 assertions + idempotent re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${CATALOG_TEST_DB:-dryos_catalog_isolated}"
MIGRATION_V2="${ROOT}/supabase/migrations/20261107013000_catalog_conteudo_v2.sql"

CANONICAL_SLUGS=(
  fd-iris fd-theo fd-nero fd-atlas
  auto-atendimento auto-integracao-sistemas auto-agente-ia-especializado auto-relatorios-dashboards auto-cobranca-conciliacao
  dryos-os-basic dryos-os-pro dryos-os-max
  studio-projetos-sob-medida
  studio-consultoria studio-processos studio-infraestrutura studio-growth studio-performance studio-desenvolvimento
)
LEGACY_SLUGS=(
  core spark-inbox spark-bridge spark-specialist spark-pulse spark-cobra
  studio-launch studio-custom studio-insight studio-bridge-plus studio-agent evergreen
)
EXPECTED_CANONICAL_ACTIVE=19
EXPECTED_LEGACY=12

fail() {
  echo "ASSERT FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ASSERT OK: $*"
}

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

echo "== catalog_conteudo_v2 isolated DB: ${DB_NAME}"

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

while IFS= read -r -d '' f; do
  echo "Applying $(basename "$f")..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

pass "all migrations applied once"

# --- fixture: client, operation, legacy + custom products, frentes ---
run_sql <<'SQL'
INSERT INTO public.clients (id, name, slug)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Catalog Test Client', 'catalog-test');

INSERT INTO public.operations (id, client_id, product_line, name, status)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'core',
  'Op catalog isolation',
  'em_operacao'
);

INSERT INTO public.service_products (name, slug, description, default_cycle_type)
VALUES (
  'CRM com IA (custom)',
  'crm-com-ia-custom',
  'Produto custom criado fora do seed — não deve ser arquivado.',
  'c'
);

INSERT INTO public.frentes (
  id, operation_id, name, cycle_type, domain, phase, actionable_status, product_id
)
SELECT
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Frente legada Core',
  'c',
  'infra',
  'execucao',
  'aguardando validacao de catalogo desde hoje',
  id
FROM public.service_products WHERE slug = 'core';

INSERT INTO public.frentes (
  id, operation_id, name, cycle_type, domain, phase, actionable_status, product_id
)
SELECT
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Frente custom CRM',
  'c',
  'infra',
  'execucao',
  'aguardando validacao de catalogo desde hoje',
  id
FROM public.service_products WHERE slug = 'crm-com-ia-custom';
SQL

pass "fixtures: frente legada (core) + frente custom + custom product"

# --- counts after first pass (v2 already in chain) ---
total_products=$(run_sql -tA -c "SELECT count(*)::int FROM public.service_products;")
legacy_archived=$(run_sql -tA -c "
  SELECT count(*)::int FROM public.service_products
  WHERE slug = ANY (ARRAY[
    'core','spark-inbox','spark-bridge','spark-specialist','spark-pulse','spark-cobra',
    'studio-launch','studio-custom','studio-insight','studio-bridge-plus','studio-agent','evergreen'
  ]::text[]) AND archived_at IS NOT NULL;
")
custom_archived=$(run_sql -tA -c "
  SELECT archived_at IS NOT NULL FROM public.service_products WHERE slug = 'crm-com-ia-custom';
")
canonical_active=$(run_sql -tA -c "
  SELECT count(*)::int FROM public.service_products
  WHERE archived_at IS NULL AND slug = ANY (ARRAY[
    'fd-iris','fd-theo','fd-nero','fd-atlas',
    'auto-atendimento','auto-integracao-sistemas','auto-agente-ia-especializado','auto-relatorios-dashboards','auto-cobranca-conciliacao',
    'dryos-os-basic','dryos-os-pro','dryos-os-max',
    'studio-projetos-sob-medida',
    'studio-consultoria','studio-processos','studio-infraestrutura','studio-growth','studio-performance','studio-desenvolvimento'
  ]::text[]);
")
dup_slugs=$(run_sql -tA -c "
  SELECT count(*)::int FROM (
    SELECT slug FROM public.service_products GROUP BY slug HAVING count(*) > 1
  ) d;
")

[[ "$legacy_archived" -eq "$EXPECTED_LEGACY" ]] || fail "legacy archived expected ${EXPECTED_LEGACY}, got ${legacy_archived}"
[[ "$canonical_active" -eq "$EXPECTED_CANONICAL_ACTIVE" ]] || fail "canonical active expected ${EXPECTED_CANONICAL_ACTIVE}, got ${canonical_active}"
[[ "$custom_archived" == "f" ]] || fail "custom product must stay active"
[[ "$dup_slugs" -eq 0 ]] || fail "duplicate slugs: ${dup_slugs}"

pass "legacy archived=${legacy_archived}, canonical active=${canonical_active}, custom active, no dup slugs (total rows=${total_products})"

# FK + history before re-run
legacy_frente_product=$(run_sql -tA -c "
  SELECT sp.slug FROM public.frentes f
  JOIN public.service_products sp ON sp.id = f.product_id
  WHERE f.id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
")
custom_frente_product=$(run_sql -tA -c "
  SELECT sp.slug FROM public.frentes f
  JOIN public.service_products sp ON sp.id = f.product_id
  WHERE f.id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
")
[[ "$legacy_frente_product" == "core" ]] || fail "legacy frente FK slug expected core, got ${legacy_frente_product}"
[[ "$custom_frente_product" == "crm-com-ia-custom" ]] || fail "custom frente FK expected crm-com-ia-custom"

pass "FK joins: legacy frente→core, custom frente→crm-com-ia-custom"

# Simulate edit Frente: change name only (product_id untouched)
run_sql <<'SQL'
UPDATE public.frentes
SET name = 'Frente legada Core (nome alterado)', updated_at = now()
WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SQL

legacy_after_name_only=$(run_sql -tA -c "
  SELECT sp.slug FROM public.frentes f
  JOIN public.service_products sp ON sp.id = f.product_id
  WHERE f.id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
")
[[ "$legacy_after_name_only" == "core" ]] || fail "product_id cleared after name-only UPDATE"

pass "SQL simulate save other fields: product_id on legacy frente preserved"

# --- re-run catalog v2 migration (idempotency) ---
echo "Re-applying $(basename "$MIGRATION_V2")..."
run_sql -f "$MIGRATION_V2"

legacy_archived_2=$(run_sql -tA -c "
  SELECT count(*)::int FROM public.service_products
  WHERE slug = ANY (ARRAY[
    'core','spark-inbox','spark-bridge','spark-specialist','spark-pulse','spark-cobra',
    'studio-launch','studio-custom','studio-insight','studio-bridge-plus','studio-agent','evergreen'
  ]::text[]) AND archived_at IS NOT NULL;
")
canonical_active_2=$(run_sql -tA -c "
  SELECT count(*)::int FROM public.service_products
  WHERE archived_at IS NULL AND slug = ANY (ARRAY[
    'fd-iris','fd-theo','fd-nero','fd-atlas',
    'auto-atendimento','auto-integracao-sistemas','auto-agente-ia-especializado','auto-relatorios-dashboards','auto-cobranca-conciliacao',
    'dryos-os-basic','dryos-os-pro','dryos-os-max',
    'studio-projetos-sob-medida',
    'studio-consultoria','studio-processos','studio-infraestrutura','studio-growth','studio-performance','studio-desenvolvimento'
  ]::text[]);
")
total_products_2=$(run_sql -tA -c "SELECT count(*)::int FROM public.service_products;")
custom_archived_2=$(run_sql -tA -c "
  SELECT archived_at IS NOT NULL FROM public.service_products WHERE slug = 'crm-com-ia-custom';
")
legacy_frente_product_2=$(run_sql -tA -c "
  SELECT sp.slug FROM public.frentes f
  JOIN public.service_products sp ON sp.id = f.product_id
  WHERE f.id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
")

[[ "$legacy_archived_2" -eq "$EXPECTED_LEGACY" ]] || fail "re-run: legacy archived ${legacy_archived_2}"
[[ "$canonical_active_2" -eq "$EXPECTED_CANONICAL_ACTIVE" ]] || fail "re-run: canonical active ${canonical_active_2}"
[[ "$total_products_2" -eq "$total_products" ]] || fail "re-run: row count changed ${total_products} -> ${total_products_2}"
[[ "$custom_archived_2" == "f" ]] || fail "re-run: custom archived"
[[ "$legacy_frente_product_2" == "core" ]] || fail "re-run: frente lost FK"

pass "re-run migration: counts stable, FK/history preserved"

studio_categories=$(run_sql -tA -c "
  SELECT count(*)::int FROM public.service_products
  WHERE catalog_kind = 'studio_category' AND archived_at IS NULL
    AND name IN ('Consultoria','Processos','Infraestrutura','Growth','Performance','Desenvolvimento');
")
[[ "$studio_categories" -eq 6 ]] || fail "expected 6 studio categories, got ${studio_categories}"

pass "6 Studio categories with exact names"

echo ""
echo "=== catalog_conteudo_v2 isolated test: ALL PASSED ==="
