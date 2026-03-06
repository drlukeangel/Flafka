# Phase 9.4: Empty State Onboarding Hint

## Problem
When users first load the workspace, they see a single default statement with no context or guidance on how to interact with the application. Users unfamiliar with the UI don't know:
- How to populate the sidebar with database objects
- How to execute a query
- What keyboard shortcuts are available

This results in confusion and potential churn. A helpful, dismissible hint can guide users through the initial onboarding without being intrusive.

## Solution
Display a subtle, card-style onboarding banner below the first editor cell when the workspace is in its "fresh" state. The banner will contain three quick-start tips with clear, actionable guidance. The hint will be automatically dismissed when the user:
1. Runs their first query (executes a statement)
2. Adds a new statement
3. Clicks the dismiss button (X)

Once dismissed, the flag `hasSeenOnboardingHint` is persisted to localStorage via zustand, preventing re-display on future visits.

## Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `src/store/workspaceStore.ts` | Add `hasSeenOnboardingHint` to state and persist middleware; add `dismissOnboardingHint()` action | State management |
| `src/components/OnboardingHint/OnboardingHint.tsx` | New component: dismissible card with tips, styling for dark/light modes | New component |
| `src/components/OnboardingHint/index.ts` | Export barrel file | New export |
| `src/App.tsx` | Render `<OnboardingHint />` conditionally below editor cells; trigger dismiss on statement run/add | UI integration |
| `src/index.css` | Add styles for `.onboarding-hint-card`, dark/light theme variables | Styling |

## Implementation Details

### 1. Zustand Store Changes
**Location:** `src/store/workspaceStore.ts`

Add to `WorkspaceState` interface (REQUIRED):
```typescript
hasSeenOnboardingHint: boolean;
dismissOnboardingHint: () => void;
```

Initialize in state:
```typescript
hasSeenOnboardingHint: false,
```

Add action:
```typescript
dismissOnboardingHint: () => {
  set({ hasSeenOnboardingHint: true });
},
```

Update persist middleware's `partialize` allowlist to include (REQUIRED):
```typescript
hasSeenOnboardingHint: state.hasSeenOnboardingHint,
```

**Note:** `hasSeenOnboardingHint` MUST appear in BOTH the `WorkspaceState` interface AND the `partialize` allowlist. Without both, localStorage persistence will fail.

### 2. New Component: OnboardingHint.tsx
**Location:** `src/components/OnboardingHint/OnboardingHint.tsx`

Create a functional component with:
- Props: `onDismiss: () => void` (callback when X clicked)
- Render a card with:
  - Close button (X) in top-right, triggering `onDismiss`
  - Title: "Getting Started"
  - Three list items with tips:
    1. "Double-click a table in the sidebar to insert a SELECT query"
    2. "Press Ctrl+Enter to run your query"
    3. "Press ? for keyboard shortcuts"
  - Use semantic HTML (`<ul>`, `<li>`)
  - Icons for each tip (use react-icons: FiArrowRight, FiZap, FiHelpCircle)
- CSS classes: `.onboarding-hint-card`, `.hint-close-btn`, `.hint-title`, `.hint-tips-list`, `.hint-tip-item`

### 3. Styling
**Location:** `src/index.css`

Add styles using CSS variables for theme support. Include `:root` fallbacks to prevent flash of unstyled content before theme loads:
```css
/* Root fallback variables (light mode default) */
:root {
  --hint-bg-color: #f8f9fa;
  --hint-border-color: #e0e0e0;
  --hint-text-primary: #2c3e50;
  --hint-text-secondary: #555;
  --hint-text-muted: #999;
  --hint-shadow-color: rgba(0, 0, 0, 0.05);
  --hint-hover-bg: #e8e9eb;
  --hint-icon-color: #0066cc;
}

.onboarding-hint-card {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--hint-border-color);
  border-radius: 8px;
  background-color: var(--hint-bg-color);
  position: relative;
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 0 2px 4px var(--hint-shadow-color);
}

.hint-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--hint-text-muted);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.hint-close-btn:hover {
  background-color: var(--hint-hover-bg);
  color: var(--hint-text-primary);
}

.hint-title {
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--hint-text-primary);
}

.hint-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.hint-tip-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  color: var(--hint-text-secondary);
}

.hint-tip-item:last-child {
  margin-bottom: 0;
}

.hint-tip-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--hint-icon-color);
}

/* Light mode */
[data-theme="light"] {
  --hint-bg-color: #f8f9fa;
  --hint-border-color: #e0e0e0;
  --hint-text-primary: #2c3e50;
  --hint-text-secondary: #555;
  --hint-text-muted: #999;
  --hint-shadow-color: rgba(0, 0, 0, 0.05);
  --hint-hover-bg: #e8e9eb;
  --hint-icon-color: #0066cc;
}

/* Dark mode */
[data-theme="dark"] {
  --hint-bg-color: #2a2d31;
  --hint-border-color: #444;
  --hint-text-primary: #e0e0e0;
  --hint-text-secondary: #aaa;
  --hint-text-muted: #666;
  --hint-shadow-color: rgba(0, 0, 0, 0.3);
  --hint-hover-bg: #3a3d41;
  --hint-icon-color: #4da6ff;
}
```

