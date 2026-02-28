# Phase 6: Dark Mode / Theme Toggle

**Status**: Design Phase
**Date**: 2026-02-28

---

## Problem Statement

The Flink SQL Workspace UI currently only supports a light theme with hardcoded colors. Users working in low-light environments or with display accessibility preferences cannot switch to a dark theme. The existing CSS uses a mix of CSS custom properties (in `index.css`) and scattered inline hex values throughout `App.css`, making theme switching inconsistent and incomplete.

**Goals**:
- Provide a persistent dark/light theme toggle in the header
- Ensure all UI elements render correctly in both themes
- Apply dark theme to the Monaco SQL editor
- Persist theme preference to localStorage via Zustand

---

## Proposed Solution

### 1. CSS Variable Architecture
- Define all light theme colors in `:root` (already partially done in `index.css`)
- Add `[data-theme="dark"]` overrides for all color variables
- Replace hardcoded colors in `App.css` with CSS variable references
- Ensure consistent contrast ratios (WCAG AA) in both themes

### 2. Zustand Store Integration
- Add `theme: 'light' | 'dark'` state to `WorkspaceState`
- Implement `toggleTheme()` action
- Include `theme` in the `partialize` persist configuration
- Initialize from localStorage on app mount

### 3. DOM Attribute Binding
- Set `document.documentElement.dataset.theme` on mount and when toggled
- Ensure theme persistence survives page refreshes

### 4. Monaco Editor Integration
- Pass dynamic `theme` prop: `'vs-light'` for light mode, `'vs-dark'` for dark mode
- Update EditorCell to read theme from store and apply to Editor component

### 5. Theme Toggle Button
- Add FiMoon/FiSun icon button to header toolbar (right side, before Settings)
- Show sun icon in dark mode (click to switch to light)
- Show moon icon in light mode (click to switch to dark)
- Include smooth color transition on toggle

---

## Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add inline script to read theme from localStorage and set `data-theme` attribute before render (prevents flash of wrong theme) |
| `src/index.css` | Add `[data-theme="dark"]` CSS variable overrides for all colors and shadows; add transition rule; define all semantic surface tokens |
| `src/App.css` | Replace ALL hardcoded hex/rgba values with CSS variables (see comprehensive color list below); ensure dark theme coverage |
| `src/App.tsx` | Add theme toggle button to header; call `toggleTheme()` on click; set `document.documentElement.dataset.theme` on mount |
| `src/store/workspaceStore.ts` | Add `theme` to state; add `toggleTheme()` action; include `theme` in `partialize` |
| `src/components/EditorCell/EditorCell.tsx` | Subscribe to `theme` from store; pass dynamic theme to Monaco Editor component |

---

## Implementation Details

### 1. CSS Variables (index.css)

**Light Theme (default in `:root`)**:
```css
:root {
  --color-primary: #4933D7;
  --color-success: #22C55E;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;

  --color-background: #F5F4F4;
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F9F9F9;
  --color-border: #E5E7EB;

  --color-text-primary: #131316;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;
  --color-text-disabled: #D1D5DB;

  /* Semantic surface colors for notifications/alerts */
  --color-surface-error: #FEF2F2;
  --color-surface-warning: #FFFBEB;
  --color-surface-success: #ECFDF5;
  --color-surface-info: #EFF6FF;

  /* Primary tint for backgrounds */
  --color-surface-primary-tint: rgba(73, 51, 215, 0.05);

  /* Table row colors */
  --color-row-odd: #fafafa;
  --color-row-hover: #F0F0F0;

  /* Copy flash animation */
  --color-copy-flash: #D1FAE5;

  /* Highlights */
  --color-highlight-bg: #FEF08A;
  --color-highlight-text: #78350F;
  --color-bg-hover: #E9ECEF;

  /* Icon colors */
  --color-table: #22C55E;
  --color-view: #8B5CF6;

  /* Shadows */
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-focus-ring: 0 0 0 3px rgba(73, 51, 215, 0.1);

  --transition-fast: 150ms ease-in-out;
}
```

