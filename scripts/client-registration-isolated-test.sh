#!/usr/bin/env bash
# Smoke: migration client_registration_invitations + colunas clients.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${CLIENT_REG_TEST_DB:-dryos_client_registration}"
MIG="${ROOT}/supabase/migrations/20261109180000_client_registration_invitations.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi
if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"; }

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb "${DB_NAME}"

run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql" 2>/dev/null || true

if [[ ! -f "${MIG}" ]]; then
  echo "FAIL: migration missing" >&2
  exit 1
fi

run_sql -f "${MIG}"

run_sql -tAc "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='client_registration_invitations'" \
  | grep -qv '^0$'

echo "ASSERT OK: client_registration migration applied on isolated DB"
