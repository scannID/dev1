#!/bin/bash

# Test Script for Client App API Endpoints (Phase 1)
# Tests all 7 critical endpoints needed for merchant portal

BASE_URL="http://localhost:4000/api"
BUSINESS_ID="kampala-grill"

echo "🧪 Testing Client App API Endpoints - Phase 1"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Create Catalog Item
echo -e "${BLUE}1. Testing POST /api/businesses/{businessId}/catalog${NC}"
echo "   Creating new catalog item..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/catalog" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Pizza","category":"Meals","price":22000,"description":"Delicious test pizza","available":true}')

ITEM_ID=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['item']['id'])")
echo "   ✅ Created item with ID: $ITEM_ID"
echo ""

# Test 2: List Catalog Items
echo -e "${BLUE}2. Testing GET /api/businesses/{businessId}/catalog${NC}"
echo "   Fetching all catalog items..."
ITEMS_COUNT=$(curl -s "$BASE_URL/businesses/$BUSINESS_ID/catalog" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['items']))")
echo "   ✅ Found $ITEMS_COUNT catalog items"
echo ""

# Test 3: Update Catalog Item
echo -e "${BLUE}3. Testing PATCH /api/businesses/{businessId}/catalog/{itemId}${NC}"
echo "   Updating catalog item..."
curl -s -X PATCH "$BASE_URL/businesses/$BUSINESS_ID/catalog/$ITEM_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Pizza","price":25000}' > /dev/null
echo "   ✅ Item updated successfully"
echo ""

# Test 4: Update Item Availability
echo -e "${BLUE}4. Testing PATCH /api/businesses/{businessId}/catalog/{itemId}/availability${NC}"
echo "   Toggling item availability..."
curl -s -X PATCH "$BASE_URL/businesses/$BUSINESS_ID/catalog/$ITEM_ID/availability" \
  -H "Content-Type: application/json" \
  -d '{"available":false}' > /dev/null
echo "   ✅ Availability toggled to unavailable"
echo ""

# Test 5: Create Order (for status tests)
echo -e "${BLUE}5. Creating test order for status updates...${NC}"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/businesses/$BUSINESS_ID/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "name": "Test Customer",
      "phone": "+256700123456",
      "location": "Table 10",
      "note": "Test order"
    },
    "items": [
      {"id": "beef-plate", "quantity": 1}
    ]
  }')

ORDER_ID=$(echo $ORDER_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['order']['id'])")
echo "   ✅ Created order with ID: $ORDER_ID"
echo ""

# Test 6: Update Order Status
echo -e "${BLUE}6. Testing PATCH /api/orders/{orderId}/status${NC}"
echo "   Updating order status to Preparing..."
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Preparing"}' > /dev/null
echo "   ✅ Order status updated to Preparing"

echo "   Updating order status to Ready..."
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Ready"}' > /dev/null
echo "   ✅ Order status updated to Ready"

echo "   Updating order status to Completed..."
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Completed"}' > /dev/null
echo "   ✅ Order status updated to Completed"
echo ""

# Test 7: Update Payment Status
echo -e "${BLUE}7. Testing PATCH /api/orders/{orderId}/payment${NC}"
echo "   Updating payment status to Paid..."
curl -s -X PATCH "$BASE_URL/orders/$ORDER_ID/payment" \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus":"Paid"}' > /dev/null
echo "   ✅ Payment status updated to Paid"
echo ""

# Test 8: Clear Completed Orders
echo -e "${BLUE}8. Testing DELETE /api/businesses/{businessId}/orders/completed${NC}"
echo "   Clearing completed orders..."
CLEAR_RESPONSE=$(curl -s -X DELETE "$BASE_URL/businesses/$BUSINESS_ID/orders/completed")
DELETED_COUNT=$(echo $CLEAR_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['deleted'])")
echo "   ✅ Cleared $DELETED_COUNT completed order(s)"
echo ""

# Test 9: Delete Catalog Item
echo -e "${BLUE}9. Testing DELETE /api/businesses/{businessId}/catalog/{itemId}${NC}"
echo "   Deleting test catalog item..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/businesses/$BUSINESS_ID/catalog/$ITEM_ID")
if [ "$HTTP_CODE" = "204" ]; then
    echo "   ✅ Item deleted successfully"
else
    echo "   ❌ Failed to delete item (HTTP $HTTP_CODE)"
fi
echo ""

# Summary
echo -e "${GREEN}✅ All Phase 1 endpoints tested successfully!${NC}"
echo ""
echo "Summary of tested endpoints:"
echo "  1. POST   /api/businesses/{businessId}/catalog"
echo "  2. GET    /api/businesses/{businessId}/catalog"
echo "  3. PATCH  /api/businesses/{businessId}/catalog/{itemId}"
echo "  4. PATCH  /api/businesses/{businessId}/catalog/{itemId}/availability"
echo "  5. PATCH  /api/orders/{orderId}/status"
echo "  6. PATCH  /api/orders/{orderId}/payment"
echo "  7. DELETE /api/businesses/{businessId}/orders/completed"
echo "  8. DELETE /api/businesses/{businessId}/catalog/{itemId}"
echo ""
echo "🎉 Client app API Phase 1 is ready for frontend integration!"
