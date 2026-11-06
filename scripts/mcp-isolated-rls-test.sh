#!/usr/bin/env bash
# Disposable Postgres: apply all migrations, then assert MCP verify + RLS negatives.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MCP_TEST_DB:-dryos_mcp_isolated}"

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

run_sql_rls() {
  PGPASSWORD=rls_tester psql -v ON_ERROR_STOP=1 -h localhost -U rls_tester -d "${DB_NAME}" "$@"
}

grant_app_privileges() {
  run_sql <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO authenticated, rls_tester;
GRANT USAGE ON SCHEMA public TO authenticated, rls_tester;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, rls_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, rls_tester;
ALTER TABLE public.operations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_idempotent_responses FORCE ROW LEVEL SECURITY;
SQL
}

run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

while IFS= read -r -d '' f; do
  echo "Applying $(basename "$f")..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

grant_app_privileges

# UUIDs fixos
ADMIN_ID='11111111-1111-4111-8111-111111111111'
MEMBER_A='22222222-2222-4222-8222-222222222222'
MEMBER_B='33333333-3333-4333-8333-333333333333'

run_sql <<SQL
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN_ID}', 'admin@test.local'),
  ('${MEMBER_A}', 'member-a@test.local'),
  ('${MEMBER_B}', 'member-b@test.local');

INSERT INTO public.profiles (id, role) VALUES
  ('${ADMIN_ID}', 'admin'),
  ('${MEMBER_A}', 'member'),
  ('${MEMBER_B}', 'member')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.clients (id, name, slug)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Client Test', 'client-test');

INSERT INTO public.operations (id, client_id, product_line, name, status)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'core', 'Op A', 'em_operacao'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'core', 'Op B', 'em_operacao');

