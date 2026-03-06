# Phase 12.5 — Advanced Topic & Schema Operations

**Status**: Phase 1 PRD — PRD SIGN-OFF APPROVED
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-03-01
**Depends On**: Phase 12.4 (Full Lifecycle Integration) ✅
**Blocks**: Phase 12.6 (TBD)
**Sources**:
- Interview Analyst Report: `docs/agents/feedback/run-2/INTERVIEW-ANALYST.md`
- Interview Summary (TPPM): `docs/agents/feedback/run-2/PHASE-12.4-INTERVIEW-SUMMARY.md`
- Flink Developer Stress Test Run-2: `docs/agents/feedback/run-2/FLINK-DEVELOPER.md`
- Flink Developer Stress Test Run-3: `docs/agents/feedback/run-3/FLINK-DEVELOPER.md`
- Phase 12.4 PRD: `docs/features/phase-12.4-full-lifecycle-integration.md`

---

## Problem Statement

Phase 12.4 shipped a functional integration between the Topic panel, Schema panel, and SQL workspace. User interviews confirmed that all six features were validated and appreciated. However, five specific gaps emerged from the post-ship interviews and stress test findings that limit the effectiveness of what was built:

1. **Schema delete safety**: Deleting a schema subject requires only a single click — no name confirmation required. Deleting a topic requires typing the full name. This inconsistency is a safety regression: one misclick irreversibly deletes all schema versions across a production subject. (Run-2 Flink Developer, §5)

2. **Schema diff view is broken in two ways**: When the user changes the primary schema version while diff mode is active, the diff pane goes stale — it continues showing an outdated comparison. Additionally, there is no guard against the user selecting the same version on both sides, making the diff view compare a document to itself with no indication. (Run-2 Flink Developer, §2 and §8)

3. **Schema version delete uses a browser confirm dialog**: `window.confirm()` is the only remaining native browser dialog in the entire codebase. It cannot be styled, is blocked by some browser configurations, pauses the JS event loop, and is visually jarring. All other destructive operations use the inline `DeleteConfirm` component pattern. (Run-2 Flink Developer, §6)

4. **Copy button for topic name is absent**: User D (power user, data scientist) prefers copying a topic name to clipboard over inserting at cursor — a faster workflow for building SQL queries with copy-paste outside the editor. The insert-at-cursor button already shipped in Phase 12.4, but the standalone copy shortcut was explicitly requested as a distinct improvement. (Interview Summary, Phase 12.5 Immediate Backlog Item 1)

5. **Pre-save validation feedback is missing from config edit**: When a user edits a topic config inline, validation only happens server-side (422 response). Users want to see validation errors before clicking Save — specifically for retention.ms (must be > 0 and integer), replication.factor (must be ≥ 1), and min.insync.replicas (must be ≥ 1 and ≤ replication.factor). (Interview Summary, Phase 12.5 Immediate Backlog Item 3; Run-3 Flink Developer §LOW-3)

6. **Health score dashboard is absent from topic list**: Users currently see individual partition-count warning badges per row. What they want is a summary-level health status per topic that consolidates partition count, ISR status, and replication. User D specifically requested a visual 🟢 Healthy / 🟡 Warning / 🔴 Critical composite indicator in the topic list. (Interview Summary, Phase 12.5 Immediate Backlog Item 4)

Additionally, two structural/theme issues were identified:

7. **SchemaTreeView uses hardcoded color values**: `#8B5CF6` (record type badge) and `#14B8A6` (array/map type badges) are hardcoded hex in `SchemaTreeView.tsx:97,99,101`. These are the only theme-breaking hardcoded colors remaining in the SchemaPanel and will fail to adapt if the design system's accent palette changes. (Run-2 Flink Developer, §3)

8. **AbortController signal is not forwarded to the HTTP layer in config fetches**: `TopicDetail.tsx` creates an `AbortController` and guards React state updates with `controller.signal.aborted`, but the signal is never passed to `topicApi.getTopicConfigs()` or forwarded to the Axios request. On slow connections with rapid topic switching, this allows up to 10+ concurrent in-flight HTTP requests to continue running and be silently discarded, wasting server resources. (Run-2 Flink Developer, §4)

