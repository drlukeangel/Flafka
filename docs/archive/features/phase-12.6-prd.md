# Phase 12.6 — Config Audit, Schema Filtering, and Query Templates

**Status**: Phase 2 — B1 Implementation Active (A2 Gate CLEARED 2026-03-01T00:30:00Z — 5/5 APPROVED)
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-03-01
**A2 Updated**: 2026-03-01 (incorporated all reviewer feedback — see A2 Design Review Feedback section)
**Depends On**: Phase 12.5 (Advanced Topic & Schema Operations) ✅
**Blocks**: Phase 12.7 (TBD)
**Sources**:
- Interview Analyst Report (Run-4): `docs/agents/feedback/run-4/INTERVIEW-ANALYST.md`
- Flink Developer Stress Test (Run-5): `docs/agents/feedback/run-5/FLINK-DEVELOPER.md`
- Phase 12.5 PRD: `docs/features/phase-12.5-prd.md`
- A2 Design Review Feedback (Run-6): `docs/agents/feedback/run-6/`

---

## Problem Statement

Phase 12.5 shipped eight targeted fixes and hardening improvements. Post-ship feedback from five user interviews (Run-4) and the Flink Developer stress test (Run-5) surfaced the next set of gaps. The backlog now totals 8 story points of confirmed bugs (Run-5) plus 37–55 story points of validated feature requests (Run-4), reaching the ≥25 point release threshold.

**Specific gaps driving Phase 12.6:**

1. **Config edit has no audit trail**: Users B and E (compliance roles) flagged that config changes are currently invisible — there is no record of who changed a config value or when. For regulated teams this is a compliance blocker: config edit adoption is blocked until there is a change log. Users cannot answer "why is retention.ms set to 2 days?" without tribal knowledge.

2. **Schema subject list has no filter by type or compatibility mode**: User C (senior architect) manages 200+ subjects. The existing search filters only on subject name. There is no way to quickly surface "all PROTOBUF subjects" or "all subjects with BACKWARD_TRANSITIVE compat." Power users with large subject counts cannot efficiently navigate the list.

3. **Schema panel shows nothing on initial mount**: User D reported that the Schema panel shows blank white space — no spinner, no skeleton — while the initial subject list fetch is in flight. Every session starts with a moment where the panel appears broken.

4. **Config table sort state resets when switching topics**: User B compares the same config across multiple topics. Every topic switch resets the column sort, forcing manual re-sort each time. This turns a reasonable comparison workflow into tedious repetition.

5. **AbortController is missing from schema diff fetch**: When a user switches the diff version picker rapidly, multiple in-flight schema fetches can race. The diff pane may show a stale version's schema. This is the same pattern that was fixed in Phase 12.5 Feature 8 for topic config fetches — the schema diff fetch was missed.

6. **Query templates / saved snippets library is absent**: Users A and D both upgraded this from a Phase 12.4 low-priority mention to an explicit Phase 12.6 request after two weeks of daily use. User A has written the same `SELECT * FROM \`my-topic\` LIMIT 100` statement over 40 times. User D runs 5–6 weekly patterns with no way to save them.

7. **Diff view stale closure when primary matches diffVersion (S5-MED-1)**: When the user changes the primary version to the same value as the current diff version, the stale closure in `handleVersionChange` does not update the diff version picker correctly. The user sees two identical schemas side-by-side and a broken/empty diff version dropdown.

8. **TopicDetail health dot shown for healthy topics (S5-MED-2)**: `TopicDetail.tsx` renders the health dot unconditionally — including for healthy (green) topics. `TopicList.tsx` correctly hides the dot for healthy topics per AC-6.1. This inconsistency adds visual noise for the majority of topics.

**Additionally, three low-severity bugs from Run-5:**

9. **Diff mode stuck after version delete reduces subject to 1 version (S5-LOW-1)**: If a user is in diff mode and deletes one of two versions, the diff button disappears but `diffMode` is not reset. The user is trapped in a broken diff view with no way to exit except navigating away.

10. **Duplicate health warnings for 0-partition topic (S5-LOW-2)**: `TopicDetail.tsx`'s `computeHealthScore` emits both "Topic has no partitions" and "Single-partition topics have no parallelism" for a 0-partition topic. The second warning is semantically incorrect and confusing.

11. **VersionDeleteConfirm button uses hardcoded `#ffffff` (S5-LOW-3)**: The confirm button in `VersionDeleteConfirm` uses `color: '#ffffff'` in an inline style rather than a CSS custom property, violating AC-3.7 from Phase 12.5.

**Goals for Phase 12.6:**
1. Add client-side config edit audit log (who changed what, when — session-scoped)
2. Add schema subject list filters (by schema type and compatibility mode)
3. Add schema panel loading skeleton on initial mount
4. Persist config table sort state within session
5. Add AbortController to schema diff fetch
6. Add query templates / saved SQL snippets library (localStorage-backed)
7. Fix diff view stale closure (S5-MED-1)
8. Fix TopicDetail health dot shown for healthy topics (S5-MED-2)
9. Fix diff mode stuck after single-version delete (S5-LOW-1)
10. Fix duplicate health warnings for 0-partition topics (S5-LOW-2)
11. Fix VersionDeleteConfirm button hardcoded `#ffffff` (S5-LOW-3)

---

## Story Points Summary

| ID | Feature | Type | Points |
|:---|:---|:---|:---:|
| F1 | Config edit audit log | Enhancement | 8 |
| F2 | Schema subject list filter (type + compat) | Enhancement | 5 |
| F3 | Schema panel loading skeleton | Enhancement | 2 |
| F4 | Config table sort persistence (session) | Enhancement | 3 |
| F5 | AbortController on schema diff fetch | Bug/Hardening | 2 |
| F6 | Query templates / saved SQL snippets | Enhancement | 13 |
| F7 | Diff view stale closure fix (S5-MED-1) | Bug | 3 |
| F8 | TopicDetail health dot for healthy topics (S5-MED-2) | Bug | 2 |
| F9 | Diff mode stuck on last-version delete (S5-LOW-1) | Bug | 1 |
| F10 | Duplicate health warnings 0-partition (S5-LOW-2) | Bug | 1 |
| F11 | VersionDeleteConfirm hardcoded #ffffff (S5-LOW-3) | Bug | 1 |
| **TOTAL** | | | **41** |

---

## Proposed Solution

### Feature 1: Config Edit Audit Log

**Files:** `src/components/TopicPanel/TopicDetail.tsx`, `src/store/workspaceStore.ts`

**Behavior:**
- Every successful config save via the inline config editor appends an entry to a session-scoped audit log.
- Audit log entries contain: topic name, config key, previous value, new value, timestamp (ISO 8601), and a user label (initially "You" — there is no authenticated user concept yet).
- The audit log is stored in the Zustand store (not persisted to localStorage — session only, resets on page reload).
- A "Config History" section appears below the config table in `TopicDetail`, collapsed by default.
- Clicking the "Config History" header expands the section to show a chronological list of entries for that topic (most recent first).
- Each entry shows: `[HH:MM:SS] retention.ms: 604800000 → 86400000`
- When no changes have been made for the current topic in this session, the section shows "No config changes this session."
- On cancel (user clicks Cancel or presses Escape while editing), no entry is appended.
- On API error (422 or network failure), no entry is appended (entry is only written on confirmed save success).

**Display format for a single entry:**
```
HH:MM:SS   key-name   old-value → new-value
```

**Constraints:**
- Log is per-topic — only entries for the currently viewed topic are displayed. The full log (all topics) lives in the store.
- Log has a max capacity of 200 entries across all topics. Oldest entries are evicted when the cap is reached (FIFO).
- Log does NOT persist to localStorage. It resets when the page is reloaded. This is intentional: config history in a client-side tool should be understood as session context, not a permanent record.
- Future phases may add server-side audit log integration if a Confluent Cloud API is available for this.
- The audit log MUST be implemented directly in `workspaceStore.ts` — do NOT introduce a separate hook. Zustand is the single state source. (Principal Architect A2 note)

