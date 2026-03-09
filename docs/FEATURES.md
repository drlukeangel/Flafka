# Flafka -- Feature Reference

Complete list of shipped features. For architecture details, see [ARCHITECTURE.md](TECH-STACK.md). For how to add new features, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## SQL Editor

### Monaco Editor with Flink SQL Support
Each workspace cell embeds a Monaco Editor configured for SQL. Flink-specific keywords (TUMBLE, HOP, CUMULATE, MATCH_RECOGNIZE, WATERMARK, EXECUTE STATEMENT SET, etc.) are registered as autocomplete suggestions via a module-level `CompletionItemProvider`. Table and view names from the sidebar tree and column names from the last-clicked table schema are also suggested.

### Multi-Cell Workspace
The workspace supports an arbitrary number of SQL cells, each independently editable and executable. Cells can be added, deleted, duplicated, collapsed, labeled, and reordered via drag-and-drop. Each cell has its own status, results, scan mode, and optional engine selection.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Enter (Cmd+Enter) | Execute current cell |
| Escape | Cancel running statement |
| Ctrl+Alt+Up/Down | Navigate between cells |
| Shift+Alt+F | Format SQL |
| ? | Toggle help panel |
| Ctrl+S | Save workspace |

### Auto-Resize Editor Height
Editor cells dynamically resize between 80px and 400px based on content line count via Monaco's `onDidContentSizeChange` event.

### SQL Formatter
Formats SQL via Shift+Alt+F or toolbar button. Uppercases keywords, inserts newlines before major clauses, normalizes whitespace, and preserves string literals, comments, and backtick identifiers. Uses `editor.executeEdits()` to preserve undo history.

### Insert at Cursor from Sidebar
Double-clicking a column name in the schema panel inserts it at the cursor position in the last-focused editor via a shared `editorRegistry.ts` module. Single-click copies to clipboard.

### Scan Mode Selector (per-cell)
Each cell has a scan mode dropdown controlling where Flink reads from:

| Mode | Description |
|---|---|
| Earliest | Read from beginning of topic |
| Latest | Read from end (latest offset) |
| Group | Resume from consumer group offsets |
| Timestamp | Read from a specific timestamp (millis) |
| Specific Offsets | Read from explicit partition:offset pairs |

ksqlDB cells are filtered to earliest/latest only (mapped to `auto.offset.reset`).

### Engine Selector (per-cell)
When ksqlDB is enabled, a compact dropdown in each cell header lets users choose between Flink SQL and ksqlDB execution engines. Switching engines clears results and resets to IDLE. New cells inherit the engine from the preceding cell. ksqlDB cells show a purple left border and an engine badge when collapsed.

### Draft Indicator Badge
An amber "Modified" pill appears in the cell header when the current code differs from `lastExecutedCode`. Disappears after re-execution or when code matches the last-run version.

### Statement Labels
Each cell can have an optional user-defined label (max 50 chars) displayed in the header. Labels are edited inline with Enter/Escape/blur semantics. When collapsed, the label replaces the SQL preview.

### Smart Collapse Preview
Collapsed cells show a one-line summary: the first non-blank, non-comment SQL line (truncated to 60 chars), an inline status badge, and a row count suffix.

### Drag-to-Reorder Cells
A grip handle on each cell header enables HTML5 drag-and-drop reordering. Drop position is determined by comparing mouse Y against the cell midpoint.

### Cell Hover Actions
Copy, delete, and add-cell buttons are hidden by default and fade in on cell hover or focus-within (150ms). Run button and collapse chevron remain always visible. Touch devices get always-visible actions via `@media (hover: none)`.

---

## Results Table

### Virtual Scrolling
Large result sets (up to 5,000 rows) are virtualized using `@tanstack/react-virtual` v3. Only ~30-50 rows exist in the DOM at any time. Streaming results auto-scroll to bottom when pinned there.

### Cell Click-to-Copy
Clicking any cell copies its full raw value to the clipboard with a green flash animation and success toast. Null/undefined copies as `"null"`, objects as `JSON.stringify()`.

### Column Visibility Toggle
A "Columns" dropdown shows checkboxes for each column. Includes "Show All" and "Hide All" bulk actions.

### Row Index Column
A frozen "#" column displays 1-based original row indices. Indices remain stable through sorting/filtering via a precomputed `originalIndexMap`.

### JSON Cell Expander
Object/array cells show a small expand chevron. Clicking opens a portal pane with pretty-printed JSON and a "Copy JSON" button. Supports close-on-scroll, Escape, and click-outside.

