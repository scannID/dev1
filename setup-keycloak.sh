#!/bin/bash

# Setup Keycloak for ScanIT
# Creates realm, roles, and clients

KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="admin"
REALM_NAME="scanit"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Setting up Keycloak for ScanIT${NC}"
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
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Got access token${NC}\n"

# Step 2: Check if realm exists
echo -e "${YELLOW}Step 2: Checking if realm '$REALM_NAME' exists...${NC}"
REALM_CHECK=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM_NAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$REALM_CHECK" | grep -q "\"realm\":\"$REALM_NAME\""; then
    echo -e "${YELLOW}⚠ Realm '$REALM_NAME' already exists${NC}\n"
else
    # Step 3: Create realm
    echo -e "${YELLOW}Step 3: Creating realm '$REALM_NAME'...${NC}"
    CREATE_REALM=$(curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "realm": "'$REALM_NAME'",
        "enabled": true,
        "displayName": "ScanIT",
        "registrationAllowed": false,
        "loginWithEmailAllowed": true,
        "duplicateEmailsAllowed": false,
        "verifyEmail": true,
        "resetPasswordAllowed": true,
        "editUsernameAllowed": false,
        "bruteForceProtected": true,
        "smtpServer": {
          "host": "localhost",
          "port": "1025",
          "from": "noreply@scanit.app",
          "fromDisplayName": "ScanIT",
          "ssl": "false",
          "starttls": "false",
          "auth": "false"
        }
      }')
    
    echo -e "${GREEN}✓ Realm created${NC}\n"
fi

# Step 4: Create roles
echo -e "${YELLOW}Step 4: Creating roles...${NC}"

# Create MERCHANT role
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MERCHANT",
    "description": "Business owner role"
  }' > /dev/null

# Create ADMIN role
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ADMIN",
    "description": "System administrator role"
  }' > /dev/null

# Create CUSTOMER role
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CUSTOMER",
    "description": "End customer role"
  }' > /dev/null

echo -e "${GREEN}✓ Roles created (MERCHANT, ADMIN, CUSTOMER)${NC}\n"

# Step 5: Create backend client
echo -e "${YELLOW}Step 5: Creating backend client...${NC}"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "scanit-backend",
    "name": "ScanIT Backend",
    "description": "Backend API server",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": false,
    "bearerOnly": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": true
  }' > /dev/null

echo -e "${GREEN}✓ Backend client created${NC}\n"

# Step 6: Create frontend client
echo -e "${YELLOW}Step 6: Creating frontend client...${NC}"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "scanit-frontend",
    "name": "ScanIT Frontend",
    "description": "Frontend web application",
    "enabled": true,
    "protocol": "openid-connect",
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "implicitFlowEnabled": false,
    "redirectUris": [
      "http://localhost:5173/*",
      "http://localhost:5174/*",
      "https://scanit.app/*"
    ],
    "webOrigins": [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://scanit.app"
    ]
  }' > /dev/null

echo -e "${GREEN}✓ Frontend client created${NC}\n"

# Step 7: Create admin client (for merchant registration)
echo -e "${YELLOW}Step 7: Creating admin client for user management...${NC}"
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "scanit-admin",
    "name": "ScanIT Admin Client",
    "enabled": true,
    "serviceAccountsEnabled": true,
    "authorizationServicesEnabled": true
  }' > /dev/null

echo -e "${GREEN}✓ Admin client created${NC}\n"

# Final Summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ Keycloak Setup Complete!${NC}"
echo -e "${YELLOW}========================================${NC}\n"

echo -e "${GREEN}Configuration Summary:${NC}"
echo "  Realm: $REALM_NAME"
echo "  Keycloak URL: $KEYCLOAK_URL"
echo "  Admin Console: $KEYCLOAK_URL/admin"
echo ""
echo -e "${GREEN}Roles Created:${NC}"
echo "  • MERCHANT - Business owners"
echo "  • ADMIN - System administrators"
echo "  • CUSTOMER - End customers"
echo ""
echo -e "${GREEN}Clients Created:${NC}"
echo "  • scanit-backend (Bearer-only resource server)"
echo "  • scanit-frontend (Public SPA client)"
echo "  • scanit-admin (Service account for user management)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit: $KEYCLOAK_URL/admin"
echo "  2. Login with: admin / admin"
echo "  3. Go to Realm: $REALM_NAME"
echo "  4. Test merchant registration"
echo ""
echo -e "${GREEN}Issuer URL for application.yml:${NC}"
echo "  http://localhost:8080/realms/$REALM_NAME"
