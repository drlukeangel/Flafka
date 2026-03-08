# Architecture

How the pieces fit together. Read this before making changes.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- A Confluent Cloud account with a Flink compute pool

### Running Locally

1. Copy the example environment file and fill in your Confluent Cloud credentials:

   ```bash
   cp .env.example .env
   ```

2. The **required** environment variables are:

   | Variable | Purpose |
   |----------|---------|
   | `VITE_ORG_ID` | Confluent Cloud organization ID |
   | `VITE_ENV_ID` | Confluent Cloud environment ID |
   | `VITE_COMPUTE_POOL_ID` | Flink compute pool ID (e.g., `lfcp-xxxxx`) |
   | `VITE_FLINK_API_KEY` | Flink SQL API key (Basic Auth username) |
   | `VITE_FLINK_API_SECRET` | Flink SQL API secret (Basic Auth password) |
   | `VITE_FLINK_CATALOG` | Default Flink catalog name |
   | `VITE_FLINK_DATABASE` | Default Flink database name |
   | `VITE_CLOUD_PROVIDER` | Cloud provider (`aws`, `gcp`, `azure`) |
   | `VITE_CLOUD_REGION` | Cloud region (e.g., `us-east-1`) |

   **Optional** variables enable additional panels:

   | Variable | Enables |
   |----------|---------|
   | `VITE_SCHEMA_REGISTRY_URL` + `_KEY` + `_SECRET` | Schema browser panel |
   | `VITE_KAFKA_REST_ENDPOINT` + `_API_KEY` + `_API_SECRET` + `VITE_KAFKA_CLUSTER_ID` | Topic management and stream cards |
   | `VITE_METRICS_KEY` + `_SECRET` | Compute pool telemetry dashboard and artifact management |
   | `VITE_KSQL_ENABLED=true` + `VITE_KSQL_ENDPOINT` + `_API_KEY` + `_API_SECRET` | ksqlDB dual-engine support |
   | `VITE_UNIQUE_ID` | Tags all created resources with your identifier for soft multi-tenancy |
   | `VITE_ADMIN_SECRET=FLAFKA` | Admin mode -- see all resources, not just yours |

   All environment variables are read in `src/config/environment.ts` via `import.meta.env`. Vite embeds them into the JavaScript bundle at build time -- they are **not** available at runtime.

3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

   The app opens at `http://localhost:5173`. The Vite dev server proxies all `/api/*` requests to Confluent Cloud to avoid CORS issues (configured in `vite.config.ts`).

### Building and Deploying with Docker

The production deployment uses nginx to serve the static build and reverse-proxy API requests. The build process is **two-step** because Vite bakes `VITE_*` variables into the JS bundle at build time, so the build must happen on the host where `.env` is available.

```bash
# 1. Build the static bundle (reads .env for VITE_* vars)
npm run build

# 2. Build the Docker image (copies dist/ and .env into the container)
docker build -t flafka .

# 3. Run the container
docker run -p 8080:80 flafka
```

How it works:
- `Dockerfile` copies `dist/`, `.env`, `nginx.conf` (template), and `docker-entrypoint.sh` into an nginx:alpine image.
- `docker-entrypoint.sh` reads `.env` at container startup, derives upstream API URLs (same logic as `vite.config.ts`), substitutes them into the nginx config template via `sed`, and starts nginx.
- `nginx.conf` mirrors the Vite proxy routes (`/api/flink/`, `/api/kafka/`, etc.) as `proxy_pass` blocks. It also provides the SPA fallback (`try_files $uri /index.html`) so that clean URL routing works.

### npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server with API proxies |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once (CI mode) |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:e2e:headed` | Playwright tests in headed browser |
| `npm run package` | Run `scripts/package.sh` (build + Docker) |

---

## Project Structure

