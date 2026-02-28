# UX Review: Phase 0 Cleanup

**Reviewer:** UX Engineer
**Date:** 2026-02-28
**Files reviewed:**
- `src/components/EditorCell/EditorCell.tsx`
- `src/App.css`
- `src/index.css`

---

## Verdict: NEEDS CHANGES

Three issues require resolution before this can be approved. Two are bugs (missing CSS, layout overflow risk). One is a labeling problem. The remaining findings are improvements that would meaningfully raise the interaction quality.

---

### [BUG] `.delete-confirm`, `.confirm-yes`, `.confirm-no` have no CSS rules

The delete confirmation widget renders as a raw `<div>` containing unstyled `<span>` and `<button>` elements. `App.css` contains no rules for `.delete-confirm`, `.confirm-yes`, or `.confirm-no`. The result in the browser will be browser-default button styling (system font, grey beveled buttons, no sizing) dropped inline inside the `cell-header-right` flex row. It will look broken and may misalign or overflow the 44px header.

Recommendation: Add CSS for the confirmation widget before merging. Suggested rules using existing design tokens:

```css
.delete-confirm {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  animation: slideInRight 100ms ease-out;
}

.confirm-yes,
.confirm-no {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.confirm-yes {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: #fff;
}

.confirm-yes:hover {
  background-color: #DC2626; /* one shade darker than --color-error #EF4444 */
  border-color: #DC2626;
}

.confirm-no {
  background-color: transparent;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.confirm-no:hover {
  background-color: var(--color-surface-secondary);
  color: var(--color-text-primary);
}
```

---

### [BUG] Confirmation widget may overflow the 44px cell header

`.cell-header` has `height: 44px` and `overflow` is not set, so the content is visible but the layout is fragile. The confirmation widget injects a `<div>` with a `<span>` plus two buttons into `.cell-header-right` (a `flex` row with `gap: 4px`). Without explicit sizing on `.delete-confirm`, the widget will take whatever natural width the browser assigns to the unstyled buttons, potentially pushing the `Run` button and the collapse chevron out of view or wrapping the row.

Recommendation: Apply `height: 28px` and `align-items: center` to `.delete-confirm` to match the height of the surrounding `.icon-btn` elements (which are 28x28). This keeps the row at its natural 44px height. The CSS in the finding above already includes this.

---

### [ISSUE] "Yes / No" labels are ambiguous; use "Delete / Cancel" instead

The confirmation reads: `Delete?  [Yes]  [No]`. In a developer tool where users are operating quickly, "Yes" and "No" require an extra moment to mentally map back to the question. This is a known UX anti-pattern for destructive confirmations. "Delete" and "Cancel" are self-describing action labels - the user reads the button and knows exactly what will happen without re-reading the question.

Additionally, the `<span>Delete?</span>` label is redundant when the buttons are self-describing. Replacing it with a small trash icon keeps the header compact and saves approximately 48px of width.

Recommendation:
```tsx
<div className="delete-confirm">
  <button className="confirm-yes" onClick={handleDelete}>Delete</button>
  <button className="confirm-no" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
</div>
```

---

### [ISSUE] 5-second auto-dismiss timer is too short and has no visual indicator

5 seconds is at the low end for an auto-dismissing destructive confirmation. A user who is reading results in the cell, glances up to the header, sees the confirmation, and moves to click "Delete" may find it has already dismissed. There is also no progress indicator, so the user has no signal that the confirmation is about to disappear.

Two additional concerns:
1. If the user's mouse is hovering somewhere on the page but not the confirmation, and they are reading the screen, 5 seconds passes faster than expected.
2. A regression risk: every `showDeleteConfirm` state change restarts the `useEffect` timer. If the component re-renders for an unrelated reason (e.g. status polling updating `statement.status`), the timer resets silently, which could cause the confirmation to linger unexpectedly.

Recommendation: Increase the timeout to 8 seconds. Add a CSS progress bar that depletes over the timeout duration so the user has a clear visual signal. Alternatively, remove the auto-dismiss entirely - the user explicitly dismisses via "Cancel" or by clicking away (click-outside handler). This is the safer default for a destructive action.

---

### [ISSUE] No visual distinction when the confirmation state is active

When the trash button is replaced by the confirmation widget, the only change in the header is a small piece of text and two small buttons appearing. There is no background highlight, border change, or color treatment on the cell or its header to draw the eye. In a multi-cell workspace the user may not notice which cell's confirmation appeared, especially if the cells are partially scrolled.

Recommendation: When `showDeleteConfirm` is true, apply a red left-border or a faint red background tint to `.cell-header` using an additional class. This is consistent with how `.cell-error` uses `#FEF2F2` and a red border. Example:

```css
.cell-header.confirming-delete {
  background-color: #FEF2F2;
  border-left: 3px solid var(--color-error);
}
```

In the component, add `confirming-delete` to `.cell-header` when `showDeleteConfirm` is true:
```tsx
<div className={`cell-header${showDeleteConfirm ? ' confirming-delete' : ''}`}>
```

---

### [ISSUE] The + button position and tooltip do not communicate "insert after"

The `+` button sits in `.cell-header-left` next to the cell number. Its `title` is `"Add new statement"`, which does not tell the user whether the new cell will appear above or below the current one. The toolbar-level "Add Cell" button at the top of the workspace always appends to the end. The per-cell `+` button inserts after the current cell (`addStatement(undefined, statement.id)`). These are two different behaviors with no visual distinction.

Users unfamiliar with the codebase will likely assume the `+` button behaves the same as the toolbar button (append), and will be confused when a new cell appears in the middle of their list.

Recommendation:
1. Change `title` to `"Insert cell below"` to be explicit about position.
2. Consider repositioning the `+` button to the bottom edge of the cell (as a thin strip or a hover-revealed bar between cells) rather than the header. This placement is a well-established pattern in Jupyter Notebook and similar tools - it is spatially honest about where the new cell will appear.

---

### [OK] Delete confirmation is gated correctly - no accidental deletes possible

The two-step interaction (click trash -> confirmation appears -> click confirm to delete) correctly prevents accidental deletion from a single misclick. The `handleDelete` function checks `showDeleteConfirm` before calling `deleteStatement`, so a second click on the trash icon while the state is still transitioning would also confirm - this is acceptable and expected.

---

### [OK] Collapse/expand, duplicate, and run buttons are unaffected during confirmation

The confirmation widget only replaces the trash button. All other controls (duplicate, run/stop, collapse) remain interactive while the confirmation is visible. This is correct - there is no reason to lock the rest of the cell during a confirmation prompt.

---

### [OK] Design tokens are available for all needed confirmation states

`--color-error: #EF4444` covers the destructive button color. `--color-border`, `--color-text-secondary`, `--color-surface-secondary`, and `--transition-fast` are all available for the cancel button and hover states. No custom color values are needed.

---

## Summary of required changes

| Priority | Finding | File to change |
|----------|---------|----------------|
| Bug | Add CSS for `.delete-confirm`, `.confirm-yes`, `.confirm-no` | `src/App.css` |
| Bug | Constrain widget height to prevent header overflow | `src/App.css` |
| Issue | Change button labels from Yes/No to Delete/Cancel | `src/components/EditorCell/EditorCell.tsx` |
| Issue | Increase auto-dismiss timeout or remove it; add visual countdown | `src/components/EditorCell/EditorCell.tsx` + `src/App.css` |
| Issue | Add visual highlight to cell header during confirmation | `src/components/EditorCell/EditorCell.tsx` + `src/App.css` |
| Issue | Change `+` button title to "Insert cell below"; consider repositioning | `src/components/EditorCell/EditorCell.tsx` |
