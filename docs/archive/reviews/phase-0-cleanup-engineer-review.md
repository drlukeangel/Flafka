# Engineer Review: Phase 0 Cleanup

## Verdict: NEEDS CHANGES

Three issues require resolution before implementation: a missed caller for `addStatement` in `TreeNavigator`, an incomplete type-removal plan for `Filter` and `SortConfig`, and a missing cleanup of the auto-dismiss timer on unmount for the inline delete confirmation. The rest of the plan is sound and safe to implement.

---

## Findings

### [APPROVE] Dead state fields are correctly identified as unused

Grep confirms `activeStatementId`, `resultsFilter`, `resultsSort`, `resultsSearch`, and `isLoading` are defined and written only inside `workspaceStore.ts`. No component reads them from the store. `ResultsTable` independently manages its own `sortConfig` and `searchTerm` as local state. `isLoading` in `WorkspaceState` (line 29) is a separate field from `TreeNode.isLoading` (types/index.ts line 34), which IS read by `TreeNavigator` (line 157). The PRD removal target is correct — only the store-level `isLoading: boolean` is dead. The node-level `isLoading?: boolean` on `TreeNode` must stay.

### [BLOCK] addStatement — TreeNavigator caller is not accounted for

The PRD only updates the `EditorCell` call site. There are three callers of `addStatement`:

1. `App.tsx` line 79: `addStatement()` — toolbar "Add Statement" button, should append to end, no change needed.
2. `EditorCell.tsx` line 73: `addStatement()` — the PRD correctly changes this to `addStatement(undefined, statement.id)`.
3. **`TreeNavigator.tsx` line 38**: `addStatement(query)` — double-clicking a table/view inserts a pre-filled query. The PRD is silent on this caller.

After the signature change to `(code?: string, afterId?: string)` the TreeNavigator call remains valid (it only passes `code`, `afterId` defaults to `undefined`, so it appends to end). This is actually the correct behaviour — a tree double-click should append, not insert mid-list. However the PRD must document this decision explicitly; an implementer reading only the PRD could easily miss this caller and accidentally break it or apply the wrong insertion logic.

**Required action:** Add a note to the PRD (or implementation task) that `TreeNavigator.addStatement(query)` is intentionally left as an append call.

### [BLOCK] Filter and SortConfig types — removal is incomplete and incorrect

The PRD states (section 0.1) to "Remove `Filter` and `SortConfig` from the import line (only if no longer used in the file after cleanup)". After removing the dead store state, `Filter` and `SortConfig` will indeed be unused in `workspaceStore.ts` and should be dropped from that import.

However, `ResultsTable.tsx` line 2 imports both `Column` and `SortConfig` from `../../types` and actively uses `SortConfig` as the type for its local `sortConfig` state (line 20). `Filter` is not used in `ResultsTable` but `SortConfig` is live. The PRD section 0.2 does not mention removing `Filter` or `SortConfig` from `types/index.ts`, which is correct — they must stay there since `ResultsTable` depends on `SortConfig`. But the PRD's phrasing in section 0.1 is ambiguous and could be misread as "delete the types entirely". This must be clarified.

**Required action:** Make explicit in the PRD that `Filter` and `SortConfig` are removed only from `workspaceStore.ts` imports, not from `types/index.ts`. `Filter` becomes an orphan type in `types/index.ts` after the store cleanup — decide whether to remove it from the types file or keep it for future use.

### [CONCERN] Auto-dismiss timer for inline delete confirm — memory leak on unmount

The PRD says "Auto-dismiss after 3 seconds" for the inline delete confirmation. The natural implementation is `setTimeout(() => setShowDeleteConfirm(false), 3000)`. If the component unmounts while the timer is pending (e.g., the user deleted the cell via a different mechanism, or the statement list re-renders), the `setState` call fires on an unmounted component. In React 18 this is a no-op with a suppressed warning, but it is still sloppy and can mask bugs.

The fix is a `useEffect` cleanup:

```ts
useEffect(() => {
  if (!showDeleteConfirm) return;
  const timer = setTimeout(() => setShowDeleteConfirm(false), 3000);
  return () => clearTimeout(timer);
}, [showDeleteConfirm]);
```

This is a small addition but should be called out in the implementation notes.

### [CONCERN] addStatement splice — correctness when afterId is not found

The PRD says: "When `afterId` is provided, insert new statement AFTER that statement using findIndex + splice". If `findIndex` returns `-1` (the `afterId` is stale or no longer in the list), a naive `splice(insertAt + 1, ...)` with `insertAt = -1` results in `splice(0, ...)`, inserting at the beginning of the array. This is an unexpected silent failure. The correct fallback when `findIndex` returns `-1` should be to append to the end, consistent with the no-`afterId` path.

Suggested implementation:

```ts
addStatement: (code, afterId) => {
  const { catalog, database } = get();
  const newStatement: SQLStatement = { /* ... */ };
  set((state) => {
    const statements = [...state.statements];
    const insertIndex = afterId ? state.statements.findIndex((s) => s.id === afterId) : -1;
    if (insertIndex >= 0) {
      statements.splice(insertIndex + 1, 0, newStatement);
    } else {
      statements.push(newStatement);
    }
    return { statements };
  });
},
```

