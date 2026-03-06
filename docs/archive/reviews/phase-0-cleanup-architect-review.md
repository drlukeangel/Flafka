# Architect Review: Phase 0 Cleanup

## Verdict: APPROVE WITH NOTES

All proposed changes are architecturally sound. One item warrants a design discussion before implementation (inline delete confirmation scope), and two clarifications are needed to ensure the implementation does not introduce regressions. No blockers.

---

## Findings

### [APPROVE] Dead store state removal is verified clean

The PRD's dead-state claims are accurate. Cross-referencing every reference in `src/`:

- `activeStatementId` - written in `addStatement`, `deleteStatement`, `duplicateStatement`, and `setActiveStatement`. Read by **zero** components. Safe to remove.
- `resultsFilter`, `resultsSort`, `resultsSearch` - written only in `workspaceStore.ts`. Read by **zero** components. `ResultsTable` maintains its own `searchTerm`, `sortConfig`, and filter state entirely in local `useState`. Safe to remove.
- `isLoading` - initialised to `false`, never set to `true` anywhere. The tree loading state uses the separate `treeLoading` field (which is used correctly). Safe to remove.

All four setter actions (`setActiveStatement`, `setResultsFilter`, `setResultsSort`, `setResultsSearch`) are likewise called nowhere outside the store itself.

### [APPROVE] Filter and SortConfig types must be retained

The PRD correctly instructs removing `Filter` and `SortConfig` from the workspaceStore import line "only if no longer used in the file after cleanup." However, these types are **not dead**:

- `SortConfig` is imported and used in `src/components/ResultsTable/ResultsTable.tsx` (line 2, line 20).
- `Filter` is currently only used in the store state being removed.

After cleanup, `Filter` will genuinely be unused across the entire codebase and can be removed from `src/types/index.ts`. `SortConfig` must stay — removing it would break `ResultsTable`. The PRD does not propose removing either type from `types/index.ts`, so no action is needed there beyond removing them from the store import line. Implementation must verify this distinction.

### [APPROVE] ComputePoolStatus removal is safe

`ComputePoolStatus` in `src/types/index.ts` (lines 67-72) has exactly one occurrence in the entire codebase: its own declaration. It is never imported, never referenced, and can be deleted without consequence. The fields (`phase`, `detail`, `cfu_used`, `cfu_max`) do not map to any currently consumed API response shape in `flink-api.ts`.

### [APPROVE] TreeNode field removals are safe

- `parentId?: string` on `TreeNode` - never populated anywhere in `loadTreeData()` or in any other tree-building code. Safe to remove.
- `metadata.readOnly?: boolean` - never set in `loadTreeData()` and never read in `TreeNavigator.tsx`. Safe to remove.

Note that `TreeNode.isLoading` is referenced in `TreeNavigator.tsx` (line 157: `node.isLoading`). The PRD does not touch `isLoading` on `TreeNode` — only `isLoading: boolean` on `WorkspaceState`. These are distinct fields. No risk here, but the implementer should not conflate them.

### [APPROVE] Duplicate Column interface removal is correct

`src/api/flink-api.ts` declares its own `Column` interface (lines 49-53) that is structurally identical to `Column` in `src/types/index.ts`. The local declaration in `flink-api.ts` is used by `getTableSchema`'s return type. No external caller imports `Column` directly from `flink-api` — confirmed by search. The fix is straightforward: delete the local declaration and add `import type { Column } from '../../types'`. The `workspaceStore.ts` already imports `Column` from `../types` and uses it in the polling loop, so the canonical definition is already the one in `types/index.ts`.

### [APPROVE] addStatement splice approach is correct and performant

The proposed change to `addStatement(code?: string, afterId?: string)` is backward compatible: all three existing callers (`App.tsx` toolbar button, `TreeNavigator.tsx` double-click, `EditorCell.tsx` add button) pass zero or one argument. The new `afterId` parameter is additive.