**Engineering Implementation Notes (from A2 Design Review):**
- **oldValue capture timing**: The `oldValue` must be captured BEFORE the save API call is initiated — read the pre-edit value from current config state when the user starts the edit, store it as a local variable, and pass it to `addConfigAuditEntry` only in the `.then()` success callback. Never capture `oldValue` after the call returns. (Principal Engineer A2 note)
- **Expanded state persistence**: AC-1.4 says "toggle persists for the duration of the session (not reset on topic switch)." If `TopicDetail` unmounts/remounts on topic switch, a simple `useState` will reset. The expanded/collapsed state MUST be stored in `sessionStorage` or Zustand (not just `useState`) to survive topic switches. (Principal Engineer A2 note)
- **FIFO eviction**: Implement as `if (log.length >= 200) log.shift()` after push, or use `slice(-200)`. Keep it simple.
- **Entry display format**: Use `new Date(timestamp).toLocaleTimeString()` for HH:MM:SS. Use `font-family: monospace` or a CSS var for entry text — no inline font-family strings.
- **UX discoverability**: After the FIRST successful config save in a session, automatically expand the "Config History" section once to make the feature discoverable. Subsequent saves leave the section in its current expanded/collapsed state. (UX/IA Reviewer A2 note)
- **Visual affordance**: The "Config History" header must include a chevron/expand arrow icon to signal the section is clickable/expandable. (UX/IA Reviewer A2 note — U-3, non-blocking polish)

**Acceptance Criteria:**

- AC-1.1: After a successful config save, an audit entry is added to the store for that topic.
- AC-1.2: Audit entry contains: `topicName`, `configKey`, `oldValue`, `newValue`, `timestamp` (ISO 8601 string).
- AC-1.3: `TopicDetail` shows a "Config History" section below the config table. Section is collapsed by default.
- AC-1.4: Clicking "Config History" header expands/collapses the section. Toggle persists for the duration of the session (not reset on topic switch). Expanded state stored in sessionStorage or Zustand (not useState alone).
- AC-1.5: When expanded, entries for the current topic are shown, most recent first.
- AC-1.6: Entry format: `HH:MM:SS  key  oldValue → newValue` (monospace font for values).
- AC-1.7: When no entries exist for the current topic, show "No config changes this session" in muted text.
- AC-1.8: Canceled edits do not produce entries. `oldValue` is captured at edit-init time, not passed to store on cancel path.
- AC-1.9: Failed saves (API error) do not produce entries. Store action called only in `.then()` success branch.
- AC-1.10: Log entries use CSS custom properties for all colors — no hardcoded hex.
- AC-1.11: Section renders correctly in dark mode and light mode.
- AC-1.12: The "Config History" section header is keyboard accessible (Enter/Space to toggle).
- AC-1.13: Log capacity: ≥200 entries across all topics before any eviction occurs.
- AC-1.14: `aria-expanded` reflects collapsed/expanded state on the toggle button. (Pre-existing AC)
- AC-1.15: (U-1 BLOCKING) The "Config History" toggle button has `aria-controls` attribute pointing to the ID of the expanded content region. Required for screen reader relationship announcement.
- AC-1.16: (U-2 BLOCKING) The expanded content region has `role="region"` and `aria-label="Config history"` so screen readers can navigate directly to it.

---

### Feature 2: Schema Subject List — Filter by Type and Compatibility Mode

**Files:** `src/components/SchemaPanel/SchemaPanel.tsx` (or the schema subject list component)

**Behavior:**
- Add two filter dropdowns to the schema subject list toolbar, alongside the existing search input.
- **Type filter:** A dropdown with options: "All Types", "AVRO", "PROTOBUF", "JSON". Filters the subject list to only show subjects whose registered schema type matches the selected value.
- **Compat filter:** A dropdown with options: "All Compat Modes", "BACKWARD", "BACKWARD_TRANSITIVE", "FORWARD", "FORWARD_TRANSITIVE", "FULL", "FULL_TRANSITIVE", "NONE". Filters the subject list to only show subjects whose registered compatibility mode matches the selected value.
- Both filters apply simultaneously with the existing name search (all three filters are AND-combined).
- When a filter is active, the dropdown shows the active value highlighted (not the placeholder text).
- When no subjects match all active filters, show "No subjects match the current filters." (consistent with existing empty-state pattern).
- Filter state is session-scoped (not persisted to localStorage — resets on page reload).
- Subject schema type and compatibility mode must already be loaded for the subject for filtering to work. If the data is not yet loaded for a subject, that subject is excluded from filtered views until its data loads.
- A "Clear all filters" button or reset link appears in the toolbar when any filter (Type, Compat, or name search) is non-default. Clicking it resets all three filters to their defaults. (SR Flink/Kafka Engineer A2 suggestion)

**Implementation Note:**
- The type badge (ORIG-8, already shipped in Phase 12.2 R2) stores the schema type per subject. The compatibility mode is already fetched as part of subject detail. The filtering logic operates on already-loaded data — no new API calls are required for the filter itself.
- If schema type or compat mode has not yet been fetched for a given subject, it should be treated as "unknown" and excluded from type/compat filters. It will appear under "All Types" and "All Compat Modes" once its data loads.
- Filter implementation pattern: `const [typeFilter, setTypeFilter] = useState('ALL')` and `const [compatFilter, setCompatFilter] = useState('ALL')`. AND filtering: `subjects.filter(s => (typeFilter === 'ALL' || s.schemaType === typeFilter) && (compatFilter === 'ALL' || s.compatibility === compatFilter) && s.name.includes(search))`. Subjects with `undefined` or `null` type/compat are excluded from specific filter views. (Principal Engineer A2 note)
- Use native `<select>` elements for the dropdowns (simpler, natively keyboard-accessible, no custom dropdown component needed). (Principal Engineer A2 note)
- Filter state resets on panel mount — `useState` initializes to 'ALL' on mount; no persistence needed. Engineering must confirm that SchemaPanel unmounts/remounts when closed and reopened (not kept alive with `display:none`). If the panel is kept mounted, filter state will NOT reset as expected. (Principal Architect A2 note)
- Toolbar layout: apply visible "Type:" and "Compat:" label text beside each dropdown to aid sighted users. Consider a "Filter:" prefix grouping if the toolbar becomes crowded. (UX/IA Reviewer A2 note — U-5, non-blocking polish)

**Acceptance Criteria:**

- AC-2.1: A "Type" dropdown appears in the schema subject list toolbar. Default: "All Types".
- AC-2.2: A "Compat" dropdown appears in the schema subject list toolbar. Default: "All Compat Modes".
- AC-2.3: Selecting "AVRO" from the Type dropdown shows only subjects with schema type AVRO.
- AC-2.4: Selecting a compat mode shows only subjects matching that compatibility mode.
- AC-2.5: Type and Compat filters combine with the existing name search (AND logic).
- AC-2.6: When no subjects match, show "No subjects match the current filters."
- AC-2.7: Active filters (non-default values) are visually indicated — dropdown text reflects the selected value (not placeholder).
- AC-2.8: Dropdowns use CSS custom properties for all colors (no hardcoded hex).
- AC-2.9: Dropdowns render correctly in dark mode and light mode.
- AC-2.10: Filter state resets when the user navigates away and returns to the schema panel within the same session. (Resets to "All" on every panel mount — simple implementation.)
- AC-2.11: Filter dropdowns are keyboard accessible (can be operated by Tab + arrow keys). Native `<select>` elements satisfy this inherently.
- AC-2.12: Each dropdown has an `aria-label` attribute: `aria-label="Filter by schema type"` and `aria-label="Filter by compatibility mode"`. (Principal Engineer A2 note)
- AC-2.13: (U-4 BLOCKING) The subject list results container has `aria-live="polite"`. When the list transitions to empty state ("No subjects match the current filters."), this is announced to screen readers without requiring focus change.
- AC-2.14: A "Clear all filters" button appears in the toolbar when any filter is non-default (Type, Compat, or search). Clicking resets all filters to defaults.