### [CONCERN] duplicateStatement — inserts at end, not after source

`duplicateStatement` appends the duplicate to the end of the list (current behaviour, unchanged by this PRD). After the `addStatement` fix makes the + button insert in-place, users may expect duplicate to also appear directly after the source cell. The PRD explicitly keeps `duplicateStatement` appending to end. This is a product decision rather than a bug, but it is worth flagging as an inconsistency that could prompt a follow-up change request. No action required for this PR unless product disagrees with the behaviour.

### [APPROVE] Column deduplication in flink-api.ts is correct and safe

`flink-api.ts` exports its own `Column` interface (lines 49-53) that is structurally identical to the one in `types/index.ts`. The only internal consumer in `flink-api.ts` is `getTableSchema` (line 231), which returns `Column[]`. No other file imports `Column` from `flink-api` — the grep confirms zero hits for that import pattern. The safe migration is: delete the local `Column` interface in `flink-api.ts`, add `import type { Column } from '../types'` at the top. The return type of `getTableSchema` continues to work without changes. This is a clean, zero-risk change.

### [APPROVE] isLoading distinction — no naming collision risk

`WorkspaceState.isLoading` (store, always false, to be deleted) and `TreeNode.isLoading` (types/index.ts, used by TreeNavigator) are entirely separate. The PRD correctly identifies the store field as dead. The node-level field is not mentioned for removal. No collision or confusion after the change.

### [APPROVE] deleteStatement fallback — last statement edge case is handled

The existing `deleteStatement` already handles the "delete last statement" edge case by synthesising a fresh placeholder when `newStatements.length === 0`. This logic is untouched by the PRD. The only change is removing the `activeStatementId` field from the returned state object, which is safe.

### [APPROVE] Race condition analysis — inline delete state vs store delete

The `showDeleteConfirm` state is local to each `EditorCell` instance. The `deleteStatement` store action is synchronous (it uses a Zustand `set` call, no async). There is no race between the inline UI state and the store mutation. If the user clicks "Yes" to confirm, `deleteStatement` runs synchronously, Zustand updates, React re-renders, and the component unmounts — the local state ceases to exist. No timing issue.

The polling loop in `executeStatement` checks `currentStatement?.status === 'CANCELLED'` on each iteration before continuing. Deleting a running statement does not cancel the poll loop — the store delete removes the statement from the list, but the `id` captured in the closure continues to drive the loop. After deletion `get().statements.find((s) => s.id === id)` returns `undefined`, so `currentStatement` is `undefined`, and `currentStatement?.status` is `undefined`, which is not `'CANCELLED'`. The poll loop will continue running until it naturally completes or errors.

This is a **pre-existing issue**, not introduced by this PRD, and is out of scope. Worth logging as a separate bug: deleting a running statement should also cancel the server-side statement.

### [APPROVE] TypeScript will catch the critical breakage paths

After removing `activeStatementId` from the interface, any missed reference in a component that tries to destructure it from `useWorkspaceStore()` will be a compile error. After removing the action signatures (`setActiveStatement`, etc.) from the interface, any call site that references them is also a compile error. The acceptance criterion "No TypeScript errors after cleanup" is a sufficient safety net for ensuring completeness of the removal.

### [APPROVE] Backward compatibility of addStatement signature change

The new signature `(code?: string, afterId?: string) => void` is backward compatible with all existing callers. `App.tsx` calls `addStatement()`, `TreeNavigator` calls `addStatement(query)` — both remain valid. No callers break.

---

## Recommendations

1. **Before starting implementation:** Clarify in the PRD that `TreeNavigator`'s `addStatement(query)` call is intentionally unchanged (append-to-end for tree double-click is correct UX).

2. **Before starting implementation:** Clarify that `Filter` and `SortConfig` are removed only from `workspaceStore.ts` imports. Separately decide whether to remove the now-orphaned `Filter` type from `types/index.ts` entirely or keep it for future use.

3. **During implementation of 0.3:** Guard the `findIndex` result in `addStatement` — fall back to append when `afterId` is not found, do not let a `-1` index produce a silent insert-at-start.

4. **During implementation of 0.4:** Use a `useEffect` with a cleanup return to drive the auto-dismiss timer. Do not use a bare `setTimeout` call inside the click handler.

5. **As a follow-up (not blocking):** File a separate bug: deleting a statement that is actively being polled does not stop the poll loop. The `cancelStatement` action should be called (or the loop should check `get().statements.find(...)` returning `undefined` as a stop condition).

6. **Testing strategy:**
   - TypeScript build (`npm run build`) is the primary regression gate for the type removals.
   - Manual: add statement via + button mid-list, verify it appears after the clicked cell.
   - Manual: add statement via toolbar button, verify it appends to end.
   - Manual: double-click a table in TreeNavigator, verify statement appends to end.
   - Manual: click delete, verify inline Yes/No appears; click No, verify nothing deleted; click Yes, verify statement removed.
   - Manual: click delete, wait 3 seconds without clicking, verify confirmation auto-dismisses without deleting.
   - Manual: delete last statement, verify a new blank statement appears.
   - Manual: run a query, observe results table still sorts and searches correctly (local state unaffected by store cleanup).
