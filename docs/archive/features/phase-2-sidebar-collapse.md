# Phase 2.3: Sidebar Collapse Toggle

**Date:** 2026-02-28
**Status:** Implemented

---

## User Story

As a user, I want to collapse or expand the tree sidebar so that I can maximize the editor space when I do not need the tree navigator.

---

## Feature Description

A chevron button sits on the right border of the sidebar. Clicking it collapses the sidebar to zero width, giving the full horizontal space to the editor. Clicking again expands it back to its default width. The transition is smooth (0.2s ease on width).

---

## UI Specification

### Collapse Button

- Position: absolute, vertically centered on the sidebar's right border
- Icon: `FiChevronLeft` (when expanded) / `FiChevronRight` (when collapsed)
- Size: 20x20px button, small visual footprint
- Z-index: above sidebar content so it is always clickable
- When collapsed, the button travels with the sidebar (stays at x=0) and remains visible as a small tab on the left edge of the main content area

### States

| State     | Sidebar Width | Button Icon         | Overflow       |
|-----------|--------------|---------------------|----------------|
| Expanded  | 280px        | `<` (ChevronLeft)   | hidden         |
| Collapsed | 0px          | `>` (ChevronRight)  | hidden         |

### Transition

```css
transition: width 0.2s ease;
```

### Edge Case: Schema Panel

The schema panel lives inside the sidebar. When the sidebar width collapses to 0 with `overflow: hidden`, the schema panel is automatically hidden along with the tree navigator. No additional logic is required.

---

## State Management

### Store: `workspaceStore.ts`

New state field:

```ts
sidebarCollapsed: boolean; // default: false
```

New action:

```ts
toggleSidebar: () => void;
```

Implementation:

```ts
sidebarCollapsed: false,

toggleSidebar: () => {
  set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
},
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/store/workspaceStore.ts` | Add `sidebarCollapsed` state and `toggleSidebar` action |
| `src/App.tsx` | Import `FiChevronLeft`/`FiChevronRight`, read `sidebarCollapsed` + `toggleSidebar`, add collapse button, apply `sidebar--collapsed` class |
| `src/App.css` | Add `.sidebar--collapsed` width rule, `.sidebar-collapse-btn` styles, transition on `.sidebar` width |

---

## Implementation Notes

- The sidebar wrapper `<aside>` receives `className="sidebar sidebar--collapsed"` conditionally when `sidebarCollapsed` is true.
- The collapse button is placed inside the `<aside>` with `position: absolute; right: -12px` so it straddles the border.
- No persistence of `sidebarCollapsed` — resets to expanded on page reload (intentional; avoids blank-screen confusion).
