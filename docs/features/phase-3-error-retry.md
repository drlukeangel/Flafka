# Phase 3: Error Retry Button

## Problem Statement
When a Flink SQL statement fails (status ERROR) or is cancelled by the user (status CANCELLED), there is no quick way to re-execute it. Users must manually click "Run" in the cell header. A contextual "Retry" button placed next to the error message or within the cell-error region provides a more intuitive, discoverable recovery action.

## Proposed Solution
Add a small "Retry" button rendered inside the `cell-error` block (for ERROR status) and also conditionally in the status bar area (for CANCELLED status). The button calls `executeStatement(statement.id)` — identical to the existing Run button — which clears the old error/results and re-runs the SQL.

## Files to Modify
| File | Change |
|------|--------|
| `src/components/EditorCell/EditorCell.tsx` | Import `FiRefreshCw`, add `hasRetry` flag, render `.retry-btn` inside error/cancelled display |
| `src/App.css` | Add `.retry-btn` styles scoped to the cell-error context |

## No Store Changes Required
`executeStatement(id)` already resets `error`, `results`, and `startedAt` before re-running. No new actions needed.

## Type Changes
None.

## Acceptance Criteria
- [x] "Retry" button with `FiRefreshCw` icon appears when `status === 'ERROR'`
- [x] "Retry" button appears when `status === 'CANCELLED'` (in a cancelled notice area)
- [x] Clicking Retry calls `executeStatement(statement.id)`
- [x] Button does NOT appear for IDLE, PENDING, RUNNING, or COMPLETED states
- [x] Button is visually small, inline, and does not break existing error layout
- [x] TypeScript compiles with no errors

## Edge Cases
- Rapid double-click: `executeStatement` sets status to PENDING immediately, which hides the retry button — no double-execution risk
- Collapsed cells: retry button is only in the expanded body; collapsed preview shows status badge only (no change needed)
- No code: if statement.code is blank, executeStatement will still fire (same behaviour as Run button — existing behaviour)

## Implementation Notes
- Use `FiRefreshCw` from `react-icons/fi` (already a dep)
- `hasRetry = statement.status === 'ERROR' || statement.status === 'CANCELLED'`
- For CANCELLED: no error message shown, so render a small "Retry" pill in its own row below the status bar
- For ERROR: render retry button inline at the end of the `.cell-error` div
- Style: `border-radius: 6px`, small padding, warning/neutral color to differentiate from the primary Run button
