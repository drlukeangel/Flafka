# ksqlDB Persistent Queries Management Page

## Context

The app needs a page to view and manage ksqlDB persistent queries (CREATE STREAM AS SELECT, CREATE TABLE AS SELECT, INSERT INTO...SELECT), analogous to the existing Flink Jobs page. The Confluent Cloud UI shows these with query ID, status, full SQL, source/sink topics, throughput metrics, and Terminate/Explain actions. We don't need to replicate the full Confluent UI — just a practical management page following the same pattern as our existing Flink Jobs page. Keep scope lean.

## What Confluent Cloud Shows (for reference)

Per persistent query: Query ID (CSAS_*, CTAS_*, INSERTQUERY_*), Status (RUNNING), full SQL, Source streams/tables, Sink topic, Throughput (msg/sec), Error rate, Terminate + Explain actions.

We'll skip metrics/throughput (requires Confluent telemetry API) and keep it simple.

## Existing Code to Reuse

| What | File | Notes |
|------|------|-------|
| Flink Jobs page pattern | `src/components/JobsPage/JobsPage.tsx` (57 lines) | Router: list ↔ detail |
| Jobs list | `src/components/JobsPage/JobsList.tsx` (464 lines) | Table, search, filters, bulk actions |
| Jobs detail | `src/components/JobsPage/JobsDetail.tsx` (290 lines) | Header, status, SQL, tabs, auto-refresh |
| Jobs CSS | `src/components/JobsPage/JobsPage.css` (645 lines) | **Import directly** — reuse `.jobs-*` classes |
| ksqlDB `listQueries()` | `src/api/ksql-api.ts:337` | `SHOW QUERIES` — returns `{id, queryString, sinks, queryType, state}` |
| ksqlDB `terminateQuery()` | `src/api/ksql-api.ts:329` | `TERMINATE {queryId}` |
| `isKsqlEnabled()` | `src/config/environment.ts:115` | Gate for conditional nav item |
| NavItem type | `src/types/index.ts:109` | Union type to extend |
| NavRail | `src/components/NavRail/NavRail.tsx:34` | `NAV_ITEMS` array |
| Route hook | `src/hooks/useRoute.ts` | `VALID_NAV_ITEMS`, `PANEL_TITLES`, `applyRoute()`, Store→URL sync |
| App routing | `src/App.tsx:532,783` | Side-panel exclusion + main content render |

## Implementation Plan

### Step 1: Types (`src/types/index.ts`)

- Add `'ksql-queries'` to the `NavItem` union (line 109)
- Add named type:
  ```ts
  export interface KsqlPersistentQuery {
    id: string;            // CSAS_*, CTAS_*, INSERTQUERY_*
    queryString: string;   // Full SQL
    sinks: string[];       // Output topics
    queryType: string;     // 'PERSISTENT'
    state: string;         // RUNNING | PAUSED | ERROR
  }
  ```

### Step 2: API (`src/api/ksql-api.ts`)

- Add `explainQuery(queryId)` — thin wrapper around `executeKsql('EXPLAIN ${queryId};')` for detail view
- The existing `listQueries()` and `terminateQuery()` are sufficient for the list view

### Step 3: Store (`src/store/workspaceStore.ts`)

Add to interface + initial state + implementations (NOT persisted):

**State:**
- `ksqlQueries: KsqlPersistentQuery[]`
- `ksqlQueriesLoading: boolean`
- `ksqlQueriesError: string | null`
- `selectedKsqlQueryId: string | null`

**Actions:**
- `loadKsqlQueries()` — calls `listQueries()`, extracts `.queries[]` from first response item
- `terminateKsqlQuery(queryId)` — optimistic update (remove from list), calls `terminateQuery()`, revert on error
- `navigateToKsqlQueryDetail(queryId)` — sets `activeNavItem: 'ksql-queries'` + `selectedKsqlQueryId`

### Step 4: Components — `src/components/KsqlQueriesPage/`

#### KsqlQueriesPage.tsx (~50 lines)
Mirror `JobsPage.tsx` exactly — router toggling between list and detail views. Load queries on mount.

#### KsqlQueriesList.tsx (~250 lines)
Simpler than JobsList. **Import `../JobsPage/JobsPage.css`** to reuse all styling.

**Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| (checkbox) | — | Multi-select for bulk terminate |
| Query ID | `query.id` | Mono font, clickable |
| Status | `query.state` | Colored dot (RUNNING=green, PAUSED=amber, ERROR=red) |
| Type | Parsed from ID prefix | CSAS / CTAS / INSERT |
| SQL | `query.queryString` | Truncated, mono font |
| Sink | `query.sinks[0]` | Output topic name |
| Actions | — | Terminate button |