**Goals for Phase 12.5:**
1. Fix schema delete safety — require typed name confirmation matching the pattern in TopicDetail
2. Fix both schema diff view bugs — stale diff pane + self-compare guard
3. Replace `window.confirm()` for schema version delete with an inline confirmation overlay
4. Add copy-to-clipboard button for topic name in TopicDetail
5. Add pre-save client-side validation for inline config editing
6. Add composite topic health score display in topic list
7. Fix SchemaTreeView hardcoded colors — move to CSS custom properties
8. Forward AbortController signal through to Axios in `getTopicConfigs`

---

## Proposed Solution

Eight targeted fixes and enhancements across `SchemaDetail.tsx`, `SchemaTreeView.tsx`, `TopicDetail.tsx`, `TopicList.tsx`, and `topic-api.ts`. All changes are surgical — no new components needed except the inline confirmation overlay in SchemaDetail (reuses the existing `DeleteConfirm` pattern). No new API endpoints required.

### Feature 1: Schema Subject Delete — Typed Name Confirmation

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

The existing `DeleteConfirm` component pattern from `TopicDetail.tsx` requires the user to type the full resource name before the Delete button activates. Apply the same pattern to schema subject deletion in `SchemaDetail.tsx`. The input must match the subject name exactly (case-sensitive). On match, the Delete button activates. On mismatch, button remains disabled. On success, navigate back to schema list.

**Behavior:**
- Open delete dialog: shows subject name, warns "All versions will be permanently deleted"
- Input field labeled "Type the subject name to confirm"
- Placeholder: subject name
- Delete button: disabled until input === subject name
- On confirm: calls `deleteSubject()`, navigates to list
- On cancel: closes dialog, no state change

### Feature 2: Schema Diff View — Stale Pane Fix

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

Two distinct bugs to fix:

**Bug 2a — Stale diff pane when primary version changes:**
When `selectedVersion` changes while `diffMode === true`, `diffSchema` must be reloaded for the current `diffVersion`. The fix: add `selectedVersion` to the `useEffect` dependency array for the diff fetch, or explicitly call `fetchDiffSchema(diffVersion)` when `handleVersionChange` is called while `diffMode` is active.

**Bug 2b — Self-compare guard:**
In the diff version picker's `onChange` handler, prevent the user from selecting a version that matches `selectedVersion`. Two options: (a) filter the selected version out of the diff version dropdown options, or (b) display a warning banner when `diffVersion === selectedVersion`. Option (a) is preferred — prevents the invalid state entirely rather than recovering from it. If only one version exists, disable diff mode entirely.

### Feature 3: Schema Version Delete — Replace `window.confirm()`

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

Replace the `window.confirm()` call in `handleDeleteVersion` with an inline confirmation overlay using the same `DeleteConfirm` component pattern used elsewhere. Since this is a version-level delete (not the entire subject), no name-typing requirement is needed — a simple "Are you sure?" confirmation with version number displayed is sufficient. The overlay must:
- Show the version number being deleted
- Show "This cannot be undone" warning text
- Provide "Delete version N" confirm button and "Cancel" button
- On confirm: call existing delete API
- On cancel: close overlay, no state change
- Use CSS vars for all colors (no hardcoded hex)

### Feature 4: Copy-to-Clipboard Button for Topic Name

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

Add a standalone copy-to-clipboard button in the TopicDetail header (adjacent to the existing "Insert into SQL editor" button). The button copies the **backtick-quoted topic name** to the clipboard (same quoting as the insert action). Uses the same clipboard pattern as Phase 5.4 column copy.

**Behavior:**
- Icon: `FiCopy` (consistent with column copy pattern)
- Tooltip: "Copy topic name (backtick-quoted)"
- On click: writes backtick-quoted name to `navigator.clipboard`
- Success feedback: button changes color for 1500ms (same as existing copy pattern)
- Always enabled (does not require focused editor — contrast with Insert button)
- The insert button remains unchanged and keeps its "requires focused editor" behavior

### Feature 5: Pre-Save Client-Side Validation for Config Edit

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

Add client-side validation to the inline config edit input field. Validation fires on change (not only on submit) so the user sees feedback before clicking Save.

