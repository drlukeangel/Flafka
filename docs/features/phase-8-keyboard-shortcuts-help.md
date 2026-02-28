# Phase 8: Keyboard Shortcuts Help Modal

## Feature Summary
Users have no way to discover keyboard shortcuts in the Flink SQL Workspace. This feature adds a discoverable help modal that displays all available keyboard shortcuts.

## Problem Statement
- Users don't know what keyboard shortcuts are available
- Shortcuts like Ctrl+Enter (run), Escape (cancel), Ctrl+Alt+Down/Up (navigate cells) are not discoverable
- No UI affordance currently exists to show keyboard help

## Proposed Solution
Add a keyboard shortcuts help modal with two access methods:
1. Press the `?` key (when not in a Monaco editor cell)
2. Click a `?` icon button in the header (right side, next to history and settings icons)

The modal displays all available shortcuts in a clean grid layout and closes on Escape or click outside.

## Implementation Details

### Files to Modify
1. **`src/App.tsx`** - Add help modal state, keyboard listener, button in header, and inline modal JSX
2. **`src/App.css`** - Add modal overlay and grid styles

### State Management
- Add `showHelp` state (boolean) to track modal visibility
- Toggle with `?` key listener and button click

### Keyboard Listener
- Listen for `?` key press
- Only activate when:
  - Modal is not already open
  - User is NOT inside a Monaco editor cell (to avoid conflicts)
- Cannot rely on editor blur state; should check if active element is a Monaco editor instance

### Header Button
- Add new `?` icon button after the history panel, before settings
- Use `FiHelpCircle` or similar icon from `react-icons/fi`
- Follow existing `.header-btn` styling pattern
- Tooltip: "Keyboard Shortcuts"
- Click toggles modal open

### Modal Component (Inline in App.tsx)
Structure with accessibility attributes:
```
Modal Overlay (click outside to close)
├── Modal Container (role="dialog", aria-modal="true", aria-labelledby="help-modal-title")
│   ├── Modal Header
│   │   ├── Title (id="help-modal-title"): "Keyboard Shortcuts"
│   │   └── Close Button (X icon)
│   └── Modal Body (scrollable)
│       └── Shortcuts Grid
│           ├── Row: Ctrl+Enter / Cmd+Enter → Run statement
│           ├── Row: Escape → Cancel running statement
│           ├── Row: Ctrl+Alt+Down → Navigate to next cell
│           ├── Row: Ctrl+Alt+Up → Navigate to previous cell
│           └── Row: ? → Toggle this help modal
```

### Styling Requirements
- Modal overlay: full viewport, semi-transparent dark background
- Modal container: centered, max-width 500px, white background (respects dark mode)
- Grid layout: two columns (shortcut keys | action description)
- Keyboard keys styled with monospace font, light background, border
- Dark mode compatible using CSS variables

### Keyboard Event Handling

Use a ref to track modal state and avoid stale closures. Toggle with `?` key and handle Escape explicitly:

```javascript
const showHelpRef = useRef(false);

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Toggle on ? key
    if (e.key === '?') {
      // Don't trigger if user is in Monaco editor
      const activeEl = document.activeElement;
      const isInEditor = activeEl?.closest('.monaco-editor') !== null;
      if (!isInEditor) {
        setShowHelp(prev => !prev);
      }
      return;
    }

    // Close on Escape if modal is open
    if (e.key === 'Escape' && showHelpRef.current) {
      setShowHelp(false);
      return;
    }
  }

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

Update `showHelpRef` in a separate effect whenever `showHelp` changes:

```javascript
useEffect(() => {
  showHelpRef.current = showHelp;
}, [showHelp]);
```

Note: `e.key === '?'` already accounts for Shift on standard keyboards - the `?` character is produced by Shift+/ on most keyboards and is handled directly by the key value.

### Click Outside to Close
Use overlay `onClick` handler with event stopPropagation:
```tsx
<div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
  <div className="help-modal-container" onClick={e => e.stopPropagation()}>
    {/* modal content */}
  </div>
</div>
```

The overlay captures clicks outside, while the container stops propagation to prevent closing when clicking inside the modal.

### CSS Grid Structure
```css
.help-shortcuts-grid {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 16px 20px;
  align-items: start;
}

.shortcut-key {
  font-family: monospace;
  font-size: 12px;
  background: var(--color-surface-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-weight: 600;
}

.shortcut-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

### Acceptance Criteria
- [ ] Press `?` key toggles modal open/closed (when not in Monaco editor)
- [ ] Click `?` button in header toggles modal open/closed
- [ ] Modal uses `setShowHelp(prev => !prev)` for proper toggle behavior
- [ ] All 5 shortcuts displayed correctly:
  - Ctrl+Enter / Cmd+Enter → Run statement
  - Escape → Cancel running statement
  - Ctrl+Alt+Down → Navigate to next cell
  - Ctrl+Alt+Up → Navigate to previous cell
  - ? → Toggle this help modal
- [ ] Escape key closes modal (using `showHelpRef` to track state)
- [ ] Clicking overlay (outside modal container) closes it
- [ ] Clicking inside modal container does NOT close it (event stopPropagation works)
- [ ] Modal has accessibility attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="help-modal-title"`
- [ ] Modal title has `id="help-modal-title"` for proper aria-labelledby reference
- [ ] Modal styled consistently with app (uses CSS variables)
- [ ] Works in both light and dark mode
- [ ] Modal doesn't break layout (uses fixed positioning + overlay)
- [ ] No keyboard conflicts (? doesn't trigger when in editor)

### Edge Cases
1. User presses `?` while in Monaco editor cell → should NOT open modal
2. User presses `?` while modal is open → should close modal (toggle)
3. User scrolls inside modal → scrolling is contained within modal
4. Mobile/touch device → `?` key still works via physical keyboard, no touch-specific behavior needed yet
5. Very long descriptions → text wraps, grid handles it naturally

### Type Safety
- Modal state: `const [showHelp, setShowHelp] = useState(false);`
- Ref for modal container: `useRef<HTMLDivElement>(null)`
- Use DOM APIs to detect Monaco editor: `closest('.monaco-editor')`

### No Breaking Changes
- Settings and history panels continue to work unchanged
- All existing keyboard shortcuts (Ctrl+Enter, Escape, Ctrl+Alt+Up/Down) unchanged
- Theme system unaffected

## Testing Notes
- Manual test: Press `?` key in different contexts (editor, header, results)
- Manual test: Click header button, verify toggle
- Manual test: Click outside modal, verify closes
- Manual test: Press Escape in modal, verify closes
- Manual test: Switch themes, verify styles correct
- Manual test: Verify no console errors from duplicate event listeners

## Dependencies
- No new dependencies required
- Uses existing `react-icons/fi` icons
- Uses existing CSS variable system
- Uses existing modal pattern from settings/history panels

## Success Metrics
- Feature reduces support questions about keyboard shortcuts
- Users discover shortcuts through UI affordance
- Modal is accessible and easy to close
