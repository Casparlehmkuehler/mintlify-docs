#!/bin/bash

# API Endpoint Testing Script
# Tests all Lyceum Cloud API endpoints using the provided JWT token

set -e

# Configuration
BASE_URL="https://api.lyceum.technology/api/v2/external"
TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IitGVW9UMjRZWllyWm1ObzYiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RxY2ViZ2JleHlzenZxaG53bmhoLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIwNjBlZWM0YS01YjExLTQwYzQtYTI3Yy1hNmY2MTc2NmQ3YWYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYxNjg4NDA5LCJpYXQiOjE3NjE2ODQ4MDksImVtYWlsIjoiY2FzcGFyQGx5Y2V1bS50ZWNobm9sb2d5IiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJnaXRodWIiLCJwcm92aWRlcnMiOlsiZ2l0aHViIiwiZ29vZ2xlIl19LCJ1c2VyX21ldGFkYXRhIjp7ImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NLME5RSlFsRDliSE1zNEhSRnpMZG8wZnNJMm5td2tmU0VDYjA4WENKVjVkVk0zOVE9czk2LWMiLCJjdXN0b21fY2xhaW1zIjp7ImhkIjoibHljZXVtLnRlY2hub2xvZ3kifSwiZW1haWwiOiJjYXNwYXJAbHljZXVtLnRlY2hub2xvZ3kiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiQ2FzcGFyIExlaG1rw7xobGVyIiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwibmFtZSI6IkNhc3BhciBMZWhta8O8aGxlciIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0swTlFKUWxEOWJITXM0SFJGekxkbzBmc0kybm13a2ZTRUNiMDhYQ0pWNWRWTTM5UT1zOTYtYyIsInByZWZlcnJlZF91c2VybmFtZSI6IkNhc3BhcmxlaG1rdWVobGVyIiwicHJvdmlkZXJfaWQiOiIxMDA1NDgxNzk4ODk0NjU2MzYyNTUiLCJzdWIiOiIxMDA1NDgxNzk4ODk0NjU2MzYyNTUiLCJ1c2VyX25hbWUiOiJDYXNwYXJsZWhta3VlaGxlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6Im9hdXRoIiwidGltZXN0YW1wIjoxNzYxNjU0MTg4fV0sInNlc3Npb25faWQiOiIxZGI5Y2Y5NC1lMGIwLTQ1ZDQtOGJmYS04Mjc2MTEwMWQzMTkiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.2gy8VfKEST0WKsMcFo8D-MYVDEpcaSfqwa0h2jlRJ2M"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test result storage
declare -a FAILED_ENDPOINTS

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local extra_headers=$5

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${YELLOW}Testing:${NC} $method $endpoint"
    echo -e "${YELLOW}Description:${NC} $description"

    # Build curl command
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"
    curl_cmd="$curl_cmd -H 'Authorization: Bearer $TOKEN'"
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"

    if [ -n "$extra_headers" ]; then
        curl_cmd="$curl_cmd $extra_headers"
    fi

    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi

    # Execute curl and capture response
    response=$(eval $curl_cmd)
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    # Check if successful (2xx status code)
    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        echo -e "${GREEN}✓ PASSED${NC} - HTTP $http_code"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} - HTTP $http_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$method $endpoint (HTTP $http_code)")
    fi

    # Pretty print JSON response (if jq is available)
    if command -v jq &> /dev/null; then
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo "$body"
    fi

    echo ""
    sleep 0.5  # Rate limiting
}

# Start testing
print_header "LYCEUM CLOUD API ENDPOINT TESTING"

# ===========================================
# HEALTH ENDPOINTS
# ===========================================
print_header "🏥 System Health"

test_endpoint "GET" "/health/ping" "Health check endpoint"
test_endpoint "GET" "/health/version" "API version information"

# ===========================================
# USER MANAGEMENT
# ===========================================
print_header "👤 User Management"

test_endpoint "GET" "/user/status" "Get user status and profile"

# Note: Not testing user deletion to avoid account removal
# test_endpoint "DELETE" "/user/delete" "Delete user account"

# ===========================================
# BILLING & CREDITS
# ===========================================
print_header "💳 Billing & Credits"

test_endpoint "GET" "/billing/credits" "Get credit balance"
test_endpoint "GET" "/billing/credits/details" "Get detailed credits information"
test_endpoint "GET" "/billing/history?limit=10&offset=0" "Get execution history"
test_endpoint "GET" "/billing/activities?limit=10&offset=0" "Get billing activities"

