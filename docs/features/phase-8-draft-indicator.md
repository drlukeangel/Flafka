# Phase 8: Draft Indicator Badge

**Status**: Design Phase
**Date**: 2026-02-28

## Problem Statement

Users cannot distinguish between statements that have been edited after their last execution and statements that match the code that was last run. This leads to confusion about whether changes have been made and whether a statement needs to be re-run.

Example: A user runs a statement, then edits it and forgets they made changes. Later, they see the old results displayed and assume the current code produced those results—creating a false understanding of what the query actually returns.

## Proposed Solution

Add a "Modified" badge indicator that appears next to the statement cell number when:
- The statement has been executed at least once (`lastExecutedCode` is not null)
- The current `code` differs from `lastExecutedCode` (the code at the time of last execution)

The badge is a small amber/yellow pill styled consistently with the existing status badges. It appears in the cell header next to the cell number and disappears when the code is reverted to match the last executed version.

## Files to Modify

1. **`src/types/index.ts`**
   - Add `lastExecutedCode?: string | null` to `SQLStatement` interface
   - This field stores the exact code as it was when the statement was last executed

2. **`src/store/workspaceStore.ts`**
   - Update `SQLStatement` creation/initialization to include `lastExecutedCode: null`
   - In `executeStatement` action: capture `statement.code` at the start as `submittedCode`, then set `lastExecutedCode: submittedCode` in the PENDING `set()` call (at statement transition to PENDING, not after polling completes)
   - In `addStatement` action: initialize new statements with `lastExecutedCode: null`
   - In `duplicateStatement` action: explicitly add `lastExecutedCode: null` to the duplicate override fields (alongside existing status/results/error resets)
   - Update `partialize` function to include `lastExecutedCode: s.lastExecutedCode ?? null` in the per-statement mapping for localStorage persistence

3. **`src/components/EditorCell/EditorCell.tsx`**
   - Add logic to determine if statement is modified: `isModified = statement.lastExecutedCode != null && statement.code.trim() !== statement.lastExecutedCode.trim()`
   - Use loose equality (`!= null`) to catch both null and undefined for backward compatibility with legacy persisted data
   - Use `.trim()` on both sides of the comparison to avoid false positives from trailing whitespace
   - Render "Modified" badge in cell header when `isModified === true`
   - Place badge in the `cell-header-center` section, after `getStatusBadge()` and before execution time

4. **`src/App.css`**
   - Add `.status-badge.modified` style:
     - Color: amber/warning color (use `var(--color-warning)`)
     - Background: amber surface color (use `var(--color-surface-warning)`)
     - Consistent padding/border-radius with other status badges (4px 8px, border-radius 4px)
     - Font size 12px, font-weight 500
     - Display as inline flex with gap and alignment matching other badges

## API Changes

No API changes. All changes are client-side state management and UI rendering.

## Type Changes

```typescript
// In src/types/index.ts - SQLStatement interface
export interface SQLStatement {
  id: string;
  code: string;
  status: StatementStatus;
  results?: Record<string, unknown>[];
  columns?: Column[];
  error?: string;
  executionTime?: number;
  totalRowsReceived?: number;
  statementName?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastExecutedAt?: Date;
  startedAt?: Date;
  isCollapsed?: boolean;
  lastExecutedCode?: string | null;  // NEW: the code at time of last execution
}
```

## Acceptance Criteria

- [ ] **New statements show no badge**: A freshly added statement with `lastExecutedCode: null` never displays the badge
- [ ] **Executing clears badge**: After running a statement, code matches `lastExecutedCode`, badge disappears
- [ ] **Editing shows badge**: Edit a previously-run statement → "Modified" badge appears immediately
- [ ] **Undoing removes badge**: Edit statement back to original code → badge vanishes (code === lastExecutedCode again)
- [ ] **Badge is visible in light mode**: Amber pill badge is readable on light background
- [ ] **Badge is visible in dark mode**: Amber pill badge is readable on dark background
- [ ] **Persistence works**: Reload page → statements retain their `lastExecutedCode` and badge shows/hides correctly
- [ ] **Duplication resets**: Duplicate a statement → new copy has `lastExecutedCode: null`, no badge
- [ ] **Statement lifecycle**: Create → Run (no badge) → Edit (badge appears) → Undo edit (badge gone) → Edit again (badge returns)

## Edge Cases

1. **Statement initially has no `lastExecutedCode`** → No badge shown (correct: never executed). Loose equality (`!= null`) catches both null and undefined for backward compatibility with legacy persisted data.
2. **Execute failed with ERROR or CANCELLED status** → Should still update `lastExecutedCode` so we track "the code we tried to run" for clarity
3. **User changes code while RUNNING** → Badge should appear; the badge reflects "code differs from what's currently executing"
4. **Very long code statements** → Badge still appears next to cell number (doesn't overflow)
5. **Code change via undo/redo** → Badge updates correctly (uses current `statement.code` comparison)
6. **Trailing whitespace** → Badge comparison uses `.trim()` on both sides to avoid false positives when code is unchanged but whitespace differs
7. **deleteStatement behavior** → When deleting the last statement and creating a replacement stub, the stub doesn't include `lastExecutedCode` field. This is fine since `undefined` is treated as never-executed, and the badge logic handles it correctly via loose equality check.

## Implementation Notes

- The badge is a **boolean check** (`isModified`), not a new state variable
- Computation happens in render: `isModified = statement.lastExecutedCode != null && statement.code.trim() !== statement.lastExecutedCode.trim()`
- Use loose equality (`!= null`) instead of strict to catch both null and undefined for backward compatibility
- Use `.trim()` on both sides to handle whitespace differences gracefully
- Capture `lastExecutedCode` **at the PENDING transition** (top of `executeStatement`) as `submittedCode`, then set it in the PENDING `set()` call—not after polling completes
- Explicitly reset `lastExecutedCode: null` in `duplicateStatement` override fields
- Persistence via `partialize` in zustand middleware using `lastExecutedCode: s.lastExecutedCode ?? null` per-statement mapping
- Badge styling follows the amber/warning color scheme to indicate "needs attention" without being an error
- No icon needed, just text: "Modified"

## Testing Strategy

1. **Manual UI testing**: Create statement → run → edit → verify badge appears/disappears
2. **localStorage test**: Run a statement, reload the page, verify `lastExecutedCode` persists and badge renders correctly
3. **Cross-browser test**: Light and dark mode, verify badge contrast in both themes
4. **Regression test**: Ensure existing features (duplicate, delete, collapse) still work with new field

---

## Design Review Status

Awaiting architect and engineer review before implementation.
