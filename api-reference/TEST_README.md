# API Endpoint Testing Script

## Overview

The `test-endpoints.sh` script tests all documented Lyceum Cloud API endpoints using curl commands. It provides comprehensive coverage of the API with colored output, error handling, and detailed reporting.

## Features

- Tests all major API endpoint categories:
  - System Health (`/health/*`)
  - Billing & Credits (`/billing/*`)
  - API Key Management (`/auth/api-keys/*`)
  - File Storage (`/storage/*`)
  - Code Execution (`/execution/*`)
- Colored terminal output for easy status identification
- Automatic rate limiting between requests
- JSON response formatting (when `jq` is available)
- Comprehensive test summary with pass/fail counts
- Captures and reports failed endpoints

## Prerequisites

- `curl` (required)
- `jq` (optional, for pretty-printed JSON)
- Valid JWT token or API key

## Usage

### Basic Usage

```bash
./test-endpoints.sh
```

### With Output Logging

```bash
./test-endpoints.sh | tee test-results.log
```

### Quiet Mode (errors only)

```bash
./test-endpoints.sh 2>&1 | grep -E "(FAILED|Failed Endpoints)"
```

## Configuration

Edit the script to modify:

- `BASE_URL`: API base URL (default: `https://api.lyceum.technology/api/v2/external`)
- `TOKEN`: Your JWT token or API key

```bash
TOKEN="your-token-here"
```

## Test Categories

### Safe Tests (No Side Effects)

These tests are automatically run:

**Health & User**
- ✅ Health checks (`/health/ping`, `/health/version`)
- ✅ User status (`/user/status`)

**Billing & Credits**
- ✅ Get credit balance (`/billing/credits`)
- ✅ Get detailed credits (`/billing/credits/details`)
- ✅ View execution history (`/billing/history`)
- ✅ View billing activities (`/billing/activities`)

**API Keys**
- ✅ List API keys (`/auth/api-keys/`)

**Storage**
- ✅ List files (`/storage/list-files`)
- ✅ Get S3 credentials (`/storage/credentials`)

**Execution**
- ✅ List active executions (`/workloads/list`)
- ✅ Start Python execution (`/execution/streaming/start`)
- ✅ Check execution status (`/execution/streaming/{id}/status`)
- ✅ Get past execution details (`/execution/{id}`)
- ✅ Get execution timing (`/execution/{id}/timing`)

### Commented Out Tests (Avoid Side Effects)

These tests are commented out by default to prevent:

- **User Management**: Deleting user account (`/user/delete`)
- **Billing**: Creating checkout sessions (would create actual charges)
- **API Keys**: Creating/deleting/toggling API keys
- **Storage**: Uploading files, deleting files/folders
- **Executions**: Aborting active executions, deleting execution records

To enable these tests, uncomment the relevant sections in the script.

## Output Format

### Success Example

```
Testing: GET /billing/credits
Description: Get credit balance
✓ PASSED - HTTP 200
{
  "available_credits": 100.0,
  "used_credits": 25.0
}
```

### Failure Example

```
Testing: GET /invalid/endpoint
Description: Test invalid endpoint
✗ FAILED - HTTP 404
{
  "detail": "Not found"
}
```

### Summary

```
========================================
📊 TEST SUMMARY
========================================

Total Tests:  12
Passed:       11
Failed:       1

Failed Endpoints:
  ✗ GET /invalid/endpoint (HTTP 404)
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Rate Limiting

The script includes a 0.5-second delay between requests to respect API rate limits. Adjust the `sleep` value if needed:

```bash
sleep 0.5  # Increase for stricter rate limiting
```

## Troubleshooting

### Token Expired

If you see 401 errors:

```
✗ FAILED - HTTP 401
{"detail": "Token expired"}
```

Update the `TOKEN` variable with a fresh token.

### Rate Limit Exceeded

If you see 429 errors:

```
✗ FAILED - HTTP 429
{"detail": "Too many requests"}
```

Increase the `sleep` delay between requests.

### Missing jq

If `jq` is not installed, responses will be shown as raw JSON. Install with:

```bash
# macOS
brew install jq

# Ubuntu/Debian
apt-get install jq

# Fedora
dnf install jq
```

## Example Output

```bash
$ ./test-endpoints.sh

========================================
LYCEUM CLOUD API ENDPOINT TESTING
========================================

========================================
🏥 System Health
========================================

Testing: GET /health/ping
Description: Health check endpoint
✓ PASSED - HTTP 200
{
  "status": "healthy"
}

Testing: GET /health/version
Description: API version information
✓ PASSED - HTTP 200
{
  "version": "2.0.0",
  "build": "2024-01-01"
}

========================================
💳 Billing & Credits
========================================

Testing: GET /billing/credits
Description: Get credit balance
✓ PASSED - HTTP 200
{
  "available_credits": 100.0,
  "remaining_credits": 75.0
}

...

========================================
📊 TEST SUMMARY
========================================

Total Tests:  12
Passed:       12
Failed:       0

All tests passed! ✓
```

## Extending the Script

### Adding New Tests

Add new test cases using the `test_endpoint` function:

```bash
test_endpoint "METHOD" "/endpoint/path" "Description" "optional-json-data"
```

Example:

```bash
test_endpoint "POST" "/new/endpoint" "Test new feature" \
  '{"param1": "value1", "param2": "value2"}'
```

### Adding Headers

Pass additional headers as the fifth parameter:

```bash
test_endpoint "GET" "/endpoint" "Description" "" "-H 'X-Custom-Header: value'"
```

## Security Notes

- Keep your JWT token secure
- Don't commit the script with your token to version control
- Tokens expire after 24 hours
- Use API keys for automated testing

## Support

For API issues or questions:
- API Documentation: [https://docs.lyceum.technology](https://docs.lyceum.technology)
- Support: support@lyceum.technology
- Status Page: [https://status.lyceum.technology](https://status.lyceum.technology)
