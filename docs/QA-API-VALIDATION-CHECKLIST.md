# QA API Validation Checklist

**Purpose**: Reference guide for QA agents validating API calls during Phase B3.QA VALIDATE.
Use this checklist for every feature that modifies or adds API calls.

---

## REST Compliance Checklist

### HTTP Methods
- [ ] GET requests retrieve data only (no POST parameters, no side effects)
- [ ] POST requests create new resources (statement, workspace config, etc.)
- [ ] PUT/PATCH requests update existing resources (not used for creation)
- [ ] DELETE requests remove resources (not used for other operations)
- [ ] No mixed-use methods (e.g., GET for both retrieval and status polling)

### URL Structure
- [ ] URLs follow resource-based pattern: `/api/{resource}` or `/api/{resource}/{id}`
- [ ] No action verbs in URLs (e.g., `/api/getStatement`, `/api/createTable`) ❌
- [ ] No query parameters for filtering (use sub-resources: `/api/statements/{id}`)
- [ ] Consistent naming: plural for collections (`/statements`), singular for instances (`/statements/{id}`)
- [ ] Path parameters use curly braces: `/statements/{id}` (not `/statements/{id}` or `:id`)
- [ ] No trailing slashes in URLs

### Request/Response Format
- [ ] Request Content-Type: `application/json` (explicit header set)
- [ ] Request body is valid JSON (tested via `JSON.stringify` in mock)
- [ ] Request includes all required fields per Confluent API spec
- [ ] Optional fields are omitted (not set to null/undefined)
- [ ] Response Content-Type: `application/json`
- [ ] Response payload is valid JSON structure matching TypeScript interface

### Status Codes
- [ ] 200 OK: Successful GET, successful state update
- [ ] 201 Created: Successful resource creation (POST)
- [ ] 204 No Content: Successful deletion or no response body needed
- [ ] 400 Bad Request: Invalid input (malformed JSON, missing field, invalid value)
- [ ] 401 Unauthorized: Missing or invalid authentication
- [ ] 403 Forbidden: Authenticated but not authorized for resource
- [ ] 404 Not Found: Resource doesn't exist
- [ ] 409 Conflict: Resource conflict (e.g., duplicate statement name)
- [ ] 500 Server Error: Server-side failure
- [ ] 503 Service Unavailable: Service down or overloaded
- [ ] All non-2xx responses handled in try/catch with user-facing error message

### Idempotency & Safety
- [ ] GET requests are safe: no side effects, can be called multiple times
- [ ] GET requests are idempotent: same request always returns same result
- [ ] POST requests not idempotent (each call creates new resource) unless explicitly designed
- [ ] PUT/PATCH requests are idempotent: applying same update multiple times = same result
- [ ] DELETE requests are idempotent: deleting deleted resource returns 404 (handled gracefully)

---

## API Contract Matching Checklist

### Flink-API.ts Interface Match
- [ ] Function signature matches `src/api/flink-api.ts`:
  - Parameter types correct (string, number, object)
  - Parameter names match implementation
  - Return type matches (Promise<T> with correct T)
  - Async/await usage correct
- [ ] Request body structure matches function documentation
- [ ] Response destructuring matches actual API response shape
- [ ] All required fields in response are declared in TypeScript interface
- [ ] Optional fields marked as `?` in interface