**Dark Theme (in `[data-theme="dark"]`)**:
```css
[data-theme="dark"] {
  --color-primary: #7B5FFA;
  --color-success: #34D399;
  --color-error: #F87171;
  --color-warning: #FBBF24;
  --color-info: #60A5FA;

  --color-background: #1A1A1A;
  --color-surface: #242427;
  --color-surface-secondary: #2D2D31;
  --color-border: #3F3F46;

  --color-text-primary: #F5F5F7;
  --color-text-secondary: #A1A1A6;
  --color-text-tertiary: #696969;
  --color-text-disabled: #4B5563;

  /* Semantic surface colors for notifications/alerts */
  --color-surface-error: #1F1015;
  --color-surface-warning: #1F1810;
  --color-surface-success: #051B10;
  --color-surface-info: #051125;

  /* Primary tint for backgrounds */
  --color-surface-primary-tint: rgba(123, 95, 250, 0.1);

  /* Table row colors */
  --color-row-odd: #2A2A2E;
  --color-row-hover: #323238;

  /* Copy flash animation */
  --color-copy-flash: #064E3B;

  /* Highlights */
  --color-highlight-bg: #2D2D1A;
  --color-highlight-text: #FCD34D;
  --color-bg-hover: #3F3F46;

  /* Icon colors */
  --color-table: #34D399;
  --color-view: #A78BFA;

  /* Shadows */
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-focus-ring: 0 0 0 3px rgba(123, 95, 250, 0.2);

  --transition-fast: 150ms ease-in-out;
}
```

**Transition Rule (index.css)**:
```css
html {
  transition: background-color 0.2s, color 0.2s;
}
```

### 2. index.html Script (Flash Prevention)

Add this inline script to `<head>` **before** any stylesheets or app scripts. This runs before render to prevent a flash of the wrong theme:

```html
<script>
  (function() {
    try {
      const stored = JSON.parse(localStorage.getItem('flink-workspace') || '{}');
      const theme = stored?.state?.theme ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
    } catch (e) {
      // Fallback: set light theme if parsing fails
      document.documentElement.dataset.theme = 'light';
    }
  })();
</script>
```

This script:
1. Reads the `theme` from localStorage's Zustand state
2. Falls back to system preference via `prefers-color-scheme` if no stored value
3. Defaults to `'light'` if both fail
4. Sets `data-theme` before React renders

### 3. Store Changes (workspaceStore.ts)

```typescript
interface WorkspaceState {
  // ... existing state ...
  theme: 'light' | 'dark';

  // ... existing actions ...
  toggleTheme: () => void;
}

// In persist middleware:
persist(
  (set, get) => ({
    // ... existing implementation ...
    theme: 'light',
    toggleTheme: () => set(state => ({
      theme: state.theme === 'light' ? 'dark' : 'light'
    })),
  }),
  {
    name: 'flink-workspace',
    partialize: (state) => ({
      // ... existing fields ...
      theme: state.theme,
    }),
  }
)
```

### 4. App.tsx Changes

```typescript
// On mount: set data-theme attribute
useEffect(() => {
  const { theme } = useWorkspaceStore.getState();
  document.documentElement.dataset.theme = theme;
}, []);

// Subscribe to theme changes
const theme = useWorkspaceStore(state => state.theme);
useEffect(() => {
  document.documentElement.dataset.theme = theme;
}, [theme]);

// In header JSX (before Settings button):
<button
  className="header-btn"
  onClick={() => useWorkspaceStore.getState().toggleTheme()}
  title="Toggle theme"
  aria-label="Toggle dark/light theme"
>
  {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
</button>
```

### 5. EditorCell.tsx Changes

```typescript
// Subscribe to theme
const theme = useWorkspaceStore(state => state.theme);

// In Editor component:
<Editor
  theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
  // ... other props ...
/>
```

### 6. App.css Updates

**COMPREHENSIVE Hardcoded Colors to Replace** (26+ values):

**Toast Backgrounds**:
- `#FEF2F2` → `--color-surface-error`
- `#FFFBEB` → `--color-surface-warning`
- `#ECFDF5` → `--color-surface-success`
- `#EFF6FF` → `--color-surface-info`

**Status Badge Tints**:
- `#FFFBEB` (pending) → `--color-surface-warning`
- `#ECFDF5` (running/completed) → `--color-surface-success`
- `#FEF2F2` (error) → `--color-surface-error`

**Cell Error Styling**:
- `#FEF2F2` (background) → `--color-surface-error`
- `#FECACA` (border) → use CSS `var(--color-error)` with opacity

**Confirm Delete Modal**:
- `#FEF2F2` → `--color-surface-error`

**Copy Flash Keyframes** (cellCopyFlash & schemaColCopyFlash):
- `#D1FAE5` → `--color-copy-flash`

**Table Rows**:
- `#fafafa` (odd rows) → `--color-row-odd`
- `#F0F0F0` (hover) → `--color-row-hover`

**Tree Node Icons**:
- `#22C55E` (table icon) → `--color-table`
- `#8B5CF6` (view icon) → `--color-view`

**Tree Highlight**:
- `#FEF08A` (background) → `--color-highlight-bg`
- `#78350F` (text) → `--color-highlight-text`