**Validated configs and rules:**
| Config key | Rule | Error message |
|---|---|---|
| `retention.ms` | Must be integer ≥ -1 (−1 = infinite) | "Must be -1 (infinite) or a positive integer in milliseconds" |
| `retention.bytes` | Must be integer ≥ -1 | "Must be -1 (unlimited) or a positive integer in bytes" |
| `replication.factor` | Must be integer ≥ 1 | "Must be a positive integer ≥ 1" |
| `min.insync.replicas` | Must be integer ≥ 1 | "Must be a positive integer ≥ 1" |
| `max.message.bytes` | Must be integer > 0 | "Must be a positive integer in bytes" |
| `segment.ms` | Must be integer > 0 | "Must be a positive integer in milliseconds" |
| Any `.ms` config | Must be integer | "Must be an integer (milliseconds)" |
| Any `.bytes` config | Must be integer | "Must be an integer (bytes)" |
| Any other config | No client-side validation | (server validates on save) |

**Behavior:**
- Validation fires on `onChange` for known configs
- Error message appears below the input (same position as server error)
- Save button is disabled when validation error is present
- On blur with no value entered: show "Required" error
- Server 422 errors continue to be shown as-is (server may catch additional rules)
- Cancel always works regardless of validation state

### Feature 6: Composite Topic Health Score in Topic List

**Files:** `src/components/TopicPanel/TopicList.tsx`, `src/components/TopicPanel/TopicDetail.tsx` (badge definitions)

Replace the standalone "Low partition count" badge with a composite health indicator that aggregates multiple signals into a single health status per topic row.

**Health scoring algorithm (evaluated per topic in topic list):**

| Status | Color | Conditions |
|---|---|---|
| 🟢 Healthy | `var(--color-success)` | All checks pass |
| 🟡 Warning | `var(--color-warning)` | Any yellow condition is true |
| 🔴 Critical | `var(--color-error)` | Any red condition is true |

**Yellow conditions (warning):**
- `partitions_count < 2` — low parallelism warning (existing Phase 12.4 badge)
- `replication_factor < 2` — single point of failure risk

**Red conditions (critical):**
- `partitions_count < 1` — topic has no partitions (degenerate state)
- `is_internal === true` AND topic appeared in list (system topic leaked past filter — defensive)

**Display:**
- Single colored dot (8px circle) replaces the previous `FiAlertTriangle` badge
- On hover: tooltip lists all active conditions ("Low partition count (2 warnings)")
- Healthy topics: dot not shown (zero visual noise for the common case)
- Warning/Critical topics: dot shown with appropriate color
- In TopicDetail header: expand to show individual badges as before (detail context, not list context)

**Note:** ISR-level health (ISR < replication.factor) is a Phase 12.6+ item — it requires per-topic partition API calls on list render which would be too expensive. The Phase 12.5 composite health score uses only data already available in the topic list response.

### Feature 7: SchemaTreeView — Replace Hardcoded Colors with CSS Custom Properties

**Files:** `src/components/SchemaPanel/SchemaTreeView.tsx`, CSS/theme files

Replace the three hardcoded color values in `SchemaTreeView.tsx` with CSS custom properties:

| Current value | CSS variable name | Semantic meaning |
|---|---|---|
| `#8B5CF6` (line 97) | `--color-schema-record` | Record type badge color |
| `#14B8A6` (line 99) | `--color-schema-array` | Array type badge color |
| `#14B8A6` (line 101) | `--color-schema-map` | Map type badge color |

Add these variables to both `:root` (light mode values) and `[data-theme="dark"]` (dark mode values) in the CSS theme file. The dark mode values should be slightly lighter variants for readability against dark backgrounds.

### Feature 8: AbortController Signal Forwarded to Axios

**Files:** `src/api/topic-api.ts`, `src/components/TopicPanel/TopicDetail.tsx`

Modify `getTopicConfigs` in `topic-api.ts` to accept an optional `signal?: AbortSignal` parameter and forward it to the Axios request as `kafkaRestClient.get(..., { signal })`. In `TopicDetail.tsx`, pass `controller.signal` when calling `getTopicConfigs`.

This ensures that when the user switches topics rapidly, the in-flight HTTP request is actually cancelled at the network level rather than just having its React state update ignored. On a slow connection this reduces wasted requests from O(N) to O(1).

---

## API Contract Requirements

### No new API endpoints required.

All Phase 12.5 features use existing endpoints already in use by Phase 12.2–12.4:

