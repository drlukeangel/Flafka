# Testing Guide

## Quick Start
- Run all tests: `npm test`
- Run specific tests: `npm test -- -t "@store" --run`
- Run with coverage: `npm run test:coverage`
- Open test UI: `npm run test:ui`

## Quick Reference

```bash
# Run tests in watch mode
npm test

# Run all tests once
npm run test:run

# Run only tests matching a marker
npm test -- -t "@store"              # store tests
npm test -- -t "@api"                # API tests
npm test -- -t "@phase-9"            # phase-9 tests
npm test -- -t "@store|@api" --run   # multiple markers, no watch
npm test -- -t "@ksql-api" --run     # ksqlDB API tests
npm test -- -t "@ksql-engine" --run  # ksqlDB engine adapter tests
npm test -- -t "@flink-engine" --run # Flink engine adapter tests

# Run tests marked as @changed (in-progress work)
npm test -- -t "@changed" --run

# Coverage report (outputs to coverage/ dir)
npm run test:coverage

# Interactive Vitest UI in browser
npm run test:ui
```

**Framework**: Vitest v4 (Vite-native) + React Testing Library + jsdom

---

## Test Organization

### File Structure

```
src/__tests__/
  api/
    flink-api.test.ts
    ksql-api.test.ts
    ksql-client.test.ts
  store/
    workspaceStore.test.ts
    engines/
      flink-engine.test.ts
      ksql-engine.test.ts
  components/
    ResultsTable.test.tsx
```

Convention: `src/__tests__/{feature}/{name}.test.ts(x)`

### Marker Pattern

Every `describe` block MUST include a marker tag for subset execution:

```typescript
describe('[@store] workspaceStore', () => {
  describe('[@store] addStatement', () => {
    it('should add a new statement', () => { ... })
  })
})

describe('[@phase-9-empty-state] OnboardingHint', () => {
  it('should show hint on first visit', () => { ... })
})
```

Markers enable QA to validate only changed code without running the full suite. This is a hard requirement -- all new code must have markers.

### Mocks

| Mock | Location | Purpose |
|------|----------|---------|
| Monaco Editor | `src/test/mocks/monaco.tsx` | Renders as textarea (Monaco needs canvas) |
| API responses | `src/test/mocks/api.ts` | Factories: `mockStatement()`, `mockResults()`, `mockStatementWithStatus(status)` |

### Global Setup

`src/test/setup.ts` handles:
- `@testing-library/jest-dom` matchers
- `localStorage` mock (reset before each test)
- `import.meta.env` stubs with test-safe values
- Automatic cleanup after each test

---

## Tier 1 vs Tier 2

Tests are split into two tiers to ship features fast while maintaining quality.

### Tier 1: Critical Path (BLOCKING)

- **What**: Happy path + critical error scenarios
- **Coverage target**: 40-50% of feature code
- **Pass rate**: 100% required before shipping
- **When**: Completed during Phase B (before acceptance)
- **Examples**: User creates resource (happy path), API returns 400 for invalid input, response matches expected schema

### Tier 2: Edge Cases & Robustness (NON-BLOCKING)

- **What**: Edge cases, boundary conditions, concurrency, performance
- **Coverage target**: Additional 30-40% (reaching 80%+ total)
- **Pass rate**: 100% required, but completed after shipping
- **When**: Completed in Track C (post-acceptance, async)
- **Examples**: 10,000-character input, 100 concurrent users, database timeout retry, unicode/special characters

### Non-Testable Items

Features that cannot be automated (temporal behavior, third-party integrations) are documented with manual test steps in the PRD. QA Manager reviews and includes them in the test report.

### Phase Summary

| Phase | Tier 1 | Tier 2 | Ship? |
|-------|--------|--------|-------|
| Phase B (Implement) | 100% pass | Stubs only | Yes -- Tier 1 validates feature works |
| Track C (Post-Ship) | 100% pass | 100% pass | Production-ready with full coverage |

### QA Gates

1. **A4 -- QA Manager Validation (BLOCKING)**: Tier 1 plan is clear and implementable. Tier 2 plan is documented.
2. **B8 -- Tier 1 Test Pass (BLOCKING)**: All Tier 1 tests pass 100%. Coverage >= 40%.
3. **B9 -- UX Sign-Off (BLOCKING)**: UX + Architect approve. Screenshots validated by QA Manager.
4. **C3 -- Tier 2 Completion (NON-BLOCKING)**: All Tier 2 tests pass. Total coverage >= 80%. If missed, logged as tech debt.

