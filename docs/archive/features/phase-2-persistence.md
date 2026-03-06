# Phase 2.4: Workspace Persistence

## Overview

Save workspace state (SQL statements, catalog selection, database selection) to localStorage so that it persists across page reloads. Display a "Last saved" timestamp in the editor footer to give users confidence their work is being retained.

## Status

- **Phase**: 2.4
- **Date**: 2026-02-28
- **State**: Implemented

## Problem

Currently, any page refresh causes the user to lose all their SQL statements and context selections (catalog/database). This is disruptive during development, debugging, and iterative query writing workflows.

## Goals

1. Persist SQL statement content and metadata to localStorage automatically.
2. Persist the selected catalog and database.
3. Restore state on page load without requiring user action.
4. Show a "Last saved at" timestamp in the footer so users can see when the state was last written.
5. Do NOT persist transient data that cannot be restored server-side (query results, error details, running state).

## Non-Goals

- Persisting query results (too large and stale after reload).
- Persisting RUNNING/PENDING statement status (server-side state is lost on reload; these are reset to IDLE).
- Persisting the tree navigator state (reloaded from API on startup).
- Persisting toast notifications (ephemeral UI state).
- Multi-tab sync or conflict resolution.
- Server-side persistence or user accounts.

## Technical Design

### Library

Zustand v5's built-in `persist` middleware (from `zustand/middleware`) is used. This serializes a selected slice of state to `localStorage` under the key `flink-workspace`.

### Persisted State Slice (via `partialize`)

| Field | Persisted | Notes |
|---|---|---|
| `statements[].id` | Yes | Stable identifier |
| `statements[].code` | Yes | The SQL the user wrote |
| `statements[].status` | Yes (sanitized) | RUNNING/PENDING reset to IDLE |
| `statements[].createdAt` | Yes | Preserved for ordering |
| `statements[].isCollapsed` | Yes | UI preference |
| `statements[].results` | No | Too large; stale after reload |
| `statements[].error` | No | Transient; cleared on re-run |
| `statements[].statementName` | No | Server-side handle; no longer valid |
| `statements[].columns` | No | Re-fetched with results |
| `catalog` | Yes | User's catalog selection |
| `database` | Yes | User's database selection |
| `lastSavedAt` | Yes | ISO timestamp of last write |
| `treeNodes` | No | Reloaded from API |
| `toasts` | No | Ephemeral |

### Status Reset on Restore

Statements that were RUNNING or PENDING when the page was closed cannot be resumed after reload because the Flink server-side statement context is gone. These are reset to IDLE so the user can re-execute them manually.

### lastSavedAt

A new `lastSavedAt: string | null` field is added to `WorkspaceState`. It is set to the current ISO timestamp by `partialize` on every write. The footer reads this value and renders a human-friendly local time string.

## UI Changes

### Editor Footer

Before:
```
[statement count]            [cloud provider | region]
```

After:
```
[statement count]   Last saved at HH:MM:SS AM/PM   [cloud provider | region]
```

The "Last saved at" text only renders when `lastSavedAt` is non-null (i.e., after the first save cycle completes).

### CSS

A `.last-saved` class is added with:
- `font-size: 12px` (matches footer)
- `color: var(--color-text-tertiary)` (subtle, non-distracting)

## Files Changed

- `src/store/workspaceStore.ts` - Add persist middleware and `lastSavedAt` state field
- `src/App.tsx` - Import and render `lastSavedAt` in footer
- `src/App.css` - Add `.last-saved` CSS class

## Implementation Notes

- `createdAt` is stored as an ISO string in localStorage (JSON serialization); Zustand's persist middleware handles this automatically. No special hydration is needed for display purposes since the footer only uses `lastSavedAt`.
- The `partialize` function runs on every store mutation, so `lastSavedAt` always reflects the time of the most recent state write to localStorage.
- The store uses the `create<WorkspaceState>()()` double-invocation pattern required by Zustand v5 when wrapping with middleware.
- TypeScript type check (`npx tsc --noEmit`) passes with zero errors after implementation.
- The `lastSavedAt` field is initialized to `null` in the store's initial state; it transitions to a non-null string after the first persist write cycle completes, which means the footer label only appears after the first user interaction that triggers a state change (not on cold first load before any state exists in localStorage).
- `selectedTableSchema`, `selectedTableName`, `schemaLoading`, `treeNodes`, and `toasts` are intentionally excluded from persistence: schema data is re-fetched on tree node selection; tree data is re-fetched on load; toasts are ephemeral.