| Operation | Endpoint | Already Used By |
|---|---|---|
| Delete schema subject | `DELETE /subjects/{subject}` | `SchemaDetail.tsx` |
| Delete schema version | `DELETE /subjects/{subject}/versions/{version}` | `SchemaDetail.tsx` |
| Get topic configs | `GET /kafka/v3/clusters/{id}/topics/{name}/configs` | `topic-api.ts` |
| Topic list (health data) | `GET /kafka/v3/clusters/{id}/topics` | `topic-api.ts` |

### AbortController Signal Contract

`getTopicConfigs` signature change:

```typescript
// Before
export async function getTopicConfigs(topicName: string): Promise<TopicConfig[]>

// After
export async function getTopicConfigs(
  topicName: string,
  options?: { signal?: AbortSignal }
): Promise<TopicConfig[]>
```

The `signal` is forwarded to Axios as the second parameter of `.get()`:
```typescript
kafkaRestClient.get<{ data: TopicConfig[] }>(url, { signal: options?.signal })
```

Callers without `options` continue to work unchanged (backward compatible).

### Error Handling Requirements

All error handling follows the existing patterns established in Phase 12.2–12.4:

| HTTP Status | Context | User-Facing Message |
|---|---|---|
| 403 Forbidden | Config edit save | "You don't have permission to edit this configuration. Contact your cluster administrator." |
| 404 Not Found | Schema subject delete | "Subject not found. It may have already been deleted." |
| 422 Unprocessable Entity | Config edit save | Display server error message verbatim (server message is user-friendly) |
| Network timeout | Any fetch | "Unable to connect. Check your network connection and try again." |
| AbortError | Config fetch cancelled | Silently ignored (expected when switching topics) |

---

## Acceptance Criteria

All acceptance criteria are testable and binary (pass/fail). QA Manager must verify all criteria at Phase 2.5 gate.

### AC-1: Schema Subject Delete — Name Confirmation

- [ ] AC-1.1: Schema subject delete dialog shows a text input with placeholder matching the subject name
- [ ] AC-1.2: Delete button is disabled when input is empty
- [ ] AC-1.3: Delete button is disabled when input does not match subject name (case-sensitive)
- [ ] AC-1.4: Delete button is enabled when input matches subject name exactly
- [ ] AC-1.5: Clicking Delete with matching name calls the delete API and navigates back to subject list
- [ ] AC-1.6: Clicking Cancel closes dialog without calling any API
- [ ] AC-1.7: The confirmation pattern matches TopicDetail's delete confirmation (same component or equivalent)
- [ ] AC-1.8: Input field receives focus when dialog opens (keyboard users can start typing immediately)

### AC-2: Schema Diff View — Stale Pane Fix

- [ ] AC-2.1: When diff mode is active and selectedVersion changes, diffSchema is reloaded for the current diffVersion
- [ ] AC-2.2: After selectedVersion changes in diff mode, the left and right pane labels correctly reflect current versions
- [ ] AC-2.3: The diff version picker does not include the currently selected primary version as a selectable option
- [ ] AC-2.4: If a subject has only one version, the diff mode toggle is disabled or hidden
- [ ] AC-2.5: Changing diffVersion always reloads diffSchema from the API (no stale cache)

### AC-3: Schema Version Delete — Inline Confirmation

- [ ] AC-3.1: `window.confirm()` is not called anywhere in SchemaDetail.tsx
- [ ] AC-3.2: Clicking "Delete version N" opens an inline confirmation overlay (not a browser dialog)
- [ ] AC-3.3: The overlay shows the version number being deleted
- [ ] AC-3.4: The overlay shows "This cannot be undone" warning text
- [ ] AC-3.5: Confirming the delete calls the delete API and updates the version list
- [ ] AC-3.6: Canceling closes the overlay without calling any API
- [ ] AC-3.7: The overlay uses CSS custom properties for all colors (no hardcoded hex)
- [ ] AC-3.8: The overlay is keyboard-accessible (Tab focuses buttons, Escape cancels)

### AC-4: Copy Topic Name Button

- [ ] AC-4.1: A copy button appears in TopicDetail header adjacent to the Insert button
- [ ] AC-4.2: Clicking the copy button copies the backtick-quoted topic name to the clipboard
- [ ] AC-4.3: Topic names with special characters (`.`, `-`, spaces) are backtick-quoted correctly
- [ ] AC-4.4: Topic names without special characters are also backtick-quoted (consistent with Insert behavior)
- [ ] AC-4.5: The copy button shows a success state (color change) for 1500ms after copying
- [ ] AC-4.6: The copy button is always enabled (does not require a focused editor)
- [ ] AC-4.7: The copy button has a tooltip: "Copy topic name (backtick-quoted)"
- [ ] AC-4.8: The copy button has an `aria-label` attribute