```
src/
  api/                    # Axios HTTP clients and API wrappers
    confluent-client.ts   # Axios instances (confluentClient, fcpmClient, telemetryClient) with Basic Auth
    flink-api.ts          # Flink SQL API: executeSQL, getStatementStatus, getStatementResults, listStatements
    ksql-api.ts           # ksqlDB API: executeKsql, executeKsqlQuery (streaming), terminateQuery
    ksql-client.ts        # Axios instance for ksqlDB endpoint
    schema-registry-api.ts # Schema Registry: subjects, versions, compatibility
    topic-api.ts          # Kafka REST Proxy: topics, partitions, produce records
    artifact-api.ts       # UDF artifact management (upload, list, delete)
    telemetry-api.ts      # Confluent Cloud metrics (CFU, records in/out)

  store/
    workspaceStore.ts     # THE Zustand store -- all app state and actions (~3700 lines)
    learnStore.ts         # Separate Zustand store for Learn Center progress
    engines/
      types.ts            # SqlEngineAdapter interface
      flink-engine.ts     # Flink adapter implementation
      ksql-engine.ts      # ksqlDB adapter implementation
    useActiveTab.ts       # Helper hook for per-tab state access

  components/
    EditorCell/           # Monaco SQL editor cell (run, stop, collapse, results)
    ResultsTable/         # Virtual-scrolled data grid with sort, search, export
    StreamsPanel/         # Right-side panel with StreamCard components
    NavRail/              # Vertical icon rail (left sidebar)
    TabBar/               # Multi-tab workspace management
    TreeNavigator/        # Catalog > Database > Table tree browser
    SchemaPanel/          # Schema Registry browser
    TopicPanel/           # Kafka topic management
    ArtifactsPanel/       # UDF JAR upload and management
    SnippetsPanel/        # Saved SQL templates
    WorkspacesPanel/      # Workspace save/restore
    LearnPanel/           # Education center (tracks, examples, concepts)
    ExampleDetailView/    # Example detail page with inline docs
    JobsPage/             # Full-page Flink statement/job manager
    KsqlQueriesPage/      # Full-page ksqlDB persistent query manager
    ComputePoolDashboard/ # Compute pool status panel (header dropdown)
    KsqlDashboard/        # ksqlDB dashboard panel (header dropdown)
    HelpPanel/            # Searchable FAQ and shortcuts reference
    HistoryPanel/         # Past statement history with filters
    ScanModePanel/        # Consumer offset mode selector (earliest, latest, timestamp)
    SplitButton/          # Button with dropdown secondary actions
    ui/                   # Generic UI components (Toast, etc.)

  hooks/
    useRoute.ts           # URL <-> store sync (custom routing, no React Router)

  config/
    environment.ts        # All VITE_* env vars parsed into typed EnvironmentConfig

  services/
    example-runner.ts     # Template engine for Quick Start example cards
    example-helpers.ts    # Shared utilities for example setup (createTable, etc.)
    example-setup.ts      # Initial example card setup logic

  data/
    exampleCards.ts       # UI card definitions (49 example cards)
    examples/             # KickstarterExampleDef config objects per example
    learningTracks.ts     # 7 learning tracks with prerequisites and role filters
    badges.ts             # Achievement badges with condition functions
    challenges.ts         # Interactive challenges
    concepts/             # Concept lesson content files (9)
    helpTopics.ts         # Help panel content

  types/
    index.ts              # Core TypeScript types (SQLStatement, NavItem, TabState, etc.)
    learn.ts              # Learn Center types (LearnTab, LearningTrack, etc.)

  utils/                  # Pure utility functions (formatting, serialization, names)
  __tests__/              # Unit test files organized by module

  main.tsx                # Entry point -- popout route detection before App mounts
  App.tsx                 # Root layout shell (header, nav rail, side panel, main content)
  App.css                 # All app styles (CSS custom properties for theming)
  index.css               # Base styles and CSS reset
```

Root-level files:
```
vite.config.ts            # Vite config: React plugin, proxy routes, test config, path aliases
Dockerfile                # Single-stage nginx:alpine image (expects pre-built dist/)
nginx.conf                # Nginx reverse proxy template (${VARS} substituted at startup)
docker-entrypoint.sh      # Reads .env, substitutes nginx config vars, starts nginx
playwright.config.ts      # Playwright E2E test config
tsconfig.json             # TypeScript config
.env.example              # Template for environment variables
```

---

## State Management

### Single Zustand Store (`src/store/workspaceStore.ts`)

Nearly all application state lives in one Zustand store, exported as `useWorkspaceStore`. This file is ~3700 lines and contains the state interface, initial values, and all action implementations. It is the heart of the app.

**Why one store**: Zustand encourages colocation. Unlike Redux, there are no action creators or reducers -- actions are just methods on the store that call `set()`. A single store means any action can read and update any part of the state without cross-store coordination.

