# Flafka — Tech Stack & Architecture

> **For Junior Developers:** If you're new to the project, start with the root [README.md](../README.md) for setup, then read this file's [Architecture Layers](#architecture-layers) section for how the pieces fit together. This file is a deep reference — you don't need to read it all at once.

A browser-based SQL workspace for Confluent Cloud Flink. Write, execute, and iterate on Flink SQL queries with real-time results, schema browsing, topic management, and stream monitoring — all from a single tab.

---

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 19 | Component rendering |
| **Language** | TypeScript 5 | Type safety across the codebase |
| **Build** | Vite 6 | Dev server, HMR, proxy, production bundling |
| **State** | Zustand v5 + persist | Single store, per-tab state isolation, localStorage persistence |
| **Editor** | Monaco Editor | SQL editing with syntax highlighting, autocomplete, multi-cursor |
| **HTTP** | Axios | API clients with interceptors, retry, auth |
| **Virtual Scroll** | @tanstack/react-virtual v3 | Render 5,000+ result rows without DOM bloat |
| **Icons** | react-icons (Feather) | Consistent icon set |
| **Styling** | CSS custom properties | Theming (light/dark), per-component CSS files |
| **Testing** | Vitest + React Testing Library | Unit and integration tests with marker-based filtering |

No routing library — the app is a single workspace view with a nav rail and panel system.

---

## Architecture Layers

```
+------------------------------------------------------------------+
|                         Browser (React)                          |
|  +------------------+  +----------------+  +-----------------+  |
|  |   Monaco Editor  |  |  Results Table |  |  Side Panels    |  |
|  |   (SQL cells)    |  |  (virtual)     |  |  (tree, schema, |  |
|  |                  |  |                |  |   topics, etc)  |  |
|  +--------+---------+  +-------+--------+  +--------+--------+  |
|           |                    |                     |           |
|  +--------+--------------------+---------------------+--------+  |
|  |                    Zustand Store                           |  |
|  |  Tabs | Statements | Results | Schemas | Topics | Streams |  |
|  +----------------------------+-------------------------------+  |
|                               |                                  |
|  +----------------------------+-------------------------------+  |
|  |                   API Layer (Axios)                        |  |
|  |  confluentClient | fcpmClient | telemetryClient            |  |
|  |  schemaRegistryClient | kafkaRestClient | artifactClient   |  |
|  +----------------------------+-------------------------------+  |
|                               |                                  |
+-------------------------------+----------------------------------+
                                |
                    +-----------+-----------+
                    |    Vite Dev Proxy     |
                    |  /api/flink  -> ...   |
                    |  /api/fcpm   -> ...   |
                    |  /api/kafka  -> ...   |
                    |  /api/schema -> ...   |
                    |  /api/artifact -> ... |
                    |  /api/telemetry -> ...|
                    +-----------+-----------+
                                |
          +---------------------+----------------------+
          |                     |                      |
+---------+-------+  +----------+--------+  +----------+--------+
| Confluent Cloud |  | Schema Registry   |  | Kafka REST Proxy  |
| Flink SQL API   |  | (subjects,        |  | (topics, produce, |
| (statements,    |  |  versions,        |  |  partitions,      |
|  compute pools, |  |  compatibility)   |  |  offsets)          |
|  artifacts,     |  +-------------------+  +-------------------+
|  telemetry)     |
+-----------------+
```

---

## Confluent Cloud APIs

The app talks to 6 Confluent APIs, all proxied through Vite in dev to avoid CORS.

### 1. Flink SQL API (`sql/v1`)
The core API. Every SQL statement runs through this.

| Method | Route | What it does |
|--------|-------|-------------|
| `POST` | `/sql/v1/statements` | Execute a SQL statement |
| `GET` | `/sql/v1/statements/{name}` | Poll statement status |
| `GET` | `/sql/v1/statements/{name}/exceptions` | Get error details |
| `GET` | `/sql/v1/statements` | List all statements (history) |
| `DELETE` | `/sql/v1/statements/{name}` | Cancel a running statement |

**Execution lifecycle:**
```
POST /statements  →  poll GET /statements/{name}  →  GET results (cursor pagination)
     ↓                        ↓
  PENDING → RUNNING → COMPLETED / FAILED / CANCELLED
```

Polling uses exponential backoff: 100ms → 500ms → 1s → 5s → 30s.

### 2. Compute Pool Manager (`fcpm/v2`)

| Method | Route | What it does |
|--------|-------|-------------|
| `GET` | `/fcpm/v2/compute-pools/{id}` | Pool status, current/max CFU |

Polled every 30 seconds. Shows provisioning state and CFU capacity in the header badge.

### 3. Telemetry API (`v2/metrics/cloud`)

| Method | Route | What it does |
|--------|-------|-------------|
| `GET` | `/v2/metrics/cloud/descriptors/metrics` | Available metric types |
| `POST` | `/v2/metrics/cloud/query` | Query statement-level metrics |

**Metrics collected per statement:**
- CFU consumption
- Records in / out
- Pending records (backpressure indicator)
- State size (bytes)

Polled every 60 seconds when the compute pool dashboard is open.

### 4. Schema Registry

| Method | Route | What it does |
|--------|-------|-------------|
| `GET` | `/subjects` | List all schema subjects |
| `GET` | `/subjects/{name}/versions/{ver}` | Get schema definition |
| `GET` | `/subjects/{name}/versions` | List version history |
| `POST` | `/subjects/{name}/versions` | Register new schema |
| `POST` | `/compatibility/subjects/{name}/versions/{ver}` | Validate compatibility |
| `GET/PUT` | `/config/{name}` | Get/set compatibility level |
| `DELETE` | `/subjects/{name}` | Delete subject |
| `DELETE` | `/subjects/{name}/versions/{ver}` | Delete specific version |

Supports Avro, JSON Schema, and Protobuf.

### 5. Kafka REST Proxy

| Method | Route | What it does |
|--------|-------|-------------|
| `GET` | `/kafka/v3/clusters/{id}/topics` | List topics |
| `GET` | `/kafka/v3/clusters/{id}/topics/{name}/configs` | Topic configuration |
| `GET` | `/kafka/v3/clusters/{id}/topics/{name}/partitions` | Partition info |
| `POST` | `/kafka/v3/clusters/{id}/topics` | Create topic |
| `DELETE` | `/kafka/v3/clusters/{id}/topics/{name}` | Delete topic |
| `POST` | `/kafka/v3/clusters/{id}/topics/{name}/records` | Produce messages |

Used by the Streams panel for consume/produce and by Topic management.

### 6. Artifact API (`artifact/v1`)
Three-step upload process for Flink UDF JARs/ZIPs:

| Step | Method | Route | What it does |
|------|--------|-------|-------------|
| 1 | `POST` | `/artifact/v1/presigned-upload-url` | Get S3 presigned URL |
| 2 | `POST` | `{presigned S3 URL}` | Upload file to S3 (via Vite proxy to bypass CORS) |
| 3 | `POST` | `/artifact/v1/flink-artifacts` | Register artifact in Confluent |

Also:
| Method | Route | What it does |
|--------|-------|-------------|
| `GET` | `/artifact/v1/flink-artifacts` | List all artifacts |
| `GET` | `/artifact/v1/flink-artifacts/{id}` | Get artifact detail |
| `DELETE` | `/artifact/v1/flink-artifacts/{id}` | Delete artifact |

---

## State Management

Single Zustand store (~2300 lines) with two scopes:

### Global State
Shared across all tabs — things like schema lists, compute pool status, navigation.

```
catalogs, databases          — Flink metadata for dropdowns
computePoolPhase, CFU        — 30s polling
statementTelemetry           — 60s polling (dashboard)
schemaRegistrySubjects       — Schema Registry cache
topicList, selectedTopic     — Kafka topic browsing
theme                        — light / dark
activeNavItem, navExpanded   — Navigation state
savedWorkspaces              — Persisted workspace snapshots (max 20)
snippets                     — Saved SQL templates
toasts                       — Notification queue
```

### Per-Tab State (TabState)
Each tab is an independent workspace:

```
statements[]                 — SQL cells with code, status, results, columns
workspaceName                — Tab label
workspaceNotes               — Free-text notes
streamCards[]                — Topic consume/produce cards
backgroundStatements[]       — Streaming queries for stream cards
treeNodes[]                  — Sidebar tree (catalogs/databases/tables)
selectedNodeId               — Highlighted tree item
lastSavedAt                  — Last save timestamp
```

### Persistence
- **Middleware:** Zustand `persist` → localStorage
- **Key:** `workspace-storage`
- **Partialize:** Only serializable state (no functions, no runtime status)
- Tabs, statements, saved workspaces, snippets, theme, and session properties survive page refresh

---

## Vite Proxy Configuration

All API calls go through Vite's dev proxy to handle CORS and auth header forwarding:

| Dev Route | Target |
|-----------|--------|
| `/api/flink` | `https://flink.{region}.{provider}.confluent.cloud` |
| `/api/fcpm` | `https://api.confluent.cloud/fcpm` |
| `/api/telemetry` | `https://api.telemetry.confluent.cloud` |
| `/api/schema-registry` | `{VITE_SCHEMA_REGISTRY_URL}` |
| `/api/kafka` | `{VITE_KAFKA_REST_ENDPOINT}` |
| `/api/artifact` | `https://api.confluent.cloud/artifact` |
| `/api/s3-upload-proxy` | Custom Node middleware (server-side fetch to S3) |

The S3 upload proxy exists because presigned S3 URLs reject browser requests due to CORS. The proxy receives the file and forwards it server-side.

---

## Environment Variables

### Required
```env
VITE_ORG_ID=                    # Confluent organization ID
VITE_ENV_ID=                    # Confluent environment ID
VITE_COMPUTE_POOL_ID=           # Flink compute pool ID
VITE_FLINK_API_KEY=             # Flink SQL API key
VITE_FLINK_API_SECRET=          # Flink SQL API secret
VITE_FLINK_CATALOG=             # Default catalog name
VITE_FLINK_DATABASE=            # Default database name
```

### Optional
```env
VITE_CLOUD_PROVIDER=aws         # Cloud provider (default: aws)
VITE_CLOUD_REGION=us-east-1     # Region (default: us-east-1)

# Telemetry / Compute Pool Dashboard
VITE_METRICS_KEY=               # Service account API key
VITE_METRICS_SECRET=            # Service account API secret

# Schema Registry
VITE_SCHEMA_REGISTRY_URL=       # Schema Registry endpoint
VITE_SCHEMA_REGISTRY_KEY=       # Schema Registry API key
VITE_SCHEMA_REGISTRY_SECRET=    # Schema Registry API secret

# Kafka REST Proxy (topics, produce)
VITE_KAFKA_CLUSTER_ID=          # Kafka cluster ID
VITE_KAFKA_REST_ENDPOINT=       # Kafka REST Proxy URL
VITE_KAFKA_API_KEY=             # Kafka API key
VITE_KAFKA_API_SECRET=          # Kafka API secret
```

---

## Component Map

### Workspace
| Component | What it does |
|-----------|-------------|
| `EditorCell` | Monaco SQL editor with run/stop/collapse, status bar, results |
| `ResultsTable` | Virtual-scrolled data grid with sort, search, column toggle, cell copy |
| `TabBar` | Multi-tab management, workspace save/notes, drag reorder |
| `TreeNavigator` | Catalog > Database > Table/View/Function tree with search |

### Side Panels
| Component | Nav Item | What it does |
|-----------|----------|-------------|
| `SchemaPanel` | Schemas | Browse subjects, view/diff versions, register schemas |
| `TopicPanel` | Topics | Create/delete topics, view partitions, edit configs |
| `ArtifactsPanel` | Artifacts | Upload JARs/ZIPs, create functions, manage versions |
| `StreamsPanel` | Streams | Consume/produce to topics with stream cards (right panel) |
| `HistoryPanel` | History | Past statement list with status filters |
| `SnippetsPanel` | Snippets | Save/load SQL templates |
| `WorkspacesPanel` | Workspaces | Save/open workspace snapshots |
| `ExamplesPanel` | Examples | Guided SQL tutorials with sample data |
| `HelpPanel` | Help | Searchable FAQ and keyboard shortcuts |

### Infrastructure
| Component | What it does |
|-----------|-------------|
| `NavRail` | Vertical nav with sections (Workspace, Data, Tools, Settings) |
| `ComputePoolDashboard` | CFU metrics, running statements, telemetry |
| `JobsPage` | Full statement manager (all compute pool jobs) |
| `Toast` | Notification system (success/error/warning/info) |
| `SplitButton` | Run All / Stop All / Delete All with scoped options |

---

## Key Design Patterns

### Statement Execution
```
User types SQL → Ctrl+Enter → POST /statements → poll status (exp backoff)
  → COMPLETED: fetch results with cursor pagination, render in ResultsTable
  → FAILED: show error with expandable exception details
  → CANCELLED: mark as stopped, show duration
```

### Editor Registry
Module-level `Map<string, MonacoEditor>` tracks all mounted editors. Enables:
- Ctrl+Alt+Up/Down navigation between cells
- "Insert at cursor" from sidebar (schema columns, snippets)
- Singleton autocomplete provider (disposable pattern for HMR safety)

### Virtual Scrolling
ResultsTable uses spacer `<tr>` rows (not `translateY`) with `@tanstack/react-virtual`. Handles 5,000+ rows at 60fps with sort, search, and column visibility toggles.

### Dark Mode
CSS custom properties in `:root` (light) and `[data-theme="dark"]` (dark). Inline script in `index.html` reads localStorage before first paint to prevent flash of wrong theme.

### Workspace Persistence
Zustand's `persist` middleware with `partialize` controls what hits localStorage. Tabs, statements (code + status), saved workspaces, snippets, theme, and session properties all survive refresh. Runtime state (polling timers, API responses) does not persist.

---

## Development

```bash
npm install          # Install dependencies
npm run dev          # Dev server on :5173 with Confluent proxy
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest watch mode
npm test -- -t "@store" --run   # Run specific test marker
```

Tests use `describe('[@marker] ...')` convention for targeted execution. Markers: `@store`, `@api`, `@results-table`, `@tab-bar`, etc.
