# Engineer Review: Phase 1 Core UX

**Reviewer:** Principal Engineer
**Date:** 2026-02-28
**PRDs Reviewed:** phase-1-keyboard-shortcuts.md, phase-1-auto-resize-editor.md, phase-1-virtual-scrolling.md
**Source Files Reviewed:** EditorCell.tsx, ResultsTable.tsx, App.css (lines 585-830)

---

## Overall Verdict: NEEDS CHANGES

Two of three PRDs are close to correct but have concrete bugs that will cause broken behavior in production. The virtual scrolling implementation has a fundamental architectural error that must be resolved before any code is written.

---

## 1.1 Keyboard Shortcuts

**Verdict: APPROVE with minor note**

### What is correct

The approach is sound. Using `editor.addAction()` is the right API - it scopes keybindings to the focused editor instance, avoids global listener conflicts, and gets Monaco's cross-platform key normalization for free. `monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter` is the correct bitwise composition. Using `useWorkspaceStore.getState()` inside the `run` callback correctly avoids stale closure over the `statement` prop - this is the idiomatic Zustand pattern for event handlers registered once at mount.

The `OnMount` type from `@monaco-editor/react` does accept `(editor, monaco)` as its second parameter, so adding `monaco` to `handleEditorMount` is valid TypeScript with no import changes needed.

### Concern: Escape key priority vs. Monaco's widget layer

The PRD acknowledges this but undersells the risk. Monaco's internal `Escape` handling (closing suggestion widget, parameter hints, find widget, etc.) operates at a higher `KeybindingWeight` than user-registered actions. Registering Escape via `addAction` will therefore fire only when no Monaco overlay is open - which is generally the desired behavior. However, the PRD's Edge Case 3 analysis says "the autocomplete closes; the editor action for Escape is not triggered." This is correct, but the PRD should note that if the user has the find widget open (Ctrl+F), Escape will close the find widget first, then on a second press it will trigger the cancel action. This two-press behavior may be surprising and is worth a comment in the code.

If stricter control is needed, `addCommand` with an explicit `KbExpr` context (e.g., `!suggestWidgetVisible && !findWidgetVisible`) would be more precise, but `addAction` is acceptable for the current scope.

### Concern: Action ID collision in multiple-cell scenarios

`addAction` registers an action against the editor instance, not globally, so ID collisions across cells are not a problem. However, if `handleEditorMount` is somehow called twice on the same editor instance (e.g., React strict mode in development double-invoking effects), calling `addAction` with the same ID a second time will silently overwrite the first registration. This is harmless in practice but worth knowing.

### Concern: `handleRun` button inconsistency with Escape

The current `handleRun` button (line 52-57 in EditorCell.tsx) cancels when `RUNNING || PENDING`, but also cancels when `PENDING` despite the Run button being `disabled` when `PENDING`. The keyboard shortcut correctly no-ops during `PENDING`. These behaviors are consistent - no action needed - but worth noting in a code comment to prevent future drift.

### No TypeScript issues

The implementation compiles cleanly. `statement.id` is captured in a closure at mount time, but since `statement.id` is an immutable identifier this is safe.

---

## 1.2 Auto-Resize Editor

**Verdict: NEEDS CHANGES**

### Bug 1: `onDidContentSizeChange` callback signature is wrong

The PRD calls `editor.onDidContentSizeChange(updateHeight)` where `updateHeight` is `() => void`. However, the Monaco API for `onDidContentSizeChange` passes a `IContentSizeChangedEvent` argument to the callback. The event object has `contentHeight` and `contentWidth` properties. The PRD's `updateHeight` ignores this argument and instead calls `editor.getContentHeight()` which is a valid alternative, so the behavior is correct - but the function should be typed to accept the optional event parameter to avoid a TypeScript strict-mode error:

```typescript
// Current (may fail strict type check):
const updateHeight = () => { ... };
editor.onDidContentSizeChange(updateHeight);

// Correct:
editor.onDidContentSizeChange((_e) => {
  const contentHeight = editor.getContentHeight();
  const newHeight = Math.min(Math.max(contentHeight, 80), 400);
  setEditorHeight(newHeight);
});
```

Alternatively, use the event argument directly to avoid the redundant `getContentHeight()` call:

```typescript
editor.onDidContentSizeChange((e) => {
  const newHeight = Math.min(Math.max(e.contentHeight, 80), 400);
  setEditorHeight(newHeight);
});
```

