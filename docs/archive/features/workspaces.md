# Saved Workspaces

## Overview

Saved Workspaces allow users to snapshot the entire workspace state — SQL cells + stream card configurations — under a name and restore it from the sidebar in one click.

This solves the problem of re-creating complex multi-step setups (e.g., after running a Java UDF quickstart with 3 SQL cells + a stream card in produce mode with a dataset pre-selected) every session.

## User Journey

### Saving
1. Set up your workspace (SQL cells, stream cards, datasets)
2. Click **Save** in the header (next to Stop All/Delete All), **or** open the Workspaces panel from the nav rail and click **Save Current**
3. Give the workspace a name (auto-generated fun name pre-filled, full text selected) and press Enter or click Save
4. The workspace is snapshotted and appears in the Workspaces panel

### Opening
1. Open the Workspaces panel (Layers icon in nav rail, workspace section)
2. Find the workspace (sorted newest-first; use search to filter)
3. Click the folder icon → an inline confirmation row appears explaining what will be replaced
4. Click **Open** to confirm
5. Current SQL cells and stream cards are replaced; running statements are cancelled first

### Reconnecting RUNNING statements
- If a SQL statement was RUNNING when the workspace was saved, opening it will attempt to reconnect
- The app checks the Flink API to determine current statement status:
  - Still RUNNING → resumes polling (stream continues live)
  - COMPLETED/FAILED → updates status accordingly
  - 404 (GC'd) → marks IDLE
  - 5xx/network error → keeps RUNNING, shows toast warning

## What Is Saved

| Item | Saved? | Notes |
|------|--------|-------|
| SQL code | ✓ | Per cell |
| Statement label | ✓ | |
| Collapsed state | ✓ | |
| Scan mode params | ✓ | scanMode, scanTimestampMillis, etc. |
| Statement name (if RUNNING) | ✓ | Used for reconnect |
| Stream card topic | ✓ | |
| Stream card mode (consume/produce) | ✓ | |
| Data source (synthetic/dataset) | ✓ | |
| Selected dataset ID | ✓ | Validated on open |
| Scan mode (earliest/latest) | ✓ | |

## What Is NOT Saved

| Item | Reason |
|------|--------|
| Query results | Too large; re-run to get fresh data |
| Statement error messages | Ephemeral |
| Background statement results | Runtime only |
| Collapsed state of stream cards | Runtime only |

## Limits

- Maximum **20 saved workspaces** per browser (localStorage)
- Saving at max capacity shows a toast error; user must delete one first
- Storage full (`QuotaExceededError`) shows a toast error

## Stream Card Fidelity

- **Consume mode**: restored with `scanMode` (earliest/latest offset)
- **Produce-consume mode**: restored with `dataSource` (synthetic/dataset) and `selectedDatasetId`
- **Missing dataset**: if a saved dataset ID no longer exists in the schema datasets store → automatically falls back to synthetic mode + shows toast warning

## Reconnect Behavior Details

After opening a workspace, any statements that were RUNNING are reconnected in parallel (`Promise.allSettled`):

```
saved statementName present
  → GET /statements/{name}
  → spec.stopped === true OR phase STOPPED/CANCELLED → mark CANCELLED
  → phase RUNNING → setTimeout(resumeStatementPolling, 100)
  → phase COMPLETED → mark COMPLETED
  → phase FAILED → mark ERROR, fetch error detail
  → 404 → statement GC'd → mark IDLE
  → 5xx/network → keep RUNNING, show toast warning
```

## Architecture

### Key Files
- `src/store/workspaceStore.ts` — 5 new actions: `saveCurrentWorkspace`, `openSavedWorkspace`, `deleteSavedWorkspace`, `renameSavedWorkspace`, `updateStreamCardConfig`
- `src/components/WorkspacesPanel/WorkspacesPanel.tsx` — sidebar panel
- `src/components/WorkspacesPanel/WorkspacesPanel.css` — styles
- `src/types/index.ts` — `SavedWorkspace`, `SavedWorkspaceStatement`, `SavedWorkspaceStreamCard` interfaces
- `src/components/NavRail/NavRail.tsx` — `workspaces` nav item
- `src/App.tsx` — Save button in header, workspace name display, dialog

### Storage
- Persisted via Zustand `persist` middleware (`partialize` includes `savedWorkspaces`)
- Migration branch added: `savedWorkspaces: state.savedWorkspaces ?? []`
- `streamCards` store entries extended with mutable config fields (`mode`, `dataSource`, `selectedDatasetId`, `scanMode`) updated by `updateStreamCardConfig` on user events in `StreamCard.tsx`
