#!/usr/bin/env bash
# Disposable Postgres: member-access hardening (admin / membro-op / membro-área / nada).
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

run_rls_as() {
  local sub="$1"
  local sql="$2"
  run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${sub}', true); ${sql}" | tail -1
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
PERSON_ID='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
VILLAIN_SEED_ID='00000000-0000-4000-8000-000000000001'

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

INSERT INTO public.clients (id, name, slug)
VALUES ('${CLIENT_ID}', 'Client Test', 'client-test');

INSERT INTO public.operations (id, client_id, product_line, name, status)
VALUES ('${OP_ID}', '${CLIENT_ID}', 'core', 'Op A', 'em_operacao');

INSERT INTO public.operation_financials (
  operation_id, recurrence, monthly_recurring_revenue, tax_rate_pct, notification_webhook_url
) VALUES (
  '${OP_ID}', 'mensal', 9999.99, 6.5, 'https://n8n.example/webhook'
);

INSERT INTO public.operation_members (profile_id, operation_id)
VALUES ('${MEM_OP}', '${OP_ID}');

INSERT INTO public.areas (id, name, slug)
VALUES ('${AREA_ID}', 'Area QA', 'area-qa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_areas (profile_id, area_id)
VALUES ('${MEM_AREA}', '${AREA_ID}');

INSERT INTO public.area_operations (area_id, operation_id)
VALUES ('${AREA_ID}', '${OP_ID}');

INSERT INTO public.persons (id, kind, name, specialty)
VALUES ('${PERSON_ID}', 'internal', 'Dev Test', 'eng');

INSERT INTO public.person_compensation (person_id, hourly_rate, monthly_compensation)
VALUES ('${PERSON_ID}', 120.0, 12000.0);
SQL

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "FAIL: ${label} (expected=${expected}, got=${actual})"
    exit 1
  fi
  echo "OK: ${label}"
}

echo "== 1. Área sem membership: cliente invisível =="
COUNT_AREA=$(run_rls_as "${MEM_AREA}" "SELECT count(*)::int FROM clients WHERE id='${CLIENT_ID}';")
assert_eq "area-only cliente" "0" "${COUNT_AREA}"

echo "== 2. Membro alocado: cliente visível =="
COUNT_OP=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM clients WHERE id='${CLIENT_ID}';")
assert_eq "member-op cliente" "1" "${COUNT_OP}"

echo "== 3. Cofre: área não, membro sim =="
VAULT_AREA=$(run_rls_as "${MEM_AREA}" "SELECT can_access_client_vault('${CLIENT_ID}');")
VAULT_OP=$(run_rls_as "${MEM_OP}" "SELECT can_access_client_vault('${CLIENT_ID}');")
assert_eq "vault area" "f" "${VAULT_AREA}"
assert_eq "vault member" "t" "${VAULT_OP}"

echo "== 4. operation_financials: member SELECT bloqueado =="
FIN_MEM=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM operation_financials;")
FIN_ADMIN=$(run_rls_as "${ADMIN_ID}" "SELECT count(*)::int FROM operation_financials;")
assert_eq "financials member" "0" "${FIN_MEM}"
assert_eq "financials admin" "1" "${FIN_ADMIN}"

echo "== 5. Member não lê MRR via operations (coluna removida) =="
MRR_COL=$(run_rls_as "${MEM_OP}" "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='operations' AND column_name='monthly_recurring_revenue';" 2>/dev/null || echo 0)
assert_eq "operations sem coluna mrr" "0" "${MRR_COL}"

echo "== 6. person_compensation admin-only =="
PC_MEM=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM person_compensation;")
PC_ADMIN=$(run_rls_as "${ADMIN_ID}" "SELECT coalesce(hourly_rate::text,'null') FROM person_compensation WHERE person_id='${PERSON_ID}';")
assert_eq "compensation member" "0" "${PC_MEM}"
if [[ "${PC_ADMIN}" == 120* ]]; then
  echo "OK: compensation admin hourly"
else
  echo "FAIL: compensation admin hourly (expected 120*, got=${PC_ADMIN})"
  exit 1
fi

echo "== 7. operation_costs member = 0 =="
COSTS=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM operation_costs;")
assert_eq "operation_costs member" "0" "${COSTS}"

echo "== 8. Catálogo vilões: member sem vínculo = 0 =="
# Sem operation_villains seed: membro não deve ler villains
VILL_MEM=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM villains;")
assert_eq "villains sem vínculo member" "0" "${VILL_MEM}"

echo "== 9. Picker RPC vilões (id+nome) para membro alocado =="
PICK_V=$(run_rls_as "${MEM_OP}" "SELECT count(*)::int FROM catalog_picker_villains('${OP_ID}');")
if [[ "${PICK_V}" -ge 1 ]]; then
  echo "OK: picker villains callable (count=${PICK_V})"
else
  echo "FAIL: picker villains count (expected>=1, got=${PICK_V})"
  exit 1
fi

echo "== 10. public_links INSERT member bloqueado =="
INS=$(run_rls -tA -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${MEM_OP}', true); INSERT INTO public_links (operation_id) VALUES ('${OP_ID}') RETURNING id;" 2>&1 || true)
if echo "${INS}" | grep -qiE "policy|42501|permission|denied"; then
  echo "OK: public link insert member blocked"
else
  echo "FAIL: public link insert not blocked: ${INS}"
  exit 1
fi

echo "== 11. Webhook resolve (service path) =="
WH=$(run_sql -tA -c "SELECT resolve_operation_notification_webhook('${OP_ID}');")
if [[ "${WH}" == https://n8n.example/webhook* ]]; then
  echo "OK: webhook resolve"
else
  echo "FAIL: webhook resolve got ${WH}"
  exit 1
fi

echo ""
echo "ALL PASS: member-access RLS"
