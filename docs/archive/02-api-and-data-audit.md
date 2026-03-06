# API & Data Flow Audit - Flink SQL Workspace

**Date:** 2026-02-28

---

## API Endpoints

All API calls defined in `src/api/flink-api.ts`. Base URL: `/sql/v1/organizations/{org}/environments/{env}/statements`

| Function | HTTP Method | URL Pattern | Purpose |
|---|---|---|---|
| `executeSQL` | POST | `.../statements` | Submit SQL statement |
| `getStatementStatus` | GET | `.../statements/{name}` | Check statement phase |
| `getStatementResults` | GET | `.../statements/{name}/results` (or cursor URL) | Fetch result rows |
| `cancelStatement` | DELETE | `.../statements/{name}` | Cancel/delete statement |
| `listStatements` | GET | `.../statements` | List all statements (UNUSED) |
| `getCatalogs` | POST+poll | Executes `SHOW CATALOGS` | Get catalog names |
| `getDatabases` | POST+poll | Executes `SHOW DATABASES IN ...` | Get database names |
| `getTables` | POST+poll | Executes `SHOW TABLES IN ...` | Get table names |
| `getViews` | POST+poll | Executes `SHOW VIEWS IN ...` | Get view names |
| `getFunctions` | POST+poll | Executes `SHOW USER FUNCTIONS IN ...` | Get function names |
| `getTableSchema` | POST+poll | Executes `DESCRIBE ...` | Get column definitions (UNUSED) |
| `pollForResults` | (helper) | Polls status then fetches results | Wait for bounded query completion |

## Authentication

- Basic Auth: `base64(apiKey:apiSecret)` set on Axios instance at creation in `confluent-client.ts` (lines 5-9)
- Vite dev proxy at `/api/flink` forwards to `https://flink.{region}.{provider}.confluent.cloud`
- Credentials from `VITE_FLINK_API_KEY` / `VITE_FLINK_API_SECRET` env vars

## State Management

Single Zustand store (`src/store/workspaceStore.ts`, 526 lines).

### State Fields
| Field | Type | Used By |
|---|---|---|
| `catalog` | string | App dropdowns, query building |
| `database` | string | App dropdowns, query building |
| `catalogs` | string[] | Catalog dropdown options |
| `databases` | string[] | Database dropdown options |
| `treeNodes` | TreeNode[] | TreeNavigator |
| `selectedNodeId` | string \| null | TreeNavigator |
| `treeLoading` | boolean | TreeNavigator loading state |
| `statements` | SQLStatement[] | EditorCell list |
| `activeStatementId` | string \| null | **UNUSED** - set but never read |
| `resultsFilter` | Filter[] | **UNUSED** - never set or read by components |
| `resultsSort` | SortConfig \| null | **UNUSED** - ResultsTable uses local state |
| `resultsSearch` | string | **UNUSED** - ResultsTable uses local state |
| `toasts` | Toast[] | Toast component |
| `isLoading` | boolean | **UNUSED** - always false |

### Actions (~20)
setCatalog, setDatabase, loadCatalogs, loadDatabases, loadTreeData, toggleTreeNode, selectTreeNode, loadTreeNodeChildren (STUB), addStatement, updateStatement, deleteStatement, duplicateStatement, toggleStatementCollapse, setActiveStatement, executeStatement, cancelStatement, setResultsFilter, setResultsSort, setResultsSearch, addToast, removeToast

## Data Flow: Execute Query

1. Component calls `executeStatement(id)`
2. Status → PENDING, error/results cleared
3. `flinkApi.executeSQL(code)` POSTs to Confluent
4. Status → RUNNING with server-assigned `statementName`
5. Recursive `poll()` (max 600 iterations, 10 min):
   - Check `getStatementStatus` for phase
   - If RUNNING or COMPLETED: fetch `getStatementResults` with cursor
   - Convert raw `row[]` to `Record<string, unknown>` using column names from `traits.schema`
   - Append to `allResults`, FIFO cap at 5000 rows
   - Update store on each batch
   - Follow `metadata.next` cursor for pagination
6. On COMPLETED with no next cursor: success toast
7. On error: ERROR status + error toast

## Polling Mechanism

Two distinct patterns:

1. **`pollForResults`** (flink-api.ts:249): Simple poll for SHOW/DESCRIBE queries. Max 60 attempts, 1s interval. Returns all rows at once.

2. **`executeStatement` inner `poll()`** (workspaceStore.ts:337): Streaming-aware poll. Max 600 attempts, 1s interval. Tracks `nextCursor`. FIFO buffer at 5000 rows.

- Cursor tracking: `metadata.next` URL from each response → next fetch URL
- Initial empty-result handling: auto-follows one redirect if first fetch returns empty with next URL

## Error Handling

- `handleApiError` in `confluent-client.ts:54`: normalizes Axios errors to `{status, message, details}`
- Axios interceptors log all requests/responses/errors to console
- Store catches in `executeStatement`, sets ERROR status, shows toast
- Tree/catalog loading: catches, falls back to env defaults, shows toast
- Cancel: optimistically sets CANCELLED locally, attempts server DELETE (ignores failures)

## Dependencies

| Package | Purpose | Status |
|---|---|---|
| `axios` | HTTP client | Active |
| `zustand` | State management | Active |
| `@monaco-editor/react` | SQL code editor | Active |
| `@tanstack/react-virtual` | Virtual scrolling | **UNUSED** |
| `react-icons` | Icon library | Active |
| `framer-motion` | Animations | **UNUSED** |
| `clsx` + `tailwind-merge` | CSS utilities | **UNUSED** |
| `tailwindcss` v4 | CSS framework | Imported but barely used |

## Environment Config

`src/config/environment.ts` reads 9 `VITE_*` env vars:

**Required:** `VITE_ORG_ID`, `VITE_ENV_ID`, `VITE_COMPUTE_POOL_ID`, `VITE_FLINK_API_KEY`, `VITE_FLINK_API_SECRET`

**Optional (with defaults):** `VITE_FLINK_CATALOG` ("default"), `VITE_FLINK_DATABASE` ("public"), `VITE_CLOUD_PROVIDER` ("aws"), `VITE_CLOUD_REGION` ("us-east-1")

## Known Issues

1. `loadTreeNodeChildren` is a no-op stub (workspaceStore.ts:226-228)
2. `listStatements` is never called (flink-api.ts:149)
3. `ComputePoolStatus` interface is unused (types/index.ts:67-72)
4. `Column` type duplicated in types/index.ts AND flink-api.ts
5. API credentials in `.env` plaintext (no `.env.example`)
6. Models and External Tables tree categories always empty
7. No error recovery for polling failures
8. No debouncing on tree reload (setCatalog/setDatabase trigger immediately)
9. `isLoading` state declared but never set
10. No TODO/FIXME comments in codebase
