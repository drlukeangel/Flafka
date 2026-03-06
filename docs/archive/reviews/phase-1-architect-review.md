# Architect Review: Phase 1 Core UX

**Reviewed by:** Principal Architect
**Date:** 2026-02-28
**PRDs reviewed:** 1.1 Keyboard Shortcuts, 1.2 Auto-Resize Editor, 1.3 Virtual Scrolling
**Source files reviewed:** `EditorCell.tsx`, `ResultsTable.tsx`, `workspaceStore.ts`, `App.css`

---

## Overall Verdict: APPROVE WITH CHANGES

All three features are directionally correct and solve real user problems. Two features (1.1 and 1.2) are ready to implement with minor adjustments. Feature 1.3 has a critical technical defect in the proposed rendering approach that must be resolved before implementation begins.

---

### 1.1 Keyboard Shortcuts

**[APPROVE]**

The design is sound. Using `editor.addAction()` scoped to the Monaco instance is the right call — it avoids global `window` event listeners, naturally isolates behavior per cell, gets cross-platform modifier key normalization for free, and respects Monaco's own internal focus management (e.g., Escape closing autocomplete before reaching the cancel action).

The use of `useWorkspaceStore.getState()` inside the action callbacks is the correct pattern. These callbacks are registered once at mount time and close over a stale `statement.id` prop — which is intentional and fine, since `statement.id` is stable for the lifetime of the component. Calling `.getState()` at invocation time instead of at registration time ensures the status check is always fresh, avoiding the classic stale-closure bug.

One concern worth flagging: the PRD notes "Escape in VS Code cancels autocomplete before closing" and marks this as Monaco's responsibility, but leaves it as a recommended test rather than a verified behavior. The Monaco action system does use a priority/context system, and the built-in `closeParameterHints` and `hideSuggestWidget` commands are bound to Escape at a higher priority than user-registered actions. In practice this should work correctly, but it must be verified explicitly in QA. If it does not, the fix is to add a `precondition` guard on the cancel action (e.g., `!suggestWidgetVisible && !parameterHintsVisible`).

The `handleRun` button handler at line 51–57 of `EditorCell.tsx` has inverted semantics compared to the keyboard shortcut: it toggles run/cancel in a single handler. The keyboard shortcuts do not replicate this toggle — Ctrl+Enter only runs, Escape only cancels. This asymmetry is correct and intentional, but the PRD should note it explicitly so future contributors do not "fix" the shortcuts to match the button's toggle behavior.

No store coupling issues. No new state introduced. Performance impact is negligible.

**Required before merge:** Verify Escape behavior against Monaco's autocomplete/suggest widget in QA. Document the run-only / cancel-only asymmetry versus the button's toggle behavior.

---

### 1.2 Auto-Resize Editor

**[CONCERN — minor, non-blocking]**

The core approach is correct: `onDidContentSizeChange` is the right event to listen to, `getContentHeight()` is the right measurement API, and clamping with `Math.min(Math.max(...), 400)` is a clean one-liner. The PRD correctly identifies the CSS `!important` flags on lines 592–593 as the blocker and proposes removing them.

**Concern 1: handleEditorMount conflict with 1.1.**
Both PRDs modify `handleEditorMount` independently. The 1.2 PRD shows `handleEditorMount: OnMount = (editor) => { ... }` — it does not accept the `monaco` parameter. The 1.1 PRD changes the signature to `(editor, monaco)`. When both are merged, the combined function must include both the `monaco` parameter (for keybindings) and the `onDidContentSizeChange` listener (for auto-resize). If these are implemented in separate PRs without coordination, whichever lands second will overwrite the first. This is the most concrete interaction risk in Phase 1 and must be managed at the implementation level. See Cross-Feature Concerns below.

**Concern 2: `scrollBeyondLastLine: false` interaction.**
The Monaco options in `EditorCell.tsx` (line 230) already include `scrollBeyondLastLine: false`. This is good — it means `getContentHeight()` will return the true content height without adding extra blank scroll space at the bottom. The PRD does not mention this but it is a prerequisite for accurate height measurement. No action needed, just worth noting it must not be removed.

