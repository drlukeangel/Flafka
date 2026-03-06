# Architecture

How the pieces fit together. Read this to understand the system before making changes.

---

## Data Flow

The core loop for executing SQL:

```
User types SQL in EditorCell
  -> Ctrl+Enter triggers executeStatement(id) in workspaceStore
  -> workspaceStore calls executeSQL() in flink-api.ts
  -> flink-api.ts sends POST /api/flink/sql/v1/statements via confluentClient (Axios)
  -> Vite dev proxy forwards to Confluent Cloud (rewrites path, forwards auth header)
  -> Confluent Cloud returns statement name + PENDING status
  -> workspaceStore polls GET /api/flink/sql/v1/statements/{name} with exponential backoff
  -> On COMPLETED: fetches results with cursor pagination
  -> Results rendered in ResultsTable (virtual scrolling for large datasets)
  -> On FAILED: error message displayed in expandable error panel
```

Streaming queries follow the same flow but poll indefinitely using cursor-based long-polling. Results accumulate in a FIFO buffer capped at 5000 rows.

---

## Proxy Layer

The browser cannot call Confluent Cloud APIs directly due to CORS restrictions. All API traffic goes through the Vite dev server proxy, which rewrites paths and forwards authorization headers.

| Dev Route | Target | Purpose |
|-----------|--------|---------|
| `/api/flink` | `https://flink.{region}.{provider}.confluent.cloud` | Flink SQL API (statements, results, catalogs) |
| `/api/fcpm` | `https://api.confluent.cloud/fcpm` | Cloud Management (compute pool status, CFU) |
| `/api/kafka` | `{VITE_KAFKA_REST_ENDPOINT}` | Kafka REST Proxy (topics, partitions, produce/consume) |
| `/api/schema-registry` | `{VITE_SCHEMA_REGISTRY_URL}` | Schema Registry (subjects, versions, compatibility) |
| `/api/artifact` | `https://api.confluent.cloud/artifact` | Artifact API (UDF JARs, presigned upload URLs) |
| `/api/telemetry` | `https://api.telemetry.confluent.cloud` | Telemetry API (CFU metrics, records in/out) |
| `/api/s3-upload-proxy` | Custom Node middleware | Server-side fetch to S3 presigned URLs (S3 rejects browser CORS) |

Each proxy entry is configured in `vite.config.ts` under `server.proxy`.

---

## State Management

The entire application state lives in a single Zustand store at `src/store/workspaceStore.ts`.

### Per-Tab State (TabState)

Each workspace tab is independent. Switching tabs swaps the entire working context:

- `statements[]` -- SQL cells with code, execution status, results, column definitions
- `workspaceName` -- tab label (editable inline)
- `streamCards[]` -- topic consume/produce cards for the Streams panel
- `backgroundStatements[]` -- streaming queries powering stream cards (not shown in editor)
- `treeNodes[]` -- sidebar tree (catalogs, databases, tables, views)
- `selectedNodeId` -- currently highlighted tree item

### Global State

Shared across all tabs:

- `theme` -- light or dark
- `activeNavItem` / `navExpanded` -- which panel is open, sidebar width
- `computePoolPhase` / `cfu` / `maxCfu` -- compute pool status (polled every 30s)
- `savedWorkspaces` -- up to 20 workspace snapshots
- `snippets` -- saved SQL templates
- `toasts` -- notification queue

### Persistence

Zustand's `persist` middleware writes to localStorage under the key `workspace-storage`. A `partialize` function controls exactly which fields are saved. Tabs, statements (code and status), saved workspaces, snippets, theme, and session properties survive page refresh. Runtime state like polling timers and in-flight API responses is excluded.

On reload, any statements in RUNNING or PENDING status are reset to IDLE since the polling loop no longer exists.

---

## Component Map

### Workspace (main content area)

| Component | File | Role |
|-----------|------|------|
| `EditorCell` | `src/components/EditorCell/EditorCell.tsx` | Monaco SQL editor with run/stop/collapse, status bar, results |
| `ResultsTable` | `src/components/ResultsTable/ResultsTable.tsx` | Virtual-scrolled data grid with sort, search, column toggle, cell copy |
| `TabBar` | `src/components/TabBar/TabBar.tsx` | Multi-tab management with drag reorder, workspace save, notes |
| `TreeNavigator` | `src/components/TreeNavigator/TreeNavigator.tsx` | Catalog > Database > Table tree with search and filter |

### Side Panels (switched via NavRail)

