# Phase 1.1: Keyboard Shortcuts

## Problem Statement

Users currently must click the Run/Stop button to execute or cancel SQL queries. This creates friction for power users who are accustomed to keyboard shortcuts in professional SQL editors like DBeaver, DataGrip, and VS Code. The lack of keyboard shortcuts contradicts common user expectations and reduces efficiency in the query workflow.

## User Needs

- Execute queries without leaving the keyboard (Ctrl+Enter or Cmd+Enter on Mac)
- Cancel running queries with a single keystroke (Escape)
- Maintain keyboard focus in the editor while executing queries
- Cross-platform consistency (Windows, macOS, Linux)

## Proposed Solution

### Keyboard Binding 1: Ctrl/Cmd+Enter to Run

- **Action**: Execute the current cell's statement
- **Keybinding**: `Ctrl+Enter` (Windows/Linux), `Cmd+Enter` (macOS)
- **Implementation**: Add Monaco editor action that triggers `executeStatement(statement.id)`
- **Preconditions**: Statement must not be in `RUNNING` or `PENDING` status
- **Behavior**: When pressed in a focused editor, executes the associated statement. If already running, does nothing (no-op).

### Keyboard Binding 2: Escape to Cancel

- **Action**: Cancel the current cell's running statement
- **Keybinding**: `Escape`
- **Implementation**: Add Monaco editor action that triggers `cancelStatement(statement.id)`
- **Preconditions**: Statement must be in `RUNNING` or `PENDING` status
- **Behavior**: When pressed while a query is executing, sends a cancellation request. If not running, does nothing (no-op).

## Architecture & Design

### Scope

- **Focused**: Only affects the Monaco editor instance with keyboard focus
- **Cell-Isolated**: Each editor cell has its own keybindings. Keybindings do not affect other cells or the global application
- **Non-Blocking**: No global keybindings that might conflict with browser or OS shortcuts

### Why Editor-Scoped Keybindings?

Using `editor.addAction()` instead of global window event listeners ensures:
1. Keybindings only activate when the editor has focus (prevents accidental execution)
2. Keybindings are isolated per cell (multiple cells can coexist without conflicts)
3. Monaco handles cross-platform key normalization automatically
4. Standard editor behavior is preserved (e.g., Escape in VS Code cancels autocomplete before closing)

### State Management Integration

Both keybindings interact with the Zustand store (`useWorkspaceStore`) to check and update statement status:

- **executeStatement(id)**: Sets status to `PENDING`, then `RUNNING` as results stream in
- **cancelStatement(id)**: Sets status to `CANCELLED` and attempts server-side cancellation

The keybindings read live store state to prevent executing already-running statements.

## Files to Modify

### Primary

1. **`src/components/EditorCell/EditorCell.tsx`**
   - Modify `handleEditorMount` callback to accept the second `monaco` parameter
   - Register two editor actions with appropriate keybindings
   - Import `monaco` types if needed for TypeScript support

## Implementation Details

### Current Code Structure

**EditorCell.tsx** (lines 38-40):
```typescript
const handleEditorMount: OnMount = (editor) => {
  editorRef.current = editor;
};
```

The `OnMount` type signature provides two parameters: `(editor, monaco)`. Currently, only the first is used.

### Updated Implementation

Update the `handleEditorMount` function to register keybindings:

```typescript
const handleEditorMount: OnMount = (editor, monaco) => {
  editorRef.current = editor;

  // Ctrl/Cmd+Enter to run the statement
  editor.addAction({
    id: 'run-statement',
    label: 'Run Statement',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      const currentStatement = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === statement.id);
      const currentStatus = currentStatement?.status;

      // Only execute if not already running or pending
      if (currentStatus !== 'RUNNING' && currentStatus !== 'PENDING') {
        executeStatement(statement.id);
      }
    },
  });

  // Escape to cancel the statement
  editor.addAction({
    id: 'cancel-statement',
    label: 'Cancel Statement',
    keybindings: [monaco.KeyCode.Escape],
    run: () => {
      const currentStatement = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === statement.id);
      const currentStatus = currentStatement?.status;

      // Only cancel if currently running or pending
      if (currentStatus === 'RUNNING' || currentStatus === 'PENDING') {
        cancelStatement(statement.id);
      }
    },
  });
};
```