This is the cleaner form and removes one API call per keystroke.

### Bug 2: Listener is never disposed - memory leak on cell deletion

`editor.onDidContentSizeChange()` returns an `IDisposable`. The PRD does not store or call `.dispose()` on this return value. When a cell is deleted, React unmounts the component, but the Monaco editor instance persists in memory until GC. The listener holds a reference to `setEditorHeight` (which holds a reference to the React fiber). This is a memory leak in long sessions where users create and delete many cells.

Fix: capture the disposable and clean it up.

```typescript
const handleEditorMount: OnMount = (editor, monaco) => {
  editorRef.current = editor;

  const disposable = editor.onDidContentSizeChange((e) => {
    const newHeight = Math.min(Math.max(e.contentHeight, 80), 400);
    setEditorHeight(newHeight);
  });

  // Existing editorRef is already cleaned up by Monaco on unmount,
  // but we need to explicitly dispose our listener.
  // Return value of OnMount is void, so attach to editor's onDidDispose:
  editor.onDidDispose(() => disposable.dispose());

  // Set initial height
  const initialHeight = Math.min(Math.max(editor.getContentHeight(), 80), 400);
  setEditorHeight(initialHeight);
};
```

### Bug 3: `scrollBeyondLastLine: false` is already set but `overflow: hidden` on `.cell-editor` may fight Monaco

The Monaco `Editor` component manages its own DOM height based on the `height` prop. When `height` is `"150px"` (a string, hardcoded), Monaco renders to exactly 150px. When switched to `${editorHeight}px` (dynamic), Monaco will resize its internal container on each state update, triggering a React re-render which updates the DOM height, which can trigger `onDidContentSizeChange` again in some Monaco versions - a potential resize loop.

This is mitigated by the min/max clamping (the height stabilizes), but it is still possible to get one extra render cycle per change. To be safe, add a check to avoid setting state when the height has not changed:

```typescript
editor.onDidContentSizeChange((e) => {
  const newHeight = Math.min(Math.max(e.contentHeight, 80), 400);
  setEditorHeight((prev) => (prev === newHeight ? prev : newHeight));
});
```

Using the functional updater form with a no-op when equal prevents unnecessary re-renders and breaks any potential feedback loop.

### Bug 4: `cell-results` has `max-height: 250px` - the CSS change is incomplete

The PRD correctly identifies that `.cell-editor`'s hardcoded `height: 150px !important` must be removed. However, it does not note that `.cell-results` (line 615-618 in App.css) has `max-height: 250px; overflow: auto`. With the editor now growing up to 400px, and results capped at 250px, the total cell height per statement could be ~700px+ (header ~40px + editor 400px + results 250px + error banner). This is a UX judgment call rather than a bug, but it should be an explicit decision in the PRD rather than an unexamined side effect. Consider whether the `cell-results` cap should be raised to 400px to match.

### Concern: `automaticLayout: true` interacts with the height change

`automaticLayout: true` runs a ResizeObserver (in modern Monaco) on the editor's container element. When `setEditorHeight` updates the container height, the ResizeObserver fires, Monaco recalculates layout, which may trigger `onDidContentSizeChange`. See Bug 3 above - the functional state updater form handles this correctly.

### CSS change is correct

Removing `height: 150px !important` and `min-height: 150px !important` and replacing with `min-height: 80px; max-height: 400px; overflow: hidden` is correct. The `overflow: hidden` is appropriate because Monaco manages its own scrollbar. No other styles depend on the `.cell-editor` having a fixed 150px height - the results table sits below it in normal document flow inside a flex column.

---

## 1.3 Virtual Scrolling

**Verdict: BLOCK - Fundamental architectural error**

### BLOCKING Issue: `translateY` on `<tr>` inside `<tbody>` does not work

The proposed rendering strategy uses:
```tsx
<tr style={{ transform: `translateY(${virtualRow.start}px)` }}>
```

This approach does not work for HTML `<table>` elements. CSS `transform` on `<tr>` elements is either ignored or produces undefined behavior in all major browsers. The HTML/CSS specification does not define transform behavior on internal table elements (`<tr>`, `<td>`, `<th>`, `<thead>`, `<tbody>`, `<tfoot>`). Chrome and Firefox both silently ignore `transform: translateY()` on `<tr>`. The rows will render stacked from the top of the tbody, not at the computed virtual positions.