INSERT INTO public.operation_members (profile_id, operation_id)
VALUES ('${MEMBER_A}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SQL

# Token MCP para member A (read only) — admin cria via RPC
TOKEN_JSON=$(run_sql -tA <<SQL
BEGIN;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
SELECT public.create_mcp_agent_token(
  '${MEMBER_A}'::uuid,
  'test-readonly',
  ARRAY['read']::public.mcp_agent_token_scope[],
  (now() + interval '7 days')
)::text;
COMMIT;
SQL
)
TOKEN_JSON=$(echo "$TOKEN_JSON" | grep '^{' | head -1)

TOKEN_PLAIN=$(echo "$TOKEN_JSON" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['token'])")
TOKEN_ID=$(echo "$TOKEN_JSON" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")

fail() { echo "ASSERT FAIL: $1"; exit 1; }
pass() { echo "PASS: $1"; }

# verify: válido (como superuser; em produção só service_role tem GRANT EXECUTE)
OK=$(run_sql -tA -c "SELECT (public.verify_mcp_agent_token('${TOKEN_PLAIN}')->>'ok');" | grep -E '^(true|false)$' | tail -1)
[[ "$OK" == "true" ]] || fail "verify should accept valid token (got $OK)"
pass "verify accepts valid token"

# verify: revogado
run_sql -tA <<SQL
BEGIN;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
SELECT public.revoke_mcp_agent_token('${TOKEN_ID}'::uuid);
COMMIT;
SQL
OK=$(run_sql -tA -c "SELECT (public.verify_mcp_agent_token('${TOKEN_PLAIN}')->>'ok');" | grep -E '^(true|false)$' | tail -1)
[[ "$OK" == "false" ]] || fail "verify should reject revoked token"
pass "verify rejects revoked token"

# verify: plaintext errado
OK=$(run_sql -tA -c "SELECT (public.verify_mcp_agent_token('mcp_agt_wrongsecret_xxxxxxxxxxxxxxxx')->>'ok');" | grep -E '^(true|false)$' | tail -1)
[[ "$OK" == "false" ]] || fail "verify should reject wrong secret"
pass "verify rejects wrong secret"

# verify: usuário banido
TOKEN_JSON2=$(run_sql -tA <<SQL
BEGIN;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
SELECT public.create_mcp_agent_token(
  '${MEMBER_B}'::uuid,
  'test-ban',
  ARRAY['read']::public.mcp_agent_token_scope[],
  (now() + interval '7 days')
)::text;
COMMIT;
SQL
)
TOKEN_JSON2=$(echo "$TOKEN_JSON2" | grep '^{' | head -1)
TOKEN_PLAIN2=$(echo "$TOKEN_JSON2" | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['token'])")

run_sql -c "UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = '${MEMBER_B}';"

OK=$(run_sql -tA -c "SELECT (public.verify_mcp_agent_token('${TOKEN_PLAIN2}')->>'ok');" | grep -E '^(true|false)$' | tail -1)
[[ "$OK" == "false" ]] || fail "verify should reject banned user"
pass "verify rejects banned auth.users"

run_sql -c "UPDATE auth.users SET banned_until = NULL WHERE id = '${MEMBER_B}';"

if run_sql_rls -tA -c "SELECT public.verify_mcp_agent_token('${TOKEN_PLAIN2}');" 2>/dev/null; then
  fail "authenticated must not EXECUTE verify_mcp_agent_token"
fi
pass "verify_mcp_agent_token not granted to authenticated"

# RLS: member A vê 1 operação; member B vê 0
CNT_A=$(run_sql_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
SELECT count(*)::text FROM public.operations WHERE archived_at IS NULL;
COMMIT;
SQL
)
CNT_A=$(echo "$CNT_A" | grep -E '^[0-9]+$' | tail -1)
[[ "$CNT_A" == "1" ]] || fail "member A should see 1 operation (saw $CNT_A)"
pass "RLS member A sees assigned operation only"

CNT_B=$(run_sql_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_B}';
SELECT count(*)::text FROM public.operations WHERE archived_at IS NULL;
COMMIT;
SQL
)
CNT_B=$(echo "$CNT_B" | grep -E '^[0-9]+$' | tail -1)
[[ "$CNT_B" == "0" ]] || fail "member B should see 0 operations (saw $CNT_B)"
pass "RLS member B isolated from unassigned operations"

# RLS: member B não lê operation_id de A via get_operation pattern
VIS=$(run_sql_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_B}';
SELECT count(*)::text FROM public.operations
  WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
COMMIT;
SQL
)
VIS=$(echo "$VIS" | grep -E '^[0-9]+$' | tail -1)
[[ "$VIS" == "0" ]] || fail "member B must not read Op A row"
pass "RLS blocks cross-operation read"

run_sql <<SQL
INSERT INTO public.frentes (
  id, operation_id, name, cycle_type, domain, actionable_status
) VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Frente A',
  'c',
  'infra',
  'aguardando validação do cliente desde hoje'
);
INSERT INTO public.tasks (
  id, frente_id, operation_id, title, status
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Task isolamento',
  'todo'
);
SQL

TASK_B=$(run_sql_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_B}';
SELECT count(*)::text FROM public.tasks WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
COMMIT;
SQL
)
TASK_B=$(echo "$TASK_B" | grep -E '^[0-9]+$' | tail -1)
[[ "$TASK_B" == "0" ]] || fail "member B must not read task on Op A (saw $TASK_B)"
pass "RLS task row hidden across operations"

# MCP idempotent table: authenticated não lê
IDEM=$(run_sql_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
SELECT count(*)::text FROM public.mcp_idempotent_responses;
COMMIT;
SQL
) || true
IDEM=$(echo "${IDEM:-}" | grep -E '^[0-9]+$' | tail -1)
if [[ "${IDEM:-}" != "0" && -n "${IDEM:-}" ]]; then
  fail "authenticated should not read mcp_idempotent_responses (got ${IDEM})"
fi
pass "mcp_idempotent_responses not visible to authenticated (empty or denied)"

echo "ALL_MCP_ISOLATED_TESTS_PASSED"
