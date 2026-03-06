# Flafka -- Feature Reference

Complete list of shipped features. For architecture details, see [ARCHITECTURE.md](TECH-STACK.md). For how to add new features, see [CONTRIBUTING.md](CONTRIBUTING.md).

Complete reference of all shipped features, grouped by component.

---

## SQL Editor

### Keyboard Shortcuts (Ctrl+Enter / Escape)
Execute the current cell's SQL with Ctrl+Enter (Cmd+Enter on Mac) or cancel a running statement with Escape. Shortcuts are editor-scoped via `editor.addAction()` so they only fire when Monaco has focus. Status checks use `useWorkspaceStore.getState()` to avoid stale closures.

### Auto-Resize Editor Height
Editor cells dynamically resize between 80px and 400px based on content. Uses Monaco's `onDidContentSizeChange` event to track line count. Removed all hardcoded `150px !important` CSS rules in favor of min/max constraints.

### SQL Autocomplete / Intellisense
Monaco `CompletionItemProvider` suggests Flink-specific SQL keywords (TUMBLE, HOP, MATCH_RECOGNIZE, etc.), table/view names from the sidebar tree, and column names from the last-clicked table's schema. Provider uses a disposable pattern at module level for safe HMR cleanup. Table suggestions are best-effort based on expanded tree state.

### SQL Formatter
Formats SQL code via Shift+Alt+F or a toolbar button. The pure `formatSQL()` function uppercases keywords, inserts newlines before major clauses (FROM, WHERE, JOIN variants, GROUP BY, ORDER BY), normalizes whitespace, and preserves string literals, comments, and backtick identifiers. Multi-word keywords like LEFT JOIN are treated as atomic units. Uses `editor.executeEdits()` to preserve undo history.

### Insert at Cursor from Sidebar
Double-clicking a column name in the schema panel inserts it at the cursor position in the last-focused editor. Uses a shared `editorRegistry.ts` module (Map of editor instances + `focusedEditorId`) and `editor.executeEdits()` for undo-safe insertion. Single-click still copies to clipboard. The `focusedEditorId` is never cleared on blur to survive the blur-before-click timing.

### Keyboard Cell Navigation (Ctrl+Alt+Up/Down)
Navigate focus between editor cells with Ctrl+Alt+Down (next) and Ctrl+Alt+Up (previous). Reads the shared editor registry to find and focus the target cell's Monaco instance. Collapsed cells are auto-expanded via `toggleStatementCollapse()` before focusing. Uses `requestAnimationFrame` to defer focus after Monaco mounts.

### Draft Indicator Badge
An amber "Modified" pill badge appears in the cell header when the current code differs from `lastExecutedCode` (captured at PENDING transition). Comparison uses `.trim()` on both sides. The badge disappears when code matches the last-run version or after re-execution. Persisted via `partialize`.

### Expandable Error Details
Clicking the error status badge in the status bar toggles an expandable panel showing the full error message (monospace, scrollable), statement name, start time, and a Retry button. The panel auto-closes when statement status changes away from error states. The badge is clickable only in the status bar context, not in collapsed preview.

### Session Properties Editor
A key-value editor in the Settings panel lets users configure Flink SQL session properties (e.g., `sql.local-time-zone`, `parallelism.default`). Properties are stored as `Record<string, string>` in Zustand, persisted to localStorage, and merged into `executeSQL()` API calls. Reserved keys (`sql.current-catalog`, `sql.current-database`) cannot be overridden. Internal queries (DESCRIBE, tree loading) do not inherit user session properties.

---

## Results Table

### Virtual Scrolling
Large result sets (up to 5000 rows) are virtualized using `@tanstack/react-virtual` v3. Only ~30-50 rows exist in the DOM at any time via spacer `<tr>` elements. The `<thead>` is sticky. Row striping uses a `.results-row-odd` class (not `:nth-child`) to account for spacer rows. Streaming results auto-scroll to bottom when the user is pinned there.

### Cell Click-to-Copy
Clicking any results cell copies its full raw value to the clipboard. Null/undefined copies as `"null"`, objects as `JSON.stringify()`. A green flash animation and success toast confirm the copy. Cells show pointer cursor and hover highlight.

### Column Visibility Toggle
A "Columns" dropdown in the results toolbar shows checkboxes for each column. Unchecking hides the column from both header and data rows. Includes "Show All" and "Hide All" bulk actions. State is local (session-scoped per query), not persisted.

### Row Index Column
A frozen "#" column on the far left displays 1-based original row indices. Indices remain stable through sorting and filtering via a precomputed `originalIndexMap` (Map keyed by row object reference for O(1) lookup). The column is non-interactive, excluded from exports, and excluded from column visibility controls.

### JSON Cell Expander
Object/array cells show a small expand chevron. Clicking it opens a React Portal pane (positioned via `getBoundingClientRect()`) with pretty-printed JSON, a "Copy JSON" button, and close-on-scroll/Escape/click-outside behavior. Uses `e.stopPropagation()` to prevent triggering the cell's copy action. Works with virtual scrolling since the pane is rendered outside the table.

### Copy as Markdown Table
A "Copy as MD" toolbar button formats the current visible, sorted, filtered data as a markdown table string and copies it to the clipboard. Includes a `#` row index column, escapes pipe characters, replaces newlines with spaces, and truncates cell values over 100 characters. Tables over 100 rows are truncated with a footer indicating remaining rows.

### Custom Export Filenames
CSV exports use `query-{index}-{YYYYMMDD}-{HHmmss}.csv` instead of generic `results.csv`. When a statement has a label/name, the filename uses that as the prefix (lowercased, spaces replaced with hyphens).

---

## Workspace Management

### Workspace Persistence
Workspace state (SQL code, catalog/database selection, collapse state) is saved to localStorage automatically via Zustand's `persist` middleware with a `partialize` function. Transient data (results, errors, running status) is excluded. RUNNING/PENDING statements reset to IDLE on reload. A "Last saved at" timestamp appears in the footer.

### Workspace Import/Export
Export downloads the workspace as a pretty-printed JSON file (statements, catalog, database, workspace name). Import reads a `.json` file, validates its schema (required fields, max 500 statements, max 5MB), shows a confirmation dialog, then hydrates the store. Statement IDs are regenerated on import to prevent collisions. Status is forced to IDLE.

### Statement Labels
Each editor cell can have an optional user-defined label (max 50 chars) displayed in the header next to the cell number. Labels are edited inline (click-to-edit with Enter/Escape/blur semantics using a `labelCancelledRef` pattern). When a labeled cell is collapsed, the label replaces the SQL preview. Duplicating a labeled statement appends " Copy". Labels persist via `partialize`.

### Saved Workspaces
Snapshot the entire workspace state (SQL cells, stream card configs, scan mode parameters) under a name and restore it from a sidebar panel. Supports up to 20 saved workspaces per browser. RUNNING statements are reconnected on open by checking the Flink API for current status. Missing datasets fall back to synthetic mode.

### Workspace Controls in Tab Bar
Workspace save, notes, and name display moved from the header to the tab bar. One-click save (Ctrl+S) upserts by name. Notes panel slides up from the tab bar. Double-click a tab name to rename.

---

## Navigation & Sidebar

### Navigation Rail (Phase 12.1)
Replaced the flat sidebar with a collapsible icon rail (~48px collapsed, ~200px expanded) that switches between content panels: SQL Workspace, Data panels (Database Objects, Topics, Schemas, Artifacts), Tools (History, Streams, Help), and Settings. Provides a scalable navigation pattern as feature count grows.

### Table Schema Panel
Clicking a table or view node in the tree navigator fetches its schema via `DESCRIBE` and displays column names and types in a panel below the tree. Uses `getTableSchema()` API and stores results in `selectedTableSchema`. The panel header shows the table name; a loading spinner appears during fetch.

### Sidebar Collapse Toggle
A chevron button on the sidebar's right border collapses it to zero width with a 0.2s CSS transition. The schema panel is hidden automatically via `overflow: hidden`. Collapse state is not persisted (resets to expanded on reload).

### Tree Search/Filter
A sticky search input at the top of the tree navigator filters nodes in real-time (case-insensitive). Parent container nodes are preserved when any child matches. Matching text is highlighted in yellow via a `highlightText` function. Clear button resets the filter.

### Drag-to-Reorder Editor Cells
A grip handle icon on each cell header enables HTML5 drag-and-drop reordering. Drop position (before/after) is determined by comparing `e.clientY` against the cell's midpoint. The `reorderStatements(fromIndex, toIndex)` store action splices the statements array. Only the grip handle is draggable to avoid Monaco conflicts.

### Schema Refresh Button
A refresh icon (FiRefreshCw) in the schema panel header re-fetches the table schema with one click. The icon spins during loading via CSS animation. Button is disabled while loading to prevent duplicate requests. Uses the existing `loadTableSchema()` store action.

### Sidebar Count Badges
Category nodes (Tables, Views, Models, Functions, External Tables) display a count badge pill showing `node.children.length`. Badges are muted gray pills that support dark mode via CSS variables. A helper `isCategoryNode()` determines which node types get badges. Empty categories show "0" with reduced opacity.

---

## Statement Execution

### Statement Status Bar
A status bar appears below the editor after first execution, showing start time (`toLocaleTimeString()`), a colored status dot (green=COMPLETED/RUNNING, yellow=PENDING, red=ERROR, gray=IDLE/CANCELLED), and the server-assigned statement name. Gated on `statement.startedAt` being set.

### Statement History Panel
A clock icon in the toolbar opens a dropdown panel listing up to 50 server-side statements fetched via `listStatements()` API. Lazy-loaded on first open, cached thereafter. Each entry shows a status badge, statement name, and SQL preview (80 chars). A "Load" button creates a new cell with that statement's SQL. Includes a refresh button.

### History Panel Filters
A filter strip at the top of the history panel with tabs: All, Completed, Failed (FAILED + CANCELLED), Running (RUNNING + PENDING). Each tab shows a count badge. Filtering is client-side and instant. Relative timestamps ("2m ago", "1h ago") display when the API provides timestamp metadata.

### Finish Timestamp & Duration
When a statement reaches a terminal status (COMPLETED, ERROR, CANCELLED), the status bar shows finish time and formatted duration (e.g., "2.3s", "1m 30.5s"). Duration is computed as `lastExecutedAt - startedAt`. A module-level `formatDuration()` function handles formatting with `Math.max(0, ...)` for defensive negative handling.

### Error Retry Button
A small "Retry" button (FiRefreshCw icon) appears in the error display area for ERROR and CANCELLED statements. Calls the existing `executeStatement(id)`, which resets error/results and re-runs. Status immediately changes to PENDING on click, hiding the retry button and preventing double-execution.

### Empty State Onboarding Hint
A dismissible card appears below the first editor cell in a fresh workspace (1 statement, IDLE status). Shows three tips: sidebar table interaction, Ctrl+Enter to run, and `?` for shortcuts. Dismissed by running a statement, adding a cell, or clicking X. The `hasSeenOnboardingHint` flag is persisted to localStorage.

---

## Topic Management

### Topic Panel (Phase 12.3)
A fully functional Kafka Topic Management panel in the NavRail sidebar. Browse all topics with partition count and replication factor, search by name, view detailed configuration, create new topics (name, partitions, replication, cleanup policy, retention), and delete topics with a name-confirmation safety gate. Uses the Confluent Cloud Kafka REST API v3.

---

## Schema Registry

### Schema Management (Phase 12.2)
A Schema Registry panel for browsing, creating, evolving, and managing Confluent Cloud schemas. Accessible from the navigation rail. Supports schema visualization in JSON code and tree view formats. Integrates with the Topic Management panel to show associated schemas.

---

## Streams Panel

### Stream Monitor (Phase 13.1)
A right-side panel (opened via FiActivity icon in NavRail) for monitoring up to 5 Kafka topics simultaneously. Each topic gets a Stream Card with play/stop controls, partition filtering, and a compact message table (timestamp, partition, offset, key, value). Messages are fetched via background Flink SQL statements using metadata columns. JSON values expand via the shared ExpandableJsonPane component.

### Synthetic Data Producer
Stream Cards can produce synthetic data at 1 message/second. The generator parses Avro and JSON Schema definitions from Schema Registry, applies field-name heuristics (id->UUID, name->fake name, email->fake email), and supports all Avro primitive types, unions, nested records, enums, arrays, and maps. Auto-stops on unmount or error.

### Background Statements
Stream monitoring uses a separate `backgroundStatements` array in the store (not mixed with workspace statements). Named with a `bg-` prefix for HistoryPanel filtering. Max 1 per contextId, auto-cancelled when the panel closes or a card is removed. Not persisted to localStorage.

---

## Artifacts (UDFs)

### Artifacts Panel
Browse, upload, and delete Flink JAR artifacts (UDFs) deployed to Confluent Cloud. The primary action is generating a ready-to-use `CREATE FUNCTION ... USING JAR 'confluent-artifact://...'` statement with a version dropdown. Upload follows a 3-step flow: request presigned URL, upload JAR with progress bar, create artifact record. Delete requires typing the exact artifact name. The panel requires Cloud API keys and shows setup instructions if missing.

---

## Compute Pool Dashboard

### Compute Pool Status Badge
A colored dot and status text in the header show the compute pool's current state (RUNNING/PROVISIONED = green, PROVISIONING = yellow, DELETING = red) and CFU count. Polls the FCPM API every 30 seconds. Failures show "Unknown" with a gray dot; no error toasts for this background check.

### Compute Pool Dashboard Panel
Clicking the header badge opens a push-down panel showing all running statements with real-time telemetry metrics (CFU usage, Records In/Out, Pending Records, State Size) from the Confluent Cloud Telemetry API. Includes per-statement Stop buttons, refresh, and resizable panel height. Accessible with `aria-expanded`, focus management, and Escape to close.

---

## App-Level Features

### Dark Mode
Full dark/light theme toggle via a sun/moon icon button in the header. All colors use CSS custom properties defined in `:root` (light) and `[data-theme="dark"]` (dark). Monaco Editor receives `vs-dark` or `vs-light` theme prop. An inline script in `index.html` reads the theme from localStorage before React renders to prevent flash of wrong theme. Falls back to `prefers-color-scheme` system preference.

### Run All Statements
A "Run All" toolbar button sequentially executes every statement in IDLE, ERROR, or CANCELLED status. RUNNING/PENDING statements are skipped. Uses a `for...of` loop with `await` to keep API load low. Button is disabled when no eligible statements exist.

### Settings Panel
A gear icon toggles a dropdown panel showing read-only environment info (cloud provider, region, compute pool ID), API details (endpoint, org ID, environment ID), workspace stats (statement count, total cached rows), and the Session Properties editor.

### Smart Collapse Preview
Collapsed cells show a one-line summary: the first non-blank, non-comment SQL line (truncated to 60 chars), an inline status badge, and a row count suffix. If a statement label exists, it replaces the SQL preview. Uses a `getPreviewLine()` helper that skips `--` comment lines.

### Keyboard Shortcuts Help
Press `?` (when not in Monaco) or click the `?` header button to open a modal listing all shortcuts: Ctrl+Enter (run), Escape (cancel), Ctrl+Alt+Up/Down (navigate cells), Shift+Alt+F (format), `?` (toggle help). Closes on Escape, overlay click, or toggle. Uses `closest('.monaco-editor')` to avoid triggering inside editors.

### Collapse/Expand Animation
Cell collapse uses a CSS `max-height` transition (4000px to 0, 200ms ease-out) with opacity fade. Content stays always mounted in the DOM (never unmounts Monaco) to avoid re-initialization costs. This replaced an earlier framer-motion approach that caused Monaco remount cycles.

### Cell Position Counter
The footer displays "Cell X of Y" when an editor cell is focused, updating reactively. Tracks `focusedStatementId` in Zustand (not persisted). Extracted into a `FooterStatus` component to scope re-renders. Clears to "N statement(s)" on blur.

### Cell Hover Actions
Copy, delete, and add-cell buttons are hidden by default (opacity: 0) and fade in on cell hover or focus-within (150ms transition). Run button and collapse chevron remain always visible. Delete confirmation forces actions visible via a `.confirming` class. Touch devices get always-visible actions via `@media (hover: none)`.

### Inline Workspace Name
The header title is click-to-edit. Clicking transforms it into an input pre-filled with the current name. Enter saves, Escape reverts, blur saves (with race condition guard via ref). Empty/whitespace submissions revert to the previous value. Pencil icon appears on hover. Name persists via Zustand `partialize`. Max width 300px with ellipsis truncation.

### In-App Help System & FAQ
A searchable Help Panel (opened via `?` key or header icon) replaces the original keyboard shortcuts modal. Categories include UI Features, Flink SQL Concepts, Troubleshooting, and Tips & Tricks. Content covers all shipped features plus critical domain knowledge (cardinality explosions, watermark delays, streaming vs batch, PROCTIME vs ROWTIME, changelog semantics). Contextual "?" icons on key components link directly to relevant FAQs.

### Example Template Engine
Quick Start examples are defined as typed TypeScript config objects (`KickstarterExampleDef`) with table schemas, data generators, and SQL cell templates. A generic runner handles all boilerplate (table creation, data seeding, SQL substitution). Adding a new example requires only a config file. Bespoke examples requiring JAR upload use `example-setup.ts` as an escape hatch.