### Copy to Clipboard (Dropdown)
A "Copy" dropdown in the ResultsTable toolbar offers three clipboard formats:
- **Copy as Markdown** — markdown table with `#` row index column; truncated at 100 rows with a footer
- **Copy as JSON** — pretty-printed JSON array of visible column data
- **Copy as CSV** — comma-separated values with headers

All copy operations respect current column visibility, sorting, and search filtering. Success/error feedback via toast notification.

### Custom Export Filenames
File exports use `{prefix}-{YYYYMMDD}-{HHmmss}.{ext}` where ext is `csv`, `json`, or `md`. When a statement has a label, it becomes the filename prefix. The Export dropdown supports CSV, JSON, and Markdown file downloads.

---

## Statement Execution

### Status Bar
Appears below each editor after first execution. Shows start time, colored status dot (green=COMPLETED/RUNNING, yellow=PENDING, red=ERROR, gray=IDLE/CANCELLED), and server-assigned statement name.

### Finish Timestamp & Duration
Terminal states show finish time and formatted duration (e.g., "2.3s", "1m 30.5s").

### Error Display & Retry
Clicking the error badge toggles an expandable panel with the full error message, statement name, and start time. A "Retry" button re-executes the statement.

### Run All / Stop All / Delete All (Split Buttons)
Header split buttons allow separate or combined control of queries and streams:
- **Run All** — runs all eligible statements + starts all stream cards
- **Stop All** — cancels all running statements + stops all stream cards
- **Delete All** — clears all statements + removes all stream cards

### Statement History Panel
A clock icon opens a panel listing up to 50 server-side statements. Each entry shows status badge, statement name, and SQL preview (80 chars). Includes filter tabs (All, Completed, Failed, Running) with count badges and relative timestamps.

---

## Streams Panel

### Stream Cards
A right-side panel (toggled via FiActivity icon) for monitoring Kafka topics in real time. Each topic gets a stream card with:
- **Consume mode**: play/stop, earliest/latest offset selector, fetch, clear, live auto-refresh
- **Produce mode**: synthetic data or dataset source, burst/loop options, progress counter
- **Results bar**: collapsible results with row count, column visibility toggle, and export dropdown

### Pop-Out to New Window
Each stream card's three-dot menu includes "Pop Out" which opens the card in a standalone browser window via `window.open()` at `/stream-popout/{topicName}`.

### Synthetic Data Producer
Generates records at 1 message/second. Parses Avro and JSON Schema definitions from Schema Registry, applies field-name heuristics (id->UUID, name->fake name, email->fake email), and supports all Avro types including unions, nested records, enums, arrays, and maps.

### Dataset Producer
Uses pre-defined datasets (uploaded in Schema Registry panel) to produce real records to topics. Supports burst mode (all at once) and loop mode (continuous replay).

### Column Visibility, Copy & Export
Cards support column show/hide with Show All / Hide All. Three toolbar icon buttons (Columns, Copy, Export):
- **Copy** (clipboard icon) — dropdown with Copy as Markdown, Copy as JSON, Copy as CSV (all clipboard)
- **Export** (download icon) — dropdown with Export as CSV, Export as JSON, Export as Markdown (all file downloads)

### Card Controls
- Collapse/expand with message count badge and pulsing LIVE indicator when collapsed
- Duplicate, View Topic, View Schema, Remove via three-dot menu
- Navigation icons (FiRadio for Topics, FiFileText for Schemas) next to Live button

### Background Statements
Stream monitoring uses a separate `backgroundStatements` array (not mixed with workspace statements). Named with `bg-` prefix, max 1 per card, auto-cancelled on panel close or card removal.

### Panel Resize
Both side panel and streams panel support drag-to-resize via handles. Side panel: 200-800px. Streams panel: 280-900px.

---

## Topic Management

### Topic List
Browse all Kafka topics with partition count and replication factor. Features:
- Debounced search (300ms)
- Keyboard navigation with virtual scrolling (`@tanstack/react-virtual`)
- Composite health score dots (green/yellow/red) per topic based on partition count and replication factor
- Create Topic button with modal dialog (name, partitions, RF, cleanup policy, retention)
- Focus restore on back-navigation

### Topic Detail
Full detail view for a selected topic with:
- Metadata rows: topic name (copy + insert at cursor), partitions, replication factor, internal flag
- Configuration table: lazily loaded via Kafka REST API
  - `retention.ms` pinned to top with human-readable label
  - `cleanup.policy` pinned second with badge
  - Inline config editing with hover-revealed pencil icon for writable configs
  - Client-side validation for numeric config keys
  - Read-only configs show lock icon; sensitive values masked