---

## Writing Tests

### New Feature Checklist

**Phase A (Design)**:
- PRD lists Tier 1 tests (happy path + critical errors)
- PRD lists Tier 2 tests (edge cases, rare scenarios)
- QA Manager approves both tiers

**Phase B (Implement)**:
- Implement all Tier 1 tests with proper markers
- Create Tier 2 stubs with TODO comments
- Run `npm test -- -t "@feature-name" --run` to confirm Tier 1 passes 100%

**Track C (Post-Ship)**:
- Replace Tier 2 stubs with real implementations
- Run full suite: Tier 1 + Tier 2 both at 100%
- Update test report in feature PRD

### Tier 2 Stubs

When creating stubs for deferred tests, use skip or TODO:

```typescript
describe('[@feature-name] edge cases', () => {
  it.todo('should handle 10,000 character input')
  it.todo('should handle concurrent requests')
  it.todo('should retry on network timeout')
})
```

### Testing Store Actions

```typescript
import { useWorkspaceStore } from '@/store/workspaceStore'

describe('[@store] actions', () => {
  it('should add statement', () => {
    const store = useWorkspaceStore.getState()
    store.addStatement('SELECT 1')
    const updated = useWorkspaceStore.getState()
    expect(updated.statements).toHaveLength(1)
  })
})
```

### Testing API Functions

```typescript
import { vi } from 'vitest'
import { confluentClient } from '@/api/confluent-client'
import { executeSQL } from '@/api/flink-api'

vi.mock('@/api/confluent-client')

describe('[@api] executeSQL', () => {
  it('should execute SQL', async () => {
    vi.mocked(confluentClient.post).mockResolvedValueOnce({
      data: { name: 'stmt-1', status: { phase: 'PENDING' } }
    })
    const result = await executeSQL('SELECT 1')
    expect(result.name).toBe('stmt-1')
  })
})
```

### Testing Components

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '@/components/MyComponent'

