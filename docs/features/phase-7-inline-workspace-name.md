# Phase 7: Inline Workspace Name Edit

**Status:** Design Phase
**Date:** 2026-02-28

## Problem Statement

Currently, the header displays "SQL Workspace" as a static, non-editable title. Users can only change the workspace name in the settings panel, which is buried in a dropdown menu. Confluent Cloud allows users to click the workspace name in the header to edit it inline, providing a more intuitive and accessible way to update the workspace name.

## Proposed Solution

Make the workspace title "SQL Workspace" clickable and editable inline:
- Clicking the title transforms it into a text input field
- The input is pre-filled with the current workspace name from store (`workspaceName`)
- Pressing Enter or blurring out of the input saves the change to the store
- Pressing Escape cancels the edit and reverts to the original name
- A subtle pencil icon appears on hover to indicate the title is editable
- No layout shift should occur during the edit/cancel transition

## Files to Modify

1. **`src/App.tsx`**
   - Replace the static `<span>SQL Workspace</span>` in the logo div with an inline editable component
   - Add local state (`isEditingTitle`, `editingValue`, `preEditSnapshot`) to manage edit mode
   - Add event handlers for Enter, Escape, and blur with race condition guard
   - Use `autoFocus` on input element (no useRef)
   - Import `FiEdit2` from react-icons/fi for pencil icon inline display
   - No new component file; logic stays within App.tsx

2. **`src/App.css`**
   - Style for `.logo-text` with `max-width: 300px` and `text-overflow: ellipsis`
   - Style for the editable title input (matching font size 18px and font weight 600 from `.logo`)
   - `.logo-editable-input` with `max-width: 300px` and `text-overflow: ellipsis`
   - Pencil icon (`FiEdit2`) appears inline on hover of `.logo-text`
   - Focus and active states for the input

3. **`src/store/workspaceStore.ts`**
   - Check if `workspaceName` field exists in `WorkspaceState` interface
   - If not, add `workspaceName: string` (default: "SQL Workspace")
   - Add `setWorkspaceName: (name: string) => void` action
   - Add `workspaceName` to the `partialize` persist middleware so it's saved to localStorage

## API Changes

None. This is a local UI and state change only.

## Type Changes

**WorkspaceState interface**:
- Add field: `workspaceName: string` (with theme and other state fields)
- Add action: `setWorkspaceName: (name: string) => void` (in action signatures)

## UI/UX Details

### Current Header Structure
```html
<div class="logo">
  <FiDatabase size={24} />
  <span>SQL Workspace</span>
</div>
```

### New Header Structure
```jsx
<div class="logo">
  <FiDatabase size={24} />
  {isEditingTitle ? (
    <input
      value={editingValue}
      onChange={handleEditChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      autoFocus
      className="logo-editable-input"
    />
  ) : (
    <span
      onClick={startEdit}
      className="logo-text"
      title="Click to edit workspace name"
    >
      {workspaceName}
      <FiEdit2 size={16} className="logo-pencil-icon" />
    </span>
  )}
</div>
```

### CSS Classes Needed
- `.logo-text` - Clickable span with `max-width: 300px` and `text-overflow: ellipsis`
- `.logo-pencil-icon` - FiEdit2 SVG icon, hidden by default, shown on hover
- `.logo-editable-input` - Input field, matches font size/weight/color of `.logo`, with `max-width: 300px` and `text-overflow: ellipsis`

### Styling Notes
- Input should use `font-size: 18px`, `font-weight: 600`, match text color
- Input should have minimal border (bottom border only or subtle outline)
- Pencil icon (`FiEdit2`) should appear inline on `:hover` of `.logo-text`, hidden by default
- Both `.logo-text` and `.logo-editable-input` should have `max-width: 300px` with `text-overflow: ellipsis`
- No padding/margin changes to avoid layout shift
- Input should auto-focus when edit mode activates (via `autoFocus` prop)

## Acceptance Criteria

1. **Click to Edit**: Clicking the "SQL Workspace" title or the pencil icon enters edit mode
2. **Pre-filled Input**: Input field is pre-filled with the current `workspaceName` from store
3. **Enter to Save**: Pressing Enter saves the input value to store and exits edit mode
4. **Escape to Cancel**: Pressing Escape cancels edit, reverts to pre-edit snapshot, exits edit mode
5. **Blur to Save**: Clicking outside the input (blur) saves the value and exits edit mode (with race condition guard)
6. **Pencil Icon**: A subtle pencil icon (`FiEdit2`) is visible inline on hover of the title
7. **No Layout Shift**: Font size, weight, height, padding remain the same in view vs edit modes
8. **Persistence**: New workspace name is saved to localStorage via zustand persist middleware
9. **Empty/Whitespace Handling**: If user clears the input or submits whitespace, fallback to pre-edit snapshot
10. **Long Name Handling**: Names longer than `max-width: 300px` truncate with ellipsis

## Edge Cases & Error Handling

1. **Empty Input**: If user submits empty string, revert to pre-edit snapshot (do not allow empty names)
2. **Whitespace Only**: If input is whitespace-only, treat as empty and revert to pre-edit snapshot
3. **Rapid Clicks**: Clicking the title/pencil repeatedly should not cause issues (handled by React state)
4. **Long Names**: Names longer than `max-width: 300px` should truncate with ellipsis (CSS text-overflow)
5. **Special Characters**: Allow any UTF-8 characters (no validation needed)
6. **Concurrent Edits**: Not applicable (single-user app), but store action should be idempotent
7. **Blur/Enter Race Condition**: Guard against double-save by checking `isEditingTitle` in blur handler and setting flag to false in Enter handler first

## Implementation Notes

- Use inline `useState` in App.tsx, not a separate component
- Local state: `isEditingTitle` (bool), `editingValue` (string), `preEditSnapshot` (string to hold original value)
- Input should match logo styling exactly (use CSS variables for consistency)
- Use `autoFocus` prop on input element (no useRef needed)
- In `handleKeyDown` for Enter: set `isEditingTitle` to false **first**, then call `saveEdit()`
- In `handleBlur`: early-return if `!isEditingTitle` to prevent double-save when Enter fires
- Save original name in `preEditSnapshot` before entering edit mode; use as revert target on Escape/empty-submit
- Call `setWorkspaceName()` from store on Save/Blur
- Import `FiEdit2` from react-icons/fi; display inline next to title in `.logo-text` on hover
- Ensure `workspaceName` field is added to store BEFORE modifying App.tsx to avoid undefined refs

## Testing Strategy (QA Phase)

1. **Rendering**: Verify title displays correctly in both view and edit modes
2. **Edit Flow**: Click title → input appears and auto-focuses → type new name → press Enter → name saves and input exits
3. **Escape Flow**: Click title → input appears → type text → press Escape → reverts to pre-edit snapshot
4. **Blur Flow**: Click title → input appears → type text → click elsewhere → name saves (verify no double-save on blur after Enter)
5. **Hover Pencil**: Hover over title → FiEdit2 pencil icon appears inline; move mouse away → pencil disappears
6. **Persistence**: Edit name → reload page → verify new name persists
7. **Empty Input**: Edit name → clear all text → press Enter → verify reverts to pre-edit snapshot
8. **Long Names**: Enter a name > 40 characters → verify truncates with ellipsis (max-width: 300px)
9. **Whitespace Handling**: Edit name → enter only spaces → press Enter → verify reverts to pre-edit snapshot
10. **Edge Cases**: Test with unicode characters, rapid clicks, blur/Enter race condition