This is not a minor visual glitch - the entire virtual scrolling mechanism relies on correct row positioning. With transforms ignored, all rendered rows will pile up at position 0, the spacer rows will add phantom height below, and the visual result will be a broken layout with duplicated/overlapping rows at the top of the table and a large empty space at the bottom.

This is a known and well-documented limitation. The `@tanstack/react-virtual` documentation explicitly addresses it and provides two valid patterns for table virtualization.

### Correct approach: `<div>`-based table (recommended)

The simplest correct fix is to render the table using `<div>` elements styled to look like a table instead of native `<table>`/`<tr>`/`<td>` elements. `transform: translateY()` works correctly on divs. The existing CSS already uses flexbox in adjacent containers, so this is feasible.

```tsx
<div role="table" className="results-table">
  {/* thead equivalent */}
  <div role="rowgroup" className="results-thead">
    <div role="row" className="results-tr">
      {columnNames.map((colName) => (
        <div role="columnheader" key={colName} className="results-th" onClick={() => handleSort(colName)}>
          {/* header content */}
        </div>
      ))}
    </div>
  </div>

  {/* tbody equivalent */}
  <div
    role="rowgroup"
    style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
  >
    {rowVirtualizer.getVirtualItems().map((virtualRow) => (
      <div
        role="row"
        key={virtualRow.index}
        style={{
          position: 'absolute',
          top: 0,
          transform: `translateY(${virtualRow.start}px)`,
          width: '100%',
        }}
      >
        {columnNames.map((colName) => (
          <div role="cell" key={colName}>{/* cell content */}</div>
        ))}
      </div>
    ))}
  </div>
</div>
```

This requires updating the CSS for `.results-table`, `.results-table th/td` equivalents to use flexbox column layout. It is more work than the PRD estimates but is the correct solution.

### Alternative correct approach: `<table>` with `position: absolute` wrapper (not recommended)

Some implementations wrap the `<tbody>` in a `<div>` with `position: relative` and use a single `<table>` per virtual row. This is overly complex and breaks `border-collapse` and sticky headers.

### Alternative correct approach: padding-based spacers on `<tbody>` (acceptable for this codebase)

A simpler fix that preserves the native `<table>` element is to use `padding-top` and `padding-bottom` on the `<tbody>` element itself to represent the virtual space, while rendering only the visible rows in normal document flow:

```tsx
<tbody
  style={{
    paddingTop: `${virtualItems[0]?.start ?? 0}px`,
    paddingBottom: `${rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)}px`,
  }}
>
  {virtualItems.map((virtualRow) => {
    const row = sortedData[virtualRow.index];
    return (
      <tr key={virtualRow.index}>
        {columnNames.map((colName) => (
          <td key={colName}>{/* cell content */}</td>
        ))}
      </tr>
    );
  })}
</tbody>
```

Note: `padding` on `<tbody>` requires `display: block` on `<tbody>`, which breaks `border-collapse` table layout. The `<td>` cells will lose their column-aligned widths unless explicit column widths are set via `<colgroup>` or CSS on `th`/`td`.

### Recommendation

Given the existing native `<table>` structure and the `border-collapse: collapse` style already in place, the least-disruption path is to switch to the `<div>`-based approach and update the CSS. The PRD's estimated 2-3 hour implementation time is too low given this rework. Estimate 6-8 hours including CSS migration and cross-browser testing.

The `@tanstack/react-virtual` docs include a complete table virtualization example using divs with ARIA roles - follow it directly.

### Secondary Issue: Spacer row placement is wrong (also broken)

Even if `translateY` worked, the spacer rows are placed after the rendered rows in the PRD's code:

```tsx
{rowVirtualizer.getVirtualItems().map((virtualRow) => { ... })}
{/* top spacer - placed AFTER data rows */}
<tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }} />
{/* bottom spacer */}
<tr style={{ height: ... }} />
```

The top spacer (representing the virtual height above the first visible row) is rendered after the data rows, not before them. This means the spacer that should push the content down is actually appended to the bottom. The top spacer must come before the data rows in DOM order:

```tsx
<tbody>
  {/* Top spacer must be FIRST */}
  <tr style={{ height: `${virtualItems[0]?.start ?? 0}px` }} aria-hidden />

  {virtualItems.map((virtualRow) => (
    <tr key={virtualRow.index}>{/* ... */}</tr>
  ))}

  {/* Bottom spacer must be LAST */}
  <tr style={{ height: `${rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)}px` }} aria-hidden />
</tbody>
```