**How to read state in components**:
```typescript
// Subscribe to specific fields (triggers re-render only when these change)
const statements = useWorkspaceStore((s) => s.statements);
const addStatement = useWorkspaceStore((s) => s.addStatement);

// Read state outside React (in API callbacks, timers, etc.)
const current = useWorkspaceStore.getState();
```

### Per-Tab State Model

The workspace supports multiple tabs (up to 8). Each tab is a `TabState` object stored in `state.tabs[tabId]`. Switching tabs swaps the entire working context.

**TabState fields** (per-tab, independent):
- `statements[]` -- SQL cells with code, execution status, results, column definitions
- `workspaceName` -- editable tab label
- `streamCards[]` -- topic consume/produce cards for the Streams panel
- `backgroundStatements[]` -- server-side Flink statements powering stream cards
- `treeNodes[]`, `selectedNodeId` -- sidebar catalog tree
- `selectedTableSchema` -- columns for the selected table

**How the tab abstraction works**: The store has both `state.tabs[id].statements` (the actual data) and `state.statements` (a root-level mirror). A custom `set()` wrapper (`syncMirrors`) automatically keeps these in sync. When you write `state.statements`, you are reading from the active tab. When you call `setActiveTab({ statements: [...] })`, both the tab and the root mirror update. This backward-compatible pattern means most components can ignore tabs entirely and just read `state.statements`.

The internal tab helpers are:
- `getTab(tabId)` -- read a specific tab
- `activeTab()` -- shortcut for `getTab(activeTabId)`
- `setTab(tabId, updates)` -- update a specific tab
- `setActiveTab(updates)` -- update the active tab

**Global state** (shared across all tabs):
- `theme`, `activeNavItem`, `navExpanded`
- `computePoolPhase` / `cfu` / `maxCfu` (polled every 30s)
- `savedWorkspaces[]`, `snippets[]`, `schemaDatasets[]`
- `sessionProperties` (Flink SQL session config)
- `ksqlFeatureEnabled`
- `toasts[]`, notification queue

### Persistence (localStorage)

Zustand's `persist` middleware writes to localStorage under the key `flink-workspace`. A `partialize` function (at the bottom of `workspaceStore.ts`, around line 3469) controls exactly which fields survive a page reload.

**Persisted**: tabs (with statement code, status, labels, engine choice), theme, session properties, snippets, saved workspaces, schema datasets, user-launched statement registry, ksqlDB feature toggle, cache TTL.

**Not persisted** (reset on reload): compute pool status, statement history, schema registry data, topic list, artifacts, telemetry, all loading/error flags, toast queue, stream cards, background statements.

**Statement status on reload**: Statements that were RUNNING or PENDING are reset to IDLE -- except if a statement has a `statementName` (meaning it exists on the server). Those are kept as RUNNING, and after rehydration, `onRehydrateStorage` verifies their status with the Flink API and either resumes polling or updates to the terminal state.

**Version migrations**: The persist config has a `version` field (currently `4`) and a `migrate` function. When you add new persisted fields or change the shape of existing ones, you must:
1. Bump the version number
2. Add a migration case in the `migrate` function
3. Provide sensible defaults for the new field

Past migrations:
- v1 to v2: Wrapped flat workspace state into the `tabs` structure
- v2 to v3: Added `engine` field to statements (no data transform needed -- `undefined` means Flink)
- v3 to v4: Defaulted theme to dark, ksqlDB off by default

### Learn Store (`src/store/learnStore.ts`)

A separate, smaller Zustand store for the Education Center. Persisted independently under the key `flafka-learn-progress`.

**Why separate**: The Learn Center tracks progress (completed examples, lessons, tracks, badges) that has no relationship to workspace state. Keeping it isolated means resetting workspace state does not lose learning progress, and vice versa.

The store tracks:
- `learnTab` -- which sub-tab is active (examples, tracks)
- `selectedTrackId` / `selectedConceptId` -- current navigation state
- `progress` -- completed examples/lessons/tracks, earned badges, timestamps

Progress mutations (`markExampleComplete`, `markLessonComplete`) cascade: completing an example auto-marks any track lesson that references it, and completing all lessons in a track marks the track complete. Badge conditions are checked after every mutation.