- Schema association section: cross-links to Schema Registry subjects
- Collapsible partition breakdown table
- Delete with name-confirmation safety gate

### Bulk Delete
Multi-select mode with checkboxes, select-all, and bulk delete action bar with confirmation dialog.

### Config Audit Log
Session-only audit log of configuration changes per topic (not persisted).

---

## Schema Registry

### Schema List
Browse all schema subjects with search, schema type badges (AVRO, PROTOBUF, JSON), and compatibility level indicators. Virtual scrolling for large registries.

### Schema Detail
Full detail view per subject with:
- Schema type badge + schema ID
- Version selector (all versions fetched on mount)
- Compatibility mode display (with inherited/global indicator)
- Code view: formatted JSON in monospace
- Tree view: visual schema tree (Avro schemas)
- Copy schema as JSON
- Generate SELECT statement from Avro fields

### Schema Evolution (Evolve)
Edit mode with:
- Textarea pre-filled with current schema JSON
- "Validate" calls `validateCompatibility` API
- "Save" (disabled until validated) calls `registerSchema`

### Schema Diff
Compare any two schema versions side by side. Diff mode with version selector loads the comparison schema and highlights differences.

### Schema Datasets
Test dataset management per schema subject:
- Upload JSON or JSONL files (max 500 records)
- Generate synthetic datasets from schema definition
- Edit datasets inline (JSON editor)
- Download datasets
- Use datasets as data source in Stream Card producers

### Schema Delete
Delete with confirmation overlay and warning text.

### Cross-Panel Navigation
- Topic detail links to associated schema subjects
- Schema panel navigates to datasets view from stream cards

---

## Artifacts (UDFs)

### Artifacts Panel
Browse, upload, and delete Flink JAR artifacts (UDFs) deployed to Confluent Cloud:
- Generate ready-to-use `CREATE FUNCTION ... USING JAR 'confluent-artifact://...'` statement
- Version dropdown for multi-version artifacts
- 3-step upload flow: presigned URL request, JAR upload with progress bar, artifact record creation
- Delete with name-confirmation gate
- Requires Cloud API keys (shows setup instructions if missing)

### Platform Example Artifacts
Quick Start example UDFs use stable, session-independent names prefixed with `platform-examples-` (e.g., `platform-examples-flink-kickstarter`). These artifacts:
- Are always visible in the panel regardless of which session uploaded them
- Show a **Platform** badge (lock icon) in the list
- Cannot be deleted from the UI ("Platform examples are managed by Flafka and cannot be deleted.")

### User Upload Session Tagging
Artifacts uploaded via the Upload modal automatically receive the session tag as a suffix on the display name (e.g., `My UDF-f696969`). This ensures:
- Per-session artifact filtering works reliably
- Artifacts are traceable to the user/session that uploaded them
- No collision with platform artifacts or other sessions' uploads

See [how-to/udf-upload.md](how-to/udf-upload.md) for a complete walkthrough.

---

## Compute Pool Dashboard

### Header Badge
A colored dot and status text in the header show the compute pool's current state and CFU count. Polls the FCPM API every 30 seconds.

| Status | Color |
|---|---|
| RUNNING / PROVISIONED | Green |
| PROVISIONING | Yellow |
| DELETING / Error | Red |
| Loading | Gray |

### Dashboard Panel
Push-down panel (toggled via header badge) showing:
- All running Flink statements with real-time telemetry metrics (CFU usage, Records In/Out, Pending Records, State Size)
- Per-statement Stop buttons and drill-through to Jobs detail
- Auto-refresh every 60 seconds, manual refresh button
- Resizable panel height via drag handle
- Accessible: `aria-expanded`, focus management, Escape to close

---

## ksqlDB Integration

### Dual-Engine Architecture
Each SQL cell independently chooses Flink or ksqlDB via a per-cell engine dropdown. The `SqlEngineAdapter` interface abstracts execution across engines with implementations in `flink-engine.ts` and `ksql-engine.ts`.

### ksqlDB Feature Toggle

| Control | Description |
|---|---|
| `VITE_KSQL_ENABLED=true` | Master switch (env var) |
| Settings panel checkbox | Runtime toggle (persisted) |
| `isKsqlConfigured()` | Checks endpoint + key + secret are set |

