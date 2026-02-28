# Phase 0: Codebase Cleanup

## Problem Statement
The codebase contains dead state fields, unused types, duplicate interfaces, and minor UX issues that add confusion and technical debt. These need to be cleaned up before building new features.

## Changes

### 0.1 Remove Dead Store State (`src/store/workspaceStore.ts`)

**Remove from interface + initial values + implementations:**
- `activeStatementId: string | null` - Set by addStatement/duplicateStatement but never read by any component
- `resultsFilter: Filter[]` - Never used by components (ResultsTable has local state)
- `resultsSort: SortConfig | null` - Never used by components (ResultsTable has local state)
- `resultsSearch: string` - Never used by components (ResultsTable has local state)
- `isLoading: boolean` - Always false, never set to true

**Remove actions:**
- `setActiveStatement` (sets unused activeStatementId)
- `setResultsFilter` (sets unused resultsFilter)
- `setResultsSort` (sets unused resultsSort)
- `setResultsSearch` (sets unused resultsSearch)

**Remove `activeStatementId` references in:**
- `addStatement` - remove `activeStatementId: newStatement.id` from set()
- `deleteStatement` - remove `activeStatementId: state.activeStatementId === id ? null : state.activeStatementId`
- `duplicateStatement` - remove `activeStatementId: newStatement.id` from set()

**Remove unused type imports from store file:**
- Remove `Filter` and `SortConfig` from the store's import line (they are no longer used in the store after cleanup)
- **DO NOT remove `Filter` or `SortConfig` from `types/index.ts`** — `SortConfig` is actively used by `ResultsTable.tsx`. Keep `Filter` in types as it represents a real domain concept needed for future column filtering.

### 0.2 Remove Dead Types (`src/types/index.ts`, `src/api/flink-api.ts`)

**In `src/types/index.ts`:**
- Remove `ComputePoolStatus` interface (lines 67-72) - never imported anywhere
- Remove `parentId?: string` from TreeNode interface - never populated
- Remove `readOnly?: boolean` from TreeNode.metadata - never set or checked
- **KEEP** `Filter` and `SortConfig` types — they are used or will be used

**In `src/api/flink-api.ts`:**
- Remove duplicate `Column` interface (lines 49-53)
- Import `Column` from `../../types` instead if used by `getTableSchema` return type

### 0.3 Fix addStatement Insert Position

**In `src/store/workspaceStore.ts`:**
- Change `addStatement` signature from `(code?: string) => void` to `(code?: string, afterId?: string) => void`
- When `afterId` is provided, insert new statement AFTER that statement using findIndex + splice on a COPY of the array
- **IMPORTANT**: If `findIndex` returns `-1` (afterId not found), fall back to appending at end (not inserting at index 0)
- When `afterId` is not provided, append to end (backward compatible)

**Callers (3 total):**
1. `src/components/EditorCell/EditorCell.tsx` — `handleAddCell`: Change to `addStatement(undefined, statement.id)` (insert after current cell)
2. `src/components/TreeNavigator/TreeNavigator.tsx` — `handleDoubleClick` line 38: Calls `addStatement(query)` — NO CHANGE needed (afterId defaults to undefined, appends to end, which is correct UX for tree double-click)
3. `src/App.tsx` — toolbar "Add Statement" button line 79: Calls `addStatement()` — NO CHANGE needed (appends to end)

### 0.4 Replace confirm() Dialog

**In `src/components/EditorCell/EditorCell.tsx`:**
- Replace `window.confirm('Are you sure...')` with an inline confirmation state
- Add `const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)`
- Render inline "Delete? Yes / No" buttons when showDeleteConfirm is true
- Auto-dismiss after 5 seconds (consistent with toast duration)
- **Use `useEffect` with `clearTimeout` cleanup** to avoid setState on unmounted component
- Show brief "Cancelled" feedback when auto-dismissed

## Acceptance Criteria
- [ ] No TypeScript errors after cleanup
- [ ] `npm run build` succeeds
- [ ] All existing functionality still works (run query, cancel, delete, duplicate, add cell)
- [ ] + button inserts cell after current cell, not at end
- [ ] Delete shows inline confirmation, not browser dialog
- [ ] No unused imports remain

## Files Modified
1. `src/store/workspaceStore.ts` - Remove dead state, fix addStatement
2. `src/types/index.ts` - Remove dead types
3. `src/api/flink-api.ts` - Remove duplicate Column, import from types
4. `src/components/EditorCell/EditorCell.tsx` - Fix addStatement call, replace confirm()

## Edge Cases
- Deleting the last statement should still create a placeholder (existing behavior)
- addStatement with no afterId should still append to end
- addStatement with stale/invalid afterId should fall back to append (not insert at index 0)
- Multiple rapid deletes should not cause race conditions
- Delete confirmation auto-dismiss timer must be cleaned up if component unmounts
- TreeNavigator double-click still appends to end (not after a specific cell)
- `isLoading` on `TreeNode` type (used by TreeNavigator) is a DIFFERENT field from store-level `isLoading` — do NOT touch TreeNode.isLoading

## Review Status
- [x] Architect Review: APPROVE WITH NOTES (see phase-0-cleanup-architect-review.md)
- [x] Engineer Review: APPROVED after revisions (see phase-0-cleanup-engineer-review.md)
- Revisions addressed: TreeNavigator caller documented, Filter/SortConfig clarified, useEffect cleanup, findIndex guard

## Implementation Notes

**Completed:** 2026-02-28

### Changes from original PRD:
- Auto-dismiss on delete confirmation was REMOVED per UX review (too short without visual countdown)
- Button labels changed from "Yes/No" to "Delete/Cancel" per UX review
- + button tooltip changed from "Add new statement" to "Insert cell below"
- Cell header gets red tint (`.confirming-delete` class) during delete confirmation
- `useEffect` import removed since auto-dismiss was removed

### Review artifacts:
- Architect review: `docs/features/phase-0-cleanup-architect-review.md`
- Engineer review: `docs/features/phase-0-cleanup-engineer-review.md`
- QA report: `docs/features/phase-0-cleanup-qa-report.md` (27/28 pass, 1 fixed)
- UX report: `docs/features/phase-0-cleanup-ux-report.md` (all issues fixed)