---

## Routing

### Custom Pathname-Based Routing (not React Router)

The app uses `window.history.pushState` / `popstate` for routing. There is no React Router dependency. A single custom hook, `useRoute()` in `src/hooks/useRoute.ts`, provides bidirectional sync between the URL and the Zustand store.

```
URL <--> useRoute hook <--> Zustand store (activeNavItem + detail selections)
```

### How `useRoute` Works

Three `useEffect` hooks handle the lifecycle:

1. **On mount**: `parseRoute()` reads `window.location.pathname`, splits it into segments, and maps the first segment to a `NavItem`. If the URL is a deep link (e.g., `/topics/my-topic`), it dispatches the corresponding store action (`navigateToTopic`, `navigateToJobDetail`, etc.). If the URL is just `/`, it defers to whatever `activeNavItem` the store already has (from persistence).

2. **Store to URL**: When `activeNavItem` or detail selections change in the store, the effect builds the new URL path via `buildPath()` and calls `pushState`. A `suppressPopstate` ref prevents the next effect from reacting to this change (since `pushState` does not fire `popstate`).

3. **URL to store (popstate)**: When the user clicks browser back/forward, the `popstate` handler re-parses the URL and applies it to the store.

### URL Patterns

| URL | Store State |
|-----|-------------|
| `/` | `activeNavItem: 'workspace'` |
| `/jobs` | `activeNavItem: 'jobs'` |
| `/jobs/{statementName}` | Jobs page with detail panel for that statement |
| `/topics/{topicName}` | Topics panel with that topic selected |
| `/schemas/{subjectName}` | Schemas panel with that subject loaded |
| `/learn` | Learn page (examples tab) |
| `/learn/tracks/{trackId}` | Learn page with track detail open |
| `/learn/examples/{exampleId}` | Learn page with example detail open |
| `/ksql-queries/{queryId}` | ksqlDB queries page with detail panel |
| `/tree`, `/history`, `/settings`, etc. | Corresponding side panel open |

Sub-IDs are URL-encoded with `encodeURIComponent`. Extra path segments beyond the expected depth are silently ignored.

### Legacy Hash Support

Old URLs like `#/jobs/my-statement` are automatically upgraded to `/jobs/my-statement` via `replaceState` on page load. The `parseRoute()` function handles this before falling through to pathname parsing.

### Stream Card Popout Route

Stream cards can be opened in a separate browser window via `window.open('/stream-popout/{topicName}')`. This route is detected in `src/main.tsx` **before** `<App>` mounts:

```typescript
function Root() {
  const path = window.location.pathname;
  const match = path.match(/^\/stream-popout\/(.+)$/);
  if (match) {
    return <StreamCardPopout topicName={decodeURIComponent(match[1])} />;
  }
  return <App />;
}
```

This prevents `useRoute()` from firing and overwriting the URL. The popout renders a standalone `StreamCardPopout` component (in `src/components/StreamsPanel/StreamCardPopout.tsx`) that connects to the same Zustand store as the main window.

### SPA Fallback

Since the server receives the full pathname, it must return `index.html` for all non-file routes:
- **Vite dev server**: Automatic (default SPA behavior)
- **Production (nginx)**: `try_files $uri $uri/ /index.html` in `nginx.conf`

### Adding a New Deep Link

1. Add a branch in `applyRoute()` (in `useRoute.ts`) for `navItem === 'yourPanel' && subId`
2. Add a branch in the store-to-URL effect to extract the sub-ID from the relevant store selection
3. Wire it to a store navigation action that sets `activeNavItem` and loads the detail
4. Add the nav item string to `VALID_NAV_ITEMS` in `useRoute.ts`

---

## API Layer

### Vite Proxy (Development) vs Nginx Reverse Proxy (Production)

The browser cannot call Confluent Cloud APIs directly due to CORS. All API traffic goes through a reverse proxy.

**In development**, Vite's built-in proxy (configured in `vite.config.ts` under `server.proxy`) rewrites paths and forwards authorization headers:

| Dev Route | Target | Notes |
|-----------|--------|-------|
| `/api/flink` | `https://flink.{region}.{provider}.confluent.cloud` | Flink SQL API |
| `/api/fcpm` | `https://api.confluent.cloud/fcpm` | Cloud Management API |
| `/api/kafka` | `{VITE_KAFKA_REST_ENDPOINT}` | Kafka REST Proxy |
| `/api/schema-registry` | `{VITE_SCHEMA_REGISTRY_URL}` | Schema Registry |
| `/api/artifact` | `https://api.confluent.cloud/artifact` | Artifact management |
| `/api/ksql` | `{VITE_KSQL_ENDPOINT}` | ksqlDB cluster (strips origin/referer) |
| `/api/telemetry` | `https://api.telemetry.confluent.cloud` | Metrics API |
| `/api/s3-upload-proxy` | Custom Node middleware | Forwards uploads to S3 presigned URLs |

**In production**, `nginx.conf` provides identical routes via `proxy_pass` blocks. The `docker-entrypoint.sh` script reads `.env` at container startup and substitutes upstream URLs into the nginx config template.

### Authentication

All Confluent Cloud APIs use HTTP Basic Auth. The app creates separate Axios instances (in `src/api/confluent-client.ts`) with different credentials baked into the `Authorization` header at instance creation time:

| Client | Credentials | Purpose |
|--------|-------------|---------|
| `confluentClient` | `VITE_FLINK_API_KEY:SECRET` | Flink SQL API |
| `fcpmClient` | `VITE_METRICS_KEY:SECRET` | Cloud Management + Artifact API |
| `telemetryClient` | `VITE_METRICS_KEY:SECRET` | Telemetry metrics |
| `schemaRegistryClient` | `VITE_SCHEMA_REGISTRY_KEY:SECRET` | Schema Registry |
| `kafkaRestClient` | `VITE_KAFKA_API_KEY:SECRET` | Kafka REST Proxy |
| `ksqlClient` | `VITE_KSQL_API_KEY:SECRET` | ksqlDB |

**Error handling**: `handleApiError()` in `confluent-client.ts` normalizes Axios errors into a consistent `{ status, message, details }` shape. A retry interceptor automatically retries 502/503/504 errors up to 2 times with 1.5s/3s delays.

### Statement Execution Lifecycle (Flink)

The core flow for running a SQL statement:

1. **POST** `/sql/v1/organizations/{org}/environments/{env}/statements` with the SQL text, compute pool ID, and session properties. Returns immediately with a statement name and PENDING status.

2. **Poll** `GET /statements/{name}` with exponential backoff (100ms, 500ms, 1s, 5s, 30s). The statement progresses through phases: PENDING -> RUNNING -> COMPLETED (or FAILED/CANCELLED).

3. **Fetch results** `GET /statements/{name}/results` once RUNNING or COMPLETED. Results use cursor-based pagination: the response includes a `metadata.next` URL for the next page. On the first call, if no data is available yet, the API returns an empty page with a `next` cursor; `flink-api.ts` follows it once automatically.

4. For **streaming queries**, the statement stays in RUNNING indefinitely. Results accumulate via long-polling: each `getStatementResults(name, nextCursor)` call blocks until new rows are available or a timeout elapses. The store maintains a FIFO buffer capped at 5000 rows.

5. **Cancellation** is a DELETE to `/statements/{name}`. Returns 202 Accepted; the statement transitions to CANCELLED asynchronously.

This lifecycle is orchestrated in the `executeStatement(id)` action in `workspaceStore.ts`.

### ksqlDB API Differences

ksqlDB has a fundamentally different execution model from Flink. The `ksql-engine.ts` adapter classifies each SQL statement and routes it accordingly:

| Statement Type | Endpoint | Behavior |
|----------------|----------|----------|
| DDL (`CREATE`, `DROP`, `SHOW`, `DESCRIBE`) | `POST /ksql` | Synchronous -- returns immediately with results |
| `INSERT INTO...VALUES` | `POST /ksql` | Synchronous -- inserts a single row |
| Persistent query (`CREATE...AS SELECT`) | `POST /ksql` | Returns a query ID; runs indefinitely on the server |
| Pull query (`SELECT` without `EMIT CHANGES`) | `POST /query` | Synchronous -- returns all matching rows |
| Push query (`SELECT...EMIT CHANGES`) | `POST /query` | **Streaming** via `fetch()` + `ReadableStream` + `AbortController` (not Axios) |

