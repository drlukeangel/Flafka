# PRD: Statement Status Bar (Phase 2.1)

## Overview

Each editor cell should display a status bar below the Monaco editor showing contextual execution metadata: the start time of the most recent execution, the current statement status with a colored indicator dot, and the server-assigned statement name.

## Goals

- Surface execution metadata inline with each cell rather than relying solely on the header badge
- Give users immediate visual feedback on when execution began, what phase the statement is in, and which server-side statement name was assigned
- Only show the bar after the statement has been executed at least once (gate on `startedAt`)

## Changes Required

### 1. `src/types/index.ts`

Add `startedAt?: Date` to the `SQLStatement` interface. This field records the moment the user triggered execution (when status transitions to `PENDING`).

```ts
export interface SQLStatement {
  // ... existing fields ...
  startedAt?: Date;
}
```

### 2. `src/store/workspaceStore.ts`

In `executeStatement`, when the status is set to `PENDING`, also set `startedAt: new Date()`. This captures the wall-clock time at invocation.

```ts
set((state) => ({
  statements: state.statements.map((s) =>
    s.id === id
      ? { ...s, status: 'PENDING' as StatementStatus, error: undefined, results: undefined, startedAt: new Date() }
      : s
  ),
}));
```

### 3. `src/components/EditorCell/EditorCell.tsx`

Insert a status bar `<div>` between `.cell-editor` and the error/results sections. The bar is conditional on `statement.startedAt` being set. It shows:

- **START TIME** — formatted with `toLocaleTimeString()`
- **STATUS** — colored dot (`status-dot` class variant) plus status text
- **STATEMENT** — `statement.statementName` truncated with ellipsis via CSS

```tsx
{statement.startedAt && (
  <div className="statement-status-bar">
    <div className="status-bar-item">
      <span className="status-bar-label">START TIME:</span>
      <span>{statement.startedAt.toLocaleTimeString()}</span>
    </div>
    <div className="status-bar-item">
      <span className="status-bar-label">STATUS:</span>
      <span className={`status-dot ${statement.status.toLowerCase()}`}></span>
      <span>{statement.status}</span>
    </div>
    {statement.statementName && (
      <div className="status-bar-item">
        <span className="status-bar-label">STATEMENT:</span>
        <span className="statement-name">{statement.statementName}</span>
      </div>
    )}
  </div>
)}
```

### 4. `src/App.css`

Add CSS rules for the status bar and its child elements. Colors rely on existing design token CSS variables so the bar automatically adapts to any future theming.

```css
.statement-status-bar { ... }
.status-bar-item { ... }
.status-bar-label { ... }
/* .status-dot variants: running, completed, error, pending, cancelled, idle */
.statement-name { max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
```

## Status Dot Color Mapping

| Status        | Color                        |
|---------------|------------------------------|
| RUNNING       | `var(--color-success)` green |
| COMPLETED     | `var(--color-success)` green |
| ERROR         | `var(--color-error)` red     |
| PENDING       | `var(--color-warning)` amber |
| CANCELLED     | `var(--color-text-tertiary)` |
| IDLE          | `var(--color-text-tertiary)` |

## Acceptance Criteria

- Status bar is hidden for cells that have never been executed (`startedAt` is undefined)
- Start time displays correctly as locale time string
- Colored dot reflects current statement status
- Statement name is truncated with ellipsis when longer than 300px
- TypeScript compiles without errors

---

## Implementation Notes

**Date implemented:** 2026-02-28

### Files changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `startedAt?: Date` to `SQLStatement` interface, placed after `lastExecutedAt` |
| `src/store/workspaceStore.ts` | Added `startedAt: new Date()` to the PENDING status update inside `executeStatement` |
| `src/components/EditorCell/EditorCell.tsx` | Inserted status bar JSX between `.cell-editor` div and the error/results conditional blocks |
| `src/App.css` | Added `.statement-status-bar`, `.status-bar-item`, `.status-bar-label`, `.status-dot` variants, and `.statement-name` rules before the Responsive section |

### CSS note

`.status-dot.running` already existed in App.css with a pulse animation. The new rules for `.completed`, `.error`, `.pending`, `.cancelled`, and `.idle` variants were added alongside it. No rule conflicts were introduced.

### TypeScript verification

`npx tsc --noEmit` was run after all changes. The only TypeScript errors present are pre-existing issues unrelated to this feature:
- `workspaceStore.ts`: `findNodeById` referenced but not defined (pre-existing, from a separate in-progress feature)
- `TreeNavigator.tsx`: unused variables `selectedTableSchema`, `selectedTableName`, `schemaLoading` (pre-existing)

No errors were introduced by the Phase 2.1 changes.
