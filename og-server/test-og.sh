#!/usr/bin/env bash
# og-server/test-og.sh
#
# Quick smoke tests for the social crawler OG middleware.
# Usage:
#   ./og-server/test-og.sh                          # tests against https://kode.ug (prod)
#   BASE_URL=http://localhost:3000 ./og-server/test-og.sh  # tests locally
#   ./og-server/test-og.sh YOUR_TICKET_TOKEN YOUR_PAY_TOKEN
#
# Pass real tokens from your DB as arguments to test dynamic responses.
# Without arguments, the script tests only crawler vs browser detection
# and the /health endpoint.

set -euo pipefail

BASE_URL="${BASE_URL:-https://kode.ug}"
TICKET_TOKEN="${1:-}"
PAY_TOKEN="${2:-}"

# Colours
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; EXIT_CODE=1; }
info() { echo -e "${YELLOW}INFO${NC} $1"; }

EXIT_CODE=0

echo ""
echo "=== Kode OG-server smoke tests ==="
echo "Base URL: $BASE_URL"
echo ""

# ── 1. Health endpoint ────────────────────────────────────────────────────────
info "Testing /health..."
HEALTH=$(curl -sf "$BASE_URL/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  pass "/health returns {\"status\":\"ok\"}"
else
  fail "/health — unexpected response: $HEALTH"
fi

# ── 2. Browser request — must get SPA (empty root div) ───────────────────────
if [ -n "$TICKET_TOKEN" ]; then
  info "Testing /ticket/$TICKET_TOKEN as real browser (no crawler UA)..."
  BROWSER_RESP=$(curl -sf -A "Mozilla/5.0 (Macintosh)" "$BASE_URL/ticket/$TICKET_TOKEN" 2>/dev/null || echo "FAIL")
  if echo "$BROWSER_RESP" | grep -q 'id="root"'; then
    pass "Browser gets normal SPA (id=\"root\" present)"
  else
    fail "Browser did not get SPA — response missing id=\"root\""
  fi
fi

# ── 3. Facebook crawler — must get OG shell (no root div) ────────────────────
if [ -n "$TICKET_TOKEN" ]; then
  info "Testing /ticket/$TICKET_TOKEN as facebookexternalhit..."
  FB_RESP=$(curl -sf -A "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" \
    "$BASE_URL/ticket/$TICKET_TOKEN" 2>/dev/null || echo "FAIL")

  if echo "$FB_RESP" | grep -qi 'og:title'; then
    pass "facebookexternalhit gets og:title"
  else
    fail "facebookexternalhit — og:title missing in response"
  fi

  if echo "$FB_RESP" | grep -qi 'og:image'; then
    pass "facebookexternalhit gets og:image"
  else
    fail "facebookexternalhit — og:image missing in response"
  fi

  if echo "$FB_RESP" | grep -qi 'og:description'; then
    pass "facebookexternalhit gets og:description"
  else
    fail "facebookexternalhit — og:description missing in response"
  fi

  if echo "$FB_RESP" | grep -qi 'twitter:card'; then
    pass "facebookexternalhit gets twitter:card"
  else
    fail "facebookexternalhit — twitter:card missing in response"
  fi

  if echo "$FB_RESP" | grep -qi 'application/ld+json'; then
    pass "facebookexternalhit gets JSON-LD Event schema"
  else
    fail "facebookexternalhit — JSON-LD missing in response"
  fi

  # Confirm the OG shell does NOT contain the React root div
  if echo "$FB_RESP" | grep -q 'id="root"'; then
    fail "facebookexternalhit got SPA instead of OG shell (id=\"root\" found)"
  else
    pass "facebookexternalhit does not get id=\"root\" (OG shell confirmed)"
  fi
fi

# ── 4. Twitterbot on /pay/ ────────────────────────────────────────────────────
if [ -n "$PAY_TOKEN" ]; then
  info "Testing /pay/$PAY_TOKEN as Twitterbot..."
  TW_RESP=$(curl -sf -A "Twitterbot/1.0" "$BASE_URL/pay/$PAY_TOKEN" 2>/dev/null || echo "FAIL")

  if echo "$TW_RESP" | grep -qi 'og:title'; then
    pass "Twitterbot gets og:title on /pay/"
  else
    fail "Twitterbot — og:title missing on /pay/"
  fi

  if echo "$TW_RESP" | grep -qi 'twitter:card'; then
    pass "Twitterbot gets twitter:card on /pay/"
  else
    fail "Twitterbot — twitter:card missing on /pay/"
  fi
fi

# ── 5. WhatsApp crawler ───────────────────────────────────────────────────────
if [ -n "$TICKET_TOKEN" ]; then
  info "Testing /ticket/$TICKET_TOKEN as WhatsApp..."
  WA_RESP=$(curl -sf -A "WhatsApp/2.23.20.0 A" "$BASE_URL/ticket/$TICKET_TOKEN" 2>/dev/null || echo "FAIL")
  if echo "$WA_RESP" | grep -qi 'og:title'; then
    pass "WhatsApp crawler gets og:title"
  else
    fail "WhatsApp crawler — og:title missing"
  fi
fi

# ── 6. Unknown path → SPA fallback ───────────────────────────────────────────
info "Testing unknown path /does-not-exist as facebookexternalhit..."
UNKNOWN_RESP=$(curl -sf -A "facebookexternalhit/1.1" "$BASE_URL/does-not-exist" 2>/dev/null || echo "FAIL")
# Should get the SPA index.html (no OG shell — no route match)
if echo "$UNKNOWN_RESP" | grep -q 'id="root"'; then
  pass "Unknown path falls back to SPA (id=\"root\" present)"
else
  fail "Unknown path did not fall back to SPA"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "${GREEN}All tests passed.${NC}"
else
  echo -e "${RED}Some tests failed — see above.${NC}"
fi

# Print quick manual test commands for reference
echo ""
echo "── Manual test commands ─────────────────────────────────────────────────"
if [ -n "$TICKET_TOKEN" ]; then
  echo "curl -s -A 'facebookexternalhit/1.1' '$BASE_URL/ticket/$TICKET_TOKEN' | grep -i 'og:'"
  echo "curl -s -A 'Twitterbot/1.0'          '$BASE_URL/ticket/$TICKET_TOKEN' | grep -i 'og:'"
  echo "curl -s -A 'WhatsApp/2.23'            '$BASE_URL/ticket/$TICKET_TOKEN' | grep -i 'og:'"
fi
if [ -n "$PAY_TOKEN" ]; then
  echo "curl -s -A 'facebookexternalhit/1.1' '$BASE_URL/pay/$PAY_TOKEN' | grep -i 'og:'"
fi
echo "curl -s -A 'facebookexternalhit/1.1' '$BASE_URL/ticket/SOME_TOKEN' | python3 -m json.tool - 2>/dev/null || true"
echo ""

exit $EXIT_CODE