Push queries are the main difference: the browser opens a streaming HTTP connection and reads newline-delimited JSON. Cancellation is done by calling `abort()` on the AbortController, which closes the connection. There is no server-side TERMINATE needed for push queries.

---

## SQL Engine Adapter Pattern

### `SqlEngineAdapter` Interface (`src/store/engines/types.ts`)

The workspaceStore is engine-agnostic. It calls adapter methods instead of importing `flinkApi` or `ksqlApi` directly. The interface has five methods:

```typescript
interface SqlEngineAdapter {
  execute(sql, name, props, { onStatus, abortSignal }): Promise<ExecuteResult>;
  getStatus(statementName): Promise<EngineStatus>;
  cancel(statementName, meta?): Promise<void>;
  buildProps(statement, globalProps): Record<string, string>;
  validateName(label): string | null;
}
```

### How Engines Are Swapped Per-Cell

Each SQL statement has an optional `engine` field (`'ksqldb' | undefined`). `undefined` means Flink (backward compatible with all persisted workspaces). The adapter lookup at the top of `workspaceStore.ts` is:

```typescript
const getAdapter = (engine?: SqlEngine): SqlEngineAdapter =>
  engine === 'ksqldb' ? ksqlEngine : flinkEngine;
```

When `executeStatement(id)` runs, it reads the statement's `engine` field and calls the corresponding adapter. The EditorCell component shows an engine dropdown (Flink / ksqlDB) when `VITE_KSQL_ENABLED=true` and the user has enabled the ksqlDB feature flag in Settings.

### Flink Adapter (`src/store/engines/flink-engine.ts`)

- `execute`: Deletes any existing statement with the same name (cleanup), then calls `flinkApi.executeSQL`. Returns `{ statementName, streaming: true }` -- all Flink statements use the polling loop.
- `getStatus`: Calls `flinkApi.getStatementStatus`, extracts columns from schema traits.
- `cancel`: Calls `flinkApi.cancelStatement` (HTTP DELETE).
- `buildProps`: Merges global session properties with scan mode settings (`sql.tables.scan.startup.mode`).
- `validateName`: Enforces Flink naming rules (lowercase, hyphens, max 72 chars).

### ksqlDB Adapter (`src/store/engines/ksql-engine.ts`)

- `execute`: Classifies the SQL (DDL/persistent/push/pull) and routes to the correct ksqlDB endpoint. Push queries set up a streaming connection; DDL returns results synchronously.
- `getStatus`: Runs `EXPLAIN {queryId}` to check persistent query state.
- `cancel`: For push queries, cancellation is handled by aborting the HTTP connection (the adapter is a no-op). For persistent queries, runs `TERMINATE {queryId}`.
- `buildProps`: Maps scan mode to `ksql.streams.auto.offset.reset`. Only passes through global properties prefixed with `ksql.`.
- `validateName`: Always returns null (ksqlDB does not require user-specified names).

---

## Component Patterns

### App Layout (`src/App.tsx`)

The main layout is a horizontal arrangement: **NavRail** | **Side Panel** | **Main Content** | **Streams Panel**.

```
+--------+------------------+--------------------+------------------+
| NavRail| Side Panel       | Main Content       | Streams Panel    |
| (icons)| (tree, schemas,  | (editor cells,     | (stream cards,   |
|        |  topics, etc.)   |  jobs page, learn) |  topic consumers)|
+--------+------------------+--------------------+------------------+
```

- The **NavRail** (`src/components/NavRail/NavRail.tsx`) is a vertical strip of icons on the far left. Clicking an icon sets `activeNavItem` in the store, which controls which side panel content is shown.
- The **Side Panel** renders conditionally based on `activeNavItem`. Some nav items (`workspace`, `jobs`, `ksql-queries`, `learn`) hide the side panel entirely and use the full main content area instead.
- The **Main Content** area shows either: editor cells (workspace), a full-page view (Jobs, Learn, ksqlDB Queries, Example Detail), or the empty workspace state.
- The **Streams Panel** is on the right side. It is always mounted (for state persistence) but visually hidden via CSS when `streamsPanelOpen` is false. Both side panels support drag-to-resize.

The header contains: logo, compute pool status badge (clickable to open the ComputePoolDashboard dropdown), optional ksqlDB badge, and workspace action buttons (Run All, Stop All, Delete All, Add Statement).