---

### Feature 3: Schema Panel Loading Skeleton on Initial Mount

**Files:** `src/components/SchemaPanel/SchemaPanel.tsx` (schema subject list rendering)

**Behavior:**
- When the Schema panel mounts and the initial subject list fetch is in progress, render a skeleton loading state instead of blank white space.
- The skeleton consists of 5 shimmer rows, each matching the height and layout of a real subject list row (subject name placeholder + type badge placeholder).
- Once the fetch completes, the skeleton is replaced with the real subject list (or the empty state if no subjects are returned).
- The skeleton only appears on the initial mount load — not on subsequent refreshes or manual refresh. On refresh, the existing list remains visible while the refresh is pending (optimistic — avoid flashing skeleton on re-fetch).
- Skeleton rows use the CSS shimmer animation pattern already defined in the codebase (matching the version switch shimmer from Phase 12.2 R2, ORIG-7). Do NOT re-declare keyframes — reuse the existing CSS class.

**Engineering Implementation Notes (from A2 Design Review):**
- **Initial-load flag pattern**: Track initial load with `const [hasLoadedOnce, setHasLoadedOnce] = useState(false)`. Set `hasLoadedOnce = true` once any fetch completes (success or error). Render logic: `if (!hasLoadedOnce && isLoading) return <SkeletonRows count={5} />`. (Principal Engineer A2 note)
- **Shimmer CSS**: Use the existing shimmer CSS class from Phase 12.2 R2 (ORIG-7). Do not declare new keyframes. If SchemaPanel unmounts/remounts on close/reopen, `hasLoadedOnce` resets and the skeleton shows again on re-open — this is acceptable behavior. (Principal Engineer A2 note)
- **Shimmer colors**: Use `--color-bg-skeleton` or the equivalent existing CSS custom property for shimmer colors. No hardcoded hex. (Principal Engineer A2 note)

**Acceptance Criteria:**

- AC-3.1: On initial Schema panel mount, while the subject list fetch is in progress, 5 shimmer skeleton rows are displayed.
- AC-3.2: Skeleton rows match the approximate height and structure of real subject rows.
- AC-3.3: After fetch completes successfully, skeleton is replaced with the real subject list.
- AC-3.4: After fetch completes with empty results, skeleton is replaced with the empty state message.
- AC-3.5: Skeleton is only shown on the initial load — subsequent refreshes do not re-show the skeleton while the existing list is displayed.
- AC-3.6: Skeleton uses CSS custom properties for shimmer colors — consistent with the existing shimmer pattern in the codebase. Do not re-declare shimmer keyframes.
- AC-3.7: Skeleton renders correctly in dark mode and light mode.
- AC-3.8: Skeleton container has `aria-busy="true"` while loading; this attribute is removed after load completes.
- AC-3.9: (U-6 BLOCKING) Each individual skeleton row element has `aria-hidden="true"` so screen readers do not attempt to announce the placeholder shimmer elements.

---

### Feature 4: Config Table Sort Persistence Within Session

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

**Behavior:**
- When the user sorts the config table by clicking a column header, that sort state (column + direction) is stored in `sessionStorage`.
- When the user switches to a different topic (or navigates away and back), the config table restores the last sort state from `sessionStorage`.
- This means if User B sorted by "Key" (ascending) to find `retention.ms`, then switched to another topic, the new topic's config table loads already sorted by "Key" ascending.
- The sort state is scoped to the session (resets on page reload) — not saved to localStorage.
- Supported sort columns: Key, Value, Default, Read-only (all current sortable columns in the config table).

**Engineering Implementation Notes (from A2 Design Review):**
- **sessionStorage read pattern**: `sessionStorage.getItem('flink-ui.configTableSort')` on component mount. If `TopicDetail` is a single component receiving a `topicName` prop (not unmounted/remounted on topic switch), sort state must be initialized inside a `useEffect` that depends on `topicName`. (Principal Architect A2 note)
- **Parse safety**: Wrap `sessionStorage.getItem` / `JSON.parse` in a try/catch. If the stored value is corrupted or unparseable, fall back to default sort (`{ column: 'key', direction: 'asc' }`). Never let a bad sessionStorage value crash the table. (Principal Engineer A2 note)
- **Sort type**: `{ column: 'key' | 'value' | 'default' | 'readOnly'; direction: 'asc' | 'desc' }`. Use string union for direction.

**Acceptance Criteria:**

- AC-4.1: Clicking a config table column header sorts the table by that column.
- AC-4.2: Sort state (column + direction) is written to `sessionStorage` on each sort change.
- AC-4.3: When a new topic is selected, the config table initializes with the sort state from `sessionStorage` (if present). If `TopicDetail` does not remount on topic switch, sort state is re-read in a `useEffect` keyed on `topicName`.
- AC-4.4: If no sort state exists in `sessionStorage` (first load), the config table uses the default sort (Key ascending).
- AC-4.5: Sort indicators (up/down arrows or equivalent) reflect the active sort column and direction. Sort indicator icons use CSS custom properties for color — no hardcoded hex.
- AC-4.6: Clicking the same column header again reverses the sort direction.
- AC-4.7: Sort state uses `sessionStorage` key: `flink-ui.configTableSort` (JSON: `{ column: string, direction: 'asc' | 'desc' }`).
- AC-4.8: Sort state is not persisted to localStorage — resets on page reload.
- AC-4.9: sessionStorage parse wrapped in try/catch — corrupted values fall back to default sort without throwing.
- AC-4.10: (U-7 BLOCKING) Active sort column header `<th>` element has `aria-sort="ascending"` or `aria-sort="descending"` attribute. Inactive column headers have no `aria-sort` attribute. Required for screen readers to announce table sort state.

---

