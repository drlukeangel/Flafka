# Phase 9.2: Finish Timestamp & Duration

## Problem

When a SQL statement completes (reaches COMPLETED, ERROR, or CANCELLED status), users need to see:
1. When the statement finished executing
2. How long the entire execution took

Currently, the status bar only shows `START TIME` and `STATUS`. The `executionTime` field exists in the UI (line 501-505 in EditorCell.tsx) but only displays as a raw badge showing seconds, and it does not show finish time at all.

Users running long queries want to understand query duration at a glance in the status bar, especially when comparing multiple statements or debugging performance.

## Solution

Add `finish time` and `duration` display to the status bar when a statement completes. The format will be:

```
START TIME: 9:07 AM | DURATION: 37.8s | STATUS: ● ERROR | STATEMENT: stmt-xxx
```

**Duration calculation:**
- Compute as `lastExecutedAt - startedAt` (both are Date objects in SQLStatement)
- Format: "Xs" for seconds < 60, or "Xm Ys" for longer durations
  - Examples: "2.3s", "1m 30.5s", "5m 12s"
- Only display when both `startedAt` and `lastExecutedAt` are available AND statement has reached a terminal status (COMPLETED, ERROR, CANCELLED)

**Finish time display:**
- Use same `toLocaleTimeString()` format as existing `startedAt` display
- Show in status bar as "FINISH TIME:" label

**Impact on existing executionTime badge:**
- The `executionTime` badge in the cell header (lines 501-505) will remain as-is
- The duration in the status bar is a separate, more readable display
- Both can coexist; the header badge is for quick glance, status bar is for detailed info
- Note: The status bar duration uses `toFixed(1)` (1 decimal place) while the header badge uses `toFixed(2)` (2 decimal places). This difference is acceptable and provides appropriate precision for each context.

## Files to Modify

1. **`src/components/EditorCell/EditorCell.tsx`**
   - Add utility function `formatDuration(ms: number): string` to format milliseconds
   - Modify `statement-status-bar` JSX block (lines 601-619) to include:
     - New "FINISH TIME:" item showing `lastExecutedAt.toLocaleTimeString()`
     - New "DURATION:" item showing formatted duration
   - Add conditional rendering: only show duration/finish time when status is COMPLETED, ERROR, or CANCELLED

2. **`src/types/index.ts`** (no changes needed)
   - `lastExecutedAt` field already exists in SQLStatement interface
   - `startedAt` field already exists
   - Both are already typed as `Date | undefined`

## Implementation Details

### Duration Formatting Function

```typescript
const formatDuration = (startedAt?: Date, lastExecutedAt?: Date): string => {
  if (!startedAt || !lastExecutedAt) return '';

  const durationMs = Math.max(0, lastExecutedAt.getTime() - startedAt.getTime());
  const totalSeconds = durationMs / 1000;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toFixed(1)}s`;
};
```

**Important:** This `formatDuration` function MUST be defined at module level (above the component), not inside the component body. Placing it at module level prevents recreating the function on every render.

### Status Bar JSX Update

Replace lines 601-619 in EditorCell.tsx:

```typescript
{statement.startedAt && (
  <div className="statement-status-bar">
    <div className="status-bar-item">
      <span className="status-bar-label">START TIME:</span>
      <span>{statement.startedAt.toLocaleTimeString()}</span>
    </div>

    {statement.lastExecutedAt && ['COMPLETED', 'ERROR', 'CANCELLED'].includes(statement.status) && (
      <>
        <div className="status-bar-item">
          <span className="status-bar-label">FINISH TIME:</span>
          <span>{statement.lastExecutedAt.toLocaleTimeString()}</span>
        </div>
        <div className="status-bar-item">
          <span className="status-bar-label">DURATION:</span>
          <span>{formatDuration(statement.startedAt, statement.lastExecutedAt)}</span>
        </div>
      </>
    )}

    <div className="status-bar-item">
      <span className="status-bar-label">STATUS:</span>
      <span className={`status-dot ${statement.status.toLowerCase()}`} role="img" aria-label={statement.status}></span>
      <span>{statement.status}</span>
    </div>

    {statement.statementName && (
      <div className="status-bar-item">
        <span className="status-bar-label">STATEMENT:</span>
        <span className="statement-name">{statement.statementName}</span>
      </div>
    )}
  </div>
)}
```

### Styling Considerations

No new CSS classes needed. Reuse existing `.status-bar-item`, `.status-bar-label` styles. The layout will flow naturally with new items.

## Acceptance Criteria

1. ✓ When statement reaches COMPLETED status with both `startedAt` and `lastExecutedAt` set, the status bar displays:
   - "START TIME: HH:MM:SS AM/PM"
   - "FINISH TIME: HH:MM:SS AM/PM"
   - "DURATION: Xs" or "Xm Ys" formatted
   - "STATUS: ● COMPLETED"
   - "STATEMENT: stmt-xxx" (if statementName exists)

2. ✓ When statement reaches ERROR status with both timestamps, status bar shows finish time and duration

3. ✓ When statement reaches CANCELLED status with both timestamps, status bar shows finish time and duration

4. ✓ Duration is computed correctly:
   - 2 second query shows "2.0s"
   - 90 second query shows "1m 30.0s"
   - Sub-second query shows "0.2s"

5. ✓ For PENDING, RUNNING, or IDLE statements, duration section is NOT shown (only START TIME visible if available)

6. ✓ If `lastExecutedAt` is missing even for terminal status, duration is not shown

7. ✓ Existing `executionTime` badge in header remains unchanged and functional

8. ✓ Status bar renders with proper spacing between items (CSS already handles this)

## Edge Cases

1. **Missing lastExecutedAt on terminal status:** Show only START TIME and STATUS. Duration section omitted.
   - Can happen if execution completed but hook didn't fire to set lastExecutedAt

2. **lastExecutedAt before startedAt:** Should not happen in normal flow, but formatDuration would return negative. Handle by checking if durationMs < 0 and returning "0s" or logging error.
   - Defensive: `const durationMs = Math.max(0, lastExecutedAt.getTime() - startedAt.getTime());`

3. **Very long-running queries (hours):** formatDuration only handles minutes/seconds. For queries running > 60 minutes:
   - Current implementation returns "60m 0.5s" for 60m 0.5s, which is correct
   - Future enhancement: add hours "Xh Ym Zs" if needed, but out of scope for now

4. **Timezone-aware display:** `toLocaleTimeString()` respects browser timezone. No special handling needed.

5. **Statement rerun:** When user reruns a COMPLETED statement:
   - `startedAt` and `lastExecutedAt` should update to new execution times
   - Status bar will recalculate duration automatically
   - No cache invalidation needed

6. **Rapid execution:** If statement completes in < 10ms, formatDuration will show "0.0s". This is acceptable.

7. **Browser timezone changes during long query:** toLocaleTimeString() will reflect current timezone. This is expected browser behavior.

## Testing Strategy

1. Unit test `formatDuration()` function:
   - Test 0.5s → "0.5s"
   - Test 2000ms (2s) → "2.0s"
   - Test 90000ms (1m 30s) → "1m 30.0s"
   - Test 5400000ms (90 minutes) → "90m 0.0s"
   - Test with null/undefined startedAt, lastExecutedAt

2. Integration test in EditorCell:
   - Render statement with COMPLETED status, both timestamps → verify finish time and duration appear
   - Render statement with RUNNING status → verify duration NOT shown
   - Render statement with lastExecutedAt missing → verify duration NOT shown

3. Manual QA:
   - Execute a statement, verify status bar shows all fields
   - Check that times match browser's locale
   - Verify duration updates correctly for different execution lengths
