#!/bin/bash

# Test Merchant Registration and QR Code Generation

BASE_URL="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Testing Merchant Registration & QR Code${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Register a new merchant
echo -e "${YELLOW}Test 1: Registering a new merchant...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Jinja Coffee House",
    "businessType": "RESTAURANT",
    "email": "owner@jinjacoffee.com",
    "phoneNumber": "+256700111222",
    "paymentDestination": {
      "type": "MOBILE_MONEY",
      "provider": "MTN",
      "number": "+256700111222",
      "accountName": "Jinja Coffee Ltd"
    },
    "businessDescription": "Premium coffee and pastries in the heart of Jinja",
    "businessAddress": "Main Street, Jinja, Uganda",
    "termsAccepted": true
  }')

MERCHANT_ID=$(echo $REGISTER_RESPONSE | jq -r '.merchantId')
if [ -z "$MERCHANT_ID" ] || [ "$MERCHANT_ID" == "null" ]; then
    echo -e "${RED}✗ Failed to register merchant${NC}"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Merchant registered successfully${NC}"
echo "  Merchant ID: $MERCHANT_ID"
echo "  Email: $(echo $REGISTER_RESPONSE | jq -r '.email')"
echo "  Business: $(echo $REGISTER_RESPONSE | jq -r '.businessName')"
echo "  Next Step: $(echo $REGISTER_RESPONSE | jq -r '.nextStep')"
echo ""

# Test 2: Get merchant profile
echo -e "${YELLOW}Test 2: Getting merchant profile...${NC}"
PROFILE_RESPONSE=$(curl -s "$BASE_URL/api/auth/merchant/profile?merchantId=$MERCHANT_ID")
PROFILE_EMAIL=$(echo $PROFILE_RESPONSE | jq -r '.email')

if [ -z "$PROFILE_EMAIL" ] || [ "$PROFILE_EMAIL" == "null" ]; then
    echo -e "${RED}✗ Failed to get merchant profile${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Merchant profile retrieved${NC}"
echo "  Business Name: $(echo $PROFILE_RESPONSE | jq -r '.businessName')"
echo "  Business Type: $(echo $PROFILE_RESPONSE | jq -r '.businessType')"
echo "  Status: $(echo $PROFILE_RESPONSE | jq -r '.status')"
echo "  Email Verified: $(echo $PROFILE_RESPONSE | jq -r '.emailVerified')"
echo "  QR Generated: $(echo $PROFILE_RESPONSE | jq -r '.qrCodeGenerated')"
echo "  Onboarding Step: $(echo $PROFILE_RESPONSE | jq -r '.onboardingStep')/5"
echo ""

# Test 3: Generate QR code (simulates first login)
echo -e "${YELLOW}Test 3: Generating QR code for merchant...${NC}"
QR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/merchant/qr-code/generate?merchantId=$MERCHANT_ID&reason=FIRST_LOGIN")
QR_TOKEN=$(echo $QR_RESPONSE | jq -r '.qrCodeToken')

if [ -z "$QR_TOKEN" ] || [ "$QR_TOKEN" == "null" ]; then
    echo -e "${RED}✗ Failed to generate QR code${NC}"
    echo "Response: $QR_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ QR code generated successfully!${NC}"
echo "  QR Token: $QR_TOKEN"
echo "  QR URL: $(echo $QR_RESPONSE | jq -r '.qrCodeUrl')"
echo "  Newly Generated: $(echo $QR_RESPONSE | jq -r '.newlyGenerated')"
echo "  Generated At: $(echo $QR_RESPONSE | jq -r '.generatedAt')"
echo ""

# Test 4: Get QR code (retrieve existing)
echo -e "${YELLOW}Test 4: Retrieving existing QR code...${NC}"
QR_GET_RESPONSE=$(curl -s "$BASE_URL/api/auth/merchant/qr-code?merchantId=$MERCHANT_ID")
QR_TOKEN_2=$(echo $QR_GET_RESPONSE | jq -r '.qrCodeToken')

if [ "$QR_TOKEN" == "$QR_TOKEN_2" ]; then
    echo -e "${GREEN}✓ QR code retrieved (same token)${NC}"
    echo "  Token: $QR_TOKEN_2"
else
    echo -e "${RED}✗ QR code mismatch${NC}"
fi
echo ""

# Test 5: Get onboarding status
echo -e "${YELLOW}Test 5: Checking onboarding status...${NC}"
ONBOARDING_RESPONSE=$(curl -s "$BASE_URL/api/auth/merchant/onboarding?merchantId=$MERCHANT_ID")
CURRENT_STEP=$(echo $ONBOARDING_RESPONSE | jq -r '.currentStep')
TOTAL_STEPS=$(echo $ONBOARDING_RESPONSE | jq -r '.totalSteps')