### Feature 5: AbortController on Schema Diff Fetch

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`, `src/api/schema-registry-api.ts` (or equivalent)

**Behavior:**
- The schema diff fetch (fetching the diff version's schema content) should be cancellable via AbortController.
- When `handleDiffVersionChange` is called (user changes the diff version picker), any in-flight fetch for the previous diff version is aborted before the new fetch begins.
- AbortController lifecycle matches the pattern established in Phase 12.5 Feature 8 (topic config fetch AbortController): create on each fetch trigger, cancel previous on re-trigger, ignore abort errors silently.
- The API function for fetching a schema version (used by the diff pane) should accept an optional `signal?: AbortSignal` parameter and forward it to the HTTP layer (Axios).

**Engineering Implementation Notes (from A2 Design Review):**
- **Ref pattern**: Use `useRef<AbortController | null>(null)` named `diffFetchAbortRef`. In `handleDiffVersionChange`: `diffFetchAbortRef.current?.abort(); const controller = new AbortController(); diffFetchAbortRef.current = controller; fetchSchemaVersion(version, { signal: controller.signal })`. (Principal Engineer A2 note)
- **API function signature**: Add `config?: { signal?: AbortSignal }` param to the schema version fetch function. Pass to Axios: `axios.get(url, { signal: config?.signal })`.
- **Error handling in catch**: `if (error.name === 'AbortError' || axios.isCancel(error)) return;` — silently ignore. All other errors continue to surface.
- **Unmount cleanup**: The `useEffect` that sets up the abort ref MUST include a cleanup function that calls `diffFetchAbortRef.current?.abort()` on component unmount. This prevents stale state updates after unmount. (Principal Engineer A2 note — HIGH priority)
- **Test mocking note**: Tests must mock Axios (not native fetch). The existing `src/test/mocks/api.ts` mock supports this. Confirm implementation uses Axios, not native fetch, throughout. (QA Manager A2 note)

**Acceptance Criteria:**

- AC-5.1: The schema version fetch API function accepts an optional `signal?: AbortSignal` parameter.
- AC-5.2: The `signal` is forwarded to the Axios request configuration.
- AC-5.3: `SchemaDetail.tsx` creates an `AbortController` for diff version fetches and calls `controller.abort()` before initiating a new fetch.
- AC-5.4: Rapid diff version switching (5 changes < 2 seconds) results in only the last selected version's schema being displayed in the diff pane.
- AC-5.5: Abort errors are silently ignored (no error toast, no error state update). Abort detection uses `error.name === 'AbortError' || axios.isCancel(error)`.
- AC-5.6: Non-abort errors (network failure, 404) continue to surface as error toasts.
- AC-5.7: The change is backward compatible — callers that do not pass a signal continue to work correctly.
- AC-5.8: The `useEffect` cleanup function calls `diffFetchAbortRef.current?.abort()` on component unmount to prevent stale state updates.

---

### Feature 6: Query Templates / Saved SQL Snippets Library

**Files:** `src/components/SnippetsPanel/SnippetsPanel.tsx` (new), `src/store/workspaceStore.ts`, `src/types/index.ts`

**Behavior:**
- A new "Snippets" panel accessible from the left sidebar (icon button, similar to the Schema panel toggle).
- Users can save any SQL cell as a named snippet: a "Save as snippet" action button is available in the EditorCell toolbar (alongside run, cancel, copy, etc.).
- The save prompt MUST NOT use `window.prompt()`. It must be an inline modal or ARIA dialog element (`<dialog>` element or equivalent with `role="dialog"` and `aria-modal="true"` with focus trapped inside). (UX/IA Reviewer A2 note — U-8 BLOCKING)
- Snippets are listed in the Snippets panel by name, sorted alphabetically by default.
- Clicking a snippet inserts its SQL content into the currently focused editor cell (uses the existing `editorRegistry` pattern for focused editor detection).
- Users can delete a snippet from the Snippets panel (inline delete with confirmation — same `DeleteConfirm` pattern used throughout).
- Users can rename a snippet (double-click the name → inline edit, Enter to save, Escape to cancel — same pattern as workspace name).
- Snippets are persisted in localStorage under the key `flink-ui.snippets` via Zustand persist middleware. The `partialize` function in the Zustand store MUST include the `snippets` field. No manual `localStorage.setItem()` calls for snippets — let the persist middleware handle sync.
- Snippet schema: `{ id: string, name: string, sql: string, createdAt: string, updatedAt: string }`.
- Maximum 100 snippets stored. When the limit is reached, saving a new snippet shows an informational message: "Snippet limit reached (100). Delete existing snippets to add new ones."
- Snippets panel shows a search input to filter the snippet list by name.
- If no snippets exist, the panel shows an empty state: "No snippets yet. Save a SQL cell to get started."
- Snippet items in the list display a tooltip on hover: "Click to insert into focused cell" — communicating the expected workflow to new users. (UX/IA Reviewer A2 note — U-13, non-blocking polish)
- The sidebar Snippets icon must be visually distinct from the Schema panel icon. Use a "code snippet" style icon (e.g., `</>` or similar code-oriented icon) to communicate the feature's purpose to technical users. (SR Flink/Kafka Engineer + UX/IA Reviewer A2 notes)

**Engineering Implementation Notes (from A2 Design Review):**
- **UUID generation**: Use `crypto.randomUUID()` for snippet IDs. Available in Chrome 92+, Firefox 95+, Safari 15.4+. Do NOT use a third-party UUID library. (Principal Architect + Principal Engineer A2 notes — HIGH priority)
- **Persistence via Zustand persist middleware**: Add `snippets` to the `partialize` list in the Zustand persist configuration. Verify the persist key aligns with `flink-ui.snippets`. Do NOT use manual `localStorage.setItem()` calls — let Zustand persist middleware handle all localStorage sync.
- **QuotaExceededError handling**: Even with the 100-snippet hard cap, localStorage writes can fail. Any code path that writes to localStorage (including Zustand persist flush) must handle `QuotaExceededError`. Wrap all `localStorage.setItem()` calls in try/catch; show a toast: "Storage full — cannot save snippet." on failure. (Principal Architect A2 note — HIGH priority)
- **100-snippet hard cap enforcement**: Check `snippets.length >= 100` BEFORE calling `addSnippet` in the store. Do not rely solely on the localStorage quota exception. This check belongs in the UI layer (before dispatching the action) and/or in the store action itself. (Principal Engineer A2 note — HIGH priority)
- **Rename blur/escape handling**: Use the `labelCancelledRef` pattern (same as workspace name and statement label rename) to prevent the blur handler from saving when Escape was pressed. On Escape: set `labelCancelledRef.current = true`, revert to previous name. On Enter: clear the ref, save new name. (Principal Engineer A2 note — MEDIUM priority)
- **Insert behavior**: Use `editorRegistry` to check if `focusedEditorId` is set before insert. If the focused editor cell was removed while a snippet click is pending, the `editorRegistry` lookup will return `undefined` — treat as no-op (same as "no editor focused" case).
- **Store/types placement**: The `Snippet` type and all snippet-related store actions (`addSnippet`, `deleteSnippet`, `renameSnippet`) MUST be added to `src/types/index.ts` and `workspaceStore.ts` respectively. No inline type declarations inside components. (Principal Engineer A2 note)
- **workspaceStore.ts and types/index.ts**: These files are shared between F1 (ConfigAuditEntry) and F6 (Snippet). BOTH features must be handled by a SINGLE engineering agent (Agent A). No other agent may touch these files.

**Acceptance Criteria:**

- AC-6.1: A Snippets panel is accessible from the left sidebar (new icon button with `aria-label="Snippets"` and visually distinct "code snippet" icon).
- AC-6.2: The Snippets panel renders a list of all saved snippets, sorted alphabetically by name.
- AC-6.3: EditorCell toolbar includes a "Save as snippet" action.
- AC-6.4: Clicking "Save as snippet" opens an inline modal dialog (NOT `window.prompt()`) for name entry. On confirm, saves the current cell's SQL content as a snippet. On cancel, does nothing.
- AC-6.5: Snippet name must be non-empty. Empty name: "Save" button disabled with message "Snippet name is required."
- AC-6.6: Clicking a snippet in the Snippets panel inserts its SQL content into the currently focused editor cell (via editorRegistry).
- AC-6.7: If no editor cell is focused, clicking a snippet shows a toast: "No editor focused — click a cell first, then insert."
- AC-6.8: Snippets can be deleted from the Snippets panel with inline confirmation (DeleteConfirm pattern, no `window.confirm()`).
- AC-6.9: Snippet name can be renamed via double-click → inline edit → Enter to save / Escape to cancel. Uses `labelCancelledRef` pattern to prevent blur from saving on Escape.
- AC-6.10: Snippets are persisted to localStorage via Zustand persist middleware under key `flink-ui.snippets`. The `partialize` function includes the `snippets` field.
- AC-6.11: Snippets panel includes a search input that filters the list by name (case-insensitive).
- AC-6.12: Empty state message shown when no snippets exist: "No snippets yet. Save a SQL cell to get started."
- AC-6.13: Storage limit is 100 snippets. Hard cap check performed before store action. Attempting to add a 101st snippet shows an informational warning and does not save.
- AC-6.14: Snippets panel renders correctly in dark mode and light mode.
- AC-6.15: All colors use CSS custom properties (no hardcoded hex).
- AC-6.16: Snippet list items are keyboard accessible (Tab to navigate, Enter to insert).
- AC-6.17: Delete confirmation uses the existing DeleteConfirm pattern (no `window.confirm()`).
- AC-6.18: `createdAt` and `updatedAt` are ISO 8601 strings. `updatedAt` is set on rename; `createdAt` is set on initial save.
- AC-6.19: Snippet ID generated using `crypto.randomUUID()` — no third-party UUID library.
- AC-6.20: (U-8 BLOCKING) The save name prompt is a `<dialog>` element or ARIA modal with `role="dialog"`, `aria-modal="true"`, and focus trapped inside while open. No `window.prompt()`.
- AC-6.21: (U-9 BLOCKING) Snippet list uses semantic HTML: container has `role="list"`, each snippet item has `role="listitem"`.
- AC-6.22: (U-10 BLOCKING) The search input in the Snippets panel has `aria-label="Search snippets"`.
- AC-6.23: (U-11 BLOCKING) The empty state message element has `role="status"` so screen readers announce it when the list becomes empty.
- AC-6.24: (U-12 BLOCKING) The sidebar Snippets icon button has `aria-label="Snippets"` and an `aria-expanded` attribute reflecting whether the Snippets panel is open or closed.
- AC-6.25: localStorage QuotaExceededError is caught and results in a toast: "Storage full — cannot save snippet." No uncaught exception.

---

### Feature 7: Diff View Stale Closure Fix (S5-MED-1)

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

**Behavior:**
The stale closure in `handleVersionChange` causes self-compare when the user changes the primary version to the current diff version. The fix: pass the new primary version value explicitly when calling the diff version change handler, so the self-compare guard operates on the updated (not stale) value.

When the primary version is changed to a value that equals the current `diffVersion`:
- The diff version should automatically be updated to the next available version (not equal to the new primary).
- If no other version is available (only 2 versions and both would be equal), diff mode should be exited.

**Acceptance Criteria:**

- AC-7.1: When the user changes the primary version to match the current diff version, the diff version is automatically changed to a different version (not self-compare).
- AC-7.2: If no alternative diff version exists (primary change leaves only one option), diff mode is exited automatically.
- AC-7.3: Self-compare never results in two identical schemas displayed side-by-side.
- AC-7.4: The diff version picker dropdown never shows the primary version as a selectable option (existing filter behavior is preserved).
- AC-7.5: The fix uses the new primary version value (not the stale closure) when evaluating the self-compare guard.

**Trigger sequence to verify (from S5-MED-1 report):**
1. Subject with versions [v1, v2, v3]. Primary = v2, diff = v1.
2. User changes primary to v1.
3. Expected: diff version automatically changes to v2 (or v3). No self-compare.
4. Actual before fix: diff pane shows v1 schema on both sides, diff picker shows empty/blank.

---

### Feature 8: TopicDetail Health Dot — Hide for Healthy Topics (S5-MED-2)

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

**Behavior:**
Apply the same `green` guard used in `TopicList.tsx` to `TopicDetail.tsx`. When `computeHealthScore` returns `level === 'green'`, return `null` from the health dot render function — no dot shown in the detail header.

**Acceptance Criteria:**

- AC-8.1: A topic with `partitions_count ≥ 2` and `replication_factor ≥ 2` shows NO health dot in the `TopicDetail` header.
- AC-8.2: A topic with `partitions_count < 2` (warning) shows a yellow dot in the `TopicDetail` header.
- AC-8.3: A topic with `replication_factor < 2` (warning) shows a yellow dot in the `TopicDetail` header.
- AC-8.4: A topic with `partitions_count < 1` or `replication_factor < 1` (critical) shows a red dot in the `TopicDetail` header.
- AC-8.5: `TopicDetail` and `TopicList` behavior is consistent for all health levels (no dots shown for green in both).

---

### Feature 9: Diff Mode Auto-Exit on Last-Version Delete (S5-LOW-1)

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

**Behavior:**
In `handleDeleteVersion`, after fetching the updated version list, check if `diffMode` should be cleared. If the new version list has fewer than 2 versions, set `diffMode(false)`.

**Acceptance Criteria:**

- AC-9.1: After a version delete that reduces the subject to 1 version, `diffMode` is set to `false` automatically.
- AC-9.2: The diff button (which requires `versions.length >= 2` to render) remains hidden after the delete.
- AC-9.3: The schema detail view returns to normal single-version display after the auto-exit.
- AC-9.4: If the version delete leaves 2 or more versions remaining, diff mode is NOT automatically exited.

---

### Feature 10: Duplicate Health Warning Fix for 0-Partition Topics (S5-LOW-2)

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

**Behavior:**
Refactor `computeHealthScore` in `TopicDetail.tsx` to use an early-return pattern (matching `TopicList.tsx`) so that critical conditions (0 partitions, 0 replication) return immediately without falling through to the yellow warning conditions.

**Acceptance Criteria:**

- AC-10.1: A topic with `partitions_count = 0` shows ONLY "Topic has no partitions" in the health tooltip — no "Single-partition" message.
- AC-10.2: A topic with `replication_factor = 0` shows ONLY "Topic has no replication" in the health tooltip — no "Low replication factor" message.
- AC-10.3: A topic with `partitions_count = 1` shows ONLY "Single-partition topics have no parallelism" (not the critical 0-partition message).
- AC-10.4: A topic with `partitions_count = 1` AND `replication_factor = 1` shows both yellow warnings in the tooltip.
- AC-10.5: The refactored `computeHealthScore` in `TopicDetail.tsx` matches the early-return logic pattern used in `TopicList.tsx`.

---

### Feature 11: VersionDeleteConfirm Button CSS Custom Property (S5-LOW-3)

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`, `src/index.css`

