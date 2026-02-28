# Phase 2.2: Table Schema Panel

## Overview

When a user clicks a table or view node in the sidebar tree navigator, display a schema panel below the tree showing the table's column names and data types. This panel replaces the need to run `DESCRIBE <table>` manually in the SQL editor.

## Background

The `getTableSchema()` function already exists in `src/api/flink-api.ts` and correctly executes `DESCRIBE <catalog>.<database>.<table>` via the Flink SQL API, returning an array of `Column` objects (`{ name, type, nullable }`). As of Phase 2.1 this function was defined but never called anywhere in the application.

## Goals

- Surface table schema information directly in the sidebar without leaving the editor context.
- Reduce friction: no need to write and run a DESCRIBE statement to inspect a table.
- Provide a visual pattern consistent with Confluent Cloud's schema panel (column name on the left, monospace type on the right).

## Non-Goals

- Inline editing of schema.
- Showing primary keys, watermarks, or computed columns differently from regular columns.
- Caching schema responses between sessions.

## User Story

> As a Flink SQL developer, when I click on a table in the workspace explorer, I want to see that table's column names and types in the sidebar so I can write accurate queries without context-switching.

## Acceptance Criteria

1. Clicking a `table` or `view` node in the tree triggers a schema fetch.
2. A loading indicator is shown while the schema is being fetched.
3. Once loaded, each column is displayed as a row: `column_name` (left) and `TYPE` (right).
4. The panel header shows the selected table name.
5. If the schema returns no columns, "No columns found" is displayed.
6. Clicking a different table replaces the previous schema.
7. Clicking a non-table node (catalog, database, Tables group, etc.) does not clear or update the panel.

## Technical Design

### State Changes (workspaceStore.ts)

Add three new state fields and one new action to `WorkspaceState`:

| Field | Type | Initial Value | Purpose |
|---|---|---|---|
| `selectedTableSchema` | `Column[]` | `[]` | Columns returned by DESCRIBE |
| `selectedTableName` | `string \| null` | `null` | Display name in panel header |
| `schemaLoading` | `boolean` | `false` | Show spinner while fetching |

New action: `loadTableSchema(catalog, database, tableName) => Promise<void>`
- Sets `schemaLoading: true`
- Calls `flinkApi.getTableSchema(catalog, database, tableName)`
- Sets `selectedTableSchema` and clears `schemaLoading`

Modify `selectTreeNode`:
- When the selected node has type `table` or `view`, extract `catalog` and `database` from `node.metadata` and call `loadTableSchema`.
- Set `selectedTableName` to `node.name`.

### Component Changes (TreeNavigator.tsx)

Add a `schema-panel` div rendered after the `tree-content` div, inside the `tree-navigator` wrapper. The panel is only rendered when `selectedTableName` is non-null. It shows:
- A header with the table name.
- A spinner row when `schemaLoading` is true.
- A list of `schema-column` rows (name + type) when the schema is loaded.
- An empty state message when the schema loaded but returned no columns.

### Style Changes (App.css)

Add CSS classes: `.schema-panel`, `.schema-header`, `.schema-section`, `.schema-section-title`, `.schema-column`, `.column-name`, `.column-type`, `.schema-loading`, `.schema-empty`.

The panel has `max-height: 250px` with `overflow-y: auto` and `flex-shrink: 0` so it does not compress the tree.

## Implementation Notes

- Populated after implementation on 2026-02-28.
- `selectTreeNode` now uses a helper `findNodeById` to traverse the nested tree structure and retrieve the full node object (including `metadata`) from just the node ID.
- The `findNodeById` helper is implemented as a local recursive function inside the store, not exported.
- `FiLoader` was already imported in `TreeNavigator.tsx` — no new icon library imports required.
- TypeScript strict mode passes with `npx tsc --noEmit` (see Step 4 verification).