The `findIndex + splice` pattern on an array of SQL statements is appropriate. Statement counts in this UI will realistically be low (single digits to tens), making the O(n) scan cost negligible. Zustand's `set()` call with array mutation via splice is fine as long as the array is copied first (i.e., `const newStatements = [...state.statements]; newStatements.splice(...)`), which is standard practice. The PRD does not spell out this copy step explicitly — the implementer must not mutate `state.statements` in place.

The `handleAddCell` change in `EditorCell.tsx` from `addStatement()` to `addStatement(undefined, statement.id)` is correct. The `App.tsx` toolbar "Add Statement" button continues to call `addStatement()` with no `afterId`, which appends to end — the right behavior for a global toolbar action.

### [CONCERN] Inline delete confirmation: auto-dismiss timer creates a usability edge case

The PRD proposes auto-dismissing the inline confirmation after 3 seconds. This is the right pattern for avoiding `window.confirm()` (which blocks the JS thread and looks out of place in a modern SPA). However, the 3-second auto-dismiss introduces a subtle edge case: if the user clicks the trash icon, looks away briefly, and the confirmation disappears, the action silently fails with no feedback. The user may believe the delete succeeded (or is confused about the cell's continued presence).

**Recommendation:** Auto-dismiss is acceptable, but add a brief visual indicator when it times out (e.g., the trash icon briefly flashes back to normal, or a micro-toast "Delete cancelled"). Alternatively, increase to 5 seconds to align with the existing toast duration used throughout the app. This is not a blocker — raise during implementation.

### [CONCERN] Inline confirmation state does not survive re-renders driven by rapid parent updates

`showDeleteConfirm` will be local `useState` in `EditorCell`. If the parent re-renders `EditorCell` with a new `statement` prop (e.g., because another cell's status changed and Zustand re-notified all subscribers), the component instance is preserved via `key={statement.id}` in `App.tsx`, so the local state is **not** reset. This is safe.

However, if a statement transitions to `RUNNING` or `COMPLETED` while the delete confirmation is showing, the cell header will re-render with updated status badges while the "Delete? Yes / No" buttons are also visible. Ensure the layout accommodates both being present simultaneously without overflow or misalignment — this is a CSS concern, not an architectural one, but worth verifying during implementation.

### [APPROVE] No shared modal component needed at this stage

The PRD explicitly chooses inline confirmation over a shared modal. This is the correct call for Phase 0. A shared modal system would introduce a new abstraction (modal state management, portal rendering, z-index layering) that is out of scope for a cleanup pass. The inline pattern is self-contained, easy to test, and sufficient for a single use-case. If delete confirmation is needed in three or more places in future, revisit with a shared dialog component at that time.

### [APPROVE] No coupling risks introduced

The changes are confined to: store internals (removing unused state), a type file (removing unused declarations), an API file (consolidating a duplicate type), and a single component (EditorCell). The `addStatement` signature change is additive and all existing callers remain valid. No new dependencies are created between components.

---

## Recommendations

1. **When implementing splice in addStatement**, copy the array before mutating: `const updated = [...state.statements]; updated.splice(insertIndex + 1, 0, newStatement); return { statements: updated };`. Do not splice `state.statements` directly.

2. **Do not remove `SortConfig` from `src/types/index.ts`**. It is actively used by `ResultsTable`. Only `Filter` becomes truly orphaned after the store cleanup — and even then, removing it is optional since it is a well-defined domain type that is likely to be used when filter functionality is eventually wired up.

3. **Reconsider removing `Filter` entirely**. The type is well-formed and describes a genuine domain concept (`ResultsTable` has the filtering UI already built in local state). Keeping it in `types/index.ts` costs nothing and avoids having to recreate it in Phase 1 if results filtering is moved to the store. If the team's preference is strict "no unused exports," then delete it, but note the likely re-introduction cost.

4. **Auto-dismiss timer**: align with the existing 5-second toast duration rather than 3 seconds, or add dismissal feedback to avoid user confusion.

5. **Verify the `isLoading` (WorkspaceState) vs `isLoading` (TreeNode) distinction** before implementation. Both fields are named `isLoading` but exist on different interfaces. Only the store-level `WorkspaceState.isLoading` is being removed. `TreeNode.isLoading` stays.