However, this only matters if the spacer row approach is used at all, which it cannot be with native `<tr>` + `translateY`. The spacer-row pattern on a native `<table>` requires rows in correct DOM order and no transforms - it's a different implementation from what the PRD describes.

### Secondary Issue: `results-table-container` has `height: 100%`

`.results-table-container` has `display: flex; flex-direction: column; height: 100%`. The scroll container (`.results-table-wrapper`) has `flex: 1; overflow: auto`. For `overflow: auto` to create a scroll container, the parent chain must have a resolved height. Since `.cell-results` has `max-height: 250px; overflow: auto`, the wrapper already has a bounded height and will scroll. The `ref={parentRef}` on `.results-table-wrapper` is correctly placed. This part of the PRD is correct.

### Secondary Issue: `tr:nth-child(even)` striping will be wrong

With virtual scrolling, only a subset of rows is rendered. If the first visible row is row index 7 (0-based), it will be the first `<tr>` in the DOM and get the odd-child style, not the even-child style it should have. Zebra striping based on `nth-child` will be visually incorrect. The fix is to apply row parity via an inline style or class based on `virtualRow.index % 2`:

```tsx
<tr
  key={virtualRow.index}
  className={virtualRow.index % 2 === 1 ? 'row-even' : ''}
>
```

This is a separate, smaller bug but should be called out explicitly in the PRD.

### Secondary Issue: `React` is not imported in ResultsTable.tsx

`ResultsTable.tsx` line 18 uses `React.FC<ResultsTableProps>` but does not import `React` (line 1 only imports `useState` and `useMemo`). This works in React 17+ with the JSX transform, but `React.FC` requires `React` to be in scope. The PRD adds a `useRef` import but does not fix the existing missing `React` import. This should be added:

```typescript
import React, { useRef, useState, useMemo } from 'react';
```

---

## Implementation Order Recommendation

Implement in this order to minimize risk and allow incremental testing:

### 1. Keyboard Shortcuts (1.1) - Implement first

Lowest risk, self-contained change to a single function in EditorCell.tsx. Zero CSS changes. Can be fully tested in isolation. Apply the minor fix to use the functional state updater pattern if any state is involved (there is none here - this is clean). Implement, test all acceptance criteria, merge.

### 2. Auto-Resize Editor (1.2) - Implement second

Moderate risk due to the memory leak and potential resize loop. Apply all four fixes identified above before implementing:
1. Use `e.contentHeight` from the event argument instead of `editor.getContentHeight()`
2. Store the disposable and call `editor.onDidDispose(() => disposable.dispose())`
3. Use the functional state updater `setEditorHeight((prev) => prev === newHeight ? prev : newHeight)` to prevent feedback loops
4. Explicitly decide and document whether `.cell-results` max-height should be updated alongside `.cell-editor`

Do not implement 1.3 at the same time as 1.2 - the editor height and results table height interact. Stabilize 1.2 first.

### 3. Virtual Scrolling (1.3) - Implement last, after PRD revision

The PRD must be revised before implementation begins. The author should:
1. Decide between the `<div>`-based approach (recommended) or the padding-on-tbody approach (acceptable with tradeoffs)
2. Rewrite the tbody rendering section to use whichever correct pattern is chosen
3. Fix the zebra striping to use index-based classes
4. Update the time estimate to 6-8 hours
5. Add `React` to the import list in the diff preview

The virtual scrolling work is independent of 1.1 and 1.2 and can proceed in a separate branch, but do not merge until the architectural issue is resolved.

---

## Summary of Required Fixes Before Merge

| PRD | Issue | Severity |
|-----|-------|----------|
| 1.1 Keyboard Shortcuts | None - approve as written | - |
| 1.2 Auto-Resize | `onDidContentSizeChange` callback should use event arg | Low |
| 1.2 Auto-Resize | Listener disposable not stored or cleaned up (memory leak) | Medium |
| 1.2 Auto-Resize | No guard against resize feedback loop | Medium |
| 1.2 Auto-Resize | `.cell-results` max-height impact not addressed | Low |
| 1.3 Virtual Scrolling | `translateY` on `<tr>` is ignored by browsers - broken | BLOCKING |
| 1.3 Virtual Scrolling | Top spacer row placed after data rows instead of before | High |
| 1.3 Virtual Scrolling | `tr:nth-child(even)` zebra striping will be incorrect | Medium |
| 1.3 Virtual Scrolling | `React` import missing from ResultsTable.tsx | Low |