**Behavior:**
Replace the hardcoded `color: '#ffffff'` in `VersionDeleteConfirm`'s confirm button (and in the subject-level `DeleteConfirm` confirm button in the same file) with a CSS custom property `var(--color-button-danger-text)`. Define this variable in `:root` and `[data-theme="dark"]` in `index.css`.

**Acceptance Criteria:**

- AC-11.1: `index.css` defines `--color-button-danger-text: #ffffff` in `:root`.
- AC-11.2: `index.css` defines `--color-button-danger-text: #ffffff` in `[data-theme="dark"]` (same value — error red backgrounds are dark in both themes).
- AC-11.3: `VersionDeleteConfirm` confirm button uses `color: 'var(--color-button-danger-text)'` — no hardcoded `#ffffff`.
- AC-11.4: `DeleteConfirm` confirm button (subject-level delete) uses `color: 'var(--color-button-danger-text)'` — no hardcoded `#ffffff`.
- AC-11.5: Visual output is identical to before in both light and dark modes.

---

## Acceptance Tests

### AT-1: Config Audit Log

```
Scenario: User edits retention.ms from 604800000 to 86400000
  Given: User is viewing TopicDetail for topic "orders"
  And: retention.ms shows value 604800000
  When: User clicks edit on retention.ms
  And: User changes value to 86400000
  And: User clicks Save
  And: API returns 200
  Then: Config History section is visible below config table (collapsed)
  When: User clicks "Config History" header
  Then: Section expands and shows 1 entry: "HH:MM:SS  retention.ms  604800000 → 86400000"
  When: User clicks a different topic
  And: Returns to "orders" topic
  Then: Config History section still shows the entry from this session
```

```
Scenario: Canceled edit produces no log entry
  Given: User is editing min.insync.replicas
  When: User presses Escape (cancel)
  Then: No entry appears in Config History for this edit
```

```
Scenario: Failed save produces no log entry
  Given: User edits replication.factor to an invalid value
  When: Server returns 422
  Then: Error toast appears
  And: No entry is added to Config History
```

### AT-2: Schema Subject List Filtering

```
Scenario: Filter by schema type AVRO
  Given: Schema panel is open with 10 subjects (5 AVRO, 3 PROTOBUF, 2 JSON)
  When: User selects "AVRO" from the Type dropdown
  Then: Only 5 AVRO subjects are shown
  And: The search input still works — typing "orders" filters within AVRO subjects
```

```
Scenario: Filter by compat mode BACKWARD_TRANSITIVE
  Given: Schema panel has subjects with various compat modes
  When: User selects "BACKWARD_TRANSITIVE" from the Compat dropdown
  Then: Only subjects with BACKWARD_TRANSITIVE compat are shown
```

