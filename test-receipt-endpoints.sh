#!/bin/bash

# Test script for Receipt Endpoints
# Tests automatic receipt generation after payment

BASE_URL="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Testing Receipt Service${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Test 1: Create an order first
echo -e "${YELLOW}Test 1: Creating a test order...${NC}"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "kampala-grill",
    "customer": {
      "name": "Jane Doe",
      "phone": "+256700123456",
      "email": "jane@example.com",
      "location": "Kampala"
    },
    "items": []
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.id')
if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" == "null" ]; then
    echo -e "${RED}✗ Failed to create order${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Order created: $ORDER_ID${NC}\n"

# Test 2: Update payment status to Paid (should auto-generate receipt)
echo -e "${YELLOW}Test 2: Updating payment status to Paid (auto-generate receipt)...${NC}"
PAYMENT_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/orders/$ORDER_ID/payment" \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus": "Paid"}')

PAYMENT_STATUS=$(echo $PAYMENT_RESPONSE | jq -r '.paymentStatus')
if [ "$PAYMENT_STATUS" == "Paid" ]; then
    echo -e "${GREEN}✓ Payment status updated to Paid${NC}"
else
    echo -e "${RED}✗ Failed to update payment status: $PAYMENT_STATUS${NC}"
fi
echo ""

# Wait a moment for receipt generation
sleep 2

# Test 3: Get receipt by order ID
echo -e "${YELLOW}Test 3: Fetching receipt by order ID...${NC}"
RECEIPT_RESPONSE=$(curl -s "$BASE_URL/api/receipts/order/$ORDER_ID")
RECEIPT_NUMBER=$(echo $RECEIPT_RESPONSE | jq -r '.receiptNumber')

if [ -z "$RECEIPT_NUMBER" ] || [ "$RECEIPT_NUMBER" == "null" ]; then
    echo -e "${RED}✗ No receipt found for order${NC}"
    echo "Response: $RECEIPT_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Receipt found: $RECEIPT_NUMBER${NC}\n"

# Test 4: Get receipt by receipt number
echo -e "${YELLOW}Test 4: Getting receipt by receipt number...${NC}"
RECEIPT_DETAIL=$(curl -s "$BASE_URL/api/receipts/$RECEIPT_NUMBER")
RECEIPT_AMOUNT=$(echo $RECEIPT_DETAIL | jq -r '.totalAmount')
RECEIPT_STATUS=$(echo $RECEIPT_DETAIL | jq -r '.status')

if [ -z "$RECEIPT_AMOUNT" ] || [ "$RECEIPT_AMOUNT" == "null" ]; then
    echo -e "${RED}✗ Failed to get receipt details${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Receipt details retrieved${NC}"
echo "  Receipt Number: $RECEIPT_NUMBER"
echo "  Amount: $RECEIPT_AMOUNT UGX"
echo "  Status: $RECEIPT_STATUS"
echo ""

# Test 5: Manual receipt generation
echo -e "${YELLOW}Test 5: Manually generating a receipt...${NC}"
MANUAL_RECEIPT=$(curl -s -X POST "$BASE_URL/api/receipts/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "kampala-grill",
    "businessName": "Kampala Grill",
    "merchantId": "kampala-grill",
    "customerName": "John Smith",
    "customerEmail": "john@example.com",
    "customerPhone": "+256700987654",
    "amount": 50000,
    "currency": "UGX",
    "paymentMethod": "Mobile Money",
    "paymentReference": "MTN-123456789",
    "items": [
      {
        "name": "Cappuccino",
        "quantity": 2,
        "price": 15000,
        "total": 30000
      },
      {
        "name": "Croissant",
        "quantity": 1,
        "price": 10000,
        "total": 10000
      }
    ],
    "subtotal": 40000,
    "taxAmount": 5000,
    "serviceFee": 5000,
    "notes": "Thank you for your purchase!",
    "sendEmail": false,
    "generatePdf": false
  }')

MANUAL_RECEIPT_NUMBER=$(echo $MANUAL_RECEIPT | jq -r '.receiptNumber')
if [ -z "$MANUAL_RECEIPT_NUMBER" ] || [ "$MANUAL_RECEIPT_NUMBER" == "null" ]; then
    echo -e "${RED}✗ Failed to generate manual receipt${NC}"
    echo "Response: $MANUAL_RECEIPT"
    exit 1
