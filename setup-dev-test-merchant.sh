#!/bin/bash
# Creates dev test merchant user in Keycloak (scanny realm) with MERCHANT role.
# Run after ./start-dev.sh — first login auto-provisions the Postgres merchant row via /me.

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="${KEYCLOAK_REALM:-scanny}"

TEST_USERNAME="${TEST_USERNAME:-testuser}"
TEST_PASSWORD="${TEST_PASSWORD:-password}"
TEST_EMAIL="${TEST_EMAIL:-test@scanny.app}"
TEST_FIRST="${TEST_FIRST:-Test}"
TEST_LAST="${TEST_LAST:-Merchant}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Setting up dev merchant user in realm '$REALM_NAME'...${NC}"

TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Failed to authenticate to Keycloak admin${NC}"
  exit 1
fi

auth() { echo "Authorization: Bearer $ACCESS_TOKEN"; }

# Ensure realm exists (create minimal scanny realm if missing)
REALM_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME" -H "$(auth)")
if [ "$REALM_CHECK" != "200" ]; then
  echo -e "${YELLOW}Creating realm '$REALM_NAME'...${NC}"
  curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
    -H "$(auth)" \
    -H "Content-Type: application/json" \
    -d '{
      "realm": "'"$REALM_NAME"'",
      "enabled": true,
      "displayName": "Scanny",
      "loginWithEmailAllowed": true,
      "registrationAllowed": false,
      "verifyEmail": false,
      "resetPasswordAllowed": true
    }' > /dev/null
fi

# MERCHANT role
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "$(auth)" \
  -H "Content-Type: application/json" \
  -d '{"name":"MERCHANT","description":"Business owner"}' > /dev/null || true

MERCHANT_ROLE=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles/MERCHANT" -H "$(auth)")

# scanny-client (matches src/keycloak.ts)
CLIENT_EXISTS=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=scanny-client" -H "$(auth)" | jq 'length')
if [ "$CLIENT_EXISTS" = "0" ]; then
  echo -e "${YELLOW}Creating scanny-client...${NC}"
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
    -H "$(auth)" \
    -H "Content-Type: application/json" \
    -d '{
      "clientId": "scanny-client",
      "name": "Scanny Merchant App",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": true,
      "redirectUris": ["http://localhost:5173/*", "http://localhost:5173"],
      "webOrigins": ["http://localhost:5173", "+"]
    }' > /dev/null
fi

# Find or create test user
USER_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?username=$TEST_USERNAME" -H "$(auth)" | jq -r '.[0].id // empty')

if [ -z "$USER_ID" ]; then
  echo -e "${YELLOW}Creating user '$TEST_USERNAME'...${NC}"
  CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
    -H "$(auth)" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "'"$TEST_USERNAME"'",
      "email": "'"$TEST_EMAIL"'",
      "firstName": "'"$TEST_FIRST"'",
      "lastName": "'"$TEST_LAST"'",
      "enabled": true,
      "emailVerified": true
    }')
  if [ "$CREATE_STATUS" != "201" ]; then
    echo -e "${RED}Failed to create user (HTTP $CREATE_STATUS)${NC}"
    exit 1
  fi
  USER_ID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?username=$TEST_USERNAME" -H "$(auth)" | jq -r '.[0].id')
else
  echo -e "${GREEN}User '$TEST_USERNAME' already exists — updating email/profile${NC}"
  curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$USER_ID" \
    -H "$(auth)" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "'"$TEST_USERNAME"'",
      "email": "'"$TEST_EMAIL"'",
      "firstName": "'"$TEST_FIRST"'",
      "lastName": "'"$TEST_LAST"'",
      "enabled": true,
      "emailVerified": true
    }' > /dev/null
fi

# Password
curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$USER_ID/reset-password" \
  -H "$(auth)" \
  -H "Content-Type: application/json" \
  -d '{"type":"password","value":"'"$TEST_PASSWORD"'","temporary":false}' > /dev/null

# Assign MERCHANT role
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$USER_ID/role-mappings/realm" \
  -H "$(auth)" \
  -H "Content-Type: application/json" \
  -d "[$MERCHANT_ROLE]" > /dev/null

echo -e "${GREEN}✓ Dev merchant user ready${NC}"
echo ""
echo "  Realm:    $REALM_NAME"
echo "  Username: $TEST_USERNAME"
echo "  Password: $TEST_PASSWORD"
echo "  Email:    $TEST_EMAIL"
echo "  Role:     MERCHANT"
echo ""
echo -e "${YELLOW}On first login to http://localhost:5173 the backend will auto-create the merchant + business rows.${NC}"
