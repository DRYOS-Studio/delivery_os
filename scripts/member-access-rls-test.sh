#!/usr/bin/env bash
# Disposable Postgres: member-access hardening negatives.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MEMBER_RLS_TEST_DB:-dryos_member_rls_isolated}"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

run_rls() {
  PGPASSWORD=rls_tester psql -v ON_ERROR_STOP=1 -h localhost -U rls_tester -d "${DB_NAME}" "$@"
}

run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

while IFS= read -r -d '' f; do
  echo "Applying $(basename "$f")..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

run_sql <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO authenticated, rls_tester;
GRANT USAGE ON SCHEMA public TO authenticated, rls_tester;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, rls_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, rls_tester;
SQL

ADMIN_ID='11111111-1111-4111-8111-111111111111'
MEM_OP='22222222-2222-4222-8222-222222222222'
MEM_AREA='33333333-3333-4333-8333-333333333333'
MEM_NONE='44444444-4444-4444-8444-444444444444'
CLIENT_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
OP_ID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
AREA_ID='dddddddd-dddd-4ddd-8ddd-dddddddddddd'

run_sql <<SQL
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_ID}', 'admin@test.local'),
  ('${MEM_OP}', 'mem-op@test.local'),
  ('${MEM_AREA}', 'mem-area@test.local'),
  ('${MEM_NONE}', 'mem-none@test.local');

INSERT INTO public.profiles (id, role) VALUES
  ('${ADMIN_ID}', 'admin'),
  ('${MEM_OP}', 'member'),
  ('${MEM_AREA}', 'member'),
  ('${MEM_NONE}', 'member')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.clients (id, name, slug) VALUES
  ('${CLIENT_ID}', 'Client Test', 'client-test');

INSERT INTO public.operations (id, client_id, product_line, name, status, monthly_recurring_revenue)
VALUES ('${OP_ID}', '${CLIENT_ID}', 'core', 'Op A', 'em_operacao', 5000);

INSERT INTO public.operation_members (profile_id, operation_id)
VALUES ('${MEM_OP}', '${OP_ID}');

INSERT INTO public.areas (id, name, slug) VALUES
  ('${AREA_ID}', 'Area QA', 'area-qa') ON CONFLICT DO NOTHING;

INSERT INTO public.profile_areas (profile_id, area_id) VALUES
  ('${MEM_AREA}', '${AREA_ID}');

INSERT INTO public.area_operations (area_id, operation_id) VALUES
  ('${AREA_ID}', '${OP_ID}');
SQL

set_uid() {
  run_sql -c "SET LOCAL role authenticated; SET LOCAL request.jwt.claim.sub = '$1';"
}

echo "== area-only cannot read client via RLS =="
COUNT_AREA=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_AREA}', true); SELECT count(*)::int FROM clients WHERE id='${CLIENT_ID}';")
test "${COUNT_AREA}" = "0" || { echo "FAIL: area-only saw client"; exit 1; }

echo "== member-op can read client =="
COUNT_OP=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_OP}', true); SELECT count(*)::int FROM clients WHERE id='${CLIENT_ID}';")
test "${COUNT_OP}" = "1" || { echo "FAIL: member-op cannot read client"; exit 1; }

echo "== area-only vault denied =="
VAULT_AREA=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_AREA}', true); SELECT can_access_client_vault('${CLIENT_ID}');")
test "${VAULT_AREA}" = "f" || { echo "FAIL: area-only vault"; exit 1; }

echo "== member-op vault allowed =="
VAULT_OP=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_OP}', true); SELECT can_access_client_vault('${CLIENT_ID}');")
test "${VAULT_OP}" = "t" || { echo "FAIL: member-op vault"; exit 1; }

echo "== member-op cannot select operation_costs =="
COSTS=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_OP}', true); SELECT count(*)::int FROM operation_costs;")
test "${COSTS}" = "0" || { echo "FAIL: member saw costs"; exit 1; }

echo "== member-op cannot insert public_links =="
INS=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_OP}', true); INSERT INTO public_links (operation_id) VALUES ('${OP_ID}') RETURNING id;" 2>&1 || true)
echo "${INS}" | grep -qi "policy\|42501\|permission" || { echo "FAIL: public link insert not blocked: ${INS}"; exit 1; }

echo "OK: member-access RLS negatives passed"