| Component | Nav Key | Role |
|-----------|---------|------|
| `SchemaPanel` | Schemas | Browse subjects, view/diff schema versions, register new schemas |
| `TopicPanel` | Topics | Create/delete topics, view partitions, edit configs |
| `ArtifactsPanel` | Artifacts | Upload UDF JARs, create functions, manage artifact versions |
| `StreamsPanel` | Streams | Monitor up to 5 Kafka topics with live message tables |
| `HistoryPanel` | History | Past statements with status filters (Completed, Failed, Running) |
| `SnippetsPanel` | Snippets | Save and load SQL templates |
| `WorkspacesPanel` | Workspaces | Save and restore workspace snapshots |
| `ExamplesPanel` | Examples | Guided SQL tutorials with sample data setup |
| `HelpPanel` | Help | Searchable FAQ, keyboard shortcuts, Flink SQL concepts |

### Infrastructure

| Component | Role |
|-----------|------|
| `NavRail` | Vertical icon rail on the left, switches between panels |
| `ComputePoolDashboard` | CFU metrics, running statements, telemetry charts |
| `JobsPage` | Full statement manager for all compute pool jobs |
| `Toast` | Notification system (success, error, warning, info) |

---

## API Clients

Five Axios clients handle all HTTP traffic. Each has an auth interceptor that adds the appropriate credentials.

| Client | File | Base URL | Auth |
|--------|------|----------|------|
| `confluentClient` | `src/api/confluent-client.ts` | `/api/flink` | Flink API key + secret (Basic Auth) |
| `fcpmClient` | `src/api/confluent-client.ts` | `/api/fcpm` | Metrics key + secret (Basic Auth) |
| `schemaRegistryClient` | `src/api/schema-registry-api.ts` | `/api/schema-registry` | Schema Registry key + secret (Basic Auth) |
| `kafkaRestClient` | `src/api/topic-api.ts` | `/api/kafka` | Kafka API key + secret (Basic Auth) |
| `artifactClient` | `src/api/artifact-api.ts` | `/api/artifact` | Metrics key + secret (Basic Auth) |

Never use raw `fetch()` or standalone Axios instances. Always go through one of these clients so auth headers and error handling are consistent.

---

## Key Design Decisions

**Why Zustand** -- Minimal boilerplate compared to Redux. No providers, no action creators, no reducers. State is accessed with a hook (`useWorkspaceStore`) or directly (`useWorkspaceStore.getState()`). The persist middleware gives free localStorage sync.

**Why Monaco Editor** -- It is the VS Code editor engine. Provides SQL syntax highlighting, autocomplete via `CompletionItemProvider`, multi-cursor editing, and familiar keybindings out of the box. The trade-off is bundle size (~2MB), but for a developer tool this is acceptable.

**Why virtual scrolling** -- Query results can return thousands of rows. Rendering all of them into the DOM causes visible lag. `@tanstack/react-virtual` keeps only ~30-50 rows in the DOM at any time using spacer `<tr>` elements (not CSS `translateY`, which breaks sticky headers in tables).

**Why CSS custom properties for theming** -- Toggling between light and dark mode sets a `data-theme` attribute on the root element. CSS variables swap instantly without re-rendering any React components. An inline script in `index.html` reads the theme from localStorage before React mounts to prevent a flash of the wrong theme.

---

## Module-Level Patterns

### Editor Registry

`src/components/EditorCell/editorRegistry.ts` exports a `Map<string, MonacoEditor>` that tracks all mounted editor instances, plus a `focusedEditorId` string tracking which editor last received focus.

This enables:
- **Keyboard navigation** (Ctrl+Alt+Up/Down) -- find the previous/next editor in the map and call `.focus()`.
- **Insert at cursor** -- double-clicking a column name in the schema panel writes to the last-focused editor via `editor.executeEdits()`.

The `focusedEditorId` is set on focus but never cleared on blur. This is intentional: when a user clicks a sidebar item, the editor blurs before the click handler fires. If we cleared on blur, the insert target would be lost.

### Monaco Autocomplete Disposable

The SQL autocomplete provider (`CompletionItemProvider`) is registered at module level, not inside a React component. A module-scoped `disposable` variable holds the registration. On HMR, the previous registration is disposed before creating a new one. This prevents duplicate suggestion lists that would otherwise accumulate with each hot reload.

### Statement Execution Lifecycle

The store's `executeStatement(id)` action:
1. Sets status to PENDING, captures `lastExecutedCode` for the draft indicator.
2. Calls `executeSQL()` which POSTs to `/sql/v1/statements`.
3. Starts a polling loop with exponential backoff (100ms, 500ms, 1s, 5s, 30s).
4. On terminal status (COMPLETED, FAILED, CANCELLED), stops polling and sets `lastExecutedAt` for duration display.
5. On COMPLETED, fetches results with cursor pagination and populates the `results` and `columns` arrays.
