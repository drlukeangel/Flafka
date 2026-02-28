# Phase 7: Cell Hover Actions

## Problem Statement
Currently, EditorCell displays all action buttons (copy, delete, Run, collapse chevron, add-cell) at all times, creating visual clutter. Confluent Cloud demonstrates a cleaner UI pattern where utility buttons appear only on hover, while primary actions remain always visible.

## Proposed Solution
Implement a hover-based visibility pattern for cell header buttons using CSS `:hover` and `:focus-within` selectors. This reduces visual noise while keeping essential actions readily accessible:

- **Always visible**: Run button (primary action), collapse/expand chevron (critical state toggle)
- **Hover-only**: Copy and delete buttons (secondary utility actions)
- **Hover-only**: Add-cell "+" button between cells (appears on gap hover)
- **Delete confirmation handling**: When delete confirmation is shown, force `.cell-actions` visible regardless of hover state

Use opacity transitions (0→1 over 150ms) to maintain layout stability and provide smooth visual feedback. Add accessibility support via `:focus-within` and touch device fallback via `@media (hover: none)`.

## Files to Modify

### 1. `src/App.css`
Add hover styles to the `.editor-cell` for fade-in/out of secondary buttons:
- `.editor-cell .cell-header-right .icon-btn` (copy/delete buttons) - fade in on hover
- `.editor-cell .add-btn` (add-cell button in cell-header-left) - fade in on hover
- Keep `.run-btn` and `.collapse-btn` always visible (opacity: 1, no transition)
- Use `opacity` for smooth fade, not `display` (prevents layout shift)

### 2. `src/components/EditorCell/EditorCell.tsx`
Add CSS classes and state handling:
- Wrap copy/delete buttons and delete confirmation in a container with class `cell-actions` to group them
- Add `confirming` class to `.editor-cell` when `showDeleteConfirm` is true to force visibility
- Mark Run button with class `run-btn` (already exists, style override)
- Mark collapse chevron with class `collapse-btn` (already exists, style override) — NOTE: naming overlap with sidebar toggle, document separately
- The add-btn in cell-header-left already has the class, just needs CSS styling

## Current Button Structure (from EditorCell.tsx)

### Cell Header Left (line 444-461)
- Drag handle (hidden by default, shows on cell-header hover)
- Add-cell button `.add-btn` with FiPlus icon (line 454-460)
- Cell number label

### Cell Header Center (line 464-478)
- Status badge
- Execution time
- Results count

### Cell Header Right (line 480-530)
- Copy button `.icon-btn` with FiCopy (line 481-487)
- Delete button `.icon-btn .delete-btn` with FiTrash2 (line 494-500) / delete confirmation UI
- Run button `.run-btn` (line 502-518)
- Collapse chevron `.icon-btn .collapse-btn` (line 519-529)

## CSS Strategy

### Opacity Classes
```css
/* Default: hide hover-only buttons */
.editor-cell .cell-actions {
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none; /* Prevent interaction while hidden */
}

/* On cell hover or focus-within: show hover-only buttons */
.editor-cell:hover .cell-actions,
.editor-cell:focus-within .cell-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Delete confirmation active: force cell-actions visible */
.editor-cell.confirming .cell-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Add-cell button visibility */
.editor-cell .add-btn {
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
}

.editor-cell:hover .add-btn,
.editor-cell:focus-within .add-btn {
  opacity: 1;
  pointer-events: auto;
}

/* Touch device fallback: always visible buttons on devices without hover capability */
@media (hover: none) {
  .editor-cell .cell-actions,
  .editor-cell .add-btn {
    opacity: 1;
    pointer-events: auto;
  }
}
```

### Key Constraints
- No `display: none` - use `opacity` to avoid layout shift
- `pointer-events: none` on hidden buttons prevents accidental clicks
- 150ms transition duration for smooth fade
- Drag handle already fades in on cell-header hover (line 988-992 in App.css)
- Run button and collapse chevron are NOT inside `.cell-actions` container, so they inherit always-visible styling from parent
- `.collapse-btn` class name conflicts with sidebar toggle `.collapse-btn` — document this as separate components

## Acceptance Criteria

1. **Copy and delete buttons hidden by default**
   - Both buttons start with opacity: 0
   - Become visible (opacity: 1) when hovering over `.editor-cell`
   - Not clickable when hidden (pointer-events: none)

2. **Run button always visible**
   - Maintains opacity: 1 at all times
   - No transition applied
   - Always clickable

3. **Collapse chevron always visible**
   - Maintains opacity: 1 at all times
   - No transition applied
   - Always clickable

