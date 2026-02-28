# Phase 3: Smart Collapse Preview

## Overview

When an editor cell is collapsed, display a meaningful one-line summary instead of a blank or empty state. The preview surface lets users quickly scan the notebook to understand what each cell does without expanding it.

## Problem

Currently, collapsing a cell shows a naive preview: the raw first line of `statement.code` sliced to 80 characters. This has several deficiencies:

- Comment-only headers (e.g. `-- Query customers`) are not useful SQL previews.
- Empty leading lines produce a blank or "..." preview.
- No status signal — the user cannot tell whether the cell ran, errored, or is still running.
- No result count — the user cannot tell how many rows the last execution produced.

## Goals

1. Show the first meaningful SQL line (skip blank lines and `--` comments).
2. Truncate long lines to 60 characters with a trailing `...`.
3. Render the existing status badge inline so users see execution state at a glance.
4. Show a row count suffix when results are available.

## Non-Goals

- Syntax highlighting in the preview line (out of scope for this phase).
- Multi-line previews.
- Persisting the preview independently from `statement.code`.

## User Stories

- As a user with many collapsed cells, I can scan the notebook and identify which cell runs which query without expanding each one.
- As a user, I can see at a glance whether a collapsed cell completed successfully, errored, or is still running.
- As a user, I can see how many rows a completed query returned without expanding the cell.

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | Collapsed cell shows a single horizontal line of content below the header. |
| 2 | Preview text is the first non-blank, non-comment SQL line from `statement.code`. |
| 3 | Lines longer than 60 chars are truncated with `...`. |
| 4 | Status badge (Pending / Running / Completed / Error / Cancelled) renders to the right of the SQL text. |
| 5 | When `statement.results` is non-empty, `(N rows)` appears after the badge in a muted colour. |
| 6 | Preview renders in a monospace font. |
| 7 | TypeScript compiles without errors (`npx tsc --noEmit`). |

## Technical Design

### Helper Function

```ts
function getPreviewLine(code: string): string {
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    }
  }
  return code.slice(0, 60) || '(empty)';
}
```

### JSX

Replace the existing collapsed preview block:

```tsx
{statement.isCollapsed && (
  <div className="cell-collapsed-preview">
    <code className="cell-collapsed-sql">{getPreviewLine(statement.code)}</code>
    {getStatusBadge()}
    {hasResults && (
      <span className="cell-collapsed-rows">
        ({statement.totalRowsReceived ?? statement.results?.length} rows)
      </span>
    )}
  </div>
)}
```

### CSS

```css
.cell-collapsed-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  background-color: var(--color-surface-secondary);
  border-top: 1px solid var(--color-border);
  overflow: hidden;
  white-space: nowrap;
}

.cell-collapsed-sql {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--color-text-primary);
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-collapsed-rows {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
```

## File Impact

| File | Change |
|------|--------|
| `src/components/EditorCell/EditorCell.tsx` | Add `getPreviewLine()` helper; update collapsed-state JSX |
| `src/App.css` | Update `.cell-collapsed-preview`; add `.cell-collapsed-sql`, `.cell-collapsed-rows` |

## Open Questions

- Should the preview update live while typing when collapsed? (Currently: yes, because it reads `statement.code` on each render.)
- Should `/* block comments */` also be skipped? (Out of scope for this phase; only `--` line comments are skipped.)