### Confluent Flink SQL API Compliance
- [ ] Endpoint path matches Confluent documentation (https://docs.confluent.io/cloud/current/flink/)
- [ ] Request parameters match documented API (field names, types, defaults)
- [ ] Response properties match documented schema
- [ ] Authentication: Basic Auth header formatted correctly: `Authorization: Basic ${base64(key:secret)}`
- [ ] Workspace header included where required: `X-Confluent-Workspace-Id: {id}` (if applicable)

### Error Handling
- [ ] Error responses have consistent shape (status code accessible via `error.response.status`)
- [ ] Error message accessible via documented path (e.g., `error.response.data.message`)
- [ ] Compilation errors from Flink parsed correctly (multi-line error text handled)
- [ ] Network errors (timeout, ECONNREFUSED) caught separately from HTTP errors
- [ ] All error paths logged with context (endpoint, request payload, error details)
- [ ] User sees human-readable error message (not raw API error)

### HTTP Client Usage
- [ ] Uses `confluentClient` from `src/api/confluent-client.ts` (Flink SQL API)
- [ ] Uses `fcpmClient` from `src/api/confluent-client.ts` (Cloud Management API)
- [ ] Does NOT use raw `fetch()` or direct axios instance
- [ ] Client has auth interceptor configured (Basic Auth headers auto-added)
- [ ] Client has correct base URL (`/api/flink` for Flink, other for Cloud Mgmt)

---

## Flink/Confluent Specific Checkpoints

### Statement Execution Lifecycle
- [ ] Statement creation: POST `/statements` with SQL payload
  - Request body: `{ "spec": { "statement": "SELECT ..." } }`
  - Response includes: `name` (ID), `spec`, `status`
- [ ] Status polling: GET `/statements/{id}` to check execution status
  - Polled periodically (not in tight loop)
  - Handles statuses: `SUBMITTED`, `COMPILING`, `COMPILED`, `RUNNING`, `IDLE`, `COMPLETED`, `FAILED`, `CANCELLED`
  - Stops polling when status is terminal (COMPLETED, FAILED, CANCELLED)
- [ ] Result fetching: GET `/statements/{id}/results` with optional `cursor` parameter
  - Cursor pagination implemented (cursor from previous response → next page)
  - Handles empty results gracefully (status RUNNING but no data yet)
  - Respects max row limit (5000 rows in FIFO buffer per architecture)
  - Streaming results: cursor-based polling, not WebSocket

### Statement Streaming & Cancellation
- [ ] Streaming queries: Results fetched via cursor pagination (GET `/statements/{id}/results?cursor=...`)
- [ ] Cancellation: POST `/statements/{id}/cancel` with `stop_after_terminating_queries: true`
  - `lastExecutedAt` timestamp updated on cancel (for duration calculation)
  - Cancellation error handling: 409 Conflict if already terminal
  - Cancelled queries show "Stopped" status (not grouped with Failed)
- [ ] Long-running queries: Timeout handling after configurable duration
  - Configurable max execution time respected
  - User can cancel at any time

### Workspace & Catalog Operations
- [ ] Workspace queries require correct workspace ID in headers/path
- [ ] Catalog listing: GET `/catalogs` returns available catalogs
- [ ] Database listing: GET `/catalogs/{id}/databases` for given catalog
- [ ] Table listing: GET `/catalogs/{id}/databases/{db}/tables` for given database
- [ ] Table schema: GET `/catalogs/{id}/databases/{db}/tables/{table}` returns column definitions
  - Column info includes: name, type (STRING, INT, TIMESTAMP, etc.), nullable, description
  - Used for SQL autocomplete and schema panel display

### Result Formatting & Display
- [ ] Result rows are arrays/objects matching declared column types
- [ ] Null values handled correctly (empty string vs null vs undefined)
- [ ] Large integers preserved (no JS number precision loss for >2^53)
- [ ] Timestamp fields parsed to Date objects for display
- [ ] Binary/BLOB fields encoded as base64 strings
- [ ] Cursor boundary: Last row can be used as cursor for next page (`cursor: lastRowId`)

### Error Scenarios (Flink-Specific)
- [ ] Compilation errors: Multi-line error message from `status.errorMessage`
  - Error includes line number and suggestion if available
  - User shown full error text in error panel
- [ ] Permission errors: 403 Forbidden when user lacks workspace access
- [ ] Timeout errors: Long-running query exceeds timeout, poll stops
- [ ] Network errors: Polling continues on transient network failures (exponential backoff)
- [ ] Query already running: 409 Conflict if trying to run same workspace twice
- [ ] Invalid workspace: 404 Not Found for non-existent workspace ID

### Confluent Cloud Integration
- [ ] API key & secret from environment: `VITE_FLINK_API_KEY`, `VITE_FLINK_API_SECRET`
- [ ] Environment variables never logged or sent to client
- [ ] Proxy correctly forwards requests: Vite dev proxy `/api/flink` → `https://confluent.example.com/`
- [ ] CORS headers handled by Vite proxy (not frontend)
- [ ] Production build: API calls still work with proxy configuration

---

## API Testing Requirements

### Test File Structure
```
src/__tests__/{feature}/{api-function-name}.test.ts
```

Example: `src/__tests__/api/executeStatement.test.ts`

### Required Test Cases (per API function)

#### Success Path
```typescript
describe('[@api-execute-statement] executeStatement', () => {
  it('should POST /statements with correct payload', () => {
    // Mock: confluentClient.post returns { name: 'stmt-123', ... }
    // Action: executeStatement('SELECT * FROM table')
    // Assert: Request payload = { spec: { statement: '...' } }
    // Assert: Response includes name, status fields
  })
})
```

#### Error Path - 4xx Client Errors
```typescript
it('should handle 400 Bad Request (invalid SQL)', () => {
  // Mock: confluentClient.post returns 400 { error: 'Invalid SQL' }
  // Action: executeStatement('INVALID SQL HERE')
  // Assert: Error caught, message shown to user
})

it('should handle 401 Unauthorized', () => {
  // Mock: confluentClient.post returns 401
  // Assert: Error caught, user redirected to login/credential page
})

it('should handle 404 Not Found', () => {
  // Mock: GET /statements/{invalid-id} returns 404
  // Action: fetchStatementStatus('invalid-id')
  // Assert: Error handled gracefully (component shows "not found")
})
```

#### Error Path - 5xx Server Errors
```typescript
it('should handle 500 Server Error with retry logic', () => {
  // Mock: First call returns 500, second returns 200
  // Assert: Error caught, user option to retry
})
```

#### Network Failures
```typescript
it('should handle network timeout', () => {
  // Mock: axios throws { code: 'ECONNABORTED' }
  // Assert: Timeout error shown, polling stops
})

it('should handle connection refused', () => {
  // Mock: axios throws { code: 'ECONNREFUSED' }
  // Assert: Connection error shown
})
```

#### Edge Cases from PRD
```typescript
it('should handle empty result set (streaming query still running)', () => {
  // Mock: GET /statements/{id}/results returns { cursor: null, results: [] }
  // Assert: Component shows "No results yet" (not "No rows")
})

it('should handle cursor pagination at boundary', () => {
  // Mock: First call returns 5000 rows + cursor, second call returns remaining rows
  // Assert: Both pages loaded, total row count correct
})

it('should handle streaming query cancellation', () => {
  // Mock: POST /statements/{id}/cancel returns 200
  // Assert: Polling stops, status shows "Cancelled"
})
```

### Mock Responses
All tests must use mock factories from `src/test/mocks/api.ts`:
- `mockStatement()` - Returns mock statement object
- `mockResults()` - Returns mock result rows
- `mockStatementWithStatus(status)` - Returns statement with specific status
- See `src/test/mocks/api.ts` for available factories and customization

### Test Execution
```bash
# Run all API tests
npm test -- -t "@api"

# Run feature-specific API tests
npm test -- -t "@api-phase-10-sidebar"

# Run once (no watch)
npm test -- -t "@api" --run

# With coverage
npm run test:coverage
```

### Assertions Checklist
- [ ] Request method correct (GET, POST, PUT, DELETE)
- [ ] Request URL correct (with IDs/parameters)
- [ ] Request headers include auth (auto via interceptor)
- [ ] Request body structure matches interface
- [ ] Response properties accessible (destructuring works)
- [ ] Error response caught and accessible
- [ ] Error message shown to user (not raw API error)
- [ ] Edge cases handled without crashes

---

## Sign-Off Template

When QA validation is complete, include this in the QA report:

```markdown
## QA API Validation Report

**Feature**: [Feature name]
**API Changes**: [List endpoints changed]
**Status**: ✅ PASS / ❌ FAIL

### REST Compliance
- ✅ All checks passed (or list failures)

### API Contract
- ✅ Matches flink-api.ts interface
- ✅ Confluent API spec compliant

### API Tests
- ✅ All API tests marked with @api
- ✅ `npm test -- -t "@api"` passes (all tests green)
- ✅ Coverage: success paths, error paths, edge cases

### Findings
- [Critical] Issue 1
- [Major] Issue 2
- (or "None" if all clear)

**QA Sign-Off**: [Approved for next phase | Blocked - requires fixes]
```

---

## Common Pitfalls to Watch For

❌ **Don't**:
- Use raw `fetch()` instead of `confluentClient`
- Hardcode API URLs (use functions in `src/api/flink-api.ts`)
- Log sensitive data (API keys, auth headers, credentials)
- Assume response properties exist without null-checks
- Forget error handling for network failures
- Test against live API (use mocks only)
- Mix Flink SQL endpoints with Cloud Management endpoints

✅ **Do**:
- Use `confluentClient` for all Flink SQL requests
- Use factory functions from `src/test/mocks/api.ts`
- Implement error handling for all API calls
- Test success + all error paths + edge cases
- Add test markers to every new test
- Verify cursor pagination for streaming results
- Handle terminal states (COMPLETED, FAILED, CANCELLED) correctly

