# Phase 4: Tree Navigator Search/Filter

## Problem Statement
The sidebar tree can contain many tables, views, and functions. Users have no way to quickly find a specific object by name — they must visually scan the entire list. A search/filter input would dramatically improve discoverability, especially in large catalogs.

## Proposed Solution
Add a sticky search input at the top of the tree navigator (below the header). As the user types, the tree is filtered in real-time to show only nodes whose names match the query (case-insensitive). Parent container nodes (catalog, database, tables group, views group, etc.) are preserved when any of their children match, so the tree structure remains navigable. Matching text within node names is highlighted in yellow.

## Files to Modify
| File | Change |
|------|--------|
| `src/components/TreeNavigator/TreeNavigator.tsx` | Add search state, filterTree function, highlight function, search input UI |
| `src/App.css` | Add `.tree-search`, `.tree-search-input`, `.tree-highlight` styles |

## No API/Store Changes Required
Search is purely client-side, operating on the already-loaded `treeNodes` from the store. No new state in Zustand is needed — `searchQuery` lives as local component state in `TreeNavigator`.

## Implementation Details

### State
```tsx
const [searchQuery, setSearchQuery] = useState('');
```

### filterTree Algorithm
```
filterTree(nodes, query):
  if query is empty → return nodes unchanged
  for each node:
    recursively filter children
    if node.name contains query (case-insensitive) → include node with all original children
    if any filtered child survived → include node with filtered children (expanded)
    otherwise → exclude node
```

Parent nodes (catalog, database, tables, views group nodes) are kept when their children match even if the parent name itself does not match. This preserves tree structure.

### highlightText Function
Splits node name by the query match, wraps each match in `<span className="tree-highlight">`.

### Search Input UI
- Placed between `.tree-header` and `.tree-content`
- Uses `FiSearch` icon from react-icons/fi (already imported pattern)
- Sticky so it stays visible while scrolling
- Clear button (FiX) appears when query is non-empty

## Acceptance Criteria
- [ ] Search input is visible at top of tree below the "Workspace Explorer" header
- [ ] Typing filters nodes case-insensitively by name in real-time
- [ ] Parent nodes are preserved when any child matches (tree structure intact)
- [ ] Matching text is highlighted in yellow within node names
- [ ] Clear button resets filter when clicked
- [ ] Empty query shows full unfiltered tree
- [ ] "No results" message shown when filter matches nothing

## Edge Cases
- Query with special regex characters must be escaped before use in RegExp
- Empty/whitespace-only query should show full tree (trim check)
- Filtering while tree is loading shows loading state normally
- Filter state resets if sidebar is collapsed/reopened (acceptable — local state)

## Implementation Notes (Post-Build)
<!-- To be filled in after implementation -->