### EditorCell (`src/components/EditorCell/EditorCell.tsx`)

Each SQL statement in the workspace gets one EditorCell. It contains:

- A **Monaco Editor** instance configured for SQL syntax highlighting with Flink-specific keyword completions. The editor auto-resizes to fit content (no scrollbar for short queries). Table and column names from the sidebar tree are injected as autocomplete suggestions.
- A **status bar** showing execution state (IDLE, PENDING, RUNNING, COMPLETED, ERROR), duration, and row count.
- A **run/stop button** that triggers `executeStatement(id)` or `cancelStatement(id)`.
- An **engine dropdown** (Flink / ksqlDB) shown when ksqlDB is enabled.
- A **results table** (`ResultsTable`) that appears below the editor after execution completes.
- A **collapse toggle** to minimize cells that are not actively being edited.

**Module-level patterns to know about**:
- `editorRegistry` (`src/components/EditorCell/editorRegistry.ts`) tracks all mounted Monaco instances in a `Map<string, MonacoEditor>`. This enables keyboard navigation between cells (Ctrl+Alt+Up/Down) and insert-at-cursor from the schema panel.
- The SQL autocomplete `CompletionItemProvider` is registered at module level (not inside a component) to prevent duplicate providers accumulating during HMR.

### StreamCard (`src/components/StreamsPanel/StreamCard.tsx`)

Each stream card connects to one Kafka topic and can operate in two modes:

- **Consume** mode: Generates a `SELECT * FROM topic LIMIT N` statement, executes it as a "background statement" (a Flink SQL statement tracked separately from editor cells), and displays results in a table. Supports auto-refresh (periodic re-query) and scan mode selection (earliest/latest offset).

- **Produce-Consume** mode: In addition to consuming, produces synthetic records or records from a pre-defined dataset. Producing uses the Kafka REST Proxy directly (not Flink SQL). Supports burst mode and dataset looping.

**Background statements** are Flink SQL statements that power stream cards but are not visible in the editor. They are tracked in `tab.backgroundStatements[]` and have their own polling loop. Each card gets one background statement, keyed by `contextId` (same as `cardId`).

Key serialization detail: when producing to topics that use Schema Registry, the card fetches the key schema, serializes keys using Confluent's wire format (magic byte + 4-byte schema ID + Avro payload), and falls back to plain JSON if serialization fails.

---

## Data Flow

### Example Setup and Runner Pattern

The example system lets users launch pre-built Flink SQL tutorials with one click. The architecture has four layers:

1. **Example definitions** (`src/data/examples/*.ts`): Each file exports a `KickstarterExampleDef` config object that declares: which tables to create (by schema key), which datasets to generate, which SQL cells to inject, and which stream cards to open.

2. **Example cards** (`src/data/exampleCards.ts`): UI registration -- maps each example def to a card with title, description, difficulty, category, and tags. These are what users see in the Learn panel.

3. **Table schema registry** (`TABLE_SCHEMAS` in `src/services/example-runner.ts`): A `Record<string, DDLFactory | string>` where each key maps to either a DDL factory function (`(tableName) => CREATE TABLE ...`) or a string alias pointing to another key. This centralizes all table schemas.

4. **Data generators** (`DATA_GENERATORS` in `example-runner.ts`): A `Record<string, GeneratorFn>` where each key maps to a function that produces sample data rows. Generators live in `src/data/new-example-generators.ts` and `src/data/view-sample-generators.ts`.

**Runtime flow when a user clicks "Run Example":**
1. The runner resolves `{TABLE_NAME}` placeholders in SQL to `table-name-{uniqueId}` using the user's `VITE_UNIQUE_ID`.
2. Creates Kafka topics via the Kafka REST API.
3. Creates Flink tables using the DDL from `TABLE_SCHEMAS`.
4. Generates sample data using the registered generator and produces it to the topics.
5. Injects SQL cells into the workspace with the example's query.
6. Opens stream cards for topics that have `stream: 'produce-consume'` or `stream: 'consume'` in the example def.

**To add a new example**: Write a config file in `src/data/examples/`, register the card in `src/data/exampleCards.ts`, add any new table schemas to `TABLE_SCHEMAS`, and add data generators to `DATA_GENERATORS`. No changes to the runner itself are needed for standard examples.

---

## Testing

### Vitest for Unit Tests

