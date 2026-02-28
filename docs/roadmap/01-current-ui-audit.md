# Current UI Audit - Flink SQL Workspace

**Date:** 2026-02-28
**Codebase:** `C:\_dev\flink-ui`

---

## Layout Structure

The application uses a classic three-region layout: **header**, **sidebar + main content area**.

### Overall Shell (`src/App.tsx`, lines 31-106)

```
+-------------------------------------------------------+
|  HEADER (56px tall, fixed)                             |
|  [Logo]         [Compute Pool Info]        [Settings]  |
+----------+-----------------------------------------+---+
|  SIDEBAR |  MAIN CONTENT                            |
|  280px   |  +------------------------------------+  |
|  fixed   |  | TOOLBAR (catalog/db + Add Stmt)   |  |
|          |  +------------------------------------+  |
|          |  | EDITOR CELLS (scrollable)          |  |
|          |  |  [Cell 1]                          |  |
|          |  |  [Cell 2]                          |  |
|          |  |  ...                               |  |
|          |  +------------------------------------+  |
|          |  | FOOTER (statement count + env)     |  |
+----------+-----------------------------------------+---+
```

- **Root container** (`.app`): Flex column, 100vh, overflow hidden.
- **Header** (`.app-header`): Fixed 56px height. Three sections: logo left, compute pool center, settings button right.
- **Content area** (`.app-content`): Flex row, fills remaining height.
  - **Sidebar** (`.sidebar`): Fixed 280px width (240px at <=1024px, hidden at <=768px). Contains `TreeNavigator`.
  - **Main** (`.main-content`): Flex column, fills remaining width. Contains toolbar, scrollable editor cells area, and footer.
- **Toast overlay** (`.toast-container`): Fixed position, bottom-right corner, z-index 3000.

### Responsive Breakpoints (`src/App.css`, lines 884-908)

| Breakpoint | Changes |
|---|---|
| <= 1024px | Sidebar shrinks to 240px |
| <= 768px | Sidebar hidden entirely; toolbar stacks vertically; header padding reduced |

---

## Components Inventory

### 1. `App` (`src/App.tsx`)

**Role:** Root application shell. Orchestrates layout and loads initial data.

**Props:** None (root component).

**State used from store:**
- `catalog`, `database`, `catalogs`, `databases` -- for the toolbar dropdowns
- `statements` -- to render editor cells
- `setCatalog`, `setDatabase`, `loadCatalogs`, `loadDatabases`, `addStatement` -- actions

**Behavior:**
- On mount (line 25-29): Calls `loadCatalogs()` and `loadDatabases(catalog)`. Note: dependency array is empty `[]` so these only fire once.
- Renders the header with logo (`FiDatabase` icon + "SQL Workspace"), compute pool ID display, and a settings button (non-functional).
- Renders two `Dropdown` components for catalog and database selection.
- Renders an "Add Statement" button in the toolbar.
- Maps over `statements` array rendering an `EditorCell` for each.
- Shows statement count and environment info (cloud provider + region) in footer.

---

### 2. `EditorCell` (`src/components/EditorCell/EditorCell.tsx`)

**Role:** A single SQL editor cell with run/stop controls, status display, Monaco editor, error display, and results table.

**Props (lines 19-22):**
| Prop | Type | Description |
|---|---|---|
| `statement` | `SQLStatement` | The statement data object |
| `index` | `number` | Zero-based position index for display as `#N` |

**Store actions used (lines 25-33):**
- `updateStatement` -- on editor content change
- `deleteStatement` -- delete with confirmation dialog
- `duplicateStatement` -- copy statement
- `toggleStatementCollapse` -- expand/collapse
- `executeStatement` -- run SQL
- `cancelStatement` -- stop running SQL
- `addStatement` -- add new cell (from the cell's + button)

**Internal state:**
- `editorRef` (useRef) -- reference to Monaco editor instance

**Sub-sections:**
1. **Cell Header** (line 123-195): Three-part layout (left/center/right).
2. **Cell Editor** (lines 199-227): Monaco editor, only visible when not collapsed.
3. **Cell Error** (lines 229-234): Red error banner, only visible on ERROR status.
4. **Cell Results** (lines 236-244): ResultsTable component, only visible when results exist.
5. **Collapsed Preview** (lines 248-252): Shows first 80 chars of first line of code when collapsed.

---

### 3. `ResultsTable` (`src/components/ResultsTable/ResultsTable.tsx`)

**Role:** Displays query results in a sortable, searchable, exportable table.

**Props (lines 12-16):**
| Prop | Type | Description |
|---|---|---|
| `data` | `Record<string, unknown>[]` | Array of row objects |
| `columns` | `Column[]` | Column definitions with name/type/nullable |
| `totalRowsReceived` | `number?` | Optional total count for streaming queries |

**Internal state (lines 19-21):**
- `searchTerm` (string) -- text filter across all columns
- `sortConfig` (SortConfig | null) -- current sort column and direction
- `viewMode` ('grid' | 'list') -- toggle between grid and list views

**Key behaviors:**
- Search filters all rows by checking every cell value (case-insensitive substring match).
- Sort is three-state: ascending -> descending -> no sort (reset). Null values sort to end.
- Export generates CSV or JSON as a client-side download via Blob URL.
- Column names derived from `columns` prop first, then falls back to `Object.keys(data[0])`.
- Empty data shows "Query executed successfully. No rows returned." message.

---

### 4. `TreeNavigator` (`src/components/TreeNavigator/TreeNavigator.tsx`)

**Role:** Sidebar tree view showing database objects (catalogs, databases, tables, views, models, functions, external tables).

**Props:** None (reads directly from store).

**Store state used (lines 18-28):**
- `treeNodes`, `treeLoading`, `selectedNodeId` -- tree data and UI state
- `loadTreeData`, `toggleTreeNode`, `selectTreeNode` -- tree actions
- `addStatement` -- for double-click-to-query feature
- `catalog`, `database` -- for building SELECT queries

**Behavior:**
- On mount: Calls `loadTreeData()`.
- **Double-click** on table/view nodes (line 34-39): Creates a new statement with `SELECT * FROM \`catalog\`.\`database\`.\`tableName\` LIMIT 10;`
- Shows loading spinner, tree content, or "No database objects found" empty state.

**Sub-component: `TreeNodeComponent` (lines 84-186):**

**Props (lines 75-82):**
| Prop | Type | Description |
|---|---|---|
| `node` | `TreeNode` | The tree node data |
| `level` | `number` | Indentation depth |
| `selectedNodeId` | `string | null` | Currently selected node |
| `onToggle` | `(nodeId: string) => void` | Expand/collapse handler |
| `onSelect` | `(nodeId: string) => void` | Selection handler |
| `onDoubleClick` | `(node: TreeNode) => void` | Double-click handler |

**Node type icons (lines 97-121):**
| Type | Icon | Color |
|---|---|---|
| catalog | `FiFolder` | Primary purple |
| database | `FiDatabase` | Info blue |
| tables/table | `FiGrid` | Green (#22C55E) |
| views/view | `FiEye` | Purple (#8B5CF6) |
| models/model | `FiBox` | Default secondary |
| functions/function | `FiCode` | Default secondary |
| externalTables/externalTable | `FiExternalLink` | Default secondary |

**Expandable types** (line 93): catalog, database, tables, views, models, functions, externalTables.
**Empty category message** (lines 176-183): Shows "No {category} yet" in italic when expanded with no children.
**Indentation**: 16px per level, starting at 4px left padding.

---

### 5. `Dropdown` (`src/components/Dropdown/Dropdown.tsx`)

**Role:** Searchable dropdown selector used for catalog and database selection.

**Props (lines 4-9):**
| Prop | Type | Description |
|---|---|---|
| `label` | `string` | Label displayed to the left of the trigger |
| `value` | `string` | Currently selected value |
| `options` | `string[]` | Available options |
| `onChange` | `(value: string) => void` | Selection callback |
| `disabled` | `boolean?` | Disables interaction (default: false) |

**Internal state (lines 19-21):**
- `isOpen` (boolean) -- dropdown open/closed
- `searchTerm` (string) -- filter text within dropdown

**Behavior:**
- Click outside closes dropdown (mousedown event listener, lines 27-37).
- Options filtered by case-insensitive substring match.
- Selected option shown with checkmark icon (`FiCheck`).
- Empty search results show "No results found".
- Chevron rotates 180 degrees when open.
- Search input auto-focuses on open.

---

### 6. `Toast` (`src/components/ui/Toast.tsx`)

**Role:** Notification toast system displayed at bottom-right of viewport.

**Props:** None (reads from store).

**Store state used:**
- `toasts` -- array of active toasts
- `removeToast` -- dismiss handler

**Toast types and styling (lines 16-28):**
| Type | Icon | Background | Border Color |
|---|---|---|---|
| success | `FiCheckCircle` | #ECFDF5 | Green |
| error | `FiAlertCircle` | #FEF2F2 | Red |
| warning | `FiAlertTriangle` | #FFFBEB | Amber |
| info | `FiInfo` | #EFF6FF | Blue |

**Behavior:**
- Each toast has a close button (`FiX` icon).
- Toasts auto-dismiss after `duration` ms (default 5000ms, set in store line 503-504).
- Entry animation: slide in from right with cubic-bezier spring curve (200ms).
- Max width: 400px.

---

## UI Features

### Interactive Features

| Feature | Location | Description |
|---|---|---|
| **SQL Editor** | `EditorCell.tsx` line 200 | Monaco editor with SQL syntax highlighting, `vs-light` theme, 150px height |
| **Run/Stop Statement** | `EditorCell.tsx` lines 50-56, 166-182 | Run button executes SQL; toggles to Stop when running |
| **Cancel Statement** | `EditorCell.tsx` line 52 | Cancels running/pending statements both locally and on server |
| **Delete Statement** | `EditorCell.tsx` lines 58-62 | Browser `confirm()` dialog before deletion |
| **Duplicate Statement** | `EditorCell.tsx` line 64-66 | Copies statement code, resets status/results |
| **Collapse/Expand Cell** | `EditorCell.tsx` lines 68-70 | Toggles between full editor view and single-line preview |
| **Add Statement (toolbar)** | `App.tsx` line 79 | Adds new empty statement at end of list |
| **Add Statement (cell)** | `EditorCell.tsx` lines 126-131 | Plus button on each cell header adds new statement |
| **Catalog Dropdown** | `App.tsx` lines 65-70 | Searchable dropdown to switch catalog; triggers database reload + tree reload |
| **Database Dropdown** | `App.tsx` lines 71-76 | Searchable dropdown to switch database; triggers tree reload |
| **Tree Navigation** | `TreeNavigator.tsx` | Expandable/collapsible tree of database objects |
| **Tree Double-Click** | `TreeNavigator.tsx` lines 34-39 | Double-clicking table/view creates SELECT statement |
| **Tree Node Selection** | `TreeNavigator.tsx` line 125 | Click selects and expands/collapses nodes |
| **Results Search** | `ResultsTable.tsx` lines 19, 103-109 | Text search filters across all result columns |
| **Results Sort** | `ResultsTable.tsx` lines 48-58 | Click column header to sort asc/desc/none |
| **Results Export CSV** | `ResultsTable.tsx` lines 61-68 | Downloads results as CSV file |
| **Results Export JSON** | `ResultsTable.tsx` lines 69-71 | Downloads results as JSON file |
| **View Mode Toggle** | `ResultsTable.tsx` lines 116-129 | Grid/List view toggle buttons (icons only, see Missing Features) |
| **Toast Notifications** | `Toast.tsx` | Auto-dismissing notification toasts with manual close |
| **Dropdown Search** | `Dropdown.tsx` lines 23-25 | Filter dropdown options by typing |

### Keyboard/UX Details

- Monaco editor options (`EditorCell.tsx` lines 207-225):
  - Minimap disabled
  - Font size 13px
  - Line numbers on
  - Word wrap on
  - Scroll beyond last line disabled
  - Folding enabled
  - Line highlight on current line
  - Padding: 12px top/bottom
  - Vertical scrollbar always visible, 10px wide
  - `alwaysConsumeMouseWheel: false` -- allows scroll to pass through to parent

---

## Styling Approach

### CSS Architecture

Two CSS files, no CSS modules or CSS-in-JS:

| File | Purpose | Lines |
|---|---|---|
| `src/index.css` | Global reset, CSS custom properties (design tokens), base typography, scrollbar styles, animations | 108 lines |
| `src/App.css` | All component styles in a single flat file using BEM-like class naming | 908 lines |

### Framework

- **Tailwind CSS** is imported (`@import "tailwindcss"` in `index.css` line 1) but barely used. Nearly all styling is done with hand-written CSS classes in `App.css`.
- **Icon library:** `react-icons/fi` (Feather Icons) used throughout.

### Design Tokens (`src/index.css`, lines 4-38)

| Category | Token | Value |
|---|---|---|
| Brand | `--color-primary` | #4933D7 (purple) |
| Brand | `--color-primary-light` | #7B5FFA |
| Brand | `--color-primary-dark` | #3D1FD1 |
| Semantic | `--color-success` | #22C55E (green) |
| Semantic | `--color-error` | #EF4444 (red) |
| Semantic | `--color-warning` | #F59E0B (amber) |
| Semantic | `--color-info` | #3B82F6 (blue) |
| Neutral | `--color-background` | #F5F4F4 |
| Neutral | `--color-surface` | #FFFFFF |
| Neutral | `--color-surface-secondary` | #F9F9F9 |
| Neutral | `--color-border` | #E5E7EB |
| Text | `--color-text-primary` | #131316 |
| Text | `--color-text-secondary` | #6B7280 |
| Text | `--color-text-tertiary` | #9CA3AF |
| Text | `--color-text-disabled` | #D1D5DB |
| Shadow | `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) |
| Shadow | `--shadow-md` | 0 4px 6px rgba(0,0,0,0.1) |
| Shadow | `--shadow-lg` | 0 10px 15px rgba(0,0,0,0.1) |
| Shadow | `--shadow-cell` | 0 1px 3px rgba(0,0,0,0.08) |
| Animation | `--transition-fast` | 100ms |
| Animation | `--transition-normal` | 200ms |
| Animation | `--transition-slow` | 300ms |

### Animations (`src/index.css`, lines 86-107)

| Name | Usage |
|---|---|
| `spin` | Loading spinners (`.animate-spin`) |
| `pulse` | Running status dot, generic pulse (`.animate-pulse`) |
| `slideInRight` | Toast entry animation |

### Theme

- **Light theme only.** No dark mode support. Monaco editor forced to `vs-light` theme (`EditorCell.tsx` line 206).
- Color palette references "Confluent Spec" per the CSS comment on line 3 of `index.css`.

### Responsive Design

- Two breakpoints at 1024px and 768px (see Layout Structure section above).
- No mobile-first approach -- desktop-first with media queries reducing layout.
- Sidebar has no toggle mechanism at mobile sizes -- it simply disappears.

---

## Missing UI Features

### Dead State / Unused Code

| Item | Location | Details |
|---|---|---|
| **`viewMode` state in ResultsTable** | `ResultsTable.tsx` line 21 | State is managed (`'grid' \| 'list'`), toggle buttons are rendered (lines 116-129), but the actual rendering of data (lines 143-185) is always the same `<table>` regardless of `viewMode`. List view is not implemented. |
| **`activeStatementId` in store** | `workspaceStore.ts` lines 80, 297-299 | Set by `addStatement` and `setActiveStatement` but never read by any component. No visual indicator of "active" cell. |
| **`resultsFilter` / `setResultsFilter` in store** | `workspaceStore.ts` lines 82, 492 | Filter type is fully defined (`Filter` interface with operators: equals, contains, greater, less, not_equals) but never used by any component. No column-level filtering UI exists. |
| **`resultsSort` / `setResultsSort` in store** | `workspaceStore.ts` lines 83, 493 | Store-level sort state exists but ResultsTable manages its own local sort state instead. Store sort is never used. |
| **`resultsSearch` / `setResultsSearch` in store** | `workspaceStore.ts` lines 84, 494 | Store-level search state exists but ResultsTable manages its own local search state instead. Store search is never used. |
| **`isLoading` in store** | `workspaceStore.ts` line 87 | Global loading flag, initialized to `false`, never set to `true` by any action. |
| **`loadTreeNodeChildren` in store** | `workspaceStore.ts` lines 226-228 | Stub function that only does `console.log`. Lazy-loading of tree children is not implemented; all data is loaded upfront in `loadTreeData`. |
| **Settings button** | `App.tsx` lines 48-51 | Settings gear icon button in header has no `onClick` handler and no settings panel exists. |
| **`listStatements` API function** | `flink-api.ts` lines 149-156 | Exported function to list all server-side statements. Never called from any component or store action. |
| **`getTableSchema` API function** | `flink-api.ts` lines 231-244 | Exported function to DESCRIBE a table's schema. Never called from any component or store action. No schema/column detail view exists in the tree. |
| **Models category in tree** | `workspaceStore.ts` line 178-179 | "Models" tree node always has empty children array. No API call fetches models. |
| **External Tables category in tree** | `workspaceStore.ts` lines 195-200 | "External tables" tree node always has empty children array. No API call fetches external tables. |
| **`parentId` in TreeNode** | `types/index.ts` line 36 | Defined in the type but never populated in any tree-building code. |
| **`readOnly` in TreeNode metadata** | `types/index.ts` line 41 | Defined in the type but never set or checked. |
| **`ComputePoolStatus` type** | `types/index.ts` lines 67-72 | Fully defined interface but never used anywhere. No compute pool status checking exists. |
| **Duplicate `Column` interface** | `flink-api.ts` lines 49-53 vs `types/index.ts` lines 20-24 | Two separate `Column` interface definitions. The one in `flink-api.ts` is never imported externally. |

### Features That Are Clearly Missing

| Feature | Evidence |
|---|---|
| **Dark mode** | Only light theme, no toggle, no CSS variables for dark palette |
| **Sidebar resize/toggle** | Fixed width, no drag handle, no collapse button, hidden entirely on mobile with no way to show |
| **Cell reordering** | Statements rendered in array order, no drag-and-drop, no move up/down buttons |
| **Cell resize** | Monaco editor height hardcoded to 150px (`EditorCell.tsx` line 201, `App.css` line 542-543 with `!important`) |
| **Pagination** | Results table renders all rows at once. No virtual scrolling. Limited to MAX_ROWS=5000 by FIFO in store (line 333/399), but all 5000 are rendered in DOM. |
| **Column filtering** | Filter type defined but no UI. No per-column filter dropdowns or menus. |
| **Column resize** | Table columns auto-sized, no drag-to-resize handles |
| **Cell value copy** | No click-to-copy on individual cell values in results table |
| **Statement history** | No record of past executions; re-running overwrites previous results |
| **Multi-statement execution** | No "Run All" button; each cell must be run individually |
| **Keyboard shortcuts** | No Ctrl+Enter to run, no Cmd+S to save, no keyboard navigation between cells |
| **Tab/workspace management** | Single workspace, no tabs or named sessions |
| **Authentication UI** | API key/secret only via `.env` file; no login screen or credential management |
| **Error retry** | No retry button on failed queries; must manually re-run |
| **Statement naming** | Server assigns statement names but these are not displayed to the user |
| **Streaming indicator** | Running streaming queries show "Running" badge but no visual distinction from batch queries approaching completion |

---

## Cell Actions

Every button/action available on an editor cell (`EditorCell.tsx`):

### Cell Header Left

| # | Action | Icon | Location | Behavior |
|---|---|---|---|---|
| 1 | **Add Statement** | `FiPlus` (16px) | Line 126-131 | Adds a new empty statement cell at the end of the list. Title: "Add new statement". |

Also displays: **Cell number** as `#N` (1-indexed, line 132).

### Cell Header Center

| # | Element | Details |
|---|---|---|
| 2 | **Status Badge** | Shows PENDING (spinner + "Pending"), RUNNING (pulsing dot + "Running"), COMPLETED (checkmark + "Completed"), ERROR (alert + "Error"), CANCELLED ("Cancelled"). IDLE shows nothing. Lines 80-119. |
| 3 | **Execution Time** | Shows `Xs` format (seconds with 2 decimal places). Only visible when `executionTime` is set. Line 137-141. |
| 4 | **Row Count** | Shows `N rows` or `N of M rows` when totalRowsReceived > displayed. Only visible when results exist. Lines 142-148. |

### Cell Header Right

| # | Action | Icon | Location | Behavior |
|---|---|---|---|---|
| 5 | **Duplicate** | `FiCopy` (14px) | Lines 152-158 | Copies statement code into a new cell with IDLE status and no results. Title: "Duplicate statement". |
| 6 | **Delete** | `FiTrash2` (14px) | Lines 159-165 | Shows browser `confirm()` dialog "Are you sure you want to delete this statement?". If last cell, replaces with empty placeholder. Shows success toast. Title: "Delete statement". |
| 7 | **Run / Stop** | `FiPlay`/`FiSquare` (14px) | Lines 166-182 | When idle/completed/error/cancelled: shows "Run" with play icon. When running/pending: shows "Stop" with square icon. Disabled during PENDING state. Stop cancels both locally and on server. |
| 8 | **Collapse/Expand** | `FiChevronDown`/`FiChevronRight` (16px) | Lines 183-193 | Toggles cell between full view and collapsed single-line preview. Title changes between "Expand" and "Collapse". |

### Cell Body (when expanded)

| # | Element | Condition | Details |
|---|---|---|---|
| 9 | **Monaco SQL Editor** | Always (when expanded) | 150px height, SQL language, line numbers, word wrap, folding. Lines 199-227. |
| 10 | **Error Banner** | `status === 'ERROR' && error` | Red background, alert icon + error message text. Lines 229-234. |
| 11 | **Results Table** | `results.length > 0` | Embedded ResultsTable component with search, sort, export. Lines 236-244. |

### Cell Body (when collapsed)

| # | Element | Details |
|---|---|---|
| 12 | **Code Preview** | First line of SQL code, truncated to 80 characters + "...". Monospace font. Lines 248-252. |

---

## Results Table Features

Everything the results table can do (`ResultsTable.tsx`):

### Toolbar (lines 100-141)

| Feature | Location | Details |
|---|---|---|
| **Search** | Lines 103-109 | Text input with `FiSearch` icon. Placeholder: "Search...". Filters all rows -- checks every cell value as a case-insensitive substring match. Search is real-time (onChange). |
| **Row Count Display** | Line 111-113 | Shows `{filtered} of {total} rows` and optionally `({totalReceived} total received)` for streaming queries where server sent more than displayed. |
| **Grid View Toggle** | Lines 116-121 | `FiGrid` icon button. Highlights when `viewMode === 'grid'`. Title: "Grid view". |
| **List View Toggle** | Lines 123-128 | `FiList` icon button. Highlights when `viewMode === 'list'`. Title: "List view". |
| **Export Dropdown** | Lines 130-139 | `FiDownload` icon + "Export" label. Shows menu on hover (CSS-only, `.export-dropdown:hover .export-menu`, `App.css` line 688). |
| **Export as CSV** | Line 136 | Generates CSV with headers from column names, values JSON-stringified. Downloads as `results.csv`. |
| **Export as JSON** | Line 137 | Generates pretty-printed JSON (2-space indent) of sorted/filtered data. Downloads as `results.json`. |

### Table (lines 143-185)

| Feature | Location | Details |
|---|---|---|
| **Sticky Column Headers** | `App.css` line 721-722 | `position: sticky; top: 0` on `<th>` elements. Gray background (#F3F4F6). |
| **Column Sorting** | Lines 148, 48-58 | Click any column header to sort. Three-state cycle: ascending (up arrow) -> descending (down arrow) -> no sort (inactive up arrow at 30% opacity). Null values always sort to end. |
| **Sort Direction Indicator** | Lines 151-161 | Active column shows `FiArrowUp` or `FiArrowDown`. Inactive columns show faded `FiArrowUp`. |
| **Null Value Styling** | Lines 172-173, `App.css` lines 769-772 | Null/undefined values displayed as italic gray "null" text. |
| **Object Serialization** | Lines 174-175 | Object values rendered via `JSON.stringify()`. |
| **Cell Truncation** | `App.css` lines 755-758 | Max-width 300px, `text-overflow: ellipsis`, `white-space: nowrap`. |
| **Alternating Row Colors** | `App.css` lines 761-763 | Even rows get `--color-surface-secondary` (#F9F9F9) background. |
| **Row Hover** | `App.css` lines 765-767 | Hover background #F0F0F0. |
| **Column Header Hover** | `App.css` lines 731-733 | Header hover background #E5E7EB. |
| **Empty Results** | Lines 90-96 | Shows "Query executed successfully. No rows returned." centered message. |
| **Max Height** | `App.css` line 567 | Results container capped at `max-height: 250px` with overflow auto scroll. |

### Data Pipeline

1. Raw `data` prop received
2. Filtered by `searchTerm` (all columns, case-insensitive) -> `filteredData`
3. Sorted by `sortConfig` (single column, nulls last) -> `sortedData`
4. Rendered in `<table>`
5. Export operates on `sortedData` (respects both filter and sort)

### Limitations

- No pagination or virtual scrolling -- all rows rendered in DOM simultaneously.
- No column reordering or resizing.
- No cell-level copy-to-clipboard.
- No column type formatting (dates, numbers, booleans all rendered as strings).
- Grid/List view toggle exists in UI but only grid view is implemented.
- Search has no debounce -- filters on every keystroke.
- Export filenames are hardcoded (`results.csv`, `results.json`) -- no customization.
- No column visibility toggle (show/hide columns).

---

## State Management

### Store: `src/store/workspaceStore.ts` (Zustand)

The entire application state lives in a single Zustand store with 526 lines. Key data flows:

| Data | Source | Consumers |
|---|---|---|
| Catalog/Database lists | Flink SQL `SHOW CATALOGS` / `SHOW DATABASES` | `App.tsx` Dropdowns |
| Tree nodes | Flink SQL `SHOW TABLES/VIEWS/FUNCTIONS` | `TreeNavigator` |
| Statements array | User actions + API polling | `App.tsx` mapping, `EditorCell` |
| Toast notifications | Store actions on success/error | `Toast` component |

### API Layer

| File | Role |
|---|---|
| `src/config/environment.ts` | Reads 9 `VITE_*` env vars with defaults |
| `src/api/confluent-client.ts` | Axios instance with Basic Auth, request/response logging interceptors, CORS proxy via `/api/flink` |
| `src/api/flink-api.ts` | All Confluent Flink SQL v1 API calls: execute, status, results, cancel, list, SHOW commands, DESCRIBE |

### Execution Flow (`workspaceStore.ts` lines 302-467)

1. Set status PENDING, clear previous results/error
2. POST SQL to Confluent API -> get statement name
3. Set status RUNNING
4. Poll loop (max 600 attempts, 1s interval):
   - Check if cancelled locally
   - GET statement status
   - If FAILED: throw error
   - If COMPLETED or RUNNING: GET results with cursor pagination
   - Append rows, FIFO cap at 5000 rows
   - Update store with accumulated results
   - If COMPLETED and no next cursor: done, show success toast
   - Otherwise: continue polling
5. On error: set ERROR status, show error toast

---

## File Index

| File | Lines | Purpose |
|---|---|---|
| `src/main.tsx` | 10 | React entry point with StrictMode |
| `src/App.tsx` | 109 | Root layout shell |
| `src/index.css` | 108 | Design tokens, reset, base styles, animations |
| `src/App.css` | 908 | All component styles |
| `src/config/environment.ts` | 44 | Environment variable configuration |
| `src/api/confluent-client.ts` | 67 | Axios HTTP client with auth |
| `src/api/flink-api.ts` | 282 | Flink SQL API functions |
| `src/store/workspaceStore.ts` | 525 | Zustand global state store |
| `src/types/index.ts` | 72 | TypeScript type definitions |
| `src/components/EditorCell/EditorCell.tsx` | 257 | SQL editor cell component |
| `src/components/EditorCell/index.ts` | 1 | Barrel export |
| `src/components/ResultsTable/ResultsTable.tsx` | 190 | Query results table component |
| `src/components/ResultsTable/index.ts` | 1 | Barrel export |
| `src/components/TreeNavigator/TreeNavigator.tsx` | 188 | Sidebar tree navigator |
| `src/components/TreeNavigator/index.ts` | 1 | Barrel export |
| `src/components/Dropdown/Dropdown.tsx` | 91 | Searchable dropdown component |
| `src/components/Dropdown/index.ts` | 1 | Barrel export |
| `src/components/ui/Toast.tsx` | 48 | Toast notification component |
| `src/vite-env.d.ts` | -- | Vite type declarations |
