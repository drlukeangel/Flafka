# Phase A3: PRD Revision — Phase 12.4 Full Lifecycle Integration

**Date**: 2026-02-28
**Status**: REVISION COMPLETE
**Input**: Design Review feedback from 5 reviewers (ALL APPROVED with non-blocking notes)
**Output**: Updated PRD addressing all 6 notes

---

## Summary

The Phase A2 Design Review approved Phase 12.4 with 5/5 APPROVE verdicts but identified 6 non-blocking notes requiring formal PRD clarifications. All notes have been addressed in the PRD. The feature is ready for Phase B implementation.

---

## Revisions Applied

### 1. Principal Architect: Store Persist Config Exclusion

**Note**: If `topicPartitionsExpanded` is added to the Zustand store, it MUST be excluded from the `partialize` persist config.

**Status**: ✅ ADDRESSED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — "Changes to `workspaceStore.ts`" section

**Change Details**:
- Expanded the store section to explicitly document the `topicPartitionsExpanded: boolean` field
- Added strong note: "The `topicPartitionsExpanded` field is **runtime-only** and must be **excluded from the `partialize` persist config** (not saved to localStorage)"
- Added rationale: "This flag controls temporary UI state (panel width expand/collapse) and should reset on page reload"
- Updated store implementation snippet to show both `navigateToSchemaSubject` and `setTopicPartitionsExpanded` actions

**Why This Matters**: This flag controls visual UI state (whether the partition section is expanded). On page reload, it should default to collapsed. Persisting it would retain the expanded state across sessions, which is unintended behavior.

---

### 2. Principal Engineer: Promise.allSettled (Not Promise.all) for Schema Lookups

**Note**: `Promise.allSettled` (NOT `Promise.all`) is required for the three Schema Registry subject lookups — one 404 must not abort the others. Verify the PRD specifies this correctly.

**Status**: ✅ CONFIRMED & EMPHASIZED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — "Schema Lookup Convention" section (line 623)

**Change Details**:
- Updated line from: "Use `Promise.allSettled` (not `Promise.all`) so a 404 on `orders-value` does not prevent the `orders-key` check from running."
- Updated to: "**Critical**: Use **`Promise.allSettled` (NOT `Promise.all`)** so a 404 on `orders-value` does not prevent the `orders-key` check from running. This ensures all three subject patterns are checked in parallel without one failure aborting the others."
- Added visual emphasis with bold and caps to ensure this critical pattern is unmissable during implementation

**Why This Matters**: Using `Promise.all` would abort all three subject lookups if any single one fails. For example, if `{topic}-value` returns 404 (topic has no value schema), then `{topic}-key` and `{topic}` would never be checked. Using `Promise.allSettled` ensures we try all three patterns and return the ones that succeed.

---

### 3. Principal Engineer: requestIdRef Pattern for Config Save Cancellation

**Note**: The `requestIdRef` cancel-during-save pattern must be applied to the config alter operation.

**Status**: ✅ ADDED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — "Inline Config Editing" (Feature 4) section

**Change Details**:
- Added explicit note in the "On Cancel" section:
  ```
  On Cancel (click or Escape key):
  - Row returns to read mode with the previous value, no API call
  - **Critical**: If Cancel is clicked while a save is in progress, use the `requestIdRef` pattern
    (already established for `fetchConfigs` in TopicDetail) to track the save request ID and mark
    it as cancelled. This way, if the API response arrives after cancel, it is silently discarded,
    preventing stale state updates.
  ```
- Referenced the existing `requestIdRef` pattern already used in `TopicDetail.fetchConfigs` as the model to follow

**Why This Matters**: Without this pattern, if a user clicks Cancel while the save request is in flight, the API response could still arrive after the component has already exited edit mode. Using `requestIdRef` ensures that late-arriving responses are recognized as "from a cancelled request" and their state updates are ignored.

---

### 4. Principal Engineer: Individual Try/Catch for Per-Partition Offset Calls

**Note**: Each per-partition offset call must be individually try/caught — not a single outer catch.

**Status**: ✅ DETAILED & EMPHASIZED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — "PartitionTable — Offset Fetch Strategy" section

