#!/usr/bin/env bash
# Bootstrap Keycloak realm + prod OIDC clients for Kode on VPS.
# Run after Keycloak is healthy (auth.kode.com).
#
# Usage:
#   export KEYCLOAK_URL=https://auth.kode.com
#   export KEYCLOAK_ADMIN_USERNAME=admin
#   export KEYCLOAK_ADMIN_PASSWORD='...'
#   export KEYCLOAK_BACKEND_CLIENT_SECRET='...'
#   bash deploy/setup-realm.sh
#
# Optional:
#   MERCHANT_ORIGIN=https://kode.com
#   ADMIN_ORIGIN=https://admin.kode.com
#   KEYCLOAK_REALM=scanny
#   CREATE_SEED_USERS=1

set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

KC_URL="${KEYCLOAK_URL:-https://auth.kode.com}"
KC_URL="${KC_URL%/}"
REALM="${KEYCLOAK_REALM:-scanny}"
ADMIN_USER="${KEYCLOAK_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD is required}"
BACKEND_SECRET="${KEYCLOAK_BACKEND_CLIENT_SECRET:?KEYCLOAK_BACKEND_CLIENT_SECRET is required}"
MERCHANT_ORIGIN="${MERCHANT_ORIGIN:-https://kode.com}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-https://admin.kode.com}"
CREATE_SEED_USERS="${CREATE_SEED_USERS:-0}"

echo "Keycloak: $KC_URL"
echo "Realm:    $REALM"
echo "Merchant: $MERCHANT_ORIGIN (client scanny-client)"
echo "Admin:    $ADMIN_ORIGIN (client scanny-admin)"

TOKEN_JSON="$(
  curl -fsS -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "username=$ADMIN_USER" \
    --data-urlencode "password=$ADMIN_PASS" \
    -d 'grant_type=password' \
    -d 'client_id=admin-cli'
)"
TOKEN="$(printf '%s' "$TOKEN_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')"
AUTH=( -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' )
echo "Got admin token"

code="$(curl -sS -o /tmp/scanny-realm.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$KC_URL/admin/realms" \
  -d "{\"realm\":\"$REALM\",\"enabled\":true,\"displayName\":\"Kode\",\"loginWithEmailAllowed\":true,\"duplicateEmailsAllowed\":false,\"resetPasswordAllowed\":true}")"
if [[ "$code" == "201" ]]; then
  echo "Realm '$REALM' created"
elif [[ "$code" == "409" ]]; then
  echo "Realm '$REALM' already exists"
else
  echo "Realm create failed HTTP $code: $(cat /tmp/scanny-realm.json)" >&2
  exit 1
fi

for role in MERCHANT ADMIN CUSTOMER STAFF; do
  code="$(curl -sS -o /tmp/scanny-role.json -w '%{http_code}' "${AUTH[@]}" \
    -X POST "$KC_URL/admin/realms/$REALM/roles" \
    -d "{\"name\":\"$role\"}")"
  if [[ "$code" == "201" ]]; then
    echo "Role $role created"
  elif [[ "$code" == "409" ]]; then
    echo "Role $role exists"
  else
    echo "Role $role failed HTTP $code" >&2
    exit 1
  fi
done

ensure_public_client() {
  local client_id="$1"
  local origin="$2"
  local existing id
  existing="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/clients?clientId=$client_id")"
  id="$(printf '%s' "$existing" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(a[0]["id"] if a else "")')"

  if [[ -n "$id" ]]; then
    local full body
    full="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/clients/$id")"
    body="$(
      CLIENT_JSON="$full" ORIGIN="$origin" python3 - <<'PY'
import json, os
c = json.loads(os.environ["CLIENT_JSON"])
origin = os.environ["ORIGIN"]
c["enabled"] = True
c["publicClient"] = True
c["standardFlowEnabled"] = True
c["directAccessGrantsEnabled"] = False
c["implicitFlowEnabled"] = False
c["redirectUris"] = [f"{origin}/*", f"{origin}/"]
c["webOrigins"] = [origin]
attrs = c.get("attributes") or {}
attrs["pkce.code.challenge.method"] = "S256"
attrs["post.logout.redirect.uris"] = "+"
c["attributes"] = attrs
print(json.dumps(c))
PY
    )"
    curl -fsS "${AUTH[@]}" -X PUT "$KC_URL/admin/realms/$REALM/clients/$id" -d "$body" >/dev/null
    echo "Client $client_id updated (prod origins only)"
  else
    curl -fsS "${AUTH[@]}" -X POST "$KC_URL/admin/realms/$REALM/clients" -d "$(
      CLIENT_ID="$client_id" ORIGIN="$origin" python3 - <<'PY'
