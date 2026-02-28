# Phase 1.2: Auto-Resize Editor Height

**Status:** Proposed
**Complexity:** Low
**Estimated Effort:** 2-3 hours
**Priority:** High (UX improvement)

## Problem Statement

The Monaco editor component in `EditorCell` has a hardcoded height of 150px, which creates two usability issues:

1. **Wasted Space**: Short SQL queries (1-2 lines) occupy the same 150px height, leaving excessive whitespace
2. **Forced Scrolling**: Long queries (10+ lines) require internal scrolling within the editor, fragmenting the query view

This inconsistent experience impacts productivity when working with queries of varying complexity.

## Proposed Solution

Implement dynamic editor height adjustment using Monaco's `onDidContentSizeChange` event. The editor height will:
- Grow with content to display multi-line queries fully
- Maintain minimum height (80px) for empty/collapsed states
- Cap at maximum height (400px) to prevent cells from dominating the viewport
- Adjust smoothly as users type or paste content

## Technical Approach

### Component: EditorCell.tsx

**Current State:**
- Editor height is hardcoded to `"150px"` (line 212)
- No state management for dynamic height
- Content size changes are not monitored

**Changes Required:**

1. **Add height state** (line 36):
   ```typescript
   const [editorHeight, setEditorHeight] = useState(100);
   ```

2. **Enhance handleEditorMount** (lines 38-40):
   ```typescript
   const handleEditorMount: OnMount = (editor) => {
     editorRef.current = editor;

     // Auto-resize based on content
     const updateHeight = () => {
       const contentHeight = editor.getContentHeight();
       const newHeight = Math.min(Math.max(contentHeight, 80), 400);
       setEditorHeight(newHeight);
     };

     editor.onDidContentSizeChange(updateHeight);
     updateHeight(); // Set initial height
   };
   ```

3. **Update Editor component** (line 212):
   ```typescript
   <Editor
     height={`${editorHeight}px`}
     // ... rest of props unchanged
   />
   ```

### Styles: App.css

**Current State:**
- `.cell-editor` has hardcoded `height: 150px !important` and `min-height: 150px !important` (lines 592-593)
- `!important` flag prevents dynamic values from working

**Changes Required:**

Replace lines 590-595:
```css
/* Cell Editor */
.cell-editor {
  border-bottom: 1px solid var(--color-border);
  min-height: 80px;
  max-height: 400px;
  overflow: hidden;
}
```

**Key Changes:**
- Remove hardcoded `height: 150px !important`
- Remove hardcoded `min-height: 150px !important`
- Add `min-height: 80px` (no `!important`)
- Add `max-height: 400px` (no `!important`)
- Keep `overflow: hidden` to prevent Monaco's internal scrollbar

## Implementation Details

### Height Calculation Logic

```typescript
const contentHeight = editor.getContentHeight();
const newHeight = Math.min(Math.max(contentHeight, 80), 400);
```

- **Lower bound (80px)**: Ensures minimum usable height even for empty editors
- **Upper bound (400px)**: Prevents single editor from dominating viewport (~9 lines of code at current font size)
- **Content-based**: Uses Monaco's built-in `getContentHeight()` which accounts for line height and padding

### Event Listener

`editor.onDidContentSizeChange(updateHeight)` fires when:
- User types or deletes characters
- Content is pasted
- Lines are added/removed
- Font size changes (if implemented)

This listener persists for the editor's lifetime and updates state each time.

### Initial Height

Calling `updateHeight()` after registering the listener sets the initial height based on the statement's current code, accounting for multiline default statements.

## Affected Files

| File | Lines | Changes |
|------|-------|---------|
| `src/components/EditorCell/EditorCell.tsx` | 36, 38-50, 212 | Add state, enhance mount handler, dynamic height prop |
| `src/App.css` | 590-595 | Replace hardcoded constraints with min/max |

## Acceptance Criteria

- [x] Empty editor defaults to minimum height (~80px)
- [x] Single-line query displays without scrolling
- [x] Multi-line query (10+ lines) expands editor proportionally
- [x] Editor never exceeds 400px height (scrolls beyond that)
- [x] No hardcoded `150px` remains in codebase
- [x] Collapsed cells work correctly (state doesn't affect collapsed view)
- [x] Pasted content expands smoothly without flicker
- [x] Deleted content shrinks the editor back down
- [x] `automaticLayout: true` still handles width changes
- [x] No TypeScript compilation errors
- [x] No console warnings or errors

## Edge Cases

| Scenario | Behavior | Notes |
|----------|----------|-------|
| **Collapsed cell** | Height state maintained but hidden | Uncollapsing uses stored height value |
| **Empty statement** | 80px minimum | Visual consistency |
| **Paste 50+ lines** | Caps at 400px, scrolls internally | Prevents viewport hijacking |
| **Rapidly delete content** | Shrinks smoothly | Animation handled by CSS transition |
| **Initial load with code** | Height computed on mount | No layout shift |
| **Window resize** | No impact on editor height | Handled separately by `automaticLayout: true` |

## Performance Considerations

- **Event listener**: Single listener per editor instance (minimal overhead)
- **State updates**: Only triggered by actual content size changes, not DOM reflows
- **Height calculation**: O(1) operation in Monaco's internal measurement
- **No layout thrashing**: Updates batched in React's event loop

## Testing Strategy

### Unit Tests
- Verify height state updates when content changes
- Verify height respects min/max bounds
- Verify collapsed state doesn't affect height tracking

### Integration Tests
- Test with short queries (1-2 lines)
- Test with medium queries (5-10 lines)
- Test with long queries (15+ lines)
- Test paste operations (small and large content blocks)
- Test content deletion
- Test cell collapse/expand

### Visual Tests
- No visual jumps during height transitions
- Editor content aligns consistently
- Results table positioned correctly below editor

## Dependencies

- Monaco Editor library (already available): `onDidContentSizeChange` API
- React: state management via `useState`
- CSS: min/max-height properties (CSS3, widely supported)

## Breaking Changes

None. This is a pure enhancement that maintains backward compatibility.

## Rollback Plan

Revert the three code changes and restore original CSS. No data migration needed.

## Timeline

**Phase 1.2** iteration:
- Code review: 15 minutes
- Implementation: 30-45 minutes
- Testing: 45-60 minutes
- Polish & documentation: 15 minutes

**Total: 2-3 hours**

## Future Enhancements

1. **User Preference**: Store preferred editor height in localStorage
2. **Smooth Transitions**: Add CSS transition to height changes
3. **Double-Click Expand**: Expand to full content on double-click
4. **Keyboard Shortcut**: Cmd/Ctrl+Shift+E to toggle expand
5. **Responsive Limits**: Adjust max-height based on viewport size
6. **Theme Support**: Scale height limits for different font sizes

## Implementation Notes

**Completed:** 2026-02-28
**Combined with:** Phase 1.1 Keyboard Shortcuts (shared handleEditorMount)

- Uses hybrid `e?.contentHeight ?? editor.getContentHeight()` for event + initial call
- Disposable properly cleaned up via `editor.onDidDispose`
- Functional state updater prevents resize feedback loop
- Removed all `!important` from cell-editor CSS
- QA: 11/11 checks pass (see phase-1-qa-report.md)