**Features:**
- Search bar (by ID or SQL text)
- Status filter (RUNNING / PAUSED / ERROR)
- Refresh button + "loaded X ago" timestamp
- Bulk select + Terminate dropdown
- Empty state when no queries

**Skip:** Ownership filter, "mine" badge, Statement Type filter, region subtitle

#### KsqlQueryDetail.tsx (~180 lines)
Simpler than JobsDetail. No Settings tab.

**Layout:**
- Header: back button, query ID (mono h2), Terminate button (if RUNNING)
- Status bar: colored dot + label, query type
- Metadata grid: Sink(s), Query Type, State
- SQL panel: full `queryString` with line numbers (same styling as Jobs)
- "Load in Workspace" button: creates new ksqlDB cell with the SQL
- Auto-refresh: poll every 5s for RUNNING queries (re-fetch via `listQueries` or `explainQuery`)

### Step 5: Navigation (`src/components/NavRail/NavRail.tsx`)

Add conditional entry to `NAV_ITEMS` after `jobs`:
```ts
{ id: 'ksql-queries', icon: <FiList size={18} />, label: 'ksqlDB Queries', section: 'workspace' }
```
Filter from the array when `!isKsqlEnabled()`.

### Step 6: Routing

**`src/hooks/useRoute.ts`:**
- Add `'ksql-queries'` to `VALID_NAV_ITEMS` set (line 7)
- Add `'ksql-queries': 'ksqlDB Queries'` to `PANEL_TITLES` (line 13)
- Add `navigateToKsqlQueryDetail` to `applyRoute()` actions interface and handler (line 86 area)
- Add Store→URL sync for `selectedKsqlQueryId` (line 203 area)

**`src/App.tsx`:**
- Line 532: Add `&& activeNavItem !== 'ksql-queries'` to side-panel exclusion
- Line 783: Add `activeNavItem === 'ksql-queries' ? <KsqlQueriesPage /> :` before jobs check
- Import `KsqlQueriesPage` at top

### Step 7: Status Mapping

Reuse Jobs CSS status dot classes:
```
RUNNING → .status-running (green)
PAUSED  → .status-pending (amber)
ERROR   → .status-failed  (red)
```

## Key Differences from Flink Jobs

| Aspect | Flink Jobs | ksqlDB Queries |
|--------|-----------|----------------|
| Data source | Paginated `listStatements()` | Single `SHOW QUERIES` call |
| States | RUNNING/PENDING/COMPLETED/FAILED/CANCELLED | RUNNING/PAUSED/ERROR |
| Stop action | HTTP DELETE (cancel) | `TERMINATE` SQL command |
| Delete action | Separate delete | No delete — terminate only |
| Caching | TTL + light refresh | Not needed (fast call) |
| Multi-tenancy | `env.uniqueId` suffix | None |
| Detail tabs | Overview + Settings | Overview only |

## Scope Boundaries

**In scope:** List + detail views, search, status filter, bulk terminate, URL routing, conditional visibility, Load in Workspace button, auto-refresh.

**Out of scope:** Throughput metrics, error rate display, EXPLAIN topology visualization, Pause/Resume, sources column (needs EXPLAIN per query), separate store file, test files (Track C).

## Verification

1. Toggle `VITE_KSQL_ENABLED=true` → "ksqlDB Queries" nav item appears; `false` → hidden
2. Click nav item → list page loads, shows all persistent queries from `SHOW QUERIES`
3. Search by ID or SQL → filters correctly
4. Status filter → filters by RUNNING/PAUSED/ERROR
5. Click query row → detail view with full SQL, metadata, status
6. Click Terminate → query terminated, removed from list
7. Bulk select + Terminate → multiple queries terminated
8. URL deep linking: `/ksql-queries/CSAS_FOO_0` → opens detail for that query
9. Browser back/forward works correctly
10. "Load in Workspace" → creates ksqlDB cell with SQL in editor

---

## Track B: Stress Test Roadmap Items (Post-Acceptance, Async)

*Items expected from Flink Developer stress testing. These feed back into the next release cycle.*

| Priority | Item | Points | Notes |
|:---:|:---|:---:|:---|
| HIGH | Rapid query list refresh causes stale state if TERMINATE is in-flight | 3 | Race between optimistic removal and re-fetch adding query back |
| HIGH | Bulk terminate doesn't verify query still exists before TERMINATE call | 3 | Stale list + bulk action = errors on already-terminated queries |
| MED | No loading skeleton on initial KsqlQueriesList mount | 2 | Page looks broken until SHOW QUERIES returns |
| MED | SHOW QUERIES response time under load (50+ persistent queries) | 2 | Verify no UI hang — ksqlDB REST is synchronous |
| MED | Search filter doesn't debounce — rapid typing causes excessive re-renders | 2 | Add 200ms debounce like JobsList |
| MED | Status filter reset button missing or unclear | 1 | Follow same pattern as JobsList filter clear |
| LOW | Detail auto-refresh polling doesn't stop on component unmount | 2 | Missing cleanup in useEffect — stale writes |
| LOW | "Load in Workspace" button doesn't verify ksqlDB engine is still available | 1 | Edge case: ksqlDB disabled between page load and click |
| LOW | Keyboard navigation missing in query list table | 2 | Jobs page may not have this either — parity check |
| LOW | Query ID column doesn't truncate on narrow viewports | 1 | CSS overflow handling for long CSAS_* IDs |

