# Phase 3: Results Table Cell Click to Copy

## Overview

When a user clicks any cell in the results table, the cell value is copied to the clipboard and a brief toast notification confirms the action.

## Problem Statement

Users frequently need to copy individual values from query results — primary keys, IDs, timestamps, or other field values — to use in other queries, tools, or documents. Currently there is no way to do this without manually selecting text inside a cell, which is error-prone due to text truncation (`text-overflow: ellipsis`).

## Goals

- Zero-friction value extraction from results table cells
- Clear confirmation that the copy succeeded
- Visual affordance indicating cells are interactive (clickable)
- Graceful handling of null, undefined, and complex object values

## Non-Goals

- Copying entire rows or columns
- Multi-cell selection
- Custom copy format configuration

## User Stories

**As a data engineer**, I want to click a cell in the results table so that its full value is copied to my clipboard, even if it is truncated in the display.

**As a data analyst**, I want to see confirmation that a value was copied so I know the clipboard operation succeeded before pasting elsewhere.

## Functional Requirements

| # | Requirement |
|---|-------------|
| FR-1 | Clicking any `<td>` in the results table copies the cell's value to the clipboard |
| FR-2 | A toast notification reading "Copied to clipboard" is shown after a successful copy |
| FR-3 | The full raw value is copied, not the truncated display value |
| FR-4 | Null and undefined values are copied as the string `"null"` |
| FR-5 | Object/array values are copied as their JSON string representation |
| FR-6 | A brief CSS highlight animation plays on the clicked cell to confirm the interaction |
| FR-7 | Cells display a pointer cursor on hover to signal they are clickable |
| FR-8 | Cells display a background highlight on hover |

## Technical Design

### ResultsTable.tsx changes

1. Import `useWorkspaceStore` and destructure `addToast`.
2. Add `useState<string | null>` for `copiedCell` to track which cell is animating.
3. Add `handleCellClick(value: unknown, cellKey: string)`:
   - Convert value to string: `null`/`undefined` → `"null"`, objects → `JSON.stringify(value)`, primitives → `String(value)`.
   - Call `navigator.clipboard.writeText(stringValue)`.
   - Call `addToast({ type: 'success', message: 'Copied to clipboard', duration: 2000 })`.
   - Set `copiedCell` to `cellKey`, then clear after 600 ms.
4. On each `<td>`, add:
   - `className={`results-cell${copiedCell === cellKey ? ' results-cell--copied' : ''}`}`
   - `onClick={() => handleCellClick(row[colName], cellKey)}`

### App.css changes

```css
.results-cell {
  cursor: pointer;
}

.results-cell:hover {
  background: var(--color-bg-hover);
}

@keyframes cellCopyFlash {
  0%   { background-color: #D1FAE5; }
  100% { background-color: transparent; }
}

.results-cell--copied {
  animation: cellCopyFlash 600ms ease-out forwards;
}
```

## Acceptance Criteria

- [ ] Clicking a cell with a string value copies the exact string (not truncated)
- [ ] Clicking a cell showing `null` copies the string `"null"`
- [ ] Clicking a cell with an object value copies valid JSON
- [ ] A success toast appears and disappears within ~2 seconds
- [ ] A green flash animation is visible on the clicked cell
- [ ] Hovering over any data cell shows a pointer cursor
- [ ] Hovering over any data cell shows a subtle background change
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] No regression to existing sort, filter, or export functionality

## Toast Duration

The copy toast uses `duration: 2000` (2 seconds) to be brief and unobtrusive, consistent with ephemeral confirmation patterns rather than the default 5-second duration used for query results.