### ksqlDB SQL Classification
`classifyKsqlStatement()` routes statements to the correct API path:
- DDL (CREATE/DROP/ALTER) and persistent queries (CSAS/CTAS/INSERT INTO)
- Push queries via `fetch()` + `ReadableStream` + `AbortController`
- Pull queries via standard REST call
- INSERT VALUES via `/inserts-stream`

### ksqlDB Queries Page
Full-page view (accessible from NavRail) for managing ksqlDB persistent queries:
- List view: all persistent queries with status, type (STREAM AS, TABLE AS, INSERT), and SQL preview
- Detail view: query details with terminate action
- External navigation from dashboard

### ksqlDB Dashboard
Push-down panel (toggled via header badge) mirroring the Compute Pool Dashboard:
- Shows all persistent queries with state indicators
- Per-query terminate buttons and drill-through to detail
- Query count badge in header
- Auto-refresh, resizable, Escape to close

---

## Jobs Management

### Jobs Page
Full-page view for all Flink SQL statements (accessible from NavRail):
- **List view**: searchable table with status filter dropdown (Running, Pending, Completed, Stopped, Failed), ownership filter (My Statements / Other Statements), checkbox selection for bulk actions
- **Detail view**: full statement details with cancel and delete actions
- Region subtitle and page-loaded timestamp
- Relative timestamps ("2m ago", "1h ago")
- Cache-aware data loading with configurable TTL

### Deep Links
Direct URL navigation: `/jobs/{statementName}` loads the Jobs page and selects the specific statement.

---

## Education Center (Learning Platform)

### Learn Panel (Full-Page)
A full-page Education Center accessible from the NavRail. Features two tabs -- Tracks and Examples -- with overall progress tracking displayed in the header.

### Learning Tracks (7 tracks)

| Track | Level | Est. Time | Target Roles |
|---|---|---|---|
| Getting Started with Flink SQL | Beginner | 20 min | Data Engineer, Analytics Engineer |
| Kafka Fundamentals | Beginner | 35 min | Data Engineer, Platform Engineer |
| Windowing & Time | Intermediate | 30 min | Data Engineer, Analytics Engineer |
| Joins & Enrichment | Intermediate | 25 min | Data Engineer, Analytics Engineer |
| Stateful Processing | Advanced | 35 min | Data Engineer |
| Views & Architecture | Advanced | 30 min | Analytics Engineer |
| Confluent Cloud Platform | Intermediate | 25 min | Platform Engineer |

Tracks have prerequisite chains. Locked tracks show a "Skip ahead" option for power users.

### Concept Lessons (10 interactive lessons)
Embedded within tracks, each with animated SVG visualizations:
- What is Kafka?, What is Flink?, Streams vs Tables
- Consumer Groups & Offsets, Changelog Modes
- Event Time & Watermarks, Join Types, State Management
- Confluent Cloud Architecture, Schema Governance

### Animations (40+ components)
Native CSS/SVG animation components for concept visualization including: tumble/hop/session/cumulate windows, watermark progression, join matching, state accumulation, CDC pipeline, pattern match, consumer groups, changelog modes, dynamic routing, and many more. All support dark/light theme and `prefers-reduced-motion`.

### Example Cards (50 total)
Hands-on examples spanning all tracks: Hello Flink, Hello ksqlDB, filters, aggregates, windows (tumble, hop, session, cumulate), joins (regular, temporal, interval, lookup, stream enrichment), deduplication, CDC pipeline, pattern matching, running aggregates, change detection, views (golden record, credit risk, AI drift, early warning, MBS pricing), dynamic routing (Flink Avro/JSON, ksqlDB Avro/JSON), Kafka fundamentals (produce/consume, startup modes, changelog modes, value formats, schema evolution, connector bridge), and more.

### Challenges (42 total)
"Try It Yourself" challenges distributed across examples. Each challenge prompts users to modify SQL, explore edge cases, or test understanding. Includes optional hints and expected behavior descriptions.

### Badges (10 milestones)
Zustand-persisted progress tracking (separate `flafka-learn-progress` localStorage key):

| Badge | Condition |
|---|---|
| First Query | Complete 1 example |
| Track Starter | Complete 1 track |
| Window Master | Complete Windowing & Time track |
| Join Guru | Complete Joins & Enrichment track |
| State Keeper | Complete Stateful Processing track |
| View Builder | Complete Views & Architecture track |
| Challenge Accepted | Complete 10 challenges |
| Completionist | Complete all 46 examples |
| Speed Runner | Complete 3+ examples in one session |
| Kafka Native | Complete Kafka Fundamentals track |