```
Scenario: No subjects match combined filters
  Given: Type = "PROTOBUF", Compat = "FULL_TRANSITIVE"
  And: No PROTOBUF subjects have FULL_TRANSITIVE compat
  Then: "No subjects match the current filters." is shown
```

### AT-3: Schema Panel Loading Skeleton

```
Scenario: Initial schema panel mount
  Given: User has not opened the Schema panel this session
  When: User clicks to open the Schema panel
  Then: While the subject list fetch is in progress, 5 skeleton shimmer rows appear
  When: Fetch completes
  Then: Skeleton rows are replaced by the real subject list
```

```
Scenario: Manual refresh does not re-show skeleton
  Given: Schema panel is open showing 10 subjects
  When: User clicks the refresh button (if present) or the panel re-mounts
  Then: Existing subject list remains visible during the refresh
  And: No skeleton is shown during the refresh fetch
```

### AT-4: Config Table Sort Persistence

```
Scenario: Sort persists across topic switches
  Given: User is viewing TopicDetail for topic "orders"
  And: Config table is sorted by "Value" descending
  When: User selects topic "payments"
  Then: Config table for "payments" loads sorted by "Value" descending
  When: User returns to "orders"
  Then: Config table for "orders" still shows sorted by "Value" descending
```

```
Scenario: Sort resets on page reload
  Given: Config table is sorted by "Value" descending
  When: User reloads the page
  Then: Config table uses default sort (Key ascending)
```

### AT-5: AbortController on Schema Diff Fetch

```
Scenario: Rapid diff version switching
  Given: SchemaDetail is open for a subject with 5 versions
  And: Diff mode is active
  When: User rapidly changes the diff version picker 5 times in < 2 seconds
  Then: Only the last selected version's schema is displayed in the diff pane
  And: No stale version content appears
  And: No error toast is shown for the aborted requests
```

### AT-6: Query Templates / Saved Snippets

```
Scenario: Save a snippet and insert it
  Given: EditorCell has SQL content: "SELECT * FROM `orders` LIMIT 100"
  When: User clicks "Save as snippet" in the cell toolbar
  And: Names it "orders sample"
  Then: Snippet appears in Snippets panel as "orders sample"
  When: User focuses a different EditorCell
  And: Clicks "orders sample" in the Snippets panel
  Then: "SELECT * FROM `orders` LIMIT 100" is inserted into the focused cell
```

```
Scenario: Insert with no focused editor
  Given: No EditorCell is currently focused
  When: User clicks a snippet in the Snippets panel
  Then: Toast appears: "No editor focused — click a cell first, then insert."
  And: No content is inserted
```

```
Scenario: Snippets persist across page reload
  Given: User has saved 3 snippets
  When: User reloads the page
  Then: All 3 snippets are present in the Snippets panel
```

```
Scenario: Snippet storage limit
  Given: User has 100 snippets saved
  When: User tries to save a 101st snippet
  Then: Informational message: "Snippet limit reached (100). Delete existing snippets to add new ones."
  And: No new snippet is created
```

### AT-7: Diff View Stale Closure Fix

```
Scenario: Change primary version to match current diff version
  Given: Subject has versions [1, 2, 3]. Primary = v2, diff = v1.
  When: User changes primary to v1
  Then: Diff version is automatically updated to v2 or v3
  And: The two diff panes show different versions
  And: The diff version picker shows a valid (non-primary) version as selected
```

### AT-8: TopicDetail Health Dot for Healthy Topics

```
Scenario: Healthy topic shows no dot in detail header
  Given: Topic "orders" has partitions_count = 3 and replication_factor = 3
  When: User clicks to open TopicDetail for "orders"
  Then: No health dot is shown in the TopicDetail header
  And: TopicList row for "orders" also shows no dot (existing behavior)
```

### AT-9: Diff Mode Auto-Exit on Last-Version Delete

```
Scenario: Delete second-to-last version while in diff mode
  Given: Subject has exactly 2 versions (v1, v2)
  And: Diff mode is active (left = v1, right = v2)
  When: User clicks "Delete version v2" and confirms
  Then: Diff mode is automatically exited (diffMode = false)
  And: The schema detail returns to single-version view showing v1
  And: The Diff button is not visible (only 1 version remains)
```

### AT-10: Duplicate Health Warning Fix

```
Scenario: 0-partition topic tooltip shows only one critical message
  Given: Topic "broken" has partitions_count = 0 and replication_factor = 3
  When: User hovers over the health dot in TopicDetail
  Then: Tooltip shows exactly: "Topic has no partitions"
  And: Tooltip does NOT contain "Single-partition topics have no parallelism"
```

### AT-11: VersionDeleteConfirm CSS Custom Property

```
Scenario: Confirm button text color in dark mode
  Given: Theme is set to dark
  When: User opens the version delete confirmation overlay
  Then: The "Delete v{N}" confirm button text is white
  And: No hardcoded '#ffffff' string exists in SchemaDetail.tsx inline styles
```

---

## Edge Cases

### Feature 1 (Config Audit Log) Edge Cases

| Case | Handling |
|:---|:---|
| User edits same config twice in one session | Two separate entries appear in log, both visible |
| Old value and new value are identical | Entry is still written (user explicitly saved, even if value is same) |
| Topic name contains special characters | Store entry using raw topic name string; display escapes as needed |
| Page reload during edit | Log entry not written (reload discards in-progress edit; log is session-scoped) |
| 200+ edits in one session | Oldest entries evicted (FIFO) at 200-entry cap |

### Feature 2 (Schema Subject List Filter) Edge Cases

| Case | Handling |
|:---|:---|
| Subject type not yet loaded | Subject excluded from type-filtered views; appears in "All Types" only once loaded |
| Compat mode is "NONE" | "NONE" is a valid dropdown option; matches subjects with compatibility = NONE |
| User types in search while a type filter is active | Search filters within the already-filtered set (AND logic) |
| All subjects are AVRO, user selects PROTOBUF | Empty state message shown |
| Subject has no registered compat (null/undefined) | Excluded from all specific compat filter views; appears in "All Compat Modes" only |

### Feature 5 (AbortController on Diff Fetch) Edge Cases

| Case | Handling |
|:---|:---|
| User rapidly clicks the same diff version option | Second click aborts and re-fires the same request — no problem |
| Network request completes before abort signal fires | `signal.aborted` check guards any state update; stale response discarded |
| Subject is switched while diff fetch is in-flight | Subject-change useEffect fires; diff fetch is aborted cleanly |

### Feature 6 (Snippets) Edge Cases

| Case | Handling |
|:---|:---|
| SQL content is empty when user clicks "Save as snippet" | Still saveable — empty snippet is valid (user may intend it as a placeholder) |
| Two snippets have identical names | Allowed — names are not unique keys; ID is the unique key |
| localStorage is full (quota exceeded) | Catch QuotaExceededError; show toast: "Storage full — cannot save snippet." |
| User renames snippet to empty string | Rename reverted to previous name on save (empty name not allowed) |
| Focused editor cell is removed while snippet insert is pending | Insert is a no-op; focused editor ID no longer maps to a live editor |

### Feature 7 (Diff Stale Closure Fix) Edge Cases

| Case | Handling |
|:---|:---|
| Subject has exactly 2 versions and primary changes to match diff | No alternative diff version exists → diff mode auto-exits (same as F9 behavior) |
| `handleVersionChange` called with same value as current `selectedVersion` | No-op (value did not change; no need to update diff) |
| `diffVersion` is 'latest' (edge case: unreachable through UI) | Self-compare guard treats 'latest' as null — does not block; safe |

---

## Files Affected