describe('[@component] MyComponent', () => {
  it('should render and respond to clicks', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Tests hang or timeout | Check for unresolved promises in mocks. Use `timeout` option on slow tests. |
| "Cannot find module" | Verify mock setup. Check path aliases in `vite.config.ts` match `tsconfig.json`. Clear `node_modules/.vite/`. |
| Component not rendering | Component may need Monaco or DOM-heavy lib. Add mock to `src/test/mocks/` and alias in config. |

---

## API Validation Checklist

This section is the QA gate reference for Phase B3. Use it for every feature that modifies or adds API calls.

### REST Compliance

**HTTP Methods**:
- GET retrieves data only (no side effects)
- POST creates new resources
- PUT/PATCH updates existing resources
- DELETE removes resources
- No mixed-use methods

**URL Structure**:
- Resource-based: `/api/{resource}` or `/api/{resource}/{id}`
- No action verbs in URLs (no `/api/getStatement`)
- Plural for collections (`/statements`), singular for instances (`/statements/{id}`)
- No trailing slashes

**Request/Response Format**:
- Content-Type: `application/json` (both directions)
- Request body is valid JSON with all required fields per Confluent API spec
- Optional fields omitted (not set to null/undefined)
- Response payload matches TypeScript interface

**Status Codes** (all non-2xx must be handled with user-facing messages):

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, state update |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource |
| 500 | Server Error | Server-side failure |
| 503 | Service Unavailable | Service down/overloaded |

**Idempotency**:
- GET: safe and idempotent
- POST: not idempotent (creates new resource each call)
- PUT/PATCH: idempotent
- DELETE: idempotent (deleting already-deleted resource returns 404, handled gracefully)

### API Contract Matching

**flink-api.ts Interface**:
- Function signature matches: parameter types, names, return type (`Promise<T>`)
- Request body structure matches documentation
- Response destructuring matches actual API shape
- Required fields declared in TypeScript interface; optional fields marked with `?`

**Confluent Flink SQL API**:
- Endpoint paths match [Confluent docs](https://docs.confluent.io/cloud/current/flink/)
- Request parameters match documented API (field names, types, defaults)
- Auth: `Authorization: Basic ${base64(key:secret)}`

**HTTP Client Usage**:
- `confluentClient` for Flink SQL API calls (base URL: `/api/flink`)
- `fcpmClient` for Cloud Management API calls
- Never use raw `fetch()` or direct axios instances
- Auth interceptor auto-adds headers

**Error Handling**:
- Error responses have consistent shape (`error.response.status`, `error.response.data.message`)
- Flink compilation errors (multi-line) parsed correctly
- Network errors (timeout, ECONNREFUSED) caught separately from HTTP errors
- All error paths logged with context (endpoint, payload, error details)
- User sees human-readable message, not raw API error

### Flink/Confluent Specifics

**Statement Execution Lifecycle**:

1. **Create**: POST `/statements` with `{ "spec": { "statement": "SELECT ..." } }`
   - Response includes `name` (ID), `spec`, `status`
2. **Poll**: GET `/statements/{id}` periodically (not tight loop)
   - Statuses: SUBMITTED, COMPILING, COMPILED, RUNNING, IDLE, COMPLETED, FAILED, CANCELLED
   - Stop polling on terminal status (COMPLETED, FAILED, CANCELLED)
3. **Results**: GET `/statements/{id}/results` with optional `cursor` parameter
   - Cursor pagination: cursor from previous response feeds next request
   - Empty results during RUNNING: show "No results yet" (not "No rows")
   - Max 5000 rows in FIFO buffer
   - Streaming uses cursor-based polling, not WebSocket

**Cancellation**:
- POST `/statements/{id}/cancel` with `stop_after_terminating_queries: true`
- `lastExecutedAt` updated on cancel (for duration display)
- 409 Conflict if already terminal (handle gracefully)
- Cancelled queries show "Stopped" status (not grouped with Failed)

**Catalog/Schema Operations**:
- GET `/catalogs` -- list available catalogs
- GET `/catalogs/{id}/databases` -- list databases in catalog
- GET `/catalogs/{id}/databases/{db}/tables` -- list tables in database
- GET `/catalogs/{id}/databases/{db}/tables/{table}` -- column definitions (name, type, nullable, description)

**Result Formatting**:
- Null values: distinguish empty string vs null vs undefined
- Large integers: preserve precision (no JS number loss for >2^53)
- Timestamps: parse to Date for display
- Binary/BLOB: base64 encoded

**Flink Error Scenarios**:
- Compilation errors: multi-line from `status.errorMessage`, may include line number and suggestion
- Permission errors: 403 for missing workspace access
- Timeout: long-running query exceeds limit, polling stops
- Transient network failures during polling: exponential backoff, keep retrying
- 409 Conflict: query already running in workspace
- 404: non-existent workspace ID

**Confluent Cloud Integration**:
- API credentials from `VITE_FLINK_API_KEY` and `VITE_FLINK_API_SECRET`
- Credentials never logged or sent to client
- Vite dev proxy: `/api/flink` forwards to Confluent Cloud (handles CORS)

### Required Test Cases per API Function

Every API function needs tests covering:

1. **Success path**: correct method, URL, payload, and response handling
2. **4xx errors**: 400 (invalid input), 401 (auth), 404 (not found)
3. **5xx errors**: 500 with retry logic
4. **Network failures**: timeout (ECONNABORTED), connection refused (ECONNREFUSED)
5. **Edge cases from PRD**: empty results, cursor pagination boundaries, streaming cancellation

All tests must use mock factories from `src/test/mocks/api.ts`. Never test against live API.

### Common Pitfalls

Avoid:
- Using raw `fetch()` instead of `confluentClient`
- Hardcoding API URLs (use functions in `flink-api.ts`)
- Logging sensitive data (API keys, auth headers)
- Assuming response properties exist without null-checks
- Missing error handling for network failures
- Mixing Flink SQL endpoints with Cloud Management endpoints

### QA API Sign-Off Template

```markdown
## QA API Validation Report

**Feature**: [Name]
**API Changes**: [Endpoints changed]
**Status**: PASS / FAIL

### REST Compliance
- [status] All checks passed (or list failures)

### API Contract
- [status] Matches flink-api.ts interface
- [status] Confluent API spec compliant

### API Tests
- [status] All tests marked with @api
- [status] `npm test -- -t "@api"` passes
- [status] Coverage: success paths, error paths, edge cases

### Findings
- [Critical/Major/Minor] Description (or "None")

**QA Sign-Off**: [Approved for next phase | Blocked - requires fixes]
```

---

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run a specific spec file
npx playwright test e2e/loan-scalar-extract.spec.ts
npx playwright test e2e/loan-udf-setups.spec.ts

# Run against Docker (skip dev server startup)
PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test
```

### Expected Runtimes

E2E tests exercise real Confluent Cloud infrastructure. Timing depends on whether UDF artifacts already exist.

| Spec | Test | First Run (fresh) | Subsequent Runs (artifact reuse) |
|------|------|-------------------|----------------------------------|
| `loan-scalar-extract.spec.ts` | Java UDF happy path | ~3 min | ~15s |
| `loan-udf-setups.spec.ts` | Part D: Aggregate (WeightedAvg) | ~3 min | ~15s |
| `loan-udf-setups.spec.ts` | Part E: Validation (LoanValidator) | ~3 min | ~15s |
| `loan-udf-setups.spec.ts` | Part F: PII Masking (PiiMask) | ~3 min | ~15s |
| `loan-udf-setups.spec.ts` | Part G: Async Enrichment (two JARs) | ~8 min | ~15s |

**Why so long on first run?**

After a JAR is uploaded to S3, Confluent Cloud processes it asynchronously (scan, compile, register). The `versions` field on the artifact doesn't populate until processing completes — typically 30–60 seconds per JAR. Our setup flow correctly waits for versions before generating `CREATE FUNCTION` SQL. The Confluent UI appears faster because it shows "uploaded" immediately without waiting for version availability.

On subsequent runs, existing artifacts are detected by `display_name` and reused — no upload or polling needed, so tests run in ~15 seconds.

### Timeouts

| Config | Value | Reason |
|--------|-------|--------|
| `playwright.config.ts` `timeout` | 300,000ms (5 min) | Budget for per-test Confluent API calls |
| Part G `test.setTimeout` | 540,000ms (9 min) | Part G uploads two fresh JARs if not cached |
| `waitForToast` D–F | 240,000ms | Single artifact upload + DDL + data gen |
| `waitForToast` G | 480,000ms | Two artifact uploads; credit-bureau-enrich processes slowly |

### Prerequisites

- All env vars in `.env` must be set (see `.env.example`)
- `VITE_METRICS_KEY` / `VITE_METRICS_SECRET` are required for artifact cleanup in `beforeAll`
- `VITE_KAFKA_API_KEY` / `VITE_KAFKA_API_SECRET` required for topic cleanup
- `VITE_FLINK_API_KEY` / `VITE_FLINK_API_SECRET` required for all SQL execution

### E2E File Structure

```
e2e/
  fixtures/
    app.fixture.ts       # appPage fixture, goToExamples, waitForToast helpers
  helpers/
    selectors.ts         # SEL constants (data-testid selectors)
    cleanup.ts           # cleanupAll() / cleanupPython() — API-level teardown
  loan-scalar-extract.spec.ts   # Part A: Java scalar UDF
  loan-udf-setups.spec.ts       # Parts D–G: Aggregate, Validation, PII, Enrichment
```

---

## Current Coverage

### What Is Tested

- **API functions**: 7 of 12 (58%) -- `executeSQL`, `getStatementStatus`, `getStatementResults`, `cancelStatement`, `listStatements`, and two others
- **Store**: Core actions well-covered (add/remove/update statements, workspace persistence)
- **Components**: ResultsTable, EditorCell, TreeNavigator have tests
- **Phases 0-9**: 95% marker coverage, core components excellent

### Known Gaps (from QA Audit)

| Area | Gap | Priority |
|------|-----|----------|
| Catalog operations | `getCatalogs`, `getDatabases`, `getTables` untested | High |
| Error paths | Only 20% covered -- need 4xx/5xx/network failure tests | High |
| `cancelStatement` | REST method may be incorrect (needs verification) | High |
| Phase 11 features | 8 test files missing markers | Medium |
| Error handling | Inconsistent patterns across API functions | Medium |

Full audit details: `docs/roadmap/QA-AUDIT-PHASE-0-9.md`
