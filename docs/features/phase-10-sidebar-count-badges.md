# Phase 10: Sidebar Count Badges

**Status**: Design Phase
**Owner**: Orchestrator (Opus)
**Date**: 2026-02-28

## Problem Statement

The sidebar tree navigator displays category nodes (Tables, Views, Models, Functions, External Tables) without any visual indication of how many items they contain. Users must expand each category to know if it's populated, leading to unnecessary clicks and poor discoverability of the data model structure.

**Desired behavior**: Show item count badges next to category node labels (e.g., "Tables (7)") to provide immediate visibility into data model composition and reduce exploration friction.

## Solution Overview

Add a **count badge component** rendered next to category node labels in `TreeNodeComponent`. The badge will:
- Display the count of child items: `node.children?.length || 0`
- Style as a small muted pill (gray background, reduced font size, rounded corners)
- Support dark mode via existing CSS variables
- Only render for category nodes: `tables`, `views`, `models`, `functions`, `externalTables`
- NOT render on root (`catalog`, `database`) or individual item nodes (`table`, `view`, etc.)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/TreeNavigator/TreeNavigator.tsx` | Add badge JSX to `TreeNodeComponent`, add helper function to determine if node is a category |
| `src/App.css` | Add `.tree-node-badge` and `.tree-node-badge--empty` styles |

## Implementation Details

### Component Changes (TreeNavigator.tsx)

#### Helper Function
Add before `TreeNodeComponent`:
```typescript
/**
 * Check if a node is a category node that should display a count badge.
 * Category nodes: tables, views, models, functions, externalTables
 */
function isCategoryNode(nodeType: string): boolean {
  return ['tables', 'views', 'models', 'functions', 'externalTables'].includes(nodeType);
}
```

#### TreeNodeComponent JSX
In the `.tree-node` div (around line 340), after the `HighlightedLabel` component (after line 358), add:
```typescript
{isCategoryNode(node.type) && (
  <span className={`tree-node-badge${(node.children?.length || 0) === 0 ? ' tree-node-badge--empty' : ''}`}>
    {node.children?.length || 0}
  </span>
)}
```

**Placement logic**: The badge should appear:
- After the node label/name
- Before the copy icon (if present)
- Before the loading spinner (if present)

The DOM order in `.tree-node` is currently:
1. Chevron
2. Icon
3. Label
4. **[NEW] Badge goes here**
5. Loading spinner
6. Copy icon

### CSS Styles (App.css)

Add after `.tree-node-copy-icon:hover` (after line 729):

```css
/* Count Badge */
.tree-node-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 2px 6px;
  background-color: var(--color-surface-secondary);
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-weight: 500;
  border-radius: 3px;
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 22px;
}

.tree-node-badge--empty {
  opacity: 0.7;
  color: var(--color-text-disabled);
}
```

**Rationale**:
- `display: inline-flex` + `align-items: center, justify-content: center` ensures text is vertically centered in the pill
- `margin-left: 6px` provides spacing from the label
- `padding: 2px 6px` creates the pill shape with adequate horizontal/vertical balance
- `min-width: 22px` ensures single-digit counts (0-9) stay compact; multi-digit counts naturally expand
- `white-space: nowrap` prevents wrapping in tight spaces
- `flex-shrink: 0` prevents compression when space is constrained
- `--color-surface-secondary` (light gray in light mode, dark gray in dark mode) provides subtle contrast
- `--color-text-tertiary` for muted appearance
- `.tree-node-badge--empty` reduces opacity to visually de-emphasize empty categories

**Dark mode**: Handled automatically via CSS variables; no additional theme-specific rules needed.

## Acceptance Criteria

- [ ] Badge appears next to all category nodes (Tables, Views, Models, Functions, External Tables)
- [ ] Badge displays correct count: `node.children?.length || 0`
- [ ] Badge shows "0" for empty categories (e.g., if no functions exist)
- [ ] Badge does NOT appear on:
  - Root catalog node
  - Database nodes
  - Individual item nodes (table, view, function, etc.)
- [ ] Badge styling is consistent across light and dark modes
- [ ] Badge text is centered vertically within the pill
- [ ] Badge does not compress or wrap, maintains readable state even with long table names
- [ ] Badge does not interfere with copy icon or loading spinner
- [ ] Empty categories (count 0) have slightly reduced opacity for visual distinction
- [ ] No TypeScript errors; all types are correct

## Edge Cases

1. **Zero items in category**: Badge shows "0", appears slightly faded (`tree-node-badge--empty`)
2. **Double-digit+ counts**: Badge expands naturally (e.g., "15") while maintaining alignment
3. **Very long table names**: Badge stays to the right of the label, copy icon appears after badge
4. **Search filtering**: Badge count still reflects original `node.children?.length` (not filtered count), since we're showing the badge on category nodes which are always root-level
5. **Loading state**: Loading spinner appears after badge; badge does not animate or pulse
6. **Collapsed category**: Badge is visible even when category is collapsed (user can see "Tables (7)" without expanding)
7. **Dark mode**: CSS variables ensure proper contrast and appearance in both light and dark themes

## Non-Requirements

- Badges do NOT update dynamically during runtime (no polling)
- Badges do NOT show filtered count during search (always show full count)
- Badges do NOT animate on hover or state change
- No tooltip/popover on badge hover
- Badge does not track individual statement results or execution state

## Testing Strategy

**Unit Testing** (not in scope for this PR, but noted for QA):
- `isCategoryNode('tables')` returns true
- `isCategoryNode('table')` returns false
- `node.children?.length || 0` correctly evaluates to 0 when undefined/empty

**QA Manual Testing**:
- Expand each category and verify badge count matches visible items
- Verify badge styling consistency across light/dark modes
- Verify badge does not appear on non-category nodes
- Verify badge text is readable and centered
- Verify no layout shift or overflow when badge is added
- Verify copy icon remains accessible and functional

## Rollback Plan

If issues arise:
1. Remove the badge JSX from `TreeNodeComponent` (revert lines added after line 358)
2. Remove CSS rules for `.tree-node-badge` and `.tree-node-badge--empty`
3. Optionally keep the `isCategoryNode()` helper for future use

## Dependencies

- No new dependencies required
- Uses existing CSS variables for theme support
- No API changes
- No store changes
