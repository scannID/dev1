#!/usr/bin/env bash
set -euo pipefail

failed=0

echo "Checking tracked files for legacy product names..."
if git grep -nEI \
  -e 'scanit[.]app' \
  -e 'ScanIT' \
  -- . \
  ':(exclude)docs/archive/**' \
  ':(exclude)backend/src/main/resources/db/migration/**'
then
  echo "error: legacy product naming remains outside docs/archive/ and historical migrations"
  failed=1
fi

echo "Checking that environment files are not tracked..."
tracked_env_files="$(
  git ls-files |
    awk -F/ '$NF == ".env" { print }'
)"
if [[ -n "${tracked_env_files}" ]]; then
  printf '%s\n' "${tracked_env_files}"
  echo "error: one or more .env files are tracked"
  failed=1
fi

echo "Checking that local Keycloak archives are not tracked..."
tracked_keycloak_archives="$(
  git ls-files |
    awk '/^backend\/keycloak-[^/]*[.]zip$/ { print }'
)"
if [[ -n "${tracked_keycloak_archives}" ]]; then
  printf '%s\n' "${tracked_keycloak_archives}"
  echo "error: local Keycloak archives must not be tracked"
  failed=1
fi

echo "Checking for weak production password defaults in prod compose..."
if git grep -nE 'POSTGRES_PASSWORD:-\w+|KEYCLOAK_ADMIN_PASSWORD:-\w+|REDIS_PASSWORD:-\w+' -- docker-compose.prod.yml >/dev/null 2>&1; then
  echo "error: docker-compose.prod.yml must not embed weak password defaults"
  failed=1
fi

if (( failed != 0 )); then
  exit 1
fi

echo "Naming and tracked-file checks passed."