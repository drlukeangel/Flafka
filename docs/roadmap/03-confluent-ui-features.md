# Confluent Cloud Workspace UI Features

**Date:** 2026-02-28
**Source:** Browser exploration of `https://confluent.cloud/workspaces/...`

---

## Overall Layout

```
+---+---+---------+----------------------------------------+
| N | T |  TREE   |  WORKSPACE HEADER                      |
| A | A |  SIDE   |  [name] [default] [user] [env] [gear]  |
| V | B |  BAR    |  Catalog [v]  Database [v]  (i)        |
|   | S |         +----------------------------------------+
|   |   |         |  CELL 1 (editor + status bar)          |
|   |   |         |  CELL 2 (editor + status bar + results)|
|   |   |         |  ...                                    |
|   |   +---------+----------------------------------------+
|   |   | SCHEMA  |  FOOTER: Last saved | N / M cells      |
+---+---+---------+----------------------------------------+
```

## Left Navigation Sidebar (Icon Rail)

Vertical icon rail, ~50px wide. Icons top-to-bottom:

| # | Icon | Tooltip | Purpose |
|---|------|---------|---------|
| 1 | House | Home | Confluent Cloud home dashboard |
| 2 | Hexagon | Environments | Environment management |
| 3 | Document | Statements | Statement management/history |
| 4 | Grid (active) | Workspaces | SQL workspaces (current page) |
| 5 | Connectors | Connectors | Kafka connectors |
| 6 | Arrows | Data Lineage | Stream lineage visualization |
| -- | separator | -- | -- |
| 7 | Chat bubble | Support | Help/support |
| 8 | Grid/doc | Documentation | Docs reference |

## Workspace Header

### Top Bar
- **Workspace name:** "example workspace" (editable)
- **Default badge:** Shows selected default database
- **User info:** "luke angel" with "User Account" badge
- **Environment:** "AWS | us-east-1" with `AWS.us-east-1.env-g52g3m.98c8`
- **Status:** Green dot + "Running" (compute pool status)
- **Settings gear:** Opens settings panel

### Catalog/Database Bar
- **Catalog dropdown:** "Catalog examples [v]"
- **Database dropdown:** "Database marketplace [v]"
- **Info icon (i):** Likely shows workspace/environment details

## Workspace Tabs
- Tab bar below header: "example workspace x" + "+" button to add new workspace tab
- Tabs are closeable (x button)
- Multiple workspace tabs supported

## Cell Editor

### Cell Structure
Each cell contains:
1. **Editor area** - Monaco-like SQL editor with:
   - Line numbers
   - Syntax highlighting (SQL keywords in purple/blue, strings in green)
   - Comment support (`--` comments shown in gray)
   - Auto-indent
   - Scrollbar (horizontal shown)

2. **Status bar** below editor:
   - **START TIME:** `2026-02-28T06:49:51.746976Z`
   - **STATEMENT STATUS:** Green dot + "Running" (or Completed, Failed, etc.)
   - **STATEMENT NAME:** Purple hyperlink like `example-workspace-450aa1ba-9949-4b9a-af56-63f76e650...`
   - **Stop button:** Red-ish "Stop" button on the right

3. **Cell action buttons** (left gutter, visible on hover):
   - **+** (plus): Add new cell after this one
   - **Copy** (clipboard icon): Duplicate cell
   - **Delete** (trash icon): Delete cell

4. **Collapse toggle**: Chevron (^) on the right side of cell to collapse/expand

### Cell Numbering
- Footer shows "3 / 20 cells" - current position and total count

## Results Table

(From exploring cells with results - streaming queries show live-updating tables)

### Features observed:
- Column headers with sort arrows
- Row data displayed in tabular format
- Row count displayed
- Scrollable within cell
- Results appear inline below the status bar within the same cell

## Schema Panel (Sidebar)

When clicking a table name in the tree (e.g., "orders"):

### Panel Header
- Table name "orders" with refresh icon (circular arrow)

### Schema Section
- "Schema (5)" - expandable with count
- Lists each column:
  - `order_id` — `VARCHAR(...)`
  - `customer_id` — `INT`
  - `product_id` — `VARCHAR(...)`
  - `price` — `DOUBLE`
  - `$rowtime` — `TIMESTAM...` (with lock/key icon indicating system column)

### Options Section
- "Options (7)" — expandable, likely shows table configuration

## Settings Panel

Clicking the gear icon opens a right-side panel:

### Workspace Settings
- **Workspace name:** Editable text field
- **Compute pool:** Dropdown selector
- **Service Account:** Display/selector
- **Delete workspace:** Destructive action button

## Statement Detail Panel

Clicking the statement name link opens a detail panel with 4 tabs:

### Activity Tab
- Messages in/out counts
- Scaling status
- CFU (Confluent Flink Unit) usage metrics

### Statement Properties Tab
- `sql.current-catalog`: value
- `sql.current-database`: value
- `sql.local-time-zone`: value

### SQL Content Tab
- Read-only view of the executed SQL statement

### Logs Tab
- Log entries from "Last 24h"
- Filterable/scrollable log viewer

## Footer

- **Left:** "Last saved at 2/28/26, 1:49 AM"
- **Right:** "3 / 20 cells" (current position / total)

## Tree Sidebar

### Structure
```
▼ examples [Read-only demo]
  ▼ marketplace
    ▼ Tables
      clicks
      orders (selected, highlighted)
      customers
      products
  ▼ default
    ▶ cluster_0
```

### Features
- Expand/collapse with chevrons
- "Read-only demo" badge on catalog
- Click to select (blue highlight)
- Click table → shows schema panel below
- Icons per type (table icon, database icon, etc.)

## Features NOT in Our App (Gap Analysis)

| Confluent Feature | Our Status |
|---|---|
| Workspace tabs (multiple workspaces) | Missing |
| Left nav icon rail | Missing |
| Statement status bar per cell | Missing |
| Statement name as clickable link | Missing |
| Statement detail panel (4 tabs) | Missing |
| Schema panel on table click | Missing (API exists!) |
| Settings panel | Missing (button exists, no handler) |
| Compute pool status (Running dot) | Missing (type exists!) |
| "Last saved" in footer | Missing |
| Cell position counter (3/20) | Partial (show count, not position) |
| Workspace name in header | Missing |
| Read-only demo badge | Missing |
| Options section in schema | Missing |
| Table refresh icon | Missing |
| Horizontal scrollbar in editor | Have it |
| Cell hover action buttons (left gutter) | We show them always, not on hover |