### 4. App.tsx Integration
**Location:** `src/App.tsx`

Import the component:
```typescript
import { OnboardingHint } from './components/OnboardingHint';
```

Extract from store:
```typescript
const { hasSeenOnboardingHint, dismissOnboardingHint } = useWorkspaceStore();
```

Add helper to detect fresh workspace:
```typescript
const isFreshWorkspace = () => {
  return statements.length === 1 && statements[0].status === 'IDLE';
};
```

Render the hint conditionally in JSX after the editor cells, wrapped in a check:
```typescript
{!hasSeenOnboardingHint && isFreshWorkspace() && (
  <OnboardingHint onDismiss={() => dismissOnboardingHint()} />
)}
```

Add dismiss triggers directly at call sites (NOT in a useEffect):
1. In the "Add Statement" button onClick handler: Call `dismissOnboardingHint()` immediately after adding statement
2. In `executeStatement` handler in App.tsx (at the start, before API call): Call `dismissOnboardingHint()` immediately

```typescript
// In the Add Statement button onClick (e.g., in sidebar):
onClick={() => {
  addStatement();
  dismissOnboardingHint();
}}

// In executeStatement handler in App.tsx (at the beginning):
const executeStatement = (statementId: string) => {
  dismissOnboardingHint();
  // ... rest of execution logic
};
```

## Acceptance Criteria

1. **Fresh Workspace Detection**
   - Hint shows ONLY when: exactly 1 statement, status is IDLE, code contains SELECT or default template
   - Hint hides if user has multiple statements or has already run a query

2. **Hint Display**
   - Card appears below the editor cell with subtle styling
   - Muted colors (not bright/attention-grabbing)
   - Three tips are clearly legible
   - Icons align with each tip

3. **Dismissal Mechanisms**
   - Clicking X button dismisses hint immediately
   - Running any statement (Ctrl+Enter) dismisses hint
   - Adding a new statement dismisses hint
   - Running all statements (runAllStatements) dismisses hint
   - All four mechanisms call `dismissOnboardingHint()`

4. **Persistence**
   - `hasSeenOnboardingHint` is stored in localStorage via zustand persist
   - On page reload, hint does NOT reappear if previously dismissed
   - Flag persists across browser sessions

5. **Theme Support**
   - Hint styling respects light/dark theme toggle
   - Colors are readable in both themes
   - No hardcoded colors (all via CSS variables)

6. **Responsive & Accessible**
   - Close button has clear hover state
   - Semantic HTML (`<ul>`, `<li>`)
   - Close button is keyboard-accessible (tabindex handled by button element)
   - Tips are concise and actionable

## Edge Cases

1. **Workspace with 1 statement, RUNNING status**
   - Hint NOT shown (status is not IDLE)
   - Correct behavior: hint is for users who haven't started yet

2. **User dismisses, then clears all statements and resets**
   - `hasSeenOnboardingHint` remains true (persisted)
   - Hint does NOT reappear (even though they're back to fresh state)
   - Acceptable: user has seen the hint before, localStorage should reflect that

3. **User modifies the default statement code**
   - If code no longer contains "SELECT *", hint may not show
   - Correct behavior: hint is for "untouched" fresh workspaces

4. **Hint visible while statement is executing**
   - Hint dismisses as soon as execution completes
   - Correct behavior: execution counts as "user engagement"

5. **Multiple rapid clicks on hint dismiss button**
   - Button state managed by component, should be idempotent
   - `dismissOnboardingHint()` action is safe to call multiple times (sets same flag)
   - No race condition risk

6. **Theme switch while hint is visible**
   - CSS variables automatically update hint colors
   - Hint re-renders with new theme colors
   - Correct behavior: theme toggle handles entire app uniformly