**Change Details**:
- Updated from: "Each offset request is wrapped in try/catch — individual failures show "—" for that partition without failing the entire table."
- Updated to include a detailed "Critical" note and code example:
  ```typescript
  **Critical**: Each offset request MUST be individually wrapped in try/catch — do NOT use a single
  outer catch that would fail all partitions if one request fails. Individual failures show "—" for
  that partition without failing the entire table. This ensures the partition table renders as
  complete as possible even with some offset fetch failures.

  Example:
  const offsets = await Promise.all(
    partitions.map(p =>
      getPartitionOffsets(topicName, p.id)
        .then(o => ({ partitionId: p.id, ...o }))
        .catch(err => ({ partitionId: p.id, beginning_offset: null, end_offset: null }))
    )
  );
  ```

**Why This Matters**: If one partition's offset call fails (e.g., timeout), a single outer catch would cause all partitions to show "—" in the Messages column. Using individual try/catch handlers ensures that only the failing partition shows "—", while others show accurate message counts. This provides maximum diagnostic value to the user.

---

### 5. Principal Engineer: Edge Case for First-Visit Schema Navigation

**Note**: When navigating to Schema panel via `navigateToSchemaSubject()` from a first-time visit, verify subjects list is populated.

**Status**: ✅ ADDED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — "`navigateToSchemaSubject` Action — Store Reuse" section (added new subsection)

**Change Details**:
- Added edge case documentation:
  ```markdown
  **Edge case**: When navigating to a specific schema subject via `navigateToSchemaSubject()` on a
  first-time visit (Schema panel never opened before), the Schema panel's subject list may not be
  populated since `loadSchemaRegistrySubjects()` has not run yet. The browser test must verify that
  the `selectedSchemaSubject` detail loads correctly even when the list is empty. If the Schema
  panel was already visited earlier in the session, the subjects list will be populated by the
  existing `useEffect`.
  ```

**Why This Matters**: The Schema panel's `useEffect` loads subjects on mount. However, when navigating from Topic → Schema panel via `navigateToSchemaSubject()`, the Schema panel may already be rendered in the DOM (just hidden). In this case, the `useEffect` won't re-fire, so the subjects list remains empty. The detail view will still work (it reads `selectedSchemaSubject` directly), but the list view will be empty. Browser testing must confirm this edge case renders correctly.

---

### 6. QA Manager: Partition Toggle Button Keyboard Accessibility Test

**Note**: Keyboard accessibility of the Partitions toggle button should be added to Track C Tier 2 stubs.

**Status**: ✅ ADDED

**Change Location**: `docs/features/phase-12.4-full-lifecycle-integration.md` — TopicDetail.test.tsx section, added test:

**Change Details**:
- Added new T2 test to the TopicDetail test list:
  ```
  | Partition toggle header button is keyboard-accessible (Tab + Enter/Space) | `[@topic-detail][@phase-12-4]` | T2 |
  ```
- Test verifies that the partition expand/collapse toggle can be activated via keyboard (Tab to focus, Enter/Space to activate)

**Why This Matters**: AC-39 requires keyboard accessibility for the new partition toggle header button. While browser verification will test this, including it in Tier 2 unit tests ensures the team has a documented test case to verify during Phase 4 Track C (post-ship test completion).

---

## Verification Checklist

- [x] All 6 non-blocking notes from design review addressed
- [x] Store persist config exclusion explicitly documented with rationale
- [x] Promise.allSettled requirement re-emphasized with critical warning
- [x] requestIdRef pattern added with reference to existing implementation
- [x] Per-partition try/catch pattern detailed with code example
- [x] First-visit schema navigation edge case documented
- [x] Partition toggle keyboard test added to Tier 2 stubs
- [x] No new acceptance criteria added (only clarifications)
- [x] All changes maintain scope and design intent

---

## Next Phase

Phase A3 revision is complete. The PRD is ready for Phase B (Implementation with Tests & Browser Validation) to proceed.

All implementation agents should review the updated PRD before beginning coding, with special attention to the 6 clarified sections marked **"Critical"**.
