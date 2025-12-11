#!/bin/bash

# Email Service Setup Verification Script
# Run this after deployment to verify everything works

set -e

WORKER_URL="${1:-}"
AUTH_TOKEN="${2:-}"

echo "=================================================="
echo "KeyReply Kira AI - Email Service Verification"
echo "=================================================="
echo ""

# Check if URL and token provided
if [ -z "$WORKER_URL" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: ./verify-email-setup.sh <worker-url> <auth-token>"
    echo ""
    echo "Example:"
    echo "  ./verify-email-setup.sh https://keyreply-kira-api.workers.dev your-session-token"
    echo ""
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check endpoint
check_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4

    echo -n "Checking $description... "

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            "${WORKER_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${WORKER_URL}${endpoint}")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  Response: $body"
        return 1
    fi
}

echo "Step 1: Checking API connectivity..."
echo "--------------------------------------"
check_endpoint "GET" "/health" "Health check"
echo ""

echo "Step 2: Checking email endpoints..."
echo "--------------------------------------"
check_endpoint "GET" "/emails/templates" "List templates"
check_endpoint "GET" "/emails/logs?limit=1" "Get email logs"
check_endpoint "GET" "/emails/stats?period=7d" "Get statistics"
echo ""

echo "Step 3: Testing database access..."
echo "--------------------------------------"
echo -n "Verifying D1 database... "

# Check if logs endpoint returns valid JSON
logs_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
    "${WORKER_URL}/emails/logs?limit=1")

if echo "$logs_response" | grep -q "\"logs\""; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Database may not be configured correctly"
    echo "  Response: $logs_response"
fi
echo ""

echo "Step 4: Checking Resend API configuration..."
echo "--------------------------------------"
echo -n "Testing Resend API key... "

# Try to get templates (requires API to be configured)
templates_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
    "${WORKER_URL}/emails/templates")

if echo "$templates_response" | grep -q "\"templates\""; then
    echo -e "${GREEN}✓ OK${NC}"
    echo "  Found $(echo "$templates_response" | grep -o "\"name\"" | wc -l) templates"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "  Could not verify templates endpoint"
fi
echo ""

echo "Step 5: Testing preview functionality..."
echo "--------------------------------------"
preview_data='{"template":"welcome","data":{"name":"Test User","tenantName":"Test Org"}}'
check_endpoint "POST" "/emails/preview" "Preview template" "$preview_data"
echo ""

echo "=================================================="
echo "Verification Summary"
echo "=================================================="
echo ""
echo "✓ = Working"
echo "✗ = Not working"
echo "⚠ = Warning/Optional"
echo ""
echo "To send a test email, run:"
echo ""
echo "curl -X POST ${WORKER_URL}/emails/test \\"
echo "  -H \"Authorization: Bearer ${AUTH_TOKEN}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"to\":\"your-email@example.com\"}'"
echo ""
echo "=================================================="
echo ""

# Check wrangler.toml exists
if [ -f "wrangler.toml" ]; then
    echo "Configuration files found:"
    echo "  ✓ wrangler.toml"
fi

if [ -f "schema.sql" ]; then
    echo "  ✓ schema.sql"
fi

if [ -f "src/services/email.js" ]; then
    echo "  ✓ src/services/email.js"
fi

if [ -f "src/routes/emails.js" ]; then
    echo "  ✓ src/routes/emails.js"
fi

echo ""
echo "For detailed documentation, see:"
echo "  - EMAIL_SERVICE_README.md"
echo "  - QUICK_START_EMAIL.md"
echo "  - EMAIL_QUICK_REFERENCE.md"
echo ""