**Concern 3: `automaticLayout: true` interaction.**
The PRD correctly notes that `automaticLayout: true` handles width but not height. However, `automaticLayout` internally uses a `ResizeObserver` on the editor's container. If the container `div.cell-editor` changes height (driven by React state), Monaco will observe the new dimensions and re-layout. The sequence is: state update → React re-renders `height` prop → Monaco container resizes → `automaticLayout` fires → Monaco re-measures. This feedback loop is benign in practice, but it means there will be two layout passes per content change. This is acceptable at the scale of one or a few editors.

**Concern 4: Height state lives in the component, not the store.**
`editorHeight` as local `useState` is the right choice here — it is purely presentational and has no cross-cell significance. The PRD correctly avoids putting this in the Zustand store. No issue.

**Concern 5: The collapsed cell edge case.**
The PRD states "Height state maintained but hidden — uncollapsing uses stored height value." This is accurate: when `isCollapsed` is true the entire editor subtree including `div.cell-editor` is unmounted (line 208 of `EditorCell.tsx`). That means the `useState(100)` will reset to its initial value of 100px on uncollapse, and `handleEditorMount` will fire again, which triggers `updateHeight()` immediately. So the actual uncollapse height will be recomputed from live content, not from a "stored" value. The PRD's description is slightly misleading but the behavior will be correct. No code change needed; just update the PRD's edge case table to say "height recomputed on remount" instead of "stored height value."

**Required before merge:** Coordinate implementation with 1.1 to avoid `handleEditorMount` overwrite. See merged implementation sketch in Cross-Feature Concerns.

---

### 1.3 Virtual Scrolling

**[BLOCK — critical rendering defect]**

The choice to adopt `@tanstack/react-virtual` is correct, and the overall integration approach (add `useVirtualizer` after `sortedData`, attach `parentRef` to `.results-table-wrapper`, replace `sortedData.map` with `rowVirtualizer.getVirtualItems().map`) is the right structure. The export-uses-`sortedData`-not-virtual-items point is explicitly called out and correct. The overscan of 20 is reasonable.

However, the proposed spacer and row positioning technique is broken for a standard HTML `<table>` layout.

**Critical defect: `translateY` on `<tr>` elements inside a `<tbody>` does not work.**

The PRD proposes positioning each virtual `<tr>` with `style={{ transform: 'translateY(${virtualRow.start}px)' }}`. This pattern works correctly when the scroll container uses `position: relative` and items use `position: absolute`. In an HTML `<table>`, `<tr>` elements participate in the table layout algorithm, not the normal flow. CSS `transform` on a `<tr>` is technically valid (it creates a new stacking context) but the row still occupies its natural position in the table layout. The `translateY` shifts the visual rendering of the row without moving its layout footprint. The result is visually overlapping rows and a broken layout, not the intended stacked rendering.

The spacer approach also has a flaw. The PRD adds two `<tr>` spacers — one at the top and one at the bottom of `<tbody>`. These are rendered after the virtual rows in the DOM but are intended to represent the space above and below them. The top spacer is rendered after the virtual rows, so it does not actually push them down. The bottom spacer's height calculation is correct in intent but its placement is wrong.

**The correct approach for table-based virtual scrolling is one of two options:**

Option A — Use a single top spacer `<tr>` as the first child and a single bottom spacer `<tr>` as the last child, with the virtual rows rendered in between in their natural DOM order (no `transform`), and the virtualizer configured with `overscan` set high enough that rows appear seamlessly:

```tsx
<tbody>
  <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }} aria-hidden />
  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
    const row = sortedData[virtualRow.index];
    return (
      <tr key={virtualRow.index}>
        {columnNames.map((colName) => (
          <td key={colName}>...</td>
        ))}
      </tr>
    );
  })}
  <tr
    style={{
      height: Math.max(
        0,
        rowVirtualizer.getTotalSize() -
          (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0)
      ),
    }}
    aria-hidden
  />
</tbody>
```