# Note: Not testing checkout endpoint as it would create actual charges
# test_endpoint "POST" "/billing/checkout" "Create checkout session" \
#   '{"credits_amount": 100, "success_url": "https://example.com/success", "cancel_url": "https://example.com/cancel"}'

# ===========================================
# API KEY MANAGEMENT
# ===========================================
print_header "🔐 API Key Management"

test_endpoint "GET" "/auth/api-keys/" "List API keys"

# Note: Not creating/deleting API keys to avoid side effects
# test_endpoint "POST" "/auth/api-keys/" "Create new API key" \
#   '{"name": "Test Key", "description": "Created by test script"}'

# ===========================================
# STORAGE ENDPOINTS
# ===========================================
print_header "📁 File Storage"

test_endpoint "GET" "/storage/list-files?prefix=" "List files in storage"
test_endpoint "POST" "/storage/credentials" "Get S3 credentials"

# Note: Not testing upload/delete to avoid side effects
# test_endpoint "POST" "/storage/upload" "Upload file" "" "-F 'file=@test.txt' -F 'key=test/test.txt'"
# test_endpoint "DELETE" "/storage/delete/test/test.txt" "Delete file"

# ===========================================
# ACTIVE WORKLOAD MANAGEMENT
# ===========================================
print_header "⚙️ Active Workload Management"

test_endpoint "GET" "/workloads/list" "List active/non-completed executions"

# Note: Not testing abort to avoid stopping actual executions
# test_endpoint "POST" "/workloads/abort/{execution_id}" "Abort active execution"

# ===========================================
# CODE EXECUTION
# ===========================================
print_header "🚀 Code Execution"

# Test Python execution
execution_data='{
  "code": "print(\"Hello from API test\")\nimport sys\nprint(f\"Python version: {sys.version}\")",
  "execution_type": "cpu",
  "timeout": 60
}'

test_endpoint "POST" "/execution/streaming/start" "Start Python execution" "$execution_data"

# Extract execution ID from last response (if successful)
if command -v jq &> /dev/null; then
    EXECUTION_ID=$(echo "$body" | jq -r '.execution_id // empty' 2>/dev/null)

    if [ -n "$EXECUTION_ID" ]; then
        echo -e "${BLUE}Captured execution_id: $EXECUTION_ID${NC}"
        echo ""
        sleep 2  # Wait for execution to start

        test_endpoint "GET" "/execution/streaming/$EXECUTION_ID/status" "Check execution status"

        # Note: Not testing abort/complete to let execution finish naturally
        # test_endpoint "POST" "/execution/streaming/abort/$EXECUTION_ID" "Abort execution"
        # test_endpoint "POST" "/execution/streaming/complete/$EXECUTION_ID" "Complete execution"
    fi
fi

# Test Docker execution (commented out to avoid consuming credits)
# docker_data='{
#   "docker_image_ref": "python:3.11-slim",
#   "docker_run_cmd": ["python", "-c", "print(\"Hello from Docker\")"],
#   "execution_type": "cpu",
#   "timeout": 300
# }'
# test_endpoint "POST" "/execution/image/start" "Start Docker execution" "$docker_data"

# ===========================================
# PAST EXECUTION MANAGEMENT
# ===========================================
print_header "📜 Past Execution Management"

# Get a past execution ID from history to test with
if command -v jq &> /dev/null; then
    PAST_EXECUTION_ID=$(curl -s -X GET \
        "$BASE_URL/billing/history?limit=1" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        | jq -r '.executions[0].execution_id // empty' 2>/dev/null)

    if [ -n "$PAST_EXECUTION_ID" ]; then
        echo -e "${BLUE}Using past execution ID for testing: $PAST_EXECUTION_ID${NC}"
        echo ""

        test_endpoint "GET" "/execution/$PAST_EXECUTION_ID" "Get execution details"
        test_endpoint "GET" "/execution/$PAST_EXECUTION_ID/timing" "Get execution timing"

        # Note: Not testing deletion to preserve execution history
        # test_endpoint "DELETE" "/execution/$PAST_EXECUTION_ID" "Delete execution record"
    else
        echo -e "${YELLOW}No past executions found, skipping past execution tests${NC}"
        echo ""
    fi
fi

# ===========================================
# SUMMARY
# ===========================================
print_header "📊 TEST SUMMARY"

echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed Endpoints:${NC}"
    for endpoint in "${FAILED_ENDPOINTS[@]}"; do
        echo -e "  ${RED}✗${NC} $endpoint"
    done
    echo ""
    exit 1
else
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo ""
    exit 0
fi
