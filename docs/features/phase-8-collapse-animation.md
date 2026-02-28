# Phase 8: Animate Cell Collapse/Expand with CSS max-height

**Date:** 2026-02-28
**Status:** Design Phase - REVISED POST-REVIEW

## Problem Statement

Currently, collapsing and expanding editor cells is instantaneous with no visual feedback. This creates a jarring experience when toggling cell visibility.

## Proposed Solution

Use pure CSS max-height transitions to animate collapse/expand. Keep content ALWAYS MOUNTED in the DOM (never unmount Monaco editor or result table) to avoid re-initialization costs. Toggle visibility via CSS class that shrinks `max-height` and `opacity`.

**Key Details:**
- Content wrapper div always rendered (even when collapsed)
- When collapsed: CSS class applies `max-height: 0` + `opacity: 0`
- When expanded: CSS class removes, `max-height: 4000px` + `opacity: 1`
- Animation duration: ~200ms with ease-out timing
- Cell header and collapse preview remain visible
- Collapse preview appears after animation completes (not cross-faded)

## Why This Approach (Post-Review Correction)

**Previous approach problems:**
- `AnimatePresence` forces Monaco to unmount/remount on every toggle (~100ms re-initialization)
- Keyboard shortcuts and completion providers must re-register each toggle
- framer-motion's `height: 'auto'` animation snaps instead of animating smoothly
- Conditional rendering `{!statement.isCollapsed && (...)}` unmounts content

**CSS max-height benefits:**
- Content stays MOUNTED → Monaco, event listeners, completions never re-initialize
- Pure CSS transitions are predictable and reliable
- No external animation library overhead
- Immediate visual feedback (height transitions while preview loads)

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/EditorCell/EditorCell.tsx` | Change conditional rendering to always-mounted wrapper div with className binding |
| `src/components/EditorCell/EditorCell.css` | Add `.cell-content-wrapper` and `.cell-content-wrapper.collapsed` CSS rules |

## Technical Approach

### CSS Implementation

Create or update `src/components/EditorCell/EditorCell.css`:
```css
.cell-content-wrapper {
  max-height: 4000px;
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.2s ease-out;
  opacity: 1;
}

.cell-content-wrapper.collapsed {
  max-height: 0;
  opacity: 0;
}
```

### React Implementation Pattern

**Remove** the current conditional rendering:
```tsx
{!statement.isCollapsed && (
  <>
    {/* editor + results + status bar + error + cancelled + results table */}
  </>
)}
```

**Replace with** always-mounted wrapper:
```tsx
<div
  className={`cell-content-wrapper ${statement.isCollapsed ? 'collapsed' : ''}`}
>
  {/* editor + results + status bar + error + cancelled + results table */}
