#!/usr/bin/env bash
# Disposable Postgres: repository_links + tooling migrations (com/sem coluna singular legada).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${REPO_TOOLING_TEST_DB:-dryos_repository_tooling}"

MIG_30000="${ROOT}/supabase/migrations/20261108030000_git_repository_url.sql"
MIG_40000="${ROOT}/supabase/migrations/20261108040000_repository_links_and_client_tooling.sql"
MIG_50000="${ROOT}/supabase/migrations/20261108050000_drop_legacy_git_repository_url_columns.sql"

ADMIN_ID='11111111-1111-4111-8111-111111111111'
MEMBER_A='22222222-2222-4222-8222-222222222222'
MEMBER_B='33333333-3333-4333-8333-333333333333'

CLIENT_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
CLIENT_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
OP_A='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
OP_B='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
FRENTE_A='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

fail() { echo "ASSERT FAIL: $*" >&2; exit 1; }
pass() { echo "ASSERT OK: $*"; }

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi
if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"; }
run_rls() { PGPASSWORD=rls_tester psql -v ON_ERROR_STOP=1 -h localhost -U rls_tester -d "${DB_NAME}" "$@"; }

should_skip_migration() {
  local base="$1"
  shift
  for skip in "$@"; do
    [[ -n "$skip" && "$base" == "$(basename "$skip")" ]] && return 0
  done
  return 1
}

apply_migrations_except() {
  while IFS= read -r -d '' f; do
    local base
    base="$(basename "$f")"
    if should_skip_migration "$base" "$@"; then
      continue
    fi
    echo "Applying ${base}..."
    run_sql -f "$f"
  done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)
}

reset_db() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
  run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"
  run_sql <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO authenticated, rls_tester;
GRANT USAGE ON SCHEMA public TO authenticated, rls_tester;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, rls_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, rls_tester;
SQL
}

seed_users_and_clients() {
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

INSERT INTO public.clients (id, name, slug) VALUES
  ('${CLIENT_A}', 'Client A', 'client-a'),
  ('${CLIENT_B}', 'Client B', 'client-b');

INSERT INTO public.operations (id, client_id, product_line, name, status) VALUES
  ('${OP_A}', '${CLIENT_A}', 'core', 'Op A', 'em_operacao'),
  ('${OP_B}', '${CLIENT_B}', 'core', 'Op B', 'em_operacao');

INSERT INTO public.frentes (id, operation_id, name, cycle_type, domain, actionable_status)
VALUES ('${FRENTE_A}', '${OP_A}', 'Frente A', 'c', 'infra', 'aguardando teste repository tooling isolado');

INSERT INTO public.operation_members (profile_id, operation_id) VALUES
  ('${MEMBER_A}', '${OP_A}');
SQL
}

echo "== repository tooling isolated DB: ${DB_NAME}"

# ─── Caminho 1: sem migration singular (30000) ───────────────────────────────

reset_db
apply_migrations_except "${MIG_30000}" "${MIG_50000}"
seed_users_and_clients

run_sql <<SQL
INSERT INTO public.repository_links (client_id, label, url)
VALUES ('${CLIENT_A}', 'App', 'https://github.com/org/a');
INSERT INTO public.client_tech_items (client_id, name)
VALUES ('${CLIENT_A}', 'PostgreSQL');
SQL

CNT=$(run_sql -tA -c "SELECT count(*)::text FROM public.repository_links;")
[[ "$CNT" == "1" ]] || fail "path1: expected 1 repository_link (saw ${CNT})"
pass "path1 (no 30000): tables usable"

# ─── Caminho 2: com 30000 + dados legados antes do 40000 ───────────────────

reset_db
apply_migrations_except "${MIG_40000}" "${MIG_50000}"
run_sql -f "${MIG_30000}"
seed_users_and_clients

run_sql <<SQL
UPDATE public.clients SET git_repository_url = 'https://github.com/legacy/client-a' WHERE id = '${CLIENT_A}';
UPDATE public.operations SET git_repository_url = 'https://github.com/legacy/op-a' WHERE id = '${OP_A}';
UPDATE public.frentes SET git_repository_url = 'https://github.com/legacy/frente-a' WHERE id = '${FRENTE_A}';
SQL

run_sql -f "${MIG_40000}"

for expected in \
  "https://github.com/legacy/client-a" \
  "https://github.com/legacy/op-a" \
  "https://github.com/legacy/frente-a"
do
  CNT=$(run_sql -tA -c "SELECT count(*)::text FROM public.repository_links WHERE url = '${expected}';")
  [[ "$CNT" == "1" ]] || fail "import missing url ${expected} (saw ${CNT})"
done
pass "path2: legacy git_repository_url imported as Principal links"