### Role Personalization
Soft role tags on track cards (Data Engineer, Analytics Engineer, Platform Engineer). No gating -- all content is accessible regardless of role.

---

## Workspace Management

### Workspace Persistence
Workspace state is saved to localStorage via Zustand's `persist` middleware with a `partialize` function. Transient data (results, errors, running status) is excluded. RUNNING/PENDING statements reset to IDLE on reload.

### Multi-Tab Workspace
Up to 8 tabs per workspace, each with independent statements, tree data, stream cards, and editor state. Tabs support:
- Add, close (with running-statement warning), switch, rename (double-click), drag-to-reorder
- Per-tab workspace name, notes, and save timestamp
- Cell position counter ("Cell X of Y")

### Saved Workspaces
Snapshot the entire workspace state under a name and restore from a sidebar panel. Supports up to 50 saved workspaces. RUNNING statements are reconnected on open by checking API for current status. Newest-first sorting, search filter, rename, delete.

### Workspace Import/Export
- **Export**: downloads as pretty-printed JSON (statements, catalog, database, name, engine per cell)
- **Import**: reads `.json` file, validates schema (required fields, max 500 statements, max 5MB), shows confirmation dialog, regenerates statement IDs

### Workspace Notes
Per-tab notes panel that slides up from the tab bar. Notes persist with saved workspaces.

### Workspace Save (Ctrl+S)
One-click save upserts by name. Tab bar shows save controls and last-saved timestamp.

---

## Snippets

### Snippets Panel
SQL snippet library accessible from the NavRail sidebar:
- **Built-in snippets**: Hello World, Show Functions, Create Java UDF, Create Python UDF (hide-able, renamable)
- **User snippets**: up to 100 saved snippets with search filter
- **Actions**: insert into focused editor, create new cell, save current editor selection as snippet
- **Management**: rename inline, delete, search across name and SQL content

---

## Navigation & Sidebar

### Navigation Rail
Collapsible icon rail (~48px collapsed, ~200px expanded) organized into sections:

| Section | Items |
|---|---|
| Workspace | Workspace, Jobs, ksqlDB Queries* |
| Data | Objects (tree), Topics, Schemas |
| Tools | Workspaces, Snippets, History, Artifacts, Learn, Help |
| Settings | Settings |

*ksqlDB Queries only visible when ksqlDB is enabled.

### URL Routing & Deep Links
Clean URL routing via the History API (no `#` fragments). Supports:
- Panel navigation: `/jobs`, `/topics`, `/schemas`, `/learn`, `/artifacts`, etc.
- Deep links: `/topics/{name}`, `/schemas/{subject}`, `/jobs/{statementName}`, `/learn/tracks/{id}`, `/learn/examples/{id}`
- Legacy hash URL upgrade (`#/jobs/...` -> `/jobs/...`)
- Browser back/forward navigation
- Route changes update `document.title` and announce to screen readers

### Database Objects Tree
Sidebar tree navigator with expandable category nodes (Tables, Views, Models, Functions, External Tables). Features:
- Sticky search/filter with case-insensitive matching and highlight
- Count badges per category
- Click to load schema, double-click columns to insert at cursor
- Schema refresh button with spin animation

### Sidebar Collapse
Chevron button collapses sidebar to zero width with 0.2s CSS transition.

---

## Settings

### Settings Panel

| Setting | Description |
|---|---|
| Unique ID | User/session identifier for resource tagging |
| Catalog | Confluent Cloud catalog selector |
| Database | Database within catalog |
| Statements | Current statement count (read-only) |
| Rows Cached | Total cached result rows (read-only) |
| Data Refresh Interval | Cache TTL for Jobs/History data (1, 5, 10, 30, 60 minutes) |
| ksqlDB Engine | Feature toggle (requires env configuration) |

### Session Properties Editor
Key-value editor for Flink SQL session properties (e.g., `sql.local-time-zone`, `parallelism.default`). Properties are merged into all `executeSQL()` API calls. Reserved keys (`sql.current-catalog`, `sql.current-database`) are protected. Includes property help tooltips, add/remove, and reset to defaults.

### Dark Mode
Full dark/light theme toggle via sun/moon icon in the NavRail. All colors use CSS custom properties. Monaco receives `vs-dark`/`vs-light` theme. An inline script in `index.html` reads theme from localStorage before React renders to prevent flash. Falls back to `prefers-color-scheme`.

---

## Resource Management

