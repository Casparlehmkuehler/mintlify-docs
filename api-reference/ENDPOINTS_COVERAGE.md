# API Endpoint Test Coverage

This document lists all endpoints from the OpenAPI spec and indicates which are tested by `test-endpoints.sh`.

## Coverage Summary

- **Total Endpoints**: 38
- **Tested (Safe)**: 20
- **Available but Commented Out**: 12
- **Not Applicable**: 6 (webhook, deprecated endpoints)

---

## Health (2/2 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/health/ping` | Health check | ✅ Tested |
| GET | `/health/version` | API version info | ✅ Tested |

---

## User Management (1/2 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/user/status` | Get user status and profile | ✅ Tested |
| DELETE | `/user/delete` | Delete user account | 💬 Commented out (destructive) |

---

## Authentication (0/2 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/auth/login` | Login with email/password | ⏭️ Not needed (using JWT directly) |
| POST | `/auth/refresh` | Refresh access token | ⏭️ Not needed (token valid) |

---

## API Key Management (1/4 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/auth/api-keys/` | List API keys | ✅ Tested |
| POST | `/auth/api-keys/` | Create new API key | 💬 Commented out (creates resource) |
| DELETE | `/auth/api-keys/{id}` | Delete/revoke API key | 💬 Commented out (destructive) |
| PATCH | `/auth/api-keys/{id}/toggle` | Toggle API key active status | 💬 Commented out (modifies state) |

---

## Billing & Credits (4/5 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/billing/credits` | Get credit balance | ✅ Tested |
| GET | `/billing/credits/details` | Get detailed credits info | ✅ Tested |
| GET | `/billing/history` | Get execution history | ✅ Tested |
| GET | `/billing/activities` | Get billing activities | ✅ Tested |
| POST | `/billing/checkout` | Create checkout session | 💬 Commented out (creates charge) |

---

## Storage (2/8 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/storage/list-files` | List files in storage | ✅ Tested |
| POST | `/storage/credentials` | Get S3 credentials | ✅ Tested |
| POST | `/storage/upload` | Upload single file | 💬 Commented out (uploads data) |
| POST | `/storage/upload-bulk` | Upload multiple files | 💬 Commented out (uploads data) |
| GET | `/storage/download/{key}` | Download file | ⏭️ Requires existing file |
| DELETE | `/storage/delete/{key}` | Delete file | 💬 Commented out (destructive) |
| DELETE | `/storage/delete-folder/{prefix}` | Delete folder | 💬 Commented out (destructive) |

---

## Active Workload Management (1/2 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/workloads/list` | List active executions | ✅ Tested |
| POST | `/workloads/abort/{id}` | Abort execution | 💬 Commented out (stops execution) |

---

## Python Execution (2/4 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/execution/streaming/start` | Start Python execution | ✅ Tested |
| GET | `/execution/streaming/{id}/status` | Get execution status | ✅ Tested |
| POST | `/execution/streaming/complete/{id}` | Mark execution complete | 💬 Commented out (client-only) |
| POST | `/execution/streaming/abort/{id}` | Abort execution | 💬 Commented out (stops execution) |

---

## Docker Execution (0/2 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/execution/image/start` | Start Docker execution | 💬 Commented out (consumes credits) |
| POST | `/execution/image/abort/{id}` | Abort Docker execution | 💬 Commented out (stops execution) |

---

## Past Execution Management (2/3 tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/execution/{id}` | Get execution details | ✅ Tested |
| GET | `/execution/{id}/timing` | Get execution timing | ✅ Tested |
| DELETE | `/execution/{id}` | Delete execution record | 💬 Commented out (destructive) |

---

## Deprecated/Internal Endpoints (Not tested)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/delete-user` | Legacy delete user endpoint | ⏭️ Deprecated |
| POST | `/create-checkout-session` | Legacy checkout endpoint | ⏭️ Deprecated |
| POST | `/webhook` | Stripe webhook (internal) | ⏭️ Internal use only |

---

## Test Execution Order

The script tests endpoints in this logical order:

1. **Health** - Verify API is operational
2. **User Management** - Get current user info
3. **Billing & Credits** - Check credits and history
4. **API Key Management** - List existing keys
5. **Storage** - List files and get credentials
6. **Active Workloads** - List running executions
7. **Code Execution** - Start new execution and check status
8. **Past Executions** - Query historical execution data

This order ensures:
- Non-destructive tests run first
- Credits are checked before running executions
- Execution IDs are captured for follow-up tests
- Past execution data is available for querying

---

## Adding More Tests

To test commented-out endpoints, uncomment the relevant sections in `test-endpoints.sh`. For example:

```bash
# Enable API key creation test
test_endpoint "POST" "/auth/api-keys/" "Create new API key" \
  '{"key_name": "Test Key from Script", "expires_at": null}'
```

**Warning**: Uncommenting destructive operations may:
- Delete data or resources
- Consume credits
- Create billing charges
- Remove access credentials

Always review the endpoint documentation before enabling tests.
