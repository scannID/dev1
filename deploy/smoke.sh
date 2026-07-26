#!/usr/bin/env bash
# Smoke-check production hosts after deploy.
# Usage: bash deploy/smoke.sh

set -uo pipefail

MERCHANT_URL="${MERCHANT_URL:-https://kode.com}"
ADMIN_URL="${ADMIN_URL:-https://admin.kode.com}"
API_URL="${API_URL:-https://api.kode.com}"
AUTH_URL="${AUTH_URL:-https://auth.kode.com}"

check() {
  local name="$1" url="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null || echo "000")"
  if [[ "$code" =~ ^(2|3) ]]; then
    echo "OK  $name ($code) $url"
    return 0
  fi
  echo "FAIL $name ($code) $url" >&2
  return 1
}

fail=0
check "merchant" "$MERCHANT_URL/" || fail=1
check "admin" "$ADMIN_URL/" || fail=1
if ! check "api-health" "$API_URL/health"; then
  check "api-health" "$API_URL/api/health" || fail=1
fi
check "auth-realm" "$AUTH_URL/realms/scanny" || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "Smoke checks failed" >&2
  exit 1
fi
echo "All smoke checks passed"