4. **Add-cell "+" button visible on hover**
   - Starts with opacity: 0
   - Becomes visible (opacity: 1) when hovering over `.editor-cell`
   - Not clickable when hidden (pointer-events: none)

5. **Smooth 150ms opacity transition**
   - All fade effects use `transition: opacity 150ms ease`
   - Transitions are instantaneous on show (no delay)

6. **No layout shift when buttons appear**
   - Uses opacity, not display property
   - Button containers maintain space in layout
   - All buttons use fixed width/height dimensions

7. **Delete confirmation always visible when active**
   - When delete confirmation appears (line 488-492), it replaces the delete button
   - Confirmation UI should be forced visible by adding `confirming` class to `.editor-cell`
   - The `.delete-confirm` container should be part of `.cell-actions`
   - Apply class logic: `className={showDeleteConfirm ? "confirming" : ""}`

## Edge Cases

1. **Delete confirmation active**: When delete confirmation appears, force `.cell-actions` visible via `confirming` class, preventing mouse-leave from hiding the confirmation buttons. The user must explicitly click Delete or Cancel to close it.

2. **Keyboard navigation**: Support `:focus-within` selector so focused cells show actions even without hover. Critical for accessibility on keyboard-only users.

3. **Touch devices**: On touch-capable devices without hover support (`@media (hover: none)`), force full opacity on `.cell-actions` and `.add-btn` to ensure touch users can see and interact with actions.

4. **Focused cell**: `:focus-within` selector shows actions when any child (button, input) receives focus, separate from hover state.

5. **Drag-over states**: Cell drag-over styling (border highlights) is independent of button visibility.

6. **Collapsed cells**: When a cell is collapsed, the header actions remain the same. No changes needed to `.cell-collapsed-preview`.

7. **Naming conflict — `.collapse-btn`**: The collapse chevron button class `.collapse-btn` shares a name with the sidebar toggle component. These are separate components in different file contexts (EditorCell vs TreeNavigator). Ensure CSS scoping or component-level selectors prevent style leakage.

## Type Changes
None - CSS-only implementation, no TypeScript type changes needed.

## API Changes
None - no API changes needed.

## Dependencies
None - uses existing CSS and React component structure.

## Implementation Notes

### Step 1: Refactor Cell Header Right
Wrap copy/delete buttons + delete confirmation in a `cell-actions` container to group them for unified hover styling.

### Step 2: Add Confirming State Logic
- Add `confirming` class to `.editor-cell` when `showDeleteConfirm === true`
- Ensure delete confirmation stays visible when active, preventing accidental mouse-leave dismissal

### Step 3: Add CSS Hover Styles
- Add `.editor-cell .cell-actions { opacity: 0; pointer-events: none; }` base styles
- Add `.editor-cell:hover .cell-actions` and `.editor-cell:focus-within .cell-actions` selectors for visibility
- Add `.editor-cell.confirming .cell-actions { opacity: 1; pointer-events: auto; }` for confirmation state
- Add `.add-btn` hover and focus-within styles similarly
- Add `@media (hover: none)` fallback forcing full opacity on touch devices

### Step 4: Test Visibility States
- Verify buttons fade in/out smoothly on hover/blur with mouse
- Verify buttons show on keyboard focus (Tab key navigation)
- Test delete confirmation stays visible when triggered, hidden when dismissed
- Test touch devices show actions without requiring hover
- Confirm Run button and chevron remain always visible in all states
- Check no layout shift occurs during fade
- Verify delete confirmation is grouped with actions

## Testing Checklist

- [ ] Copy button hidden by default, visible on cell hover
- [ ] Delete button hidden by default, visible on cell hover
- [ ] Delete confirmation hidden by default, becomes visible when triggered (via `confirming` class)
- [ ] Delete confirmation stays visible even if user moves mouse away
- [ ] Delete confirmation disappears when user clicks Delete or Cancel
- [ ] Run button always visible, not affected by hover state
- [ ] Collapse chevron always visible, not affected by hover state
- [ ] Add-cell "+" button hidden by default, visible on cell hover
- [ ] Smooth 150ms fade transition on all hover/unhover actions
- [ ] No layout shift or space reallocation during fade
- [ ] Buttons not clickable when hidden (pointer-events: none)
- [ ] Keyboard Tab navigation shows actions via `:focus-within`
- [ ] Touch devices show actions without hover (via `@media (hover: none)`)
- [ ] Delete confirmation workflow still works (click delete → confirm → execute)
- [ ] Works across all cell states: idle, running, completed, error, cancelled
- [ ] Works with collapsed and expanded cells
- [ ] `.collapse-btn` styles don't leak to sidebar toggle component