Test files live in `src/__tests__/`, organized by module (e.g., `src/__tests__/api/`, `src/__tests__/store/`, `src/__tests__/components/`). Configuration is in `vite.config.ts` under the `test` key:

- Environment: `jsdom`
- Setup file: `src/test/setup.ts`
- Monaco Editor is mocked via an alias (`'monaco-editor'` -> `src/test/mocks/monaco-editor.ts`)
- Coverage: v8 provider, text + HTML reporters

### Playwright for E2E Tests

E2E tests live in `e2e/`. Config is in `playwright.config.ts`.

Run with:
```bash
npm run test:e2e           # headless
npm run test:e2e:headed    # with visible browser
```

### Common Mocking Patterns

**`vi.hoisted()` for mock factories**: Vitest hoists `vi.mock()` calls to the top of the file, which means they execute before any `import` statements. If your mock factory references a variable, that variable must also be hoisted:

```typescript
// CORRECT: variable is hoisted alongside the mock
const { mockExecuteSQL } = vi.hoisted(() => {
  const mockExecuteSQL = vi.fn();
  return { mockExecuteSQL };
});
vi.mock('../../api/flink-api', () => ({ executeSQL: mockExecuteSQL }));

// WRONG: variable is defined after hoisting, so it's undefined when the mock runs
const mockExecuteSQL = vi.fn();
vi.mock('../../api/flink-api', () => ({ executeSQL: mockExecuteSQL }));
```

This pattern is used extensively in `ksql-client.test.ts`, `ksql-api.test.ts`, `flink-engine.test.ts`, and `ksql-engine.test.ts`.

---

## Common Gotchas

### Chrome Caches Vite ES Modules Aggressively

Chrome's disk cache for localhost persists across: new tabs, new ports, `Cache-Control: no-store`, and Ctrl+Shift+R hard refresh. When you change code and the UI does not update:

- Use an **incognito window** for manual testing after code changes
- Use **Playwright headless** (no cache) for reliable validation
- Open Chrome DevTools -> Network tab -> check "Disable cache" (only works while DevTools is open)

### ESLint Auto-Fix Removes "Unused" Imports

If you add an import and save (with ESLint auto-fix enabled), ESLint may remove the import before you have written the code that uses it. **Write the usage code first** or add the import and usage in the same save operation.

### Zustand Persist Overrides Code Defaults

When you add a new field with a default value to the store, existing users who already have persisted state will **not** see your default. The persist middleware merges persisted state on top of code defaults. If you need the new default to take effect for existing users:

1. Bump the `version` number in the persist config
2. Add a migration case that sets the new field's value
3. The migration only runs once, when Zustand detects the version mismatch

Forgetting this is a common source of "works on my machine" bugs -- your fresh localStorage has the new default, but another developer (or your CI) has old persisted state that overrides it.

### Flink-to-ksqlDB Avro Key Incompatibility

Flink tables with `PRIMARY KEY` and `'changelog.mode' = 'upsert'` wrap key fields in an Avro record struct. ksqlDB's `STRING KEY` with `KEY_FORMAT='AVRO'` expects bare unwrapped strings, causing deserialization errors ("Cannot deserialize type struct as type string"). Fix: declare the key as `STRUCT<field_name TYPE> KEY` in ksqlDB and extract with the `->` operator.

### Confluent Cloud DDL Differences

Confluent Cloud Flink SQL is not standard Flink in some ways that will trip you up:
- **No `METADATA` columns** in CREATE TABLE DDL
- **No `'connector' = 'kafka'`** properties -- tables are Confluent-managed topics
- **No `'value.format' = 'json'`** -- format is determined by the producer, not DDL

### Statement Names Must Be Globally Unique

Flink statement names are unique within a compute pool. If you POST a statement with the same name as an existing one (even a completed/failed one), you get a 409 Conflict. The Flink engine adapter handles this by attempting to DELETE the old statement before creating a new one.

### Background Statements Are Per-Tab

Background statements (used by stream cards) are scoped to the active tab. If a user creates a stream card on Tab 1, switches to Tab 2, and the background statement completes, the result is written to Tab 1's state (not Tab 2's). The `executeBackgroundStatement` action captures the tab ID at execution start and uses it for all subsequent state updates, even if the active tab changes mid-execution.