This is the approach recommended in the TanStack Virtual documentation for `<table>` elements. The top spacer must be the first `<tr>` in `<tbody>` and must use natural height (not transform). The bottom spacer must be the last `<tr>`.

Option B — Replace the `<table>` element with a `<div>`-based layout, which allows `position: absolute` or `translateY` to work correctly. This is more invasive, breaks the sticky header CSS, and requires rewriting the column rendering. Do not do this.

**Adopt Option A.**

**Secondary concern: `results-table-wrapper` height constraint.**
The CSS for `.cell-results` is `max-height: 250px; overflow: auto` (App.css line 616–618). The `.results-table-wrapper` inside it has `flex: 1; overflow: auto` (line 759–762). The virtualizer needs to measure the scroll container's visible height to compute the visible range. With `flex: 1` inside a `max-height: 250px` parent, the actual measured height of the scroll container depends on how much content is present before virtualization kicks in. On first render with 5,000 rows, the pre-virtual DOM will be enormous, potentially causing the container to hit `max-height: 250px`. After virtualization, the DOM collapses. This bootstrap sequence should be safe because `useVirtualizer` reads `parentRef.current.clientHeight` after mount, at which point the container has a measured height. Verify that `parentRef` is assigned before the virtualizer's first measurement by confirming the ref is on the outermost scrollable div (`.results-table-wrapper`), not the inner `.results-table-container`. The current `ResultsTable.tsx` renders `<div className="results-table-wrapper">` at line 143, which is correct. The proposed diff also correctly attaches `ref={parentRef}` to that same div. No issue here, but it is worth noting for the implementor.

**Secondary concern: `tr:nth-child(even)` zebra striping.**
The current CSS rule `.results-table tr:nth-child(even)` (App.css line 811) applies striping based on DOM position, not data index. With virtual scrolling, the visible rows are a sliding window — row index 0 in the DOM might correspond to data row 15 in the dataset. The even/odd DOM position will not match the even/odd data position, so zebra striping will flicker as the user scrolls. Fix by removing the CSS rule and instead applying the stripe class conditionally in the render: `className={virtualRow.index % 2 === 0 ? 'row-even' : ''}`.

**Secondary concern: row hover state.**
`.results-table tr:hover` (App.css line 815) is CSS-only and will continue to work correctly with virtual rows. No change needed.

**Required before merge:** Replace the `translateY` + after-the-fact spacer approach with the Option A spacer-first/spacer-last approach described above. Fix zebra striping to use `virtualRow.index % 2` instead of CSS `nth-child`.

---

## Cross-Feature Concerns

### 1. handleEditorMount merge conflict (1.1 + 1.2)

Both features modify the same function in the same file. The 1.1 PRD changes the signature from `(editor)` to `(editor, monaco)`. The 1.2 PRD adds an `onDidContentSizeChange` listener. Neither PRD accounts for the other's changes. The combined implementation must be a single unified function:

```typescript
const handleEditorMount: OnMount = (editor, monaco) => {
  editorRef.current = editor;

  // 1.2: Auto-resize
  const updateHeight = () => {
    const contentHeight = editor.getContentHeight();
    setEditorHeight(Math.min(Math.max(contentHeight, 80), 400));
  };
  editor.onDidContentSizeChange(updateHeight);
  updateHeight();

  // 1.1: Keyboard shortcuts
  editor.addAction({
    id: 'run-statement',
    label: 'Run Statement',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      const current = useWorkspaceStore.getState().statements.find((s) => s.id === statement.id);
      if (current?.status !== 'RUNNING' && current?.status !== 'PENDING') {
        executeStatement(statement.id);
      }
    },
  });

  editor.addAction({
    id: 'cancel-statement',
    label: 'Cancel Statement',
    keybindings: [monaco.KeyCode.Escape],
    run: () => {
      const current = useWorkspaceStore.getState().statements.find((s) => s.id === statement.id);
      if (current?.status === 'RUNNING' || current?.status === 'PENDING') {
        cancelStatement(statement.id);
      }
    },
  });
};
```