import json, os
origin = os.environ["ORIGIN"]
print(json.dumps({
  "clientId": os.environ["CLIENT_ID"],
  "name": os.environ["CLIENT_ID"],
  "enabled": True,
  "protocol": "openid-connect",
  "publicClient": True,
  "standardFlowEnabled": True,
  "directAccessGrantsEnabled": False,
  "implicitFlowEnabled": False,
  "redirectUris": [f"{origin}/*", f"{origin}/"],
  "webOrigins": [origin],
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "+",
  },
  "fullScopeAllowed": True,
}))
PY
    )" >/dev/null
    echo "Client $client_id created"
  fi
}

ensure_backend_client() {
  local client_id="scanny-backend"
  local existing id
  existing="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/clients?clientId=$client_id")"
  id="$(printf '%s' "$existing" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(a[0]["id"] if a else "")')"

  if [[ -z "$id" ]]; then
    curl -fsS "${AUTH[@]}" -X POST "$KC_URL/admin/realms/$REALM/clients" -d "$(
      SECRET="$BACKEND_SECRET" python3 - <<'PY'
import json, os
print(json.dumps({
  "clientId": "scanny-backend",
  "name": "scanny-backend",
  "enabled": True,
  "protocol": "openid-connect",
  "publicClient": False,
  "secret": os.environ["SECRET"],
  "serviceAccountsEnabled": True,
  "standardFlowEnabled": False,
  "directAccessGrantsEnabled": False,
  "implicitFlowEnabled": False,
  "fullScopeAllowed": True,
}))
PY
    )" >/dev/null
    echo "Client $client_id created"
  else
    local full body
    full="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/clients/$id")"
    body="$(
      CLIENT_JSON="$full" SECRET="$BACKEND_SECRET" python3 - <<'PY'
import json, os
c = json.loads(os.environ["CLIENT_JSON"])
c["enabled"] = True
c["publicClient"] = False
c["secret"] = os.environ["SECRET"]
c["serviceAccountsEnabled"] = True
c["standardFlowEnabled"] = False
c["directAccessGrantsEnabled"] = False
c["implicitFlowEnabled"] = False
print(json.dumps(c))
PY
    )"
    curl -fsS "${AUTH[@]}" -X PUT "$KC_URL/admin/realms/$REALM/clients/$id" -d "$body" >/dev/null
    echo "Client $client_id updated"
  fi
}

ensure_public_client "scanny-client" "$MERCHANT_ORIGIN"
ensure_public_client "scanny-admin" "$ADMIN_ORIGIN"
ensure_backend_client

ensure_user() {
  local username="$1" email="$2" first="$3" last="$4" password="$5" role="$6"
  local code
  code="$(curl -sS -o /tmp/scanny-user.json -w '%{http_code}' "${AUTH[@]}" \
    -X POST "$KC_URL/admin/realms/$REALM/users" \
    -d "$(
      python3 - <<PY
import json
print(json.dumps({
  "username": "$username",
  "email": "$email",
  "enabled": True,
  "emailVerified": True,
  "firstName": "$first",
  "lastName": "$last",
  "credentials": [{"type": "password", "value": "$password", "temporary": True}],
}))
PY
    )")"
  if [[ "$code" == "201" ]]; then
    echo "User $username created (temporary password — change on first login)"
  elif [[ "$code" == "409" ]]; then
    echo "User $username exists"
  else
    echo "User $username failed HTTP $code" >&2
    exit 1
  fi

  local uid role_json
  uid="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/users?username=$username" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')"
  role_json="$(curl -fsS "${AUTH[@]}" "$KC_URL/admin/realms/$REALM/roles/$role")"
  curl -sS -o /dev/null "${AUTH[@]}" \
    -X POST "$KC_URL/admin/realms/$REALM/users/$uid/role-mappings/realm" \
    -d "[$role_json]" || true
  echo "$role assigned to $username"
}

if [[ "$CREATE_SEED_USERS" == "1" ]]; then
  ensure_user "merchant" "merchant@kode.com" "Seed" "Merchant" "${SEED_MERCHANT_PASSWORD:-ChangeMe-Merchant-1!}" "MERCHANT"
  ensure_user "adminuser" "admin@kode.com" "Seed" "Admin" "${SEED_ADMIN_PASSWORD:-ChangeMe-Admin-1!}" "ADMIN"
fi

echo ""
echo "DONE"
echo "  scanny-client  redirect/webOrigin -> $MERCHANT_ORIGIN only"
echo "  scanny-admin   redirect/webOrigin -> $ADMIN_ORIGIN only"
echo "  scanny-backend confidential client secret synced from env"
echo ""
echo "Smoke:"
echo "  1) Merchant login at $MERCHANT_ORIGIN (MERCHANT user only)"
echo "  2) Admin login at $ADMIN_ORIGIN in a private window (ADMIN user only)"
echo "  3) Logout one app — SSO ends for both (same realm)"