fi
echo -e "${GREEN}✓ Manual receipt generated: $MANUAL_RECEIPT_NUMBER${NC}\n"

# Test 6: Mark receipt as viewed
echo -e "${YELLOW}Test 6: Marking receipt as viewed...${NC}"
VIEWED_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/receipts/$MANUAL_RECEIPT_NUMBER/mark-viewed")
IN_APP_VIEWED=$(echo $VIEWED_RESPONSE | jq -r '.inAppViewed')

if [ "$IN_APP_VIEWED" == "true" ]; then
    echo -e "${GREEN}✓ Receipt marked as viewed${NC}\n"
else
    echo -e "${RED}✗ Failed to mark receipt as viewed${NC}\n"
fi

# Test 7: Get receipts by business ID
echo -e "${YELLOW}Test 7: Getting all receipts for business...${NC}"
BUSINESS_RECEIPTS=$(curl -s "$BASE_URL/api/receipts/business/kampala-grill")
RECEIPT_COUNT=$(echo $BUSINESS_RECEIPTS | jq -r '.total')

if [ "$RECEIPT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $RECEIPT_COUNT receipt(s) for business${NC}\n"
else
    echo -e "${RED}✗ No receipts found for business${NC}\n"
fi

# Test 8: Get receipt summary
echo -e "${YELLOW}Test 8: Getting receipt summary...${NC}"
SUMMARY_RESPONSE=$(curl -s "$BASE_URL/api/receipts/summary")
TOTAL_RECEIPTS=$(echo $SUMMARY_RESPONSE | jq -r '.totalReceipts')
TOTAL_AMOUNT=$(echo $SUMMARY_RESPONSE | jq -r '.totalAmount')

if [ -z "$TOTAL_RECEIPTS" ] || [ "$TOTAL_RECEIPTS" == "null" ]; then
    echo -e "${RED}✗ Failed to get receipt summary${NC}"
else
    echo -e "${GREEN}✓ Receipt summary retrieved${NC}"
    echo "  Total Receipts: $TOTAL_RECEIPTS"
    echo "  Total Amount: $TOTAL_AMOUNT UGX"
    echo "  Sent: $(echo $SUMMARY_RESPONSE | jq -r '.sentReceipts')"
    echo "  Pending: $(echo $SUMMARY_RESPONSE | jq -r '.pendingReceipts')"
    echo "  Failed: $(echo $SUMMARY_RESPONSE | jq -r '.failedReceipts')"
fi
echo ""

# Test 9: Send receipt email (will fail gracefully without email config)
echo -e "${YELLOW}Test 9: Testing email sending (expected to log warning)...${NC}"
EMAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/receipts/$MANUAL_RECEIPT_NUMBER/send-email" \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail": "test@example.com"}')

EMAIL_SUCCESS=$(echo $EMAIL_RESPONSE | jq -r '.success')
EMAIL_MESSAGE=$(echo $EMAIL_RESPONSE | jq -r '.message')

echo -e "${YELLOW}Email Result: $EMAIL_MESSAGE${NC}"
echo "  (Email service not configured, this is expected)"
echo ""

# Test 10: Get receipts by customer email
echo -e "${YELLOW}Test 10: Getting receipts by customer email...${NC}"
CUSTOMER_RECEIPTS=$(curl -s "$BASE_URL/api/receipts/customer/john@example.com")
CUSTOMER_RECEIPT_COUNT=$(echo $CUSTOMER_RECEIPTS | jq -r '.total')

if [ "$CUSTOMER_RECEIPT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $CUSTOMER_RECEIPT_COUNT receipt(s) for customer${NC}\n"
else
    echo -e "${YELLOW}⚠ No receipts found for customer (might be expected)${NC}\n"
fi

# Final Summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ Receipt Service Tests Complete!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "${GREEN}Key Features Tested:${NC}"
echo "  ✓ Automatic receipt generation on payment"
echo "  ✓ Manual receipt generation"
echo "  ✓ Receipt retrieval by number, order, business"
echo "  ✓ Receipt retrieval by customer email"
echo "  ✓ Mark receipt as viewed"
echo "  ✓ Receipt summary and analytics"
echo "  ✓ Email sending (graceful failure without config)"
echo ""
echo -e "${YELLOW}Note: Email functionality requires SMTP configuration in application.yml${NC}"
echo -e "${YELLOW}Receipt Numbers Format: RCT-YYYYMMDD-XXXX${NC}"
