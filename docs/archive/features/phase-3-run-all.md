# Phase 3: Run All Statements Button

## Problem Statement
Users with multiple SQL cells must run each statement individually. There is no way to execute all idle/errored cells in a single action, which slows down batch workflows.

## Proposed Solution
Add a "Run All" toolbar button that sequentially executes every statement in IDLE, ERROR, or CANCELLED status. Statements already in RUNNING or PENDING are skipped.

## Files to Modify
| File | Change |
|------|--------|
| `src/store/workspaceStore.ts` | Add `runAllStatements` action + declare in interface |
| `src/App.tsx` | Import `FiPlay`, wire button to `runAllStatements`, derive disabled state |
| `src/App.css` | Add `.run-all-btn` style (outline/secondary) + disabled state |

## API Changes
None — `runAllStatements` calls the existing `executeStatement(id)` action sequentially.

## Type Changes
Add `runAllStatements: () => Promise<void>` to `WorkspaceState` interface.

## Acceptance Criteria
- "Run All" button appears in toolbar to the left of "Add Statement"
- Button is disabled when no statements have status IDLE | ERROR | CANCELLED
- Clicking executes eligible statements sequentially (one at a time, await each)
- RUNNING/PENDING statements are not touched
- A toast appears when all statements have been dispatched

## Edge Cases
- All statements already RUNNING/PENDING → button disabled
- Single statement workspace → behaves like a per-cell run
- Error in one statement → continues to next (each `executeStatement` has its own try/catch)

## Implementation Notes
- Sequential execution: `for...of` loop with `await get().executeStatement(id)` keeps API load low
- Disabled condition computed in App.tsx using `useMemo` or inline expression
- Button style: outline border using `var(--color-primary)`, no filled background (secondary style)