### Explanation

1. **Monaco Parameter**: `OnMount` type already supports `(editor, monaco)` signature. The second parameter gives access to `KeyMod` and `KeyCode` enums.

2. **CtrlCmd Modifier**: `monaco.KeyMod.CtrlCmd` automatically maps to `Ctrl` on Windows/Linux and `Cmd` on macOS.

3. **Store State Query**: Each keybinding uses `useWorkspaceStore.getState()` to read current statement status without causing re-renders or creating closure over stale state.

4. **No-Op Logic**: Checks prevent duplicate executions or cancellations of non-running statements.

5. **Action ID**: Must be unique within the editor (`run-statement`, `cancel-statement`). These IDs are used for keybinding registration and can be referenced in the editor's command palette.

### Key Binding Order

The two actions are independent and can be registered in any order. Monaco does not queue keybindings, so pressing Escape while Ctrl+Enter is being evaluated has no side effect.

## Testing Strategy

### Acceptance Criteria

- [ ] **Ctrl+Enter (Cmd+Enter on Mac) runs the statement**
  - Test in an editor with empty results
  - Verify statement transitions from `IDLE` → `PENDING` → `RUNNING`
  - Verify results appear after execution completes

- [ ] **Ctrl+Enter does NOT re-run if already RUNNING**
  - Start a long-running query with Ctrl+Enter
  - Press Ctrl+Enter again while running
  - Verify no duplicate execution or error message

- [ ] **Ctrl+Enter does NOT run if PENDING**
  - Press Ctrl+Enter; verify status is `PENDING`
  - Press Ctrl+Enter again before `RUNNING` state
  - Verify only one execution starts

- [ ] **Escape cancels a running statement**
  - Start a query with Ctrl+Enter
  - Press Escape while `RUNNING`
  - Verify status changes to `CANCELLED`
  - Verify toast notification appears: "Query cancelled"

- [ ] **Escape does NOT cancel if not running**
  - Open an editor with a completed or idle statement
  - Press Escape
  - Verify no action taken (no toast, no state change)

- [ ] **Keybindings work only when editor has focus**
  - Click in the editor → Ctrl+Enter works
  - Click outside (e.g., on a button) → Ctrl+Enter does nothing
  - Re-focus the editor → Ctrl+Enter works again

- [ ] **No TypeScript errors**
  - Build project with `npm run build` or `npm run tsc`
  - Verify no type errors related to `monaco` parameter or action signatures

- [ ] **Multiple cells with independent keybindings**
  - Create 2+ statements
  - Focus cell #1, press Ctrl+Enter → cell #1 runs
  - While cell #1 is running, focus cell #2, press Escape → cell #1 is unaffected
  - Press Ctrl+Enter in cell #2 → cell #2 runs independently

### Manual Test Scenarios

#### Scenario 1: Basic Execution

1. Open the app, default cell has a SELECT statement
2. Click in the editor
3. Press Ctrl+Enter (Cmd+Enter on Mac)
4. Verify status badge changes to "Pending" then "Running"
5. Verify results appear after 1–5 seconds
6. Verify execution time is displayed

#### Scenario 2: Cancel Before Completion

1. Open a long-running query (e.g., `SELECT CURRENT_TIMESTAMP; CALL sys_sleep(30);`)
2. Press Ctrl+Enter
3. When status is "Running", press Escape
4. Verify status badge changes to "Cancelled"
5. Verify toast shows "Query cancelled"
6. Verify no results appear