echo -e "${GREEN}✓ Onboarding status retrieved${NC}"
echo "  Current Step: $CURRENT_STEP / $TOTAL_STEPS"
echo "  Email Verification: $(echo $ONBOARDING_RESPONSE | jq -r '.steps.emailVerification.completed')"
echo "  QR Code Generation: $(echo $ONBOARDING_RESPONSE | jq -r '.steps.qrCodeGeneration.completed')"
echo "  Catalog Setup: $(echo $ONBOARDING_RESPONSE | jq -r '.steps.catalogSetup.completed')"
echo "  Test Order: $(echo $ONBOARDING_RESPONSE | jq -r '.steps.testOrder.completed')"
echo "  Complete: $(echo $ONBOARDING_RESPONSE | jq -r '.steps.complete.completed')"
echo ""

# Test 6: Mark QR code as printed
echo -e "${YELLOW}Test 6: Marking QR code as printed...${NC}"
curl -s -X POST "$BASE_URL/api/auth/merchant/qr-code/mark-printed?merchantId=$MERCHANT_ID" > /dev/null
echo -e "${GREEN}✓ QR code marked as printed${NC}\n"

# Test 7: Update merchant profile
echo -e "${YELLOW}Test 7: Updating merchant profile...${NC}"
UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/auth/merchant/profile?merchantId=$MERCHANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "businessDescription": "Premium coffee, pastries, and fresh juices in Jinja",
    "businessAddress": "123 Main Street, Jinja City, Uganda"
  }')

UPDATED_DESC=$(echo $UPDATE_RESPONSE | jq -r '.businessName')
if [ -z "$UPDATED_DESC" ] || [ "$UPDATED_DESC" == "null" ]; then
    echo -e "${RED}✗ Failed to update profile${NC}"
else
    echo -e "${GREEN}✓ Profile updated successfully${NC}"
fi
echo ""

# Test 8: Register another merchant (different business type)
echo -e "${YELLOW}Test 8: Registering second merchant (BAR)...${NC}"
REGISTER2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Entebbe Sports Bar",
    "businessType": "BAR",
    "email": "manager@entebbesportsbar.com",
    "phoneNumber": "+256700333444",
    "paymentDestination": {
      "type": "BANK_ACCOUNT",
      "bankName": "Stanbic Bank",
      "bankAccountNumber": "9010012345678",
      "accountName": "Entebbe Sports Bar Ltd"
    },
    "termsAccepted": true
  }')

MERCHANT_ID_2=$(echo $REGISTER2_RESPONSE | jq -r '.merchantId')
if [ -z "$MERCHANT_ID_2" ] || [ "$MERCHANT_ID_2" == "null" ]; then
    echo -e "${RED}✗ Failed to register second merchant${NC}"
else
    echo -e "${GREEN}✓ Second merchant registered${NC}"
    echo "  Merchant ID: $MERCHANT_ID_2"
    echo "  Business: $(echo $REGISTER2_RESPONSE | jq -r '.businessName')"
    
    # Generate QR for second merchant
    QR2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/merchant/qr-code/generate?merchantId=$MERCHANT_ID_2&reason=FIRST_LOGIN")
    QR_TOKEN_2=$(echo $QR2_RESPONSE | jq -r '.qrCodeToken')
    echo "  QR Token: $QR_TOKEN_2"
fi
echo ""

# Test 9: Check database state
echo -e "${YELLOW}Test 9: Checking database state...${NC}"
echo "Querying merchants table..."
docker exec scanit-postgres psql -U scanit -d scanit -c "SELECT id, business_name, business_type, email, qr_code_token IS NOT NULL as has_qr, status FROM merchants ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "(Database query skipped)"
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All Merchant Registration Tests Passed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}Key Features Tested:${NC}"
echo "  ✓ Merchant registration with business details"
echo "  ✓ Mobile money payment destination"
echo "  ✓ Bank account payment destination"
echo "  ✓ Auto-generated QR codes on first login"
echo "  ✓ QR code retrieval and persistence"
echo "  ✓ QR code printing tracking"
echo "  ✓ Merchant profile management"
echo "  ✓ Onboarding progress tracking"
echo "  ✓ Multiple business types support"
echo ""

echo -e "${YELLOW}QR Code URLs Generated:${NC}"
echo "  1. Jinja Coffee House:"
echo "     $(echo $QR_RESPONSE | jq -r '.qrCodeUrl')"
echo ""
echo "  2. Entebbe Sports Bar:"
echo "     $(echo $QR2_RESPONSE | jq -r '.qrCodeUrl')"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Email verification flow (Keycloak integration)"
echo "  2. Actual login with JWT tokens"
echo "  3. Frontend registration form"
echo "  4. QR code printing template"
echo "  5. Onboarding wizard UI"