| Feature | Files Modified | Files Created |
|:---|:---|:---|
| F1 (Config Audit Log) | `TopicDetail.tsx`, `workspaceStore.ts`, `types/index.ts` | None |
| F2 (Schema Subject Filter) | Schema subject list component | None |
| F3 (Schema Skeleton) | Schema subject list component | None |
| F4 (Sort Persistence) | `TopicDetail.tsx` | None |
| F5 (AbortController Diff) | `SchemaDetail.tsx`, schema API module | None |
| F6 (Snippets Library) | `workspaceStore.ts`, `types/index.ts`, `App.tsx` | `src/components/SnippetsPanel/SnippetsPanel.tsx` |
| F7 (Diff Closure Fix) | `SchemaDetail.tsx` | None |
| F8 (Health Dot Fix) | `TopicDetail.tsx` | None |
| F9 (Diff Auto-Exit) | `SchemaDetail.tsx` | None |
| F10 (Dup Warning Fix) | `TopicDetail.tsx` | None |
| F11 (CSS Var Fix) | `SchemaDetail.tsx`, `index.css` | None |

---

## Test Plan (Tier 1 — Required by QA Gate)

All test files must have markers in the format `[@phase-12.6-*]`.

| Feature | Test File | Marker | Coverage Required |
|:---|:---|:---|:---|
| F1 Config Audit Log | `src/__tests__/components/Phase126ConfigAudit.test.tsx` | `[@phase-12.6-config-audit]` | Entry creation, no-entry on cancel, no-entry on error, display, capacity |
| F2 Schema Filter | `src/__tests__/components/Phase126SchemaFilter.test.tsx` | `[@phase-12.6-schema-filter]` | Type filter, compat filter, AND logic, empty state, Clear all filters |
| F3 Schema Skeleton | `src/__tests__/components/Phase126SchemaSkeleton.test.tsx` | `[@phase-12.6-schema-skeleton]` | Skeleton on mount, replaced after load, not shown on re-fetch, aria-hidden on rows |
| F4 Sort Persistence | `src/__tests__/components/Phase126ConfigSort.test.tsx` | `[@phase-12.6-config-sort]` | Sort state written, restored on topic switch, reset on reload, sessionStorage parse fallback |
| F5 AbortController Diff | `src/__tests__/components/Phase126DiffAbort.test.tsx` | `[@phase-12.6-diff-abort]` | Abort on version change, last-version shown, no error toast, unmount cleanup |
| F6 Snippets Library | `src/__tests__/components/Phase126Snippets.test.tsx` | `[@phase-12.6-snippets]` | Save, insert, delete, rename, persistence, limit, empty state, no-editor toast |
| F7 Diff Closure Fix | `src/__tests__/components/Phase126DiffClosure.test.tsx` | `[@phase-12.6-diff-closure]` | Self-compare prevention, auto diff version update, no broken state |
| F8 Health Dot Fix | `src/__tests__/components/Phase126HealthDot.test.tsx` | `[@phase-12.6-health-dot]` | Green = no dot, yellow = dot, red = dot (TopicDetail) |
| F9 Diff Auto-Exit | Extend `Phase126DiffClosure.test.tsx` | `[@phase-12.6-diff-closure]` | Auto-exit on last-version delete |
| F10 Dup Warning | Extend `Phase126HealthDot.test.tsx` | `[@phase-12.6-health-dot]` | 0-partition = one message only |
| F11 CSS Var Fix | Extend `Phase126DiffClosure.test.tsx` | `[@phase-12.6-diff-closure]` | No hardcoded #ffffff in relevant components |

**Test implementation notes (from QA Manager A2 review):**
- **F6 test file structure**: The Snippets test file will be large (10+ scenarios, 19+ ACs). Use sub-describe blocks within the single file but share the single marker `[@phase-12.6-snippets]`. Do not create multiple test files for F6.
- **F11 CSS var test**: jsdom cannot evaluate CSS custom property computed values. Instead, test that the component does NOT contain the hardcoded string `#ffffff` in any inline style attributes. A snapshot test is acceptable for this assertion.
- **F5 AbortController test**: jsdom does not support native fetch. All abort behavior must be tested via Axios mock. Use the existing `src/test/mocks/api.ts` mock infrastructure. Confirm the implementation uses Axios throughout (not native fetch) before writing tests.

**Tier 2 test stubs (async — Track C, post-ship):**

| Feature | Tier 2 Stubs |
|:---|:---|
| F1 | Concurrent edits across topics; 200-entry FIFO eviction race; same config key edited multiple times |
| F2 | Large subject list (200+) filter performance; filter + paginated load interaction |
| F4 | sessionStorage corrupted value fallback; rapid topic switching session state race |
| F5 | Network timeout during abort; AbortError on cleanup unmount (not just version switch) |
| F6 | localStorage QuotaExceededError; two snippets identical names; focused editor cell removed mid-insert; very large SQL snippet |
| F7 | handleVersionChange called with same value (no-op); diffVersion 'latest' edge case |
| F9 | Delete version while fetch in flight (race condition) |

---

## Release 1 Scope

**Total story points:** 41
**Threshold met:** Yes (≥25)
**All 11 items in Release 1.** No deferral — all bugs from Run-5 are small (1–3 pts each) and ship together with the feature enhancements.

| Priority | Item | Points | Rationale |
|:---|:---|:---:|:---|
| 1 | F6: Query templates / snippets | 13 | Highest user impact (2 users, upgraded priority) |
| 2 | F1: Config audit log | 8 | Compliance blocker (2 users, Users B+E) |
| 3 | F2: Schema subject list filter | 5 | Enterprise navigation (1 architect, 200+ subjects) |
| 4 | F4: Config sort persistence | 3 | Multi-topic comparison workflow (daily friction) |
| 5 | F7: Diff closure fix (S5-MED-1) | 3 | Medium bug, schema diff state machine |
| 6 | F3: Schema panel skeleton | 2 | Quick win, perceived-broken UX |
| 7 | F5: AbortController diff fetch | 2 | Hardening (parity with Phase 12.5 F8) |
| 8 | F8: Health dot fix (S5-MED-2) | 2 | Medium bug, AC-6.1 inconsistency |
| 9 | F9: Diff auto-exit (S5-LOW-1) | 1 | Low bug, one-line fix |
| 10 | F10: Duplicate warnings (S5-LOW-2) | 1 | Low bug, refactor only |
| 11 | F11: CSS var fix (S5-LOW-3) | 1 | Low bug, CSS var + 2 line change |

---

## Out of Scope (Phase 12.7+ or Phase 13)

The following items were discussed in Run-4 interviews but are deferred due to complexity or dependency on APIs not yet available:

| Item | Points | Reason for Deferral |
|:---|:---|:---|
| ISR < replication.factor health warning | 4–8 | Requires per-topic ISR API call (expensive); deferred from Phase 12.5 with user acknowledgment |
| Bulk topic delete (multi-select) | 13 | Already in Phase 12.3 R3 backlog; reconfirmed demand; Phase 12.7 candidate |
| Topic lag monitoring (consumer offset lag) | 8–16 | Requires consumer group API integration not yet in codebase |
| Schema evolution validation (warn before breaking change) | 8–16 | Requires Flink job topology knowledge; Phase 13 candidate |
| Cluster topology visualization | TBD | Strategic; Phase 13+ |
| Flink job → topic lineage graph | TBD | Strategic; Phase 13+ |

---

## A2 Design Review Feedback

**Review date:** 2026-03-01T00:30:00Z
**Gate status:** CLEARED — 5/5 APPROVED
**Reviewers:** Principal Architect, Principal Engineer, QA Manager, UX/IA Reviewer, SR Flink/Kafka Engineer
**Feedback sources:** `docs/agents/feedback/run-6/`

All feedback has been incorporated into the relevant feature sections above. This section provides a consolidated reference for engineers and reviewers.

---

### Non-Blocking Engineering Notes

All 12 engineering notes must be implemented during B1. They do NOT block the A2 gate but ARE required before Phase 2.5 (QA Manager sign-off).