**Primary Tints**:
- `rgba(73, 51, 215, 0.05)` → `--color-surface-primary-tint`
- `rgba(73, 51, 215, 0.1)` → `calc(var(--color-surface-primary-tint) * 2)` or separate var

**Dropdown Selected**:
- `#EFF6FF` → `--color-surface-info`

**Background Hover Fallback** (line ~1555):
- `var(--color-bg-hover, #E9ECEF)` → ensure `--color-bg-hover` is defined in `:root`

**CRITICAL**: The implementing agent MUST use grep to find ALL hardcoded hex and rgba values in `App.css`:
```bash
grep -E '#[0-9A-Fa-f]{3,6}|rgba?\(' src/App.css
```
Then replace EVERY match with the corresponding CSS variable. Do not assume the list above is exhaustive.

---

## Acceptance Criteria

### Functional
- [x] Theme toggle button visible in header (right side)
- [x] Clicking toggle switches theme between light and dark
- [x] Theme persists after page refresh (via localStorage)
- [x] All UI elements render correctly in both themes
- [x] Monaco editor theme matches app theme
- [x] No hardcoded colors visible in theme transitions

### Visual
- [x] Dark theme has sufficient contrast (WCAG AA minimum)
- [x] Status colors remain visually distinct in dark mode
- [x] Shadows are adjusted for dark background (higher opacity)
- [x] Tables, modals, and cards are readable in dark mode
- [x] Icon colors change appropriately (sun/moon)

### Code Quality
- [x] All CSS variables properly defined in `:root` and `[data-theme="dark"]`
- [x] No theme-specific CSS scattered across components (centralized)
- [x] Store integration follows existing patterns (partialize, selectors)
- [x] No breaking changes to existing APIs

---

## Edge Cases

1. **System Theme Preference**: The inline script in `index.html` falls back to `prefers-color-scheme` if no localStorage value exists. Users can still manually toggle, which overrides the system preference.

2. **Flash of Wrong Theme**: The inline script runs before React render, setting `data-theme` synchronously. This prevents a visible flash when localStorage has a dark theme but the page initially renders light.

3. **Third-Party Components**: Monaco editor handles `theme` prop directly. Any future component libraries should accept theme as a prop or read from context/store.

4. **localStorage Cleared**: If localStorage is cleared, the inline script falls back to system preference via `prefers-color-scheme`, then `'light'` as final default.

5. **Rapid Toggling**: CSS transitions (specified in `:root` rule) handle rapid theme changes gracefully.

6. **Print Stylesheet**: Dark theme may render poorly in print. Consider adding a print media query that forces light theme if needed in a future phase.

7. **Missing CSS Variables**: The inline script includes error handling (`try/catch`). If localStorage parsing fails, theme defaults to `'light'`.

---

## Testing Strategy

1. **Visual Testing**: Screenshot dark mode against light mode for all main UI sections
2. **Persistence**: Clear localStorage, toggle theme, refresh, verify persistence
3. **Editor**: Load a statement in dark mode, verify Monaco editor is dark
4. **Contrast**: Use WCAG color contrast checker on key elements
5. **Performance**: Toggle theme repeatedly, verify no lag or flashing

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Hardcoded colors missed | **Critical**: Implement agent MUST grep for all hex/rgba values (`grep -E '#[0-9A-Fa-f]{3,6}\|rgba?\(' src/App.css`) and replace with CSS variables. Pre-QA audit cross-references this output against the comprehensive list above. |
| Dark theme colors too similar to light theme | Define dark palette upfront with designer input; test contrast ratios against WCAG AA |
| Monaco theme doesn't load | Verify Editor component accepts `theme` prop; use fallback `vs-light` if missing |
| localStorage quota exceeded | Unlikely; theme string is ~10 bytes |
| Flash of wrong theme on page load | **Solved**: Inline script in `index.html` runs synchronously before React render and sets `data-theme` attribute |
| CSS variables not found in dark theme | Ensure ALL variables defined in both `:root` and `[data-theme="dark"]` blocks. No variable should be missing from either. |
| System preference detection fails | Inline script has try/catch with fallback to `'light'` if parsing fails |

---

## Related Work

- **Phase 2.5**: Compute pool status polling (no theme impact)
- **Phase 3**: Smart collapse preview (needs dark theme colors for `.cell-collapsed-preview`)
- **Future**: Auto-detect system theme preference (`prefers-color-scheme` media query) could be Phase 7

---

## Rollout Plan

1. **Code Implementation**: Implement in sequence (store → App.tsx → EditorCell → CSS)
2. **QA Validation**: Full visual audit in both themes
3. **Fix Issues**: Patch any missed colors or contrast issues
4. **UX Review**: Ensure toggle button is discoverable and behaves smoothly
5. **Commit**: Single commit with all theme changes