### AC-5: Pre-Save Config Validation

- [ ] AC-5.1: Entering a non-integer value in `retention.ms` edit input shows an inline error message
- [ ] AC-5.2: Entering a value < -1 in `retention.ms` shows an inline error message
- [ ] AC-5.3: Entering a non-integer value in `replication.factor` shows an inline error message
- [ ] AC-5.4: Entering a value < 1 in `replication.factor` shows an inline error message
- [ ] AC-5.5: Entering a non-integer value in `min.insync.replicas` shows an inline error message
- [ ] AC-5.6: Entering a value < 1 in `min.insync.replicas` shows an inline error message
- [ ] AC-5.7: The Save button is disabled when a validation error is present
- [ ] AC-5.8: Validation errors appear on `onChange` (not only on Save click)
- [ ] AC-5.9: Clearing an invalid value clears the error message
- [ ] AC-5.10: Server 422 errors are still shown for configs without client-side validation rules
- [ ] AC-5.11: Cancel always works regardless of validation state

### AC-6: Composite Topic Health Score

- [ ] AC-6.1: A healthy topic (partitions_count ≥ 2, replication_factor ≥ 2) shows no health indicator dot
- [ ] AC-6.2: A topic with partitions_count < 2 shows a yellow warning dot in the topic list row
- [ ] AC-6.3: A topic with replication_factor < 2 shows a yellow warning dot in the topic list row
- [ ] AC-6.4: The health dot has a `title` tooltip listing active warning conditions
- [ ] AC-6.5: The health dot color uses `var(--color-warning)` for yellow and `var(--color-error)` for red
- [ ] AC-6.6: The TopicDetail header still shows individual badges for partition count and replication (detail context)
- [ ] AC-6.7: The health dot renders correctly in both light mode and dark mode
- [ ] AC-6.8: The health dot has an `aria-label` for screen readers

### AC-7: SchemaTreeView CSS Custom Properties

- [ ] AC-7.1: `SchemaTreeView.tsx` contains no hardcoded hex color values
- [ ] AC-7.2: Record type badges use `var(--color-schema-record)` CSS custom property
- [ ] AC-7.3: Array/map type badges use `var(--color-schema-array)` and `var(--color-schema-map)` CSS custom properties
- [ ] AC-7.4: The CSS variables are defined in both `:root` and `[data-theme="dark"]` selectors
- [ ] AC-7.5: The schema tree view renders with visible type badge colors in both light and dark mode (visual regression check)

### AC-8: AbortController Signal Forwarding