| # | Note | Source | Priority | Target Agent | Feature |
|:--|:-----|:-------|:---------|:------------|:--------|
| E-1 | Keep config audit log in `workspaceStore.ts` — do NOT introduce a separate hook | Principal Architect | MEDIUM | Agent A | F1 |
| E-2 | Verify SchemaPanel mount lifecycle: confirm panel unmounts/remounts on close (not `display:none`). Filter state reset depends on this. | Principal Architect | MEDIUM | Agent D | F2 |
| E-3 | Use `crypto.randomUUID()` for snippet IDs — no third-party UUID library | Principal Architect | HIGH | Agent A | F6 |
| E-4 | Implement try/catch around all localStorage writes for snippets. Show toast on `QuotaExceededError`. | Principal Architect | HIGH | Agent A / Agent D | F6 |
| E-5 | Use Zustand persist middleware for snippets — verify `partialize` includes `snippets` field. No manual localStorage sync. | Principal Architect | HIGH | Agent A | F6 |
| E-6 | Capture `oldValue` BEFORE the save API call. Pass it to `addConfigAuditEntry` only in the `.then()` success callback. | Principal Engineer | HIGH | Agent B | F1 |
| E-7 | Config History toggle expanded state: if `TopicDetail` remounts on topic switch, `useState` alone will reset. Store expanded state in `sessionStorage` or Zustand to survive topic switches. | Principal Engineer | MEDIUM | Agent B | F1 |
| E-8 | Wrap `sessionStorage` parse in try/catch with default sort fallback — never let a corrupted value crash the config table. | Principal Engineer | MEDIUM | Agent B | F4 |
| E-9 | Add `diffFetchAbortRef.current?.abort()` call in `useEffect` cleanup function on unmount — prevents stale state updates after component unmounts. | Principal Engineer | HIGH | Agent C | F5 |
| E-10 | Enforce 100-snippet hard cap check BEFORE calling `addSnippet` store action — do not rely solely on localStorage quota exception. | Principal Engineer | HIGH | Agent A / Agent D | F6 |
| E-11 | Use `labelCancelledRef` pattern for snippet rename blur/escape handling — same pattern as workspace name and statement label. | Principal Engineer | MEDIUM | Agent D | F6 |
| E-12 | Add "Clear all filters" button in schema filter toolbar — appears when any filter is non-default, resets all filters on click. | SR Flink/Kafka Engineer | LOW | Agent D | F2 |

---

### UX/IA Phase 2.6 Conditions

All 10 blocking conditions (U-1 through U-12, excluding non-blocking U-3, U-5, U-13) MUST be implemented during B1 and are ENFORCED at the Phase 2.6 gate. The UX/IA Reviewer will verify all blocking conditions before issuing "UX/IA SIGN-OFF APPROVED."

| # | Condition | Feature | Blocking? | When to Implement |
|:--|:----------|:--------|:---------|:-----------------|
| U-1 | Config History toggle button: `aria-controls` attribute pointing to the content region ID | F1 | BLOCKING | B1 |
| U-2 | Config History content region: `role="region"` + `aria-label="Config history"` | F1 | BLOCKING | B1 |
| U-3 | Config History header: chevron/expand indicator icon for visual affordance | F1 | Non-blocking | B6 polish |
| U-4 | Subject list results container: `aria-live="polite"` for empty state announcement | F2 | BLOCKING | B1 |
| U-5 | Filter dropdowns: visible "Type:" and "Compat:" label text beside each dropdown | F2 | Non-blocking | B6 polish |
| U-6 | Individual skeleton rows: `aria-hidden="true"` on each row element | F3 | BLOCKING | B1 |
| U-7 | Active sort column `<th>` element: `aria-sort="ascending"` or `aria-sort="descending"` | F4 | BLOCKING | B1 |
| U-8 | Save name prompt: `<dialog>` element or ARIA modal with `role="dialog"`, `aria-modal="true"`, focus trapped — no `window.prompt()` | F6 | BLOCKING | B1 |
| U-9 | Snippet list container: `role="list"` + each item: `role="listitem"` | F6 | BLOCKING | B1 |
| U-10 | Snippets search input: `aria-label="Search snippets"` | F6 | BLOCKING | B1 |
| U-11 | Snippets empty state element: `role="status"` | F6 | BLOCKING | B1 |
| U-12 | Sidebar Snippets icon button: `aria-label="Snippets"` + `aria-expanded` attribute | F6 | BLOCKING | B1 |
| U-13 | Snippet list items: hover tooltip "Click to insert into focused cell" | F6 | Non-blocking | B6 polish |

---

### Domain Notes (SR Flink/Kafka Engineer)

The following non-blocking domain enhancement notes were provided. They are informational for this phase; the Low-priority items may be evaluated as Phase 12.7+ candidates:

| Note | Feature | Priority | Status |
|:-----|:--------|:---------|:-------|
| F1 Config Audit: A "View all changes" cross-topic summary mode would be valuable for compliance audits | F1 | Phase 12.7+ candidate | Deferred |
| F2 Schema Filter: "Clear all filters" button when type + compat + name filters are all active | F2 | LOW — incorporated as E-12 / AC-2.14 | INCLUDED in this release |
| F6 Snippets: Team-shared snippets via export/import (like workspace export/import from Phase 10) | F6 | Phase 12.7+ candidate | Deferred |
| F6 Snippets: Snippet tagging for category organization (e.g., "debugging", "monitoring") | F6 | Phase 12.7+ candidate | Deferred |
| F6 Snippets: Template-style variable substitution in snippets (parameterized queries) | F6 | Phase 12.7+ candidate | Deferred |
| F6 Snippets: Sidebar icon must be a "code snippet" / `</>` style icon — not a generic bookmark or star | F6 | HIGH — incorporated into AC-6.1 | INCLUDED in this release |

---

### B1 File Ownership Split (from Principal Architect A2)

Agents must respect file ownership strictly. No two agents may touch the same file.

| Agent | Files Owned | Features | Wave |
|:------|:------------|:--------|:-----|
| Agent A (Store + Types) | `src/store/workspaceStore.ts`, `src/types/index.ts` | F1 audit log state + actions, F6 snippet state + actions + types | Wave 1 — runs first |
| Agent C (SchemaDetail + CSS) | `src/components/SchemaPanel/SchemaDetail.tsx`, `src/index.css`, + tests | F5 AbortController, F7 diff closure, F9 diff auto-exit, F11 CSS var | Wave 1 — fully independent, runs in parallel with Agent A |
| Agent B (TopicDetail) | `src/components/TopicPanel/TopicDetail.tsx`, + tests | F1 display/toggle, F4 sort persistence, F8 health dot, F10 dup warning | Wave 2 — launches after Agent A completes |
| Agent D (SchemaPanel + SnippetsPanel) | `src/components/SchemaPanel/SchemaPanel.tsx`, `src/components/SnippetsPanel/SnippetsPanel.tsx`, `src/App.tsx`, + tests | F2 schema filter, F3 skeleton, F6 SnippetsPanel component + sidebar wire-up | Wave 2 — launches after Agent A completes |

Agent B depends on Agent A (needs Zustand store types for F1 display). Agent D depends on Agent A (needs snippet types for SnippetsPanel). Start Wave 2 only after Agent A signals completion.

---

## PRD SIGN-OFF APPROVED

**Approved by:** TPPM
**Date:** 2026-03-01
**Total story points:** 41
**Release threshold met:** Yes (41 ≥ 25)
**Engineering unblocked:** Phase 12.6 Phase 2 may begin immediately.
**Next TPPM action:** Begin Phase 12.7 PRD during Phase 12.6 Phase 2–4.

**A2 Gate cleared:** 2026-03-01T00:30:00Z — 5/5 reviewers APPROVED.
**PRD updated with A2 feedback:** 2026-03-01 — all 12 engineering notes and 13 UX/IA conditions incorporated.