#### Scenario 3: Re-run After Cancellation

1. Run a query, cancel it
2. Status is "Cancelled"
3. Press Ctrl+Enter again
4. Verify query runs (status → Pending → Running → Completed)

#### Scenario 4: Multiple Cells

1. Create 3 statements (Add Cell button)
2. In cell #1, enter `SELECT 1;` and press Ctrl+Enter
3. While running, click in cell #2, press Ctrl+Enter
4. Verify both run in parallel or sequentially (depending on backend)
5. Press Escape in cell #1 → should cancel cell #1 only
6. Verify cell #2 continues running

#### Scenario 5: Focus Out

1. Click in editor, press Ctrl+Enter → query runs
2. Cancel it with Escape
3. Click outside the editor (e.g., on a button), press Ctrl+Enter → nothing happens
4. Click back in editor, press Ctrl+Enter → query runs

## Edge Cases & Assumptions

### Edge Case 1: Rapid Re-execution

**Scenario**: User presses Ctrl+Enter, query starts but immediately completes before status updates to `RUNNING`.

**Expected Behavior**: Second Ctrl+Enter should execute the query again (status is back to `COMPLETED`, which is neither `RUNNING` nor `PENDING`).

**Implementation Note**: The store state is checked at keybinding runtime, so this should work automatically.

### Edge Case 2: Server-Side Lag

**Scenario**: User presses Escape before the server acknowledges `executeStatement`. The local state is `PENDING`, but the server has not yet marked the statement as `RUNNING`.

**Expected Behavior**: `cancelStatement` is called. The server may reject it or return a cancellation error, but local state still transitions to `CANCELLED`. User can re-run.

**Implementation Note**: `cancelStatement` in the store already handles server errors gracefully (lines 465–470 in workspaceStore.ts).

### Edge Case 3: Escape During Autocomplete

**Scenario**: User types `SEL` and Monaco's autocomplete menu appears. User presses Escape to close the autocomplete.

**Expected Behavior**: Monaco's built-in behavior should take precedence. The autocomplete closes; the editor action for Escape is not triggered because focus is in the autocomplete menu, not the editor.

**Implementation Note**: Monaco's action system respects focus context. This should work as expected, but testing is recommended.

### Edge Case 4: Escape in a Collapsed Cell

**Scenario**: A cell is collapsed (isCollapsed: true), and the editor is not rendered.

**Expected Behavior**: Keybindings are not registered because `handleEditorMount` is not called. Escape has no effect.

**Implementation Note**: The Editor component is conditionally rendered (line 208: `{!statement.isCollapsed && ...}`). When collapsed, keybindings are unmounted and unregistered.

### Edge Case 5: Browser Keyboard Shortcuts

**Scenario**: Escape in a browser context (e.g., Firefox) may trigger the "exit fullscreen" or other OS-level behaviors.

**Expected Behavior**: Monaco's keybinding system captures the event before bubbling to the browser. The statement should cancel.

**Implementation Note**: This is Monaco's responsibility. If issues arise, we can add `preventDefault()` via a custom listener, but this should not be necessary.

## Dependencies

### Required

- `@monaco-editor/react` (already in use)
- `zustand` store pattern (already in use)

### Optional

- TypeScript `OnMount` type from `@monaco-editor/react` (imported in EditorCell.tsx, line 2)

## Performance Considerations

1. **Store Access**: `useWorkspaceStore.getState()` is a synchronous operation with O(n) worst-case complexity (linear search through statements). For most users (1–20 statements), this is negligible.

2. **Keybinding Registration**: `editor.addAction()` is called once per component mount. No recurring overhead.

3. **No New Re-renders**: Keybindings do not trigger re-renders; they call store actions directly.

## Rollout Plan

### Phase 1.1 (Current)

- Implement Ctrl/Cmd+Enter and Escape keybindings
- Deploy to staging for manual QA
- Gather user feedback

### Future Phases