</div>
```

### Key Implementation Details
- **No framer-motion imports** - Remove all AnimatePresence, motion.div references
- **Always render content** - Delete `{!statement.isCollapsed && ...}` guards
- **CSS class toggle** - Use `statement.isCollapsed ? 'collapsed' : ''` to control animation
- **max-height: 4000px** - Upper bound tall enough for all reasonable result sets (~100 rows of table); cursor pagination prevents unlimited heights
- **overflow: hidden** - Prevents content from showing outside wrapper during animation
- **opacity transition** - Fades content as max-height shrinks (visual polish)
- **ease-out curve** - Decelerating timing function for natural feel

### Collapse Preview Behavior
- Preview appears **immediately after animation completes** (no cross-fade)
- While animating (200ms), user sees content shrinking
- Once animation ends, collapsed view shows header + preview line
- This is acceptable per review feedback

### Cell Header Stays Static
- Cell header (with controls and name) remains **outside** the wrapper
- Always visible, never animated
- Collapse button always reachable

## API Changes
None. This is purely a UI animation enhancement.

## Type Changes
None. No new types required.

## Acceptance Criteria

1. ✅ Collapse animates smoothly (max-height 4000px→0, opacity 1→0 over 200ms)
2. ✅ Expand animates smoothly (max-height 0→4000px, opacity 0→1 over 200ms)
3. ✅ Animation duration is approximately 200ms
4. ✅ No layout jank, flicker, or content jumping
5. ✅ Cell header with controls remains visible and unchanged during animation
6. ✅ Collapse preview appears after animation ends
7. ✅ Monaco editor is NEVER unmounted (keyboard shortcuts work immediately after expanding)
8. ✅ Result table is NEVER unmounted during collapse/expand
9. ✅ Animation feels natural with ease-out curve
10. ✅ No console errors

## Edge Cases

1. **Rapid collapse/expand clicks** - CSS transitions will interrupt and restart smoothly; max-height/opacity animate to new target values instantly
2. **Empty or very short SQL** - Preview line still renders; content animates normally regardless of actual content height
3. **Very long results tables** - max-height: 4000px accommodates cursor-paginated table (typically max 100 visible rows); animation completes in fixed 200ms regardless of content size
4. **Keyboard navigation expanding collapsed cell** - toggleStatementCollapse updates isCollapsed, CSS class changes, animation plays immediately
5. **Multiple collapsed cells expanding** - Each cell has independent wrapper div; animations don't interfere
6. **Editor with unsaved changes** - Content stays mounted, draft state preserved during collapse/expand
7. **Active statement execution** - Background polling continues unaffected; content doesn't re-initialize

## Testing Strategy

### Manual Testing
1. Click collapse button on a cell with results → content should fade and shrink smoothly over 200ms, then preview appears
2. Click expand button → content should grow and fade in smoothly over 200ms
3. Rapidly toggle collapse → animations should interrupt cleanly and reach correct final state
4. Click inside editor while collapsed, then expand → editor focus should be preserved, keyboard shortcuts work
5. Run a new query in expanded cell, collapse it mid-execution → execution continues in background, results appear when expanded
6. Collapse a cell, then close it → cleanup code should run normally
7. Check very large result tables (100+ rows) → animation doesn't stutter

### Browser DevTools
- Inspect the `.cell-content-wrapper` element during animation
- Verify max-height and opacity CSS properties animate (not transform-based)
- Use "Rendering" tab to confirm layout recalculation happens (this is expected and acceptable)
- Monitor FPS: should stay above 50fps even with layout recalc

## Dependencies
- None added (removing framer-motion from critical path, though package remains available)

## Performance Implications
- CSS max-height transitions trigger layout recalculation (not GPU-composited)
- This is acceptable for the number of cells (typically 5-10 visible)
- **Major benefit**: Monaco editor stays mounted → no re-initialization delays
- No animation library overhead
- Main thread impact: negligible (pure CSS animation)

## Related Features
- **Phase 2.3**: Sidebar collapse toggle (static collapse, no animation)
- **Phase 3**: Smart collapse preview for editor cells (displays preview when collapsed)

## Rollback Plan
Remove the CSS wrapper div and revert to conditional rendering `{!statement.isCollapsed && ...}`. No state or data structure changes means zero risk.

---

## Implementation Notes (Post-Review)

### Review Feedback Summary
- **Principal Architect Review**: FLAGGED - AnimatePresence causes Monaco remount cycles
- **Principal Engineer Review**: FLAGGED - framer-motion height:auto doesn't animate, snaps instead

### Critical Changes Made
1. Removed all framer-motion references (AnimatePresence, motion.div)
2. Changed from conditional rendering to always-mounted wrapper div
3. Switched animation mechanism: framer-motion → CSS max-height transition
4. Added CSS rules to EditorCell.css for smooth max-height and opacity animation
5. Accept that collapse preview appears abruptly after animation (no cross-fade)
6. Performance model corrected: layout recalc acceptable vs. Monaco unmount cost

### Key Architectural Decision
Keeping Monaco editor mounted during collapse/expand is worth the layout recalculation cost. A 200ms max-height transition with reflow is faster and smoother than unmounting and re-initializing the Monaco editor (~100ms) plus re-registering keyboard shortcuts and completion providers.

### QA Sign-off
- [ ] CSS max-height animation renders smoothly
- [ ] Content never unmounts (editor still functional after expand)
- [ ] No console errors
- [ ] Edge cases with rapid toggles handled correctly
- [ ] Preview appears after animation completes
