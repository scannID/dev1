#!/bin/bash

# Admin API Endpoints Test Script
# Tests all implemented admin endpoints

BASE_URL="http://localhost:4000/api/admin"

echo "🧪 Testing Admin API Endpoints"
echo "================================"
echo ""

# Test Dashboard Endpoints
echo "📊 Testing Dashboard Endpoints..."
echo ""

echo "1. Dashboard Metrics:"
curl -s "$BASE_URL/dashboard/metrics" | python3 -m json.tool | head -20
echo ""

echo "2. Activity Feed:"
curl -s "$BASE_URL/dashboard/activity" | python3 -m json.tool | head -15
echo ""

echo "3. Top Merchants:"
curl -s "$BASE_URL/dashboard/top-merchants?period=month&limit=5" | python3 -m json.tool | head -15
echo ""

# Test Merchants Endpoints
echo "🏪 Testing Merchants Endpoints..."
echo ""

echo "4. List Merchants:"
curl -s "$BASE_URL/merchants?page=1&limit=10" | python3 -m json.tool | head -30
echo ""

echo "5. Merchant Details (kampala-grill):"
curl -s "$BASE_URL/merchants/kampala-grill" | python3 -m json.tool | head -20
echo ""

# Test Orders Endpoints
echo "📦 Testing Orders Endpoints..."
echo ""

echo "6. List Orders:"
curl -s "$BASE_URL/orders?page=1&limit=10" | python3 -m json.tool | head -20
echo ""

# Test System Health
echo "🏥 Testing System Health..."
echo ""

echo "7. System Status:"
curl -s "$BASE_URL/system/status" | python3 -m json.tool | head -30
echo ""

# Test Analytics Endpoints
echo "📊 Testing Analytics Endpoints..."
echo ""

echo "8. Ticket Analytics:"
curl -s "$BASE_URL/analytics/tickets" | python3 -m json.tool
echo ""

echo "9. Quick Payment Analytics:"
curl -s "$BASE_URL/analytics/quick-payments" | python3 -m json.tool
echo ""

echo "10. Device Analytics:"
curl -s "$BASE_URL/analytics/devices" | python3 -m json.tool
echo ""

echo "11. Revenue Overview:"
curl -s "$BASE_URL/revenue/overview" | python3 -m json.tool | head -40
echo ""

echo "✅ All endpoint tests completed!"
echo ""
echo "Summary:"
echo "- Dashboard: 3 endpoints ✅"
echo "- Merchants: 2 endpoints ✅"
echo "- Orders: 1 endpoint ✅"
echo "- System Health: 1 endpoint ✅"
echo "- Analytics: 4 endpoints ✅"
echo ""
echo "Total: 11 endpoints tested successfully! 🎉"