- Phase 1.2: Add customizable keybindings (preferences panel)
- Phase 1.3: Add more keybindings (Ctrl+D to duplicate, Ctrl+Shift+X to delete, etc.)
- Phase 2: Global keyboard shortcuts (not editor-scoped)

## Documentation & User Communication

### In-App Help

- Update editor UI to display keybinding hints:
  - Run button could show "Ctrl+Enter" or "Cmd+Enter" below the label
  - Stop button could show "Esc" below the label

### Release Notes

- "Keyboard shortcuts now available! Press Ctrl+Enter (Cmd+Enter on Mac) to run, Escape to cancel."

### Tooltips

- Add `title` attribute to Run button: "Run (Ctrl+Enter)" or "Run (Cmd+Enter)"
- Add `title` attribute to Stop button: "Stop (Esc)"

## Success Metrics

- Keyboard shortcut usage rate (tracked via analytics, if available)
- Reduction in click rate on Run/Stop buttons (assuming analytics are in place)
- User feedback: satisfaction with shortcut responsiveness and consistency

## References

- [Monaco Editor Keybindings](https://microsoft.github.io/monaco-editor/docs.html#interfaces/editor.IActionDescriptor.html)
- [Monaco KeyMod and KeyCode Enums](https://microsoft.github.io/monaco-editor/api/enums/KeyCode.html)
- [Zustand Store getState()](https://github.com/pmndrs/zustand#getting-state-outside-of-components)
- [Common SQL Editor Shortcuts](https://en.wikibooks.org/wiki/SQL_Workbench/J/FAQ#How_are_keyboard_shortcuts_configured%3F) (DBeaver, DataGrip)

## Appendix: Code Example with Comments

```typescript
const handleEditorMount: OnMount = (editor, monaco) => {
  editorRef.current = editor;

  /**
   * Keybinding 1: Ctrl/Cmd+Enter to Execute
   *
   * Maps to:
   * - Ctrl+Enter on Windows and Linux
   * - Cmd+Enter on macOS
   *
   * Only executes if statement is not already RUNNING or PENDING.
   * Uses Zustand's getState() to read current statement status without
   * creating a closure over stale props.
   */
  editor.addAction({
    id: 'run-statement',
    label: 'Run Statement',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      const currentStatement = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === statement.id);
      const currentStatus = currentStatement?.status;

      if (currentStatus !== 'RUNNING' && currentStatus !== 'PENDING') {
        executeStatement(statement.id);
      }
    },
  });

  /**
   * Keybinding 2: Escape to Cancel
   *
   * Only cancels if statement is currently RUNNING or PENDING.
   * Does nothing if statement is IDLE, COMPLETED, ERROR, or CANCELLED.
   *
   * Monaco's keybinding system respects focus context, so this action
   * only triggers when the editor has keyboard focus.
   */
  editor.addAction({
    id: 'cancel-statement',
    label: 'Cancel Statement',
    keybindings: [monaco.KeyCode.Escape],
    run: () => {
      const currentStatement = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === statement.id);
      const currentStatus = currentStatement?.status;

      if (currentStatus === 'RUNNING' || currentStatus === 'PENDING') {
        cancelStatement(statement.id);
      }
    },
  });
};
```

---

## Implementation Notes

**Completed:** 2026-02-28
**Combined with:** Phase 1.2 Auto-Resize (shared handleEditorMount)

- Both keyboard shortcuts registered via `editor.addAction()` in unified `handleEditorMount`
- Uses `useWorkspaceStore.getState()` for fresh status checks (avoids stale closures)
- Null guard added to status check for defensive coding
- QA: 7/7 checks pass (see phase-1-qa-report.md)
- Manual testing needed: Escape vs Monaco suggest/find widgets

---

**Document Version**: 1.0
**Last Updated**: 2026-02-28
**Author**: Claude Code
**Status**: Ready for Implementation