# idempotência: reexecutar só o bloco de import (policies da 40000 não são re-run safe)
run_sql <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, label, url)
    SELECT c.id, 'Principal', trim(c.git_repository_url)
    FROM public.clients c
    WHERE c.git_repository_url IS NOT NULL AND trim(c.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.client_id = c.id AND rl.operation_id IS NULL AND rl.frente_id IS NULL
          AND rl.url = trim(c.git_repository_url)
      );
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operations' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, operation_id, label, url)
    SELECT o.client_id, o.id, 'Principal', trim(o.git_repository_url)
    FROM public.operations o
    WHERE o.git_repository_url IS NOT NULL AND trim(o.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.operation_id = o.id AND rl.frente_id IS NULL
          AND rl.url = trim(o.git_repository_url)
      );
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'frentes' AND column_name = 'git_repository_url'
  ) THEN
    INSERT INTO public.repository_links (client_id, operation_id, frente_id, label, url)
    SELECT o.client_id, f.operation_id, f.id, 'Principal', trim(f.git_repository_url)
    FROM public.frentes f
    JOIN public.operations o ON o.id = f.operation_id
    WHERE f.git_repository_url IS NOT NULL AND trim(f.git_repository_url) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.repository_links rl
        WHERE rl.frente_id = f.id AND rl.url = trim(f.git_repository_url)
      );
  END IF;
END $$;
SQL
TOTAL=$(run_sql -tA -c "SELECT count(*)::text FROM public.repository_links;")
[[ "$TOTAL" == "3" ]] || fail "re-import duplicated links (total ${TOTAL})"
pass "path2: re-running import block does not duplicate links"

# migrations posteriores à 40000 (sem re-aplicar o schema inteiro)
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  [[ "$base" == "$(basename "$MIG_50000")" ]] && continue
  [[ "$base" == "$(basename "$MIG_40000")" ]] && continue
  [[ "$base" < "$(basename "$MIG_40000")" ]] && continue
  echo "Applying ${base}..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

# ─── RLS: admin / membro com escopo / negação cross-client ───────────────────

run_sql <<SQL
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, rls_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, rls_tester;
SQL

RL_ADMIN=$(run_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
SELECT count(*)::text FROM public.repository_links;
COMMIT;
SQL
)
RL_ADMIN=$(echo "$RL_ADMIN" | grep -E '^[0-9]+$' | tail -1)
[[ "$RL_ADMIN" == "3" ]] || fail "admin should see 3 links (saw ${RL_ADMIN})"
pass "RLS admin sees all repository_links"

RL_A=$(run_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
SELECT count(*)::text FROM public.repository_links;
COMMIT;
SQL
)
RL_A=$(echo "$RL_A" | grep -E '^[0-9]+$' | tail -1)
[[ "$RL_A" == "3" ]] || fail "member A should see client A links (saw ${RL_A})"
pass "RLS member A reads repository_links for assigned client"

RL_B=$(run_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_B}';
SELECT count(*)::text FROM public.repository_links;
COMMIT;
SQL
)
RL_B=$(echo "$RL_B" | grep -E '^[0-9]+$' | tail -1)
[[ "$RL_B" == "0" ]] || fail "member B must not see client A links (saw ${RL_B})"
pass "RLS member B blocked cross-client on repository_links"

# member cannot insert client-level link (admin only)
if run_rls <<SQL 2>/dev/null
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
INSERT INTO public.repository_links (client_id, label, url)
VALUES ('${CLIENT_A}', 'Hack', 'https://github.com/x/y');
COMMIT;
SQL
then
  fail "member must not insert client-scoped repository_link"
fi
pass "RLS member blocked INSERT client-scoped repository_link"

# admin can update tech item; member read-only
run_rls <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${ADMIN_ID}';
INSERT INTO public.client_tech_items (client_id, name) VALUES ('${CLIENT_A}', 'Node');
COMMIT;
SQL

TECH_A=$(run_rls -tA <<SQL
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
SELECT count(*)::text FROM public.client_tech_items;
COMMIT;
SQL
)
TECH_A=$(echo "$TECH_A" | grep -E '^[0-9]+$' | tail -1)
[[ "$TECH_A" == "1" ]] || fail "member A should read client_tech_items (saw ${TECH_A})"
pass "RLS member read client_tech_items"

if run_rls <<SQL 2>/dev/null
BEGIN;
SET LOCAL "request.jwt.claim.sub" = '${MEMBER_A}';
INSERT INTO public.client_tech_items (client_id, name) VALUES ('${CLIENT_A}', 'Denied');
COMMIT;
SQL
then
  fail "member must not write client_tech_items"
fi
pass "RLS member blocked write client_tech_items"

# ─── Fase 2 drop (opcional smoke): colunas legadas removidas ─────────────────

run_sql -f "${MIG_50000}"
for tbl in clients operations frentes; do
  COL=$(run_sql -tA -c "SELECT count(*)::text FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' AND column_name='git_repository_url';")
  [[ "$COL" == "0" ]] || fail "git_repository_url still on ${tbl}"
done
AFTER=$(run_sql -tA -c "SELECT count(*)::text FROM public.repository_links;")
[[ "$AFTER" == "3" ]] || fail "drop phase must preserve repository_links (saw ${AFTER})"
pass "phase 50000 drops legacy columns; repository_links preserved"

echo "== repository-tooling isolated tests complete"