- [ ] AC-8.1: `getTopicConfigs` in `topic-api.ts` accepts an optional `signal?: AbortSignal` parameter
- [ ] AC-8.2: The `signal` is forwarded to the Axios `.get()` call as `{ signal }`
- [ ] AC-8.3: `TopicDetail.tsx` passes `controller.signal` when calling `getTopicConfigs`
- [ ] AC-8.4: Rapidly switching between topics (select A, then B before A's fetch completes) does not result in stale config data appearing for topic B
- [ ] AC-8.5: Existing callers of `getTopicConfigs` without `options` continue to function correctly (backward compatibility)
- [ ] AC-8.6: Abort errors (`axios.isCancel()` or `error.name === 'AbortError'`) are silently ignored in the catch handler

---

## E2E Test Specifications

These specifications are pre-written for Phase B2 browser testing. Each spec maps directly to acceptance criteria.

### E2E-1: Schema Subject Delete Safety

**Precondition:** Schema Registry configured, at least one schema subject exists.

```
1. Navigate to Schema panel
2. Select any subject
3. Click the delete button
4. ASSERT: Dialog opens with a text input
5. ASSERT: Delete button is disabled
6. Type a wrong name in the input
7. ASSERT: Delete button remains disabled
8. Clear the input and type the correct subject name exactly
9. ASSERT: Delete button becomes enabled
10. Click Delete
11. ASSERT: Subject is removed from the subject list
12. ASSERT: UI navigates back to the subject list
```

**Negative case:**
```
1. Open delete dialog for subject "events-value"
2. Type "events-VALUE" (wrong case)
3. ASSERT: Delete button is disabled (case-sensitive match required)
```

### E2E-2: Schema Diff View Stability

**Precondition:** Schema subject exists with 3+ versions.

```
1. Open a subject with 3 versions (v1, v2, v3)
2. Select v3 as primary version
3. Enable diff mode
4. ASSERT: Diff version picker defaults to v2 (second-to-last)
5. ASSERT: Diff version picker does NOT include v3 as an option
6. Change primary version to v2
7. ASSERT: Diff pane reloads — now shows diff between v2 (primary) and v1 (diff)
8. ASSERT: Left and right pane labels are correct
```

**Self-compare guard:**
```
1. Open subject with 2 versions (v1, v2)
2. Enable diff mode with v2 as primary
3. ASSERT: Diff version picker only shows v1 (v2 is excluded)
4. Subject with 1 version: ASSERT: Diff toggle is disabled
```

### E2E-3: Schema Version Delete — No Browser Dialog

**Precondition:** Schema subject exists with 2+ versions.

```
1. Open a subject with 2+ versions
2. Click "Delete version N" action
3. ASSERT: No browser alert/confirm dialog appears
4. ASSERT: An inline confirmation overlay appears within the SchemaDetail component
5. ASSERT: The overlay shows "version N" in the confirmation text
6. Click Cancel
7. ASSERT: Overlay closes, version still exists in the version list
8. Click "Delete version N" again
9. Click Confirm in overlay
10. ASSERT: Version N is removed from the version list
```

### E2E-4: Copy Topic Name Button

**Precondition:** Topic Management panel configured, at least one topic exists.

```
1. Navigate to Topic Management panel
2. Select a topic with a special character in the name (e.g., "user-events.prod")
3. ASSERT: TopicDetail shows a copy button in the header area
4. Click the copy button
5. ASSERT: Button shows success state (color change) for ~1500ms
6. Paste clipboard content into any text input
7. ASSERT: Pasted text is: `user-events.prod` (backtick-quoted)
```

**Standard name (no special chars):**
```
1. Select topic named "orders"
2. Click copy button
3. ASSERT: Clipboard contains: `orders` (backtick-quoted regardless of chars)
```

**Contrast with Insert button:**
```
1. Ensure no SQL editor is currently focused
2. ASSERT: Copy button is enabled
3. ASSERT: Insert button is disabled (tooltip: "Focus a SQL editor first")
```

### E2E-5: Pre-Save Config Validation

**Precondition:** Topic Management configured, at least one editable config exists (e.g., retention.ms).

```
1. Select a topic and locate the "retention.ms" config row
2. Click the edit (pencil) button
3. Clear the input and type "abc"
4. ASSERT: Inline error appears below input
5. ASSERT: Save button is disabled
6. Clear and type "-5"
7. ASSERT: Inline error appears (must be ≥ -1)
8. Clear and type "-1"
9. ASSERT: No validation error (−1 is valid = infinite retention)
10. ASSERT: Save button is enabled
11. Clear and type "86400000"
12. ASSERT: No validation error
13. ASSERT: Save button is enabled
14. Click Save
15. ASSERT: Config value updates successfully
```

**Server error passthrough:**
```
1. Edit a config without client-side rules (e.g., a custom config)
2. Enter an intentionally invalid value
3. Click Save
4. ASSERT: Server 422 error message appears below input
5. ASSERT: Input remains in edit mode (user can retry)
```

### E2E-6: Composite Health Score

**Precondition:** Topics available in the list. At least one topic with partitions_count = 1 or replication_factor = 1.

```
1. Navigate to Topic Management panel
2. Locate a topic with partitions_count = 1
3. ASSERT: Topic row shows a yellow warning dot (not the old FiAlertTriangle badge)
4. Hover over the dot
5. ASSERT: Tooltip mentions "Low partition count"
6. Locate a healthy topic (partitions ≥ 2, replication ≥ 2)
7. ASSERT: No health indicator dot is shown for this topic
```

**Dark mode:**
```
1. Toggle to dark mode
2. ASSERT: Warning dot is visible with appropriate contrast
3. ASSERT: Dot uses CSS var color (not hardcoded)
```

### E2E-7: SchemaTreeView Dark Mode Colors

**Precondition:** An Avro schema subject with RECORD, ARRAY, and MAP type fields exists.

```
1. Toggle to dark mode
2. Navigate to Schema panel and open a complex Avro subject
3. Expand the tree view
4. ASSERT: Record type badges are visible (not invisible against dark background)
5. ASSERT: Array and map type badges are visible
6. Toggle back to light mode
7. ASSERT: All type badges still visible in light mode
```

### E2E-8: AbortController Network Cancellation

**Precondition:** Topic Management panel configured with multiple topics.

```
1. Open browser DevTools > Network tab
2. Navigate to Topic Management panel
3. Click topic A (config fetch starts)
4. Immediately click topic B before topic A's fetch completes
5. ASSERT: In the Network tab, topic A's config request is cancelled (status: "cancelled")
6. ASSERT: Only topic B's configs are displayed in the UI
7. ASSERT: No stale configs from topic A appear
```

---

## Success Metrics

### Functional

- All 8 features implemented and all acceptance criteria passing at Phase 2.5 QA gate
- Zero `window.confirm()` calls in the entire codebase after Phase 12.5 ships
- Zero hardcoded hex colors in SchemaTreeView after Phase 12.5 ships
- Schema subject delete requires typed name confirmation (matching TopicDetail behavior)

### Safety

- Schema deletion safety incident rate: 0 (no accidental subject deletes from UX confusion)
- Config edit invalid value submissions: reduced by client-side validation intercepting known invalid inputs before reaching the API

### Performance

- Rapid topic switching (5 topics in 2 seconds): 0 stale config panels displayed
- HTTP request count on rapid topic switching: ≤ 1 in-flight config fetch at any time (AbortController signal forwarded)
- Topic list render with 500 topics: < 100ms (health dot computation is O(N) over existing list data, no new API calls)

### User Experience

- Copy-to-clipboard feedback: visual state change within 50ms of click
- Config validation error display: within one keystroke of entering an invalid value (onChange, not onBlur)
- Schema diff version picker: excludes currently-selected primary version (impossible to select same version on both sides)

---

## Out of Scope (Phase 12.6+)

The following items were identified in interviews and stress tests but are explicitly excluded from Phase 12.5 to keep scope tight:

| Item | Source | Reason Deferred |
|---|---|---|
| ISR < replication.factor warning | Interview (User C) | Requires per-topic partition API calls on list render — expensive at scale |
| Broker rebalancing alerts | Interview (User C) | Requires broker-level API not in current Kafka REST v3 scope |
| Topic lag monitoring | Interviews (Users B, C) | Major feature (8-16hrs) — separate Phase 12.6 candidate |
| Schema evolution validation | Interview (User E) | Requires job topology analysis — separate Phase 13 candidate |
| Query templates library | Interview (User D) | Standalone feature — Phase 12.6 candidate |
| Bulk topic delete | Roadmap (12.3 R3 ENH-5) | 13 story points — separate release, tracked in Phase 12.3 R3 backlog |
| Config edit optimistic updates | Run-3 Flink Developer §MED-1 | Enhancement only, not a correctness issue |
| PartitionTable virtualization | Run-3 Flink Developer §LOW-1 | Typical Kafka clusters have <100 partitions; acceptable for now |
| "Back to topic list" breadcrumb | Interview Summary Phase 12.5 Item 2 | Polish; tracked in Phase 12.3 R3 |

---

## Engineering Guidance for Phase 2

### File Ownership (Parallel Agent Safety)

To enable parallel implementation without merge conflicts, assign files to agents as follows:

**Agent 1 — SchemaPanel surgeon (SchemaDetail + SchemaTreeView)**
- `src/components/SchemaPanel/SchemaDetail.tsx` — Features 1, 2, 3
- `src/components/SchemaPanel/SchemaTreeView.tsx` — Feature 7
- `src/__tests__/components/SchemaDetail.test.tsx` — All test updates for above
- `src/__tests__/components/SchemaTreeView.test.tsx` — All test updates for above
- CSS theme file (for Feature 7 CSS vars only)

**Agent 2 — TopicPanel surgeon (TopicDetail + TopicList + API)**
- `src/components/TopicPanel/TopicDetail.tsx` — Features 4, 5
- `src/components/TopicPanel/TopicList.tsx` — Feature 6
- `src/api/topic-api.ts` — Feature 8
- `src/__tests__/components/TopicPanel.test.tsx` — All test updates for above
- `src/__tests__/api/topic-api.test.ts` — Feature 8 signal tests

**Zero shared files between agents.** `workspaceStore.ts` and `types/index.ts` require no changes for any Phase 12.5 feature — confirm before starting.

### Test Markers Required

All new tests must use the existing marker format:

| Feature | Marker |
|---|---|
| Schema subject delete | `[@schema-delete-confirm]` |
| Schema diff stability | `[@schema-diff-fix]` |
| Schema version delete overlay | `[@schema-version-delete]` |
| Copy topic name | `[@topic-copy-name]` |
| Config pre-save validation | `[@config-validation]` |
| Health score composite | `[@topic-health-score]` |
| SchemaTreeView CSS vars | `[@schema-tree-colors]` |
| AbortController signal | `[@abort-signal]` |

### Implementation Order Within Each Agent

**Agent 1 (SchemaPanel):** Feature 7 first (CSS vars — zero risk, quick win), then Feature 2 (diff bugs — requires understanding the existing diff state machine), then Feature 1 (delete confirm — new UI pattern), then Feature 3 (version delete overlay — similar pattern to Feature 1).

**Agent 2 (TopicPanel):** Feature 8 first (AbortController — pure API layer, zero UI risk), then Feature 4 (copy button — additive, no existing logic changed), then Feature 5 (config validation — adds validation layer to existing edit flow), then Feature 6 (health score — replaces existing badge logic in TopicList).

### Backtick Quoting Contract

Feature 4 (copy topic name) must use the same backtick quoting function used in Phase 12.4 for "Insert topic name". Verify the quoting function is exported from a shared utility or reuse the same call pattern. Do NOT duplicate the quoting logic.

Test cases for quoting (from interview validation, all must produce backtick-quoted output):
- `topic.name` → `` `topic.name` ``
- `topic-name` → `` `topic-name` ``
- `my_topic` → `` `my_topic` `` (also quoted, per Phase 12.4 behavior)
- `UPPERCASE` → `` `UPPERCASE` ``
- `with spaces` → `` `with spaces` ``
- `orders` → `` `orders` ``

All topic names are backtick-quoted regardless of whether they contain special characters. This is consistent with the existing Insert button behavior from Phase 12.4 and simplifies the implementation (no "does this name need quoting?" decision tree).

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema diff state machine is complex — stale fix may introduce new regression | Medium | Medium | Feature 2 must be tested with 1, 2, 3, and 5+ version subjects |
| AbortController signal forwarding breaks existing tests that mock `getTopicConfigs` | Medium | Low | Mock must be updated to accept optional `options` parameter; backward compatible signature |
| CSS custom property values in dark mode may be hard to see if chosen poorly | Low | Low | QA must visually verify all three schema type badge colors in dark mode |
| Client-side validation rules may conflict with server-side rules (e.g., retention.ms = -1) | Low | Medium | Use the exact validation rules specified in Feature 5 table; test -1 explicitly |

---

## Appendix: User Interview Quotes Supporting This PRD

> "One misclick deletes my entire schema history. I want to type the name to confirm, like topics." — **User E, Platform Engineer** (supporting AC-1)

> "The diff view breaks when I switch versions in the middle. I can see both panes showing the same schema but different version numbers. That's just wrong." — **User A, Flink Engineer** (supporting AC-2)

> "That browser popup for deleting a version is jarring. It's the only thing in the UI that's not styled. It feels like a bug." — **User B, Flink Engineer** (supporting AC-3)

> "I'd rather have a 'copy' button next to the name. One-click copy is faster than insert when I'm building something in a different tool." — **User D, Data Scientist** (supporting AC-4)

> "Show validation errors before I click save. I know immediately that retention.ms should be an integer but the input lets me type anything." — **User D, Data Scientist** (supporting AC-5)

> "A single dot per topic that goes green/yellow/red — that's all I need in the list. I don't need the triangle badge to be a big orange icon every time." — **User D, Data Scientist** (supporting AC-6)

> "The purple and teal record type badges look great in light mode. They basically disappear in my colleague's dark mode config." — **User C, Sr. Architect** (supporting AC-7)