Recommendation: implement 1.1 and 1.2 in the same PR or in strict sequence with the second PR rebased on the first. Do not merge them independently.

### 2. Editor height state and re-render budget

With 1.2 active, every keystroke the user types may trigger `setEditorHeight`, which causes `EditorCell` to re-render. If 1.3 is also active and the user has results loaded, each re-render of `EditorCell` will re-render `ResultsTable` and re-invoke `useVirtualizer`. This is not catastrophic — `useVirtualizer` is designed for frequent updates — but it is unnecessary work. The `onDidContentSizeChange` event only fires when the content height actually changes (i.e., when a new line is added or removed), not on every keystroke within a line. So in practice, most typing will not trigger the resize. Confirm this behavior during QA: type continuously on a single line and verify that no height state updates occur.

### 3. Performance under streaming data

The store's `executeStatement` polls and calls `set()` approximately every second while a query is running, pushing new rows into `statement.results`. Each `set()` triggers a re-render of every `EditorCell` that subscribes to the store. In the current implementation, all `EditorCell` components subscribe to the full store via `useWorkspaceStore()` and destructure individual actions. This means every store update re-renders all cells, not just the one with active results.

This is a pre-existing issue, not introduced by Phase 1. However, Phase 1.3 virtual scrolling will make it more visible: with virtual scrolling active, a store update during streaming will cause `ResultsTable` to re-run `useVirtualizer`, which may recalculate the visible range. With the correct `sortedData` memoization already in place, this will be fast. Still, if users open multiple cells simultaneously with streaming queries, render frequency could become noticeable.

This does not block any Phase 1 feature, but it should be tracked as a Phase 2 concern: selector-based store subscriptions (`useWorkspaceStore(state => state.statements.find(s => s.id === id))`) would limit re-renders to the affected cell only.

### 4. Future feature impact of virtual scrolling (column resize, cell copy)

**Column resize:** The existing table uses `width: 100%` and `border-collapse: collapse` with no explicit column widths. A future column resize feature would need to set explicit `<col>` widths or per-`<th>` widths. Virtual scrolling with Option A (no absolute positioning, standard `<tr>` flow) is fully compatible with explicit column widths. No impediment.

**Cell copy / selection:** The virtual approach only renders visible rows. A "select all" or "copy column" feature that operates on the DOM will only see ~60 rows. Any copy or selection feature must operate on `sortedData` directly (the full in-memory array), not on DOM elements. This is the same pattern as the existing export feature, which already correctly uses `sortedData` rather than the DOM. As long as future features follow this pattern, virtual scrolling is not an obstacle. Document this constraint explicitly in the `ResultsTable` component: DOM selection must not be used as a data source.

**Row-level actions (expand detail, inline edit):** Virtual rows are re-used and repositioned as the user scrolls. If a future feature needs to maintain per-row expanded state (e.g., an expandable detail panel that increases row height), the `estimateSize: () => 35` assumption breaks. TanStack Virtual supports dynamic/measured row heights via the `measureElement` callback. This is feasible but requires more effort than the initial implementation. Flag this in the PRD as a known limitation of the static `estimateSize`.

---

## Summary of Required Changes Before Merge

| # | Feature | Change Required |
|---|---------|-----------------|
| 1 | 1.1 + 1.2 | Implement `handleEditorMount` as a single unified function; do not merge independently |
| 2 | 1.1 | Verify Escape does not fire during autocomplete/suggest widget; document run-only vs cancel-only asymmetry |
| 3 | 1.2 | Update edge case table: collapsed cell recomputes height on remount, does not restore stored value |
| 4 | 1.3 | Replace `translateY` positioning + misplaced spacers with Option A: first-child/last-child spacer `<tr>` elements with natural height |
| 5 | 1.3 | Fix zebra striping: replace CSS `tr:nth-child(even)` with `virtualRow.index % 2` conditional class |
| 6 | 1.3 | Document that future features must read `sortedData` directly, not from DOM, due to virtual rendering |
