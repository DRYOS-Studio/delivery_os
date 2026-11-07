#!/usr/bin/env bash
# RLS smoke: member vs admin for MCP-aligned tables (clients, client_contracts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MCP_EXPANDED_TEST_DB:-dryos_mcp_expanded}"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"; exit 2
fi
if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"; exit 2
fi

run_sql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"; }
run_rls() { PGPASSWORD=rls_tester psql -v ON_ERROR_STOP=1 -h localhost -U rls_tester -d "${DB_NAME}" "$@"; }

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"
while IFS= read -r -d '' f; do run_sql -f "$f"; done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

run_sql <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO authenticated, rls_tester;
GRANT USAGE ON SCHEMA public TO authenticated, rls_tester;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, rls_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, rls_tester;
SQL

ADMIN_ID='11111111-1111-4111-8111-111111111111'
MEMBER_ID='22222222-2222-4222-8222-222222222222'

run_sql <<SQL
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_ID}', 'admin@test.local'),
  ('${MEMBER_ID}', 'member@test.local');
INSERT INTO public.profiles (id, role) VALUES
  ('${ADMIN_ID}', 'admin'),
  ('${MEMBER_ID}', 'member')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
SQL

# Member cannot insert client (admin policy)
if run_rls <<SQL 2>/dev/null
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_ID}';
INSERT INTO public.clients (name, slug) VALUES ('X', 'x-member');
COMMIT;
SQL
then
  echo "ASSERT FAIL: member inserted client"; exit 1
fi
echo "ASSERT OK: member blocked on clients INSERT"

# Admin can insert client
run_rls <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
INSERT INTO public.clients (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS Client', 'rls-client');
COMMIT;
SQL
echo "ASSERT OK: admin inserted client"

CLIENT_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

# Member cannot read client_contracts
CNT=$(run_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_ID}';
SELECT count(*)::text FROM public.client_contracts;
COMMIT;
SQL
)
CNT=$(echo "$CNT" | grep -E '^[0-9]+$' | tail -1)
[[ "$CNT" == "0" ]] || { echo "ASSERT FAIL: member saw contracts ($CNT)"; exit 1; }
echo "ASSERT OK: member sees 0 client_contracts"

# Admin can insert contract row (minimal metadata; storage_path faked for RLS on table only)
run_rls <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
INSERT INTO public.client_contracts (
  client_id, label, monthly_value, implementation_fee, currency, status,
  storage_path, filename, mime_type, size_bytes, payment_day_of_month, notes
) VALUES (
  '${CLIENT_ID}',
  'Test MCP contract',
  397.00,
  1000.00,
  'BRL',
  'vigente',
  '${CLIENT_ID}/00000000-0000-4000-8000-000000000001-placeholder.txt',
  'placeholder.txt',
  'text/plain',
  1,
  14,
  'aceite WhatsApp'
);
COMMIT;
SQL
echo "ASSERT OK: admin inserted client_contract with implementation_fee"

echo "=== mcp-expanded-rls-isolated: ALL PASSED ==="
