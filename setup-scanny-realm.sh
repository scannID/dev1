#!/bin/bash

# Setup existing 'scanny' realm for merchant registration
# Adds roles and backend client to existing realm

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="admin"
REALM_NAME="scanny"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Configuring Scanny Realm for Merchants${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Step 1: Get admin access token
echo -e "${YELLOW}Step 1: Getting admin access token...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" \
  -d "grant_type=password" \
  -d "client_id=admin-cli")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ Failed to get access token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Got access token${NC}\n"

# Step 2: Check existing realm
echo -e "${YELLOW}Step 2: Verifying realm '$REALM_NAME' exists...${NC}"
REALM_CHECK=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$REALM_CHECK" | grep -q "\"realm\":\"$REALM_NAME\""; then
    echo -e "${GREEN}✓ Realm '$REALM_NAME' found${NC}\n"
else
    echo -e "${RED}✗ Realm '$REALM_NAME' not found${NC}"
    exit 1
fi

# Step 3: List existing clients
echo -e "${YELLOW}Step 3: Checking existing clients...${NC}"
CLIENTS=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$CLIENTS" | jq -r '.[].clientId' | while read client; do
    echo "  • $client"
done
echo ""

# Step 4: Create MERCHANT role (if doesn't exist)
echo -e "${YELLOW}Step 4: Creating MERCHANT role...${NC}"
MERCHANT_ROLE=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MERCHANT",
    "description": "Business owner who can manage their business"
  }' -w "%{http_code}" -o /dev/null)

if [ "$MERCHANT_ROLE" == "201" ] || [ "$MERCHANT_ROLE" == "409" ]; then
    echo -e "${GREEN}✓ MERCHANT role ready${NC}\n"
else
    echo -e "${YELLOW}⚠ MERCHANT role status: $MERCHANT_ROLE${NC}\n"
fi

# Step 5: Create ADMIN role (if doesn't exist)
echo -e "${YELLOW}Step 5: Creating ADMIN role...${NC}"
ADMIN_ROLE=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ADMIN",
    "description": "System administrator"
  }' -w "%{http_code}" -o /dev/null)

if [ "$ADMIN_ROLE" == "201" ] || [ "$ADMIN_ROLE" == "409" ]; then
    echo -e "${GREEN}✓ ADMIN role ready${NC}\n"
else
    echo -e "${YELLOW}⚠ ADMIN role status: $ADMIN_ROLE${NC}\n"
fi

# Step 5b: Create STAFF role (if doesn't exist)
echo -e "${YELLOW}Step 5b: Creating STAFF role...${NC}"
STAFF_ROLE=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "STAFF",
    "description": "Branch staff invited by a merchant"
  }' -w "%{http_code}" -o /dev/null)

if [ "$STAFF_ROLE" == "201" ] || [ "$STAFF_ROLE" == "409" ]; then
    echo -e "${GREEN}✓ STAFF role ready${NC}\n"
else
    echo -e "${YELLOW}⚠ STAFF role status: $STAFF_ROLE${NC}\n"
fi

# Step 6: Create backend client (if doesn't exist)
echo -e "${YELLOW}Step 6: Creating scanny-backend client...${NC}"
BACKEND_CLIENT=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "scanny-backend",
    "name": "Scanny Backend API",
    "description": "Backend resource server for API",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": false,
    "bearerOnly": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": true,
    "authorizationServicesEnabled": false
  }' -w "%{http_code}" -o /dev/null)

if [ "$BACKEND_CLIENT" == "201" ]; then
    echo -e "${GREEN}✓ Backend client created${NC}\n"
elif [ "$BACKEND_CLIENT" == "409" ]; then
    echo -e "${YELLOW}⚠ Backend client already exists${NC}\n"
else
    echo -e "${RED}✗ Failed to create backend client (status: $BACKEND_CLIENT)${NC}\n"
fi

# Step 7: Update existing clients to include new redirect URIs if needed
echo -e "${YELLOW}Step 7: Checking redirect URIs for scanny-client...${NC}"

# Get client ID for scanny-client
CLIENT_UUID=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=scanny-client" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.[0].id')

if [ "$CLIENT_UUID" != "null" ] && [ ! -z "$CLIENT_UUID" ]; then
    echo -e "${GREEN}✓ Found scanny-client${NC}"
    
    # Get current client config
    CLIENT_CONFIG=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$CLIENT_UUID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    # Update to ensure our URIs are included
    echo "$CLIENT_CONFIG" | jq '.redirectUris += ["http://localhost:5173/*", "http://localhost:5174/*"] | .redirectUris |= unique | .webOrigins += ["http://localhost:5173", "http://localhost:5174"] | .webOrigins |= unique' > /tmp/client_update.json
    
    curl -s -X PUT "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients/$CLIENT_UUID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d @/tmp/client_update.json > /dev/null
    
    echo -e "${GREEN}✓ Redirect URIs updated${NC}\n"
    rm /tmp/client_update.json
else
    echo -e "${YELLOW}⚠ scanny-client not found (you may need to create it manually)${NC}\n"
fi

# Final Summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ Scanny Realm Configuration Complete!${NC}"
echo -e "${YELLOW}========================================${NC}\n"

echo -e "${GREEN}Configuration Summary:${NC}"
echo "  Realm: $REALM_NAME"
echo "  Keycloak URL: $KEYCLOAK_URL"
echo "  Admin Console: $KEYCLOAK_URL/admin"
echo ""
echo -e "${GREEN}Roles Available:${NC}"
echo "  • MERCHANT - For business owners"
echo "  • ADMIN - For system administrators"
echo ""
echo -e "${GREEN}Clients:${NC}"
echo "  • scanny-client (existing - for frontend)"
echo "  • scanny-admin (existing - for admin console)"
echo "  • scanny-backend (new - for API authentication)"
echo ""
echo -e "${YELLOW}Backend Configuration (application.yml):${NC}"
echo "  keycloak:"
echo "    realm: scanny"
echo "    server-url: http://localhost:8080"
echo "    client-id: scanny-backend"
echo ""
echo -e "${GREEN}Issuer URL:${NC}"
echo "  http://localhost:8080/realms/scanny"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Restart your backend: mvn spring-boot:run"
echo "  2. Test merchant registration"
echo "  3. Users will be created in the 'scanny' realm"