### Resource Filter (Soft Multi-Tenancy)
Filters Jobs and History to show only the current user's resources (`unique` mode) or all resources (`all` mode). Admins default to `all`; regular users default to `unique`. Based on the `VITE_UNIQUE_ID` identifier.

### User-Launched Statements Registry
Persisted registry of statements launched by the current user. Tracks name, SQL, creation time, and last known phase. Used for ownership attribution in Jobs list.

### Cache Management
Configurable cache TTL (default 10 minutes) for Jobs and History data. "Clear Cached Data" button forces a fresh reload.

---

## Environment Variables & Feature Flags

### Required Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_ORG_ID` | Confluent Cloud organization ID |
| `VITE_ENV_ID` | Confluent Cloud environment ID |
| `VITE_COMPUTE_POOL_ID` | Flink Compute Pool ID |
| `VITE_FLINK_API_KEY` | Flink SQL REST API key |
| `VITE_FLINK_API_SECRET` | Flink SQL REST API secret |
| `VITE_FLINK_CATALOG` | Default Flink catalog |
| `VITE_FLINK_DATABASE` | Default Flink database |

### Optional Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_CLOUD_PROVIDER` | Cloud provider (aws, gcp, azure) |
| `VITE_CLOUD_REGION` | Cloud region (e.g., us-east-1) |
| `VITE_METRICS_KEY` / `_SECRET` | Confluent Cloud Metrics API credentials |
| `VITE_SCHEMA_REGISTRY_URL` | Schema Registry endpoint (enables schema panel) |
| `VITE_SCHEMA_REGISTRY_KEY` / `_SECRET` | Schema Registry credentials |
| `VITE_KAFKA_CLUSTER_ID` | Kafka cluster ID (enables topic panel) |
| `VITE_KAFKA_REST_ENDPOINT` | Kafka REST Proxy endpoint |
| `VITE_KAFKA_API_KEY` / `_SECRET` | Kafka REST Proxy credentials |
| `VITE_KAFKA_BOOTSTRAP` | Kafka bootstrap servers |
| `VITE_UNIQUE_ID` | User/session identifier for resource tagging |
| `VITE_ADMIN_SECRET` | Set to `FLAFKA` to enable admin mode |
| `VITE_ENVIRONMENT` | Set to `dev` for testing-friendly defaults |

### ksqlDB Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_KSQL_ENABLED` | Master switch (`true` to enable) |
| `VITE_KSQL_ENDPOINT` | ksqlDB cluster endpoint |
| `VITE_KSQL_API_KEY` / `_SECRET` | ksqlDB credentials |

### Feature Gating Summary

| Feature | Gate |
|---|---|
| ksqlDB engine selector | `VITE_KSQL_ENABLED=true` + all 3 ksqlDB vars + Settings toggle |
| Schema Registry panel | `VITE_SCHEMA_REGISTRY_URL` + `_KEY` configured |
| Topic Management panel | `VITE_KAFKA_CLUSTER_ID` + `VITE_KAFKA_REST_ENDPOINT` configured |
| Artifacts panel | `VITE_METRICS_KEY` + `_SECRET` configured |
| Compute Pool telemetry | `VITE_METRICS_KEY` + `_SECRET` configured |
| Admin mode (all resources) | `VITE_ADMIN_SECRET=FLAFKA` |

---

## App-Level Features

### Toast Notifications
Non-blocking toast notifications for success, error, and info messages. Auto-dismiss with manual close option.

### Onboarding Hint
Dismissible card below the first editor cell in a fresh workspace. Shows three tips. Dismissed by running a statement, adding a cell, or clicking X. Persisted via `hasSeenOnboardingHint`.

### Empty Workspace State
When all cells are deleted, a humorous SQL joke is displayed with the Flafka squirrel logo and a button to add a new statement.

### In-App Help System & FAQ
A searchable Help Panel with categories: UI Features, Flink SQL Concepts, Troubleshooting, Tips & Tricks. Contextual "?" icons on key components link directly to relevant FAQs.

### Example Template Engine
Examples are defined as typed TypeScript config objects (`KickstarterExampleDef`) with table schemas, data generators, and SQL cell templates. A generic runner handles all boilerplate. Adding a new example requires only a config file.

### Collapse/Expand Animation
Cell collapse uses CSS `max-height` transition (4000px to 0, 200ms ease-out) with opacity fade. Content stays mounted (never unmounts Monaco) to avoid re-initialization costs.

### Inline Workspace Name
Header title is click-to-edit. Enter saves, Escape reverts, blur saves (with race condition guard). Max width 300px with ellipsis truncation.