**Estimated total: ~19 story points from Track B**

---

## Track C: Test Completion Roadmap Items (Post-Acceptance, Async)

*Test stubs and coverage targets for the Test Completion agent (Haiku).*

### Tier 1 Tests (Required before QA Gate — Phase 2.5)

| Test | File | Type | Notes |
|:---|:---|:---|:---|
| `loadKsqlQueries` fetches and populates store | `ksql-queries-store.test.ts` | Unit | Mock `listQueries()`, verify `ksqlQueries` state |
| `loadKsqlQueries` handles API error | `ksql-queries-store.test.ts` | Unit | Verify `ksqlQueriesError` set, loading cleared |
| `terminateKsqlQuery` optimistic removal | `ksql-queries-store.test.ts` | Unit | Query removed immediately, API called |
| `terminateKsqlQuery` reverts on API error | `ksql-queries-store.test.ts` | Unit | Query re-added to list on failure |
| `navigateToKsqlQueryDetail` sets nav + selection | `ksql-queries-store.test.ts` | Unit | `activeNavItem` and `selectedKsqlQueryId` set |
| `explainQuery` calls executeKsql correctly | `ksql-api.test.ts` | Unit | Verify SQL passed, response returned |
| KsqlQueriesPage renders list by default | `KsqlQueriesPage.test.tsx` | Component | No selectedId → list view |
| KsqlQueriesPage renders detail when selected | `KsqlQueriesPage.test.tsx` | Component | selectedId → detail view |
| KsqlQueriesList search filters by ID | `KsqlQueriesList.test.tsx` | Component | Type in search → filtered rows |
| KsqlQueriesList search filters by SQL | `KsqlQueriesList.test.tsx` | Component | SQL content match |
| KsqlQueriesList status filter works | `KsqlQueriesList.test.tsx` | Component | Filter by RUNNING, verify filtered |
| KsqlQueriesList bulk terminate | `KsqlQueriesList.test.tsx` | Component | Select multiple, terminate all |
| KsqlQueryDetail shows metadata + SQL | `KsqlQueryDetail.test.tsx` | Component | Query ID, status, SQL rendered |
| KsqlQueryDetail terminate button | `KsqlQueryDetail.test.tsx` | Component | Click terminate, verify callback |
| NavRail shows ksql-queries when enabled | `NavRail.test.tsx` | Component | `isKsqlEnabled()=true` → item visible |
| NavRail hides ksql-queries when disabled | `NavRail.test.tsx` | Component | `isKsqlEnabled()=false` → item hidden |

### Tier 2 Tests (Track C — Post-Acceptance, Async)

| Test | File | Type | Notes |
|:---|:---|:---|:---|
| URL deep link `/ksql-queries/CSAS_FOO` opens detail | `useRoute.test.ts` | Integration | Verify URL parsing + store sync |
| Browser back from detail returns to list | `useRoute.test.ts` | Integration | Popstate handler |
| Auto-refresh polls for RUNNING queries | `KsqlQueryDetail.test.tsx` | Component | setInterval fires, re-fetches |
| Auto-refresh stops on unmount | `KsqlQueryDetail.test.tsx` | Component | clearInterval on cleanup |
| Auto-refresh stops for non-RUNNING queries | `KsqlQueryDetail.test.tsx` | Component | ERROR/PAUSED don't poll |
| Empty state when no queries | `KsqlQueriesList.test.tsx` | Component | 0 queries → empty message |
| Loading state shows skeleton/spinner | `KsqlQueriesList.test.tsx` | Component | `ksqlQueriesLoading=true` → loading UI |
| Error state shows error banner | `KsqlQueriesList.test.tsx` | Component | `ksqlQueriesError` → banner |
| "Load in Workspace" creates ksqlDB cell | `KsqlQueryDetail.test.tsx` | Component | Verify addCell called with engine='ksql' |
| Concurrent terminate + refresh race | `ksql-queries-store.test.ts` | Unit | Terminate during re-fetch doesn't re-add |
| Query type derived from ID prefix | `KsqlQueriesList.test.tsx` | Unit | CSAS→CSAS, CTAS→CTAS, INSERTQUERY→INSERT |

**Coverage target: ≥80% for all new files after Track C completion**
