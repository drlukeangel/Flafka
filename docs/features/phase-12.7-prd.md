# Phase 12.7 — Bulk Operations, ISR Health, Snippet Sharing & Schema Productivity

**Status**: Phase 1 PRD — PRD SIGN-OFF APPROVED
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-03-01
**Depends On**: Phase 12.6 (Config Audit, Schema Filtering & Query Templates) — in progress
**Blocks**: Phase 12.8 (TBD)
**Sources**:
- Interview Analyst Report (Run-4): `docs/agents/feedback/run-4/INTERVIEW-ANALYST.md`
- Flink Developer Stress Test (Run-5): `docs/agents/feedback/run-5/FLINK-DEVELOPER.md`
- Phase 12.6 A2 Design Review — SR Flink/Kafka Engineer (Run-6): `docs/agents/feedback/run-6/SR-FLINK-KAFKA-ENGINEER.md`
- Phase 12.6 PRD Out-of-Scope section: `docs/features/phase-12.6-prd.md`
- Phase 12.3 Release 3 backlog (ENH-4, ENH-5): `roadmap.md`
- Phase 12.2 Release 2 backlog (ORIG-11, ORIG-13): `roadmap.md`

---

## Problem Statement

Phase 12.6 addresses 11 features totalling 41 story points. While Phase 12.6 engineering is active, the backlog has accumulated a natural next wave of work across four distinct problem areas — all validated by users or domain experts — that did not fit Phase 12.6's scope:

1. **Bulk topic delete is absent**: User B explicitly requested multi-select deletion of test topics. This has been in the Phase 12.3 R3 backlog as ENH-5 (13 pts) since the original stress test. No release has shipped it. Cluster cleanup workflows require it.

2. **The health score is incomplete without ISR**: User C (domain expert, 8+ years Confluent/Flink) confirmed that `ISR < replication_factor` is a critical production health signal that the current health score algorithm does not cover. A topic can appear healthy with `partitions=3, RF=3` while all three ISRs are failing — the current system would show no dot. This was deferred from Phase 12.5 and again from Phase 12.6 because it requires a per-topic ISR API call; Phase 12.7 is the right time to resolve this.

3. **Snippets are personal-only after Phase 12.6**: The SR Flink/Kafka Engineer flagged during the Phase 12.6 A2 design review that team-shared snippets via export/import (matching the workspace export/import pattern from Phase 10) are an obvious natural extension. Teams running the same Flink query patterns should be able to share snippet libraries. This is explicitly a Phase 12.7+ candidate from the Phase 12.6 review.

4. **Schema productivity gaps remain**: Two long-lived backlog items have not shipped: "Generate SELECT from schema fields" (ORIG-11, 5 pts), which lets users build a Flink SELECT statement from an AVRO schema in one click, and the `min.insync.replicas ≤ replication.factor` cross-field validation rule (GAP-5 from the Run-4 interview analysis, 3 pts), which User E confirmed is a Kafka correctness rule missing from the current config edit validation.

5. **Topic metadata display gap**: ENH-4 from Phase 12.3 Release 3 (show topic `created_at` / `last_modified_at` if the API provides it) remains pending and is a 2-point quality-of-life item for troubleshooting.

6. **Config audit cross-topic view is absent**: The SR Flink/Kafka Engineer noted in the Phase 12.6 design review that a "view all changes" cross-topic summary mode would be valuable for compliance audits. Phase 12.6 ships per-topic config history only; cross-topic audit summarization is the natural Phase 12.7 extension.

7. **Panel resize handle missing**: ORIG-13 from Phase 12.2 Release 2 backlog (1 pt) — a resize handle between the sidebar panel and the main editor area has been requested since Phase 12.2. Small but consistently mentioned for UX polish.

**Goals for Phase 12.7:**
1. Ship bulk topic delete (multi-select mode with checkbox UI and batch delete confirmation)
2. Add ISR-based health warning to the health score algorithm (yellow: ISR < RF, red: ISR = 0)
3. Add snippet export/import for team-sharing (matching workspace export/import pattern)
4. Generate SELECT statement from schema fields (AVRO schemas → SQL cell insert)
5. Add cross-field config validation: `min.insync.replicas ≤ replication.factor`
6. Display topic `created_at` / `last_modified_at` in the topic detail header (if API provides it)
7. Add a cross-topic config audit summary panel (all config changes this session, all topics)
8. Add sidebar panel resize handle (drag-to-resize between sidebar and editor)

---

## Story Points Summary

| ID | Feature | Type | Points |
|:---|:---|:---|:---:|
| G1 | Bulk topic delete (multi-select) | Enhancement | 13 |
| G2 | ISR < RF health warning | Enhancement | 5 |
| G3 | Snippet export/import (team-sharing) | Enhancement | 8 |
| G4 | Generate SELECT from schema fields | Enhancement | 5 |
| G5 | min.insync.replicas ≤ replication.factor cross-field validation | Bug/Hardening | 3 |
| G6 | Topic created_at / last_modified_at display | Enhancement | 2 |
| G7 | Cross-topic config audit summary | Enhancement | 5 |
| G8 | Sidebar panel resize handle | Enhancement | 1 |
| **TOTAL** | | | **42** |

---

## Proposed Solution

### Feature G1: Bulk Topic Delete (Multi-Select Mode)

**Files:** `src/components/TopicPanel/TopicList.tsx`, `src/store/workspaceStore.ts`, `src/api/topic-api.ts`, `src/types/index.ts`

**Behavior:**
- A "Select" toggle button appears in the topic list toolbar (alongside the existing search input).
- When active, each topic row shows a checkbox at the left edge. Previously-selected topic detail view closes when selection mode is activated.
- Users can select multiple topics by clicking checkboxes. "Select all" checkbox in the header selects all currently visible (filtered) topics.
- A persistent footer bar appears at the bottom of the topic list when one or more topics are selected, showing: "N topics selected" and a red "Delete selected" button.
- Clicking "Delete selected" opens a single confirmation overlay (not window.confirm) showing the list of topics to be deleted, a warning message ("This action will permanently delete N topics and all their messages. This cannot be undone."), and requires the user to type `delete N topics` (lowercase, exact match) to enable the confirm button.
- On confirm, topics are deleted sequentially (one-by-one, not in parallel) with a progress indicator: "Deleting topic 1 of N…". Sequential deletion reduces risk of rate limiting.
- If any individual delete fails (non-200 response), the operation pauses: shows "3 of 5 topics deleted. Error deleting 'orders-v2': [error message]. Continue or cancel?" with "Continue" and "Cancel" buttons. "Continue" skips the failed topic and proceeds with remaining. "Cancel" stops.
- After completion, the topic list refreshes and selection mode is automatically exited.
- System topics (matching the existing system topic filter pattern) are never shown with a checkbox — they cannot be selected for bulk delete.
- Virtual scrolling is maintained — checkboxes render correctly across the full virtualized list.

**Acceptance Criteria:**

- AC-G1.1: A "Select" toggle button in the topic list toolbar activates multi-select mode.
- AC-G1.2: In multi-select mode, each non-system topic row shows a checkbox.
- AC-G1.3: A header-row "Select all" checkbox selects all visible (name-filtered) non-system topics.
- AC-G1.4: Selected topics are visually highlighted (row background color change via CSS custom property — no hardcoded hex).
- AC-G1.5: When at least one topic is selected, a footer bar appears showing "N topics selected" and a "Delete selected" button.
- AC-G1.6: Clicking "Delete selected" opens an inline confirmation overlay (no window.confirm).
- AC-G1.7: Confirmation overlay shows the list of topics to be deleted (scrollable if > 10) and requires typing `delete N topics` to enable the confirm button.
- AC-G1.8: Typing the wrong phrase keeps the confirm button disabled.
- AC-G1.9: On confirm, topics are deleted one by one (sequential, not parallel) with progress shown.
- AC-G1.10: If an individual delete fails mid-sequence, a "Continue or cancel?" prompt appears.
- AC-G1.11: After all deletes complete (or after cancel), topic list refreshes and multi-select mode exits automatically.
- AC-G1.12: System topics (matching SYSTEM_TOPIC_PATTERN) have no checkbox and cannot be selected.
- AC-G1.13: Bulk delete is compatible with virtual scrolling — selected-state persists correctly for topics scrolled out of view.
- AC-G1.14: "Select" toggle button has `aria-pressed` reflecting the mode state.
- AC-G1.15: Checkboxes are keyboard accessible (Tab + Space to toggle).
- AC-G1.16: All colors use CSS custom properties (no hardcoded hex).
- AC-G1.17: Bulk delete confirmation overlay does not use window.confirm — uses the same inline overlay pattern as DeleteConfirm.
- AC-G1.18: Selecting topics while a name search filter is active selects only the filtered subset.
- AC-G1.19: Exiting multi-select mode (clicking "Select" toggle again) clears all selections.

---

### Feature G2: ISR-Based Health Warning in Topic Health Score

**Files:** `src/components/TopicPanel/TopicList.tsx`, `src/components/TopicPanel/TopicDetail.tsx`, `src/api/topic-api.ts`, `src/types/index.ts`

**Behavior:**
- The Kafka REST Proxy v3 API provides ISR count per partition via the topic partitions API endpoint: `GET /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/partitions`.
- Each partition response includes `leader`, `replicas` (list), and `isr` (list of in-sync replicas). ISR count = `isr.length`.
- The minimum ISR count across all partitions is used as the health signal: `minISR = min(partition.isr.length for each partition)`.
- Health rule additions:
  - If `minISR < replication_factor`: **yellow warning** — "X of Y replicas in-sync (ISR degraded)"
  - If `minISR = 0`: **red critical** — "No in-sync replicas — data loss risk if leader fails"
  - If `minISR < min.insync.replicas` (if min.insync.replicas is known from config): **yellow warning** — "ISR below min.insync.replicas threshold"
- ISR data is fetched lazily — only when a topic is selected (TopicDetail view). Topic list health scores use the existing partition/RF data (no per-topic API call on list render — that would be O(N) requests for N topics in the list).
- In TopicDetail: ISR data is fetched alongside the existing config fetch. ISR state is stored separately from configs.
- In TopicList: ISR-based warnings are not shown (too expensive to fetch ISR for all topics). TopicList continues to use partition count and RF only.
- If the ISR API call fails (network error, 404, 403): ISR-based warnings are silently omitted — the health score falls back to partition/RF only. No error toast for ISR fetch failure (it is non-critical metadata).
- ISR fetch is also subject to AbortController (same pattern as config fetch in Phase 12.5 F8 / Phase 12.6 F5).

**Acceptance Criteria:**

- AC-G2.1: `topic-api.ts` exports a function `getTopicPartitions(topicName, signal?)` that fetches partition detail including ISR data.
- AC-G2.2: `TopicDetail.tsx` fetches ISR data when a topic is selected, using AbortController.
- AC-G2.3: `TopicDetail.tsx` displays an ISR-based yellow warning dot when `minISR < replication_factor`.
- AC-G2.4: `TopicDetail.tsx` displays a red critical dot when `minISR = 0`.
- AC-G2.5: ISR warning message in tooltip: "X of Y replicas in-sync (ISR degraded)" (where X = minISR, Y = RF).
- AC-G2.6: If ISR API returns an error, ISR warnings are silently omitted — no error toast.
- AC-G2.7: ISR fetch uses AbortController — rapid topic switches cancel the previous ISR request.
- AC-G2.8: `TopicList.tsx` health scores are unchanged — no ISR fetch occurs during list rendering.
- AC-G2.9: ISR-based warnings combine with existing partition/RF warnings in the tooltip (both shown if applicable).
- AC-G2.10: All ISR health colors use CSS custom properties (no hardcoded hex).
- AC-G2.11: The new `getTopicPartitions` API function is covered by unit tests with signal forwarding verified.

---

### Feature G3: Snippet Export/Import (Team Sharing)

**Files:** `src/components/SnippetsPanel/SnippetsPanel.tsx`, `src/utils/snippet-export.ts` (new), `src/store/workspaceStore.ts`

**Behavior:**
- The Snippets panel (shipped in Phase 12.6) gains an "Export" button in its toolbar (download icon) and an "Import" button (upload icon).
- **Export:** Clicking "Export" downloads a JSON file named `flink-snippets-YYYY-MM-DD.json` containing all current snippets. File format: `{ "version": 1, "snippets": [{ "name": string, "sql": string, "createdAt": string }] }`. Export does NOT include the `id` field (IDs are regenerated on import to avoid conflicts).
- **Import:** Clicking "Import" opens a file picker (`<input type="file" accept=".json">`) — no drag-and-drop required.
  - The imported file is validated: must be valid JSON, must have `version: 1`, must have a `snippets` array.
  - Each snippet in the import is validated: must have `name` (non-empty string) and `sql` (string).
  - Invalid items are skipped with a count shown in a toast: "2 invalid snippets skipped."
  - Valid snippets are merged: snippets with identical names are NOT replaced by default — user is shown a confirmation: "3 snippets with duplicate names were found. Replace existing? [Replace] [Keep both] [Skip duplicates]".
    - "Replace" overwrites the existing snippet with the imported one (by name match).
    - "Keep both" imports the new snippet with the same name (two snippets can share a name — unique by ID).
    - "Skip duplicates" skips any snippet whose name already exists in the current snippet library.
  - On import complete: toast shows "N snippets imported successfully."
  - Import respects the 100-snippet cap: if importing would exceed 100, the import is truncated at the cap and user is warned: "Import truncated — snippet limit reached. N snippets added."
- The utility logic (validation, merge) lives in `src/utils/snippet-export.ts`, matching the `src/utils/workspace-export.ts` pattern from Phase 10.
- Export requires explicit user confirmation before download (confirm dialog pattern — not automatic download) to satisfy security review.

**Acceptance Criteria:**

- AC-G3.1: Snippets panel toolbar includes "Export" and "Import" buttons.
- AC-G3.2: Clicking "Export" prompts for confirmation before downloading the snippets JSON file.
- AC-G3.3: Exported file is named `flink-snippets-YYYY-MM-DD.json`.
- AC-G3.4: Exported JSON format: `{ "version": 1, "snippets": [{ "name", "sql", "createdAt" }] }` — no `id` field.
- AC-G3.5: Clicking "Import" opens a native file picker restricted to `.json` files.
- AC-G3.6: Imported file is validated — invalid JSON shows error toast: "Import failed — invalid file format."
- AC-G3.7: Snippets missing `name` or `sql` fields are skipped; count reported in toast.
- AC-G3.8: Duplicate-name conflict resolution shows a confirmation with three options: Replace, Keep both, Skip duplicates.
- AC-G3.9: Import respects the 100-snippet cap; excess snippets are truncated with a warning toast.
- AC-G3.10: Successful import shows toast: "N snippets imported successfully."
- AC-G3.11: Imported snippets receive new UUIDs generated at import time (crypto.randomUUID()).
- AC-G3.12: Import utility logic lives in `src/utils/snippet-export.ts`.
- AC-G3.13: Export and Import buttons have appropriate `aria-label` attributes.
- AC-G3.14: All colors use CSS custom properties (no hardcoded hex).
- AC-G3.15: Export and Import actions work correctly in both light and dark mode.
- AC-G3.16: Empty snippet library exports `{ "version": 1, "snippets": [] }` — a valid, importable file.

---

### Feature G4: Generate SELECT Statement from Schema Fields

**Files:** `src/components/SchemaPanel/SchemaDetail.tsx`

**Behavior:**
- When viewing a schema subject's detail (SchemaDetail), and the schema type is AVRO (or JSON with a parseable top-level object shape), a "Generate SELECT" button appears in the schema detail toolbar.
- Clicking "Generate SELECT" generates a Flink SQL `SELECT` statement using the schema's top-level field names as columns:
  ```sql
  SELECT
    field1,
    field2,
    field3
  FROM `<subject-name-without-value-suffix>`
  LIMIT 100;
  ```
  - The topic name used in `FROM` is derived from the subject name by stripping the `-value` or `-key` suffix (if present). The name is backtick-quoted using the existing `quoteIdentifierIfNeeded` utility.
  - If the subject name does not follow the `{topic}-value` or `{topic}-key` pattern, the full subject name is used as-is (backtick-quoted).
  - Nested AVRO fields (records within records) are NOT expanded — only the top-level field names are listed. This keeps the generated SQL simple and runnable.
  - Union types (AVRO `["null", "string"]`) use the non-null type name for the column (column is listed as `field_name` — no type cast in the generated SQL).
- The generated SELECT is inserted into the currently focused editor cell (via `editorRegistry`), exactly like the "Insert topic name" button in Phase 12.3 R3.
- If no editor cell is focused, clicking "Generate SELECT" shows a toast: "No editor focused — click a cell first, then generate."
- The button only appears for AVRO schemas (type badge = "AVRO") and JSON schemas where the top level is an object with named fields. For PROTOBUF schemas, the button is hidden (PROTOBUF field extraction from schema text requires proto3 parsing — out of scope for this phase).
- Tooltip: "Generate SELECT from schema fields (inserts into focused editor)".

**Acceptance Criteria:**

- AC-G4.1: "Generate SELECT" button appears in the schema detail toolbar for AVRO schemas.
- AC-G4.2: "Generate SELECT" button is hidden for PROTOBUF schemas.
- AC-G4.3: Clicking "Generate SELECT" generates a `SELECT field1, field2, ... FROM \`topic-name\` LIMIT 100;` statement.
- AC-G4.4: Topic name used in `FROM` strips `-value` or `-key` suffix from the subject name and backtick-quotes the result.
- AC-G4.5: If no editor cell is focused, a toast is shown: "No editor focused — click a cell first, then generate."
- AC-G4.6: Only top-level AVRO fields are listed — nested record fields are not expanded.
- AC-G4.7: The generated SQL is inserted at the cursor position in the focused editor (using editorRegistry), not replacing the entire cell content.
- AC-G4.8: "Generate SELECT" button has `aria-label="Generate SELECT statement from schema fields"`.
- AC-G4.9: Button renders in both light and dark mode using CSS custom properties (no hardcoded hex).
- AC-G4.10: For JSON schemas with a top-level object shape: button appears and generates SELECT from field names.

---

### Feature G5: min.insync.replicas ≤ replication.factor Cross-Field Validation

**Files:** `src/components/TopicPanel/TopicDetail.tsx`

**Behavior:**
- When editing a config value in the config table, if the edited key is either `min.insync.replicas` or `replication.factor`, validate the cross-field constraint: `min.insync.replicas must be ≤ replication.factor`.
- The current value of the OTHER field is read from the config table (already loaded in state — no API call required).
- Cross-field validation runs AFTER the existing per-field validation (integer check, min value check).
- If the constraint is violated, the error message shown below the input is: "min.insync.replicas ({mir_value}) must be ≤ replication.factor ({rf_value})".
- The Save button remains disabled while this error is present.
- This cross-field check applies bidirectionally:
  - Editing `min.insync.replicas` to a value > current `replication.factor`: error shown.
  - Editing `replication.factor` to a value < current `min.insync.replicas`: error shown.
- If either value is not currently available in the config table state (e.g., configs not yet loaded), the cross-field validation is skipped — single-field validation only.

**Acceptance Criteria:**

- AC-G5.1: Editing `min.insync.replicas` to a value greater than the current `replication.factor` value shows a validation error.
- AC-G5.2: Editing `replication.factor` to a value less than the current `min.insync.replicas` value shows a validation error.
- AC-G5.3: Error message format: "min.insync.replicas ({mir}) must be ≤ replication.factor ({rf})".
- AC-G5.4: Save button is disabled while the cross-field validation error is present.
- AC-G5.5: Setting `min.insync.replicas` equal to `replication.factor` is valid (no error).
- AC-G5.6: If the cross-field partner value is unavailable in state, cross-field validation is skipped silently.
- AC-G5.7: Cross-field validation runs after (not instead of) the existing per-field integer and min-value checks.
- AC-G5.8: Clearing the edited value removes the cross-field error (validation re-runs on each change).

---

### Feature G6: Topic Created At / Last Modified At Display

**Files:** `src/components/TopicPanel/TopicDetail.tsx`, `src/api/topic-api.ts`

**Behavior:**
- The Kafka REST Proxy v3 API may return `created_at` and `last_modified_at` timestamps in the topic detail response (ISO 8601 strings or epoch ms — exact field name/format varies by Confluent Cloud version).
- If these fields are present in the topic response, display them in the TopicDetail header below the topic name, in muted text: "Created Jan 15, 2026 · Modified Feb 28, 2026" (human-readable date format, not ISO 8601 string).
- If the fields are absent (null, undefined, or missing from the API response), this section is hidden entirely (no "N/A" or empty label).
- Date formatting: `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`.
- No additional API call is required — these fields are expected to be present in the existing topic detail response payload (the same endpoint already used to fetch partition count and replication factor).
- `TopicDetail` type definition is updated to include optional `created_at?: string` and `last_modified_at?: string` fields.

**Acceptance Criteria:**

- AC-G6.1: If `created_at` is present in the topic response, it is displayed in the TopicDetail header in human-readable format.
- AC-G6.2: If `last_modified_at` is present in the topic response, it is displayed alongside `created_at`.
- AC-G6.3: If either timestamp is absent (null/undefined), that timestamp is not shown. If both are absent, the entire metadata line is hidden.
- AC-G6.4: Date format: "Jan 15, 2026" (locale-aware short format).
- AC-G6.5: Timestamp text uses muted color (CSS custom property — no hardcoded hex).
- AC-G6.6: Renders correctly in dark mode and light mode.
- AC-G6.7: Type definition for topic detail payload includes `created_at?: string` and `last_modified_at?: string` as optional fields.
- AC-G6.8: No additional API call is made — data comes from the existing topic detail fetch.

---

### Feature G7: Cross-Topic Config Audit Summary

**Files:** `src/components/TopicPanel/TopicList.tsx` or `src/components/TopicPanel/TopicAuditSummary.tsx` (new), `src/store/workspaceStore.ts`

**Behavior:**
- The SR Flink/Kafka Engineer noted during the Phase 12.6 A2 review that a "view all changes" cross-topic audit mode is valuable for compliance audit workflows. Phase 12.6 ships per-topic Config History (collapsed section in TopicDetail). Phase 12.7 adds a cross-topic summary view.
- A new "Audit" icon button appears in the topic panel toolbar (the same toolbar row as the "Select" toggle and search input).
- Clicking "Audit" opens a slide-in panel (or replaces the topic list with an audit view) showing ALL config changes made this session, across ALL topics, sorted by timestamp descending (most recent first).
- Each row in the audit view shows: `HH:MM:SS   topic-name   config-key   old-value → new-value`
- The audit view has a filter input (filter by topic name or config key — client-side, same AND logic as other search inputs).
- The audit view has a "Clear history" button that clears the entire audit log after a confirmation ("Clear all config history for this session? This cannot be undone.").
- Clicking a topic name in the audit view navigates to that topic's detail (same as clicking a topic in the list).
- If no config changes have been made this session, the audit view shows: "No config changes this session."
- The audit view reads from the same Zustand store audit log state introduced in Phase 12.6 Feature 1 — no new data source required.
- The audit view is accessible from any state of the topic panel (even when a topic detail is open).

**Acceptance Criteria:**

- AC-G7.1: An "Audit" icon button appears in the topic list toolbar.
- AC-G7.2: Clicking "Audit" opens the cross-topic audit view.
- AC-G7.3: The audit view shows all config changes from this session, across all topics, sorted by timestamp descending.
- AC-G7.4: Each row format: `HH:MM:SS   topic-name   config-key   old-value → new-value` (monospace font for values).
- AC-G7.5: The audit view has a filter input that filters by topic name or config key (case-insensitive, AND logic).
- AC-G7.6: If no changes have been made this session, the view shows "No config changes this session."
- AC-G7.7: "Clear history" button clears the audit log after inline confirmation (not window.confirm).
- AC-G7.8: Clicking a topic name in the audit view navigates to that topic's detail.
- AC-G7.9: "Audit" icon button has `aria-label="View all config changes this session"`.
- AC-G7.10: "Audit" icon button has `aria-pressed` reflecting whether the audit view is open.
- AC-G7.11: All colors use CSS custom properties (no hardcoded hex).
- AC-G7.12: Renders correctly in dark mode and light mode.
- AC-G7.13: Filter input has `aria-label="Filter audit log"`.

---

### Feature G8: Sidebar Panel Resize Handle

**Files:** `src/App.tsx`, `src/index.css`

**Behavior:**
- A drag-to-resize handle is rendered at the right edge of the left sidebar panel (between the sidebar and the main editor area).
- The handle is a thin vertical strip (4–6px wide) that becomes a resize cursor (`col-resize`) on hover.
- Dragging the handle changes the sidebar width. Minimum sidebar width: 200px. Maximum sidebar width: 600px. Default sidebar width: the current fixed width (unchanged from today's layout).
- Sidebar width is stored in `localStorage` under key `flink-ui.sidebarWidth` (number, pixels). Restored on page load.
- Double-clicking the handle resets the sidebar to the default width.
- The resize operation is smooth — uses `mousemove` during drag, `mouseup` to end. No layout thrashing.
- The resize handle is not keyboard accessible (resize-by-drag is a non-essential enhancement; existing fixed layout is the keyboard baseline).

**Acceptance Criteria:**

- AC-G8.1: A resize handle is visible between the sidebar panel and the main editor area.
- AC-G8.2: Dragging the handle left or right resizes the sidebar.
- AC-G8.3: Minimum sidebar width is 200px (cannot drag below).
- AC-G8.4: Maximum sidebar width is 600px (cannot drag above).
- AC-G8.5: Sidebar width is persisted to localStorage under key `flink-ui.sidebarWidth`.
- AC-G8.6: On page load, the sidebar restores its last-set width from localStorage.
- AC-G8.7: Double-clicking the handle resets the sidebar to the default width.
- AC-G8.8: The handle shows `cursor: col-resize` on hover.
- AC-G8.9: All colors/styles for the handle use CSS custom properties (no hardcoded hex).

---

## Acceptance Tests

### AT-G1: Bulk Topic Delete

```
Scenario: Delete multiple topics via multi-select
  Given: Topic list shows 10 non-system topics
  When: User clicks "Select" toggle
  Then: Checkboxes appear on all non-system topic rows
  When: User checks 3 topics: "orders", "payments", "refunds"
  Then: Footer shows "3 topics selected" and a red "Delete selected" button
  When: User clicks "Delete selected"
  Then: Confirmation overlay appears with the 3 topic names listed
  And: Confirm button is disabled until user types "delete 3 topics"
  When: User types "delete 3 topics"
  Then: Confirm button becomes enabled
  When: User clicks "Delete 3 topics"
  Then: Progress shown: "Deleting topic 1 of 3..."
  And: After completion, multi-select mode exits, topic list refreshes
  And: "orders", "payments", "refunds" are no longer in the list
```

```
Scenario: Mid-sequence delete failure
  Given: 3 topics selected for bulk delete, user confirmed
  When: Delete of "payments" fails with 403
  Then: Prompt appears: "2 of 3 topics deleted. Error deleting 'payments': 403 Forbidden. Continue or cancel?"
  When: User clicks "Continue"
  Then: Remaining topic "refunds" is deleted
  When: User clicks "Cancel"
  Then: Delete stops, topic list refreshes showing any remaining topics
```

```
Scenario: System topics cannot be selected
  Given: Topic list includes 2 system topics (__confluent-*) and 5 user topics
  When: User activates multi-select mode
  Then: System topics show no checkbox
  And: "Select all" selects only the 5 user topics
```

### AT-G2: ISR Health Warning

```
Scenario: ISR degraded warning in TopicDetail
  Given: Topic "orders" has RF=3 and current ISR count = 2 (one replica out of sync)
  When: User opens TopicDetail for "orders"
  Then: After ISR fetch completes, health dot shows yellow
  And: Tooltip includes "2 of 3 replicas in-sync (ISR degraded)"
```

```
Scenario: ISR API failure falls back gracefully
  Given: ISR API returns 403 for topic "payments"
  When: User opens TopicDetail for "payments"
  Then: No error toast is shown
  And: Health score falls back to partition/RF only (no ISR warning shown)
```

```
Scenario: TopicList does not fetch ISR
  Given: Topic list shows 50 topics
  When: User views the topic list
  Then: No API calls to the partitions endpoint are made
  And: Health dots in the topic list reflect partition/RF only (unchanged from Phase 12.6)
```

### AT-G3: Snippet Export/Import

```
Scenario: Export all snippets
  Given: User has 5 snippets saved
  When: User clicks "Export" in the Snippets panel toolbar
  Then: Confirmation prompt asks "Download your snippet library?"
  When: User confirms
  Then: A JSON file named "flink-snippets-2026-03-01.json" is downloaded
  And: File contains version:1 and all 5 snippets (without id fields)
```

```
Scenario: Import snippets with duplicate resolution
  Given: User has 2 snippets: "orders sample" and "payments count"
  And: Import file contains 3 snippets: "orders sample" (same name, different SQL), "refunds check", "weekly report"
  When: User clicks "Import" and selects the file
  Then: Duplicate name prompt appears: "1 snippet with duplicate name: 'orders sample'. Replace existing? [Replace] [Keep both] [Skip duplicates]"
  When: User clicks "Keep both"
  Then: Toast: "3 snippets imported successfully" (both "orders sample" versions kept)
  And: Snippet list now shows 5 snippets
```

```
Scenario: Import invalid file
  Given: User selects a JSON file missing the "snippets" array
  When: Import processes the file
  Then: Error toast: "Import failed — invalid file format."
  And: No snippets are added
```

### AT-G4: Generate SELECT from Schema

```
Scenario: Generate SELECT from AVRO schema
  Given: Subject "orders-value" is open in SchemaDetail
  And: Schema type is AVRO with top-level fields: id (long), customer_id (string), amount (double)
  And: An EditorCell is focused
  When: User clicks "Generate SELECT"
  Then: The following SQL is inserted at the cursor in the focused editor:
    SELECT
      id,
      customer_id,
      amount
    FROM `orders`
    LIMIT 100;
```

```
Scenario: Generate SELECT when no editor is focused
  Given: Subject "orders-value" is open in SchemaDetail
  And: No EditorCell is focused
  When: User clicks "Generate SELECT"
  Then: Toast: "No editor focused — click a cell first, then generate."
```

```
Scenario: Generate SELECT button hidden for PROTOBUF
  Given: Subject "events-value" has schema type PROTOBUF
  When: User views SchemaDetail for "events-value"
  Then: "Generate SELECT" button is not present in the toolbar
```

### AT-G5: Cross-Field Config Validation

```
Scenario: min.insync.replicas > replication.factor
  Given: Topic "orders" has replication.factor = 2 (showing in config table)
  When: User edits min.insync.replicas and sets value to 3
  Then: Validation error appears: "min.insync.replicas (3) must be ≤ replication.factor (2)"
  And: Save button is disabled
```

```
Scenario: replication.factor < min.insync.replicas
  Given: Topic "orders" has min.insync.replicas = 2 (showing in config table)
  When: User edits replication.factor and sets value to 1
  Then: Validation error appears: "min.insync.replicas (2) must be ≤ replication.factor (1)"
  And: Save button is disabled
```

```
Scenario: Equal values are valid
  Given: Topic "orders" has replication.factor = 3
  When: User sets min.insync.replicas to 3
  Then: No cross-field validation error
  And: Save button is enabled (assuming per-field validation passes)
```

### AT-G6: Topic Timestamps

```
Scenario: Topic with created_at and last_modified_at
  Given: Topic "orders" API response includes created_at: "2026-01-15T09:30:00Z" and last_modified_at: "2026-02-28T14:00:00Z"
  When: User opens TopicDetail for "orders"
  Then: Below the topic name: "Created Jan 15, 2026 · Modified Feb 28, 2026" in muted text
```

```
Scenario: Topic without timestamps
  Given: Topic "payments" API response does not include created_at or last_modified_at
  When: User opens TopicDetail for "payments"
  Then: No timestamp line is shown in the header
```

### AT-G7: Cross-Topic Audit Summary

```
Scenario: View audit log with changes from multiple topics
  Given: User has edited retention.ms on "orders" and min.insync.replicas on "payments" this session
  When: User clicks the "Audit" button in the topic toolbar
  Then: Audit view opens showing both entries, most recent first
  And: Each row shows: HH:MM:SS   topic-name   config-key   old-value → new-value
```

```
Scenario: Filter audit by topic name
  Given: Audit view is open with 5 entries across 3 topics
  When: User types "orders" in the filter input
  Then: Only entries for topic "orders" are shown
```

```
Scenario: Clear audit history
  Given: Audit view shows 10 entries
  When: User clicks "Clear history"
  Then: Confirmation prompt: "Clear all config history for this session?"
  When: User confirms
  Then: Audit view shows "No config changes this session."
  And: Per-topic Config History section in TopicDetail also shows "No config changes this session."
```

### AT-G8: Sidebar Resize Handle

```
Scenario: Drag sidebar to wider width
  Given: Sidebar is at default width
  When: User drags the resize handle 100px to the right
  Then: Sidebar is 100px wider
  And: Main editor area shrinks correspondingly
  When: User reloads the page
  Then: Sidebar restores to the wider width (from localStorage)
```

```
Scenario: Respect min/max width constraints
  Given: Sidebar is at 250px width
  When: User drags the handle far left (past the 200px min)
  Then: Sidebar stops at 200px minimum
  When: User drags the handle far right (past the 600px max)
  Then: Sidebar stops at 600px maximum
```

---

## Edge Cases

### Feature G1 (Bulk Delete) Edge Cases

| Case | Handling |
|:---|:---|
| User scrolls virtualized list mid-selection | Selected topics remain selected (selection state is by topic ID, not DOM position) |
| User applies name filter while in select mode | Only filtered topics shown; "Select all" selects only filtered subset; selections outside filter are preserved |
| All selected topics are successfully deleted but one no longer exists (409 or 404 during delete) | Treat 404 as "already deleted" — count as success, don't show error for that topic |
| User cancels mid-sequence batch delete | Remaining (unprocessed) topics are not deleted; already-deleted topics remain deleted; list refreshes |
| Confirmation typed string wrong case ("Delete 3 Topics") | Does not match — confirm button stays disabled. Match is exact lowercase: "delete N topics" |
| Single topic selected for bulk delete | Works as normal; confirmation asks to type "delete 1 topic" (not "topics") |
| Topic list is empty when multi-select is activated | "Select" toggle still works; no checkboxes shown; "Select all" is disabled or absent |

### Feature G2 (ISR Health) Edge Cases

| Case | Handling |
|:---|:---|
| Topic has 0 partitions (degenerate state) | ISR fetch skipped (no partitions to query ISR for); existing red dot for 0-partitions shown |
| ISR API returns empty array for a partition | ISR count = 0 for that partition → red critical if minISR = 0 |
| ISR count equals replication factor | No ISR warning (healthy) — dot still hidden for fully healthy topics |
| ISR data available but min.insync.replicas config not loaded | Show ISR/RF warning without the min.insync.replicas comparison; cross-field comparison only when both values are known |
| Topic switches while ISR fetch in flight | AbortController cancels previous ISR fetch; only new topic's ISR is applied |

### Feature G3 (Snippet Export/Import) Edge Cases

| Case | Handling |
|:---|:---|
| Export with 0 snippets | Exports `{ "version": 1, "snippets": [] }` — valid, importable, empty file |
| Import file larger than 10MB | Reject before parsing: show error toast "Import file too large (max 10MB)" |
| Import file with version other than 1 | Reject: "Unsupported snippet file version. Please export from a compatible version." |
| Import file with 150 snippets when user already has 80 | Import 20 snippets (to reach cap), warn: "Import truncated — only 20 of 150 snippets added (cap reached)" |
| Import cancelled by user (closes file picker without selecting) | No action taken (file input cancel event is a no-op) |

### Feature G4 (Generate SELECT) Edge Cases

| Case | Handling |
|:---|:---|
| Subject name does not end in "-value" or "-key" | Use full subject name as FROM table (backtick-quoted) |
| AVRO schema has 0 top-level fields (empty record) | Generate `SELECT * FROM \`topic\` LIMIT 100;` (no column list — fallback to *) |
| AVRO schema field name contains special characters | Column name is NOT backtick-quoted in the SELECT list (column names in SELECT don't require quoting in Flink SQL unless they're reserved words — use as-is; reserved word handling is out of scope for this phase) |
| Subject version is not the latest (user viewing an old version) | SELECT is generated from the currently viewed version's fields — not forced to latest |
| JSON schema has top-level properties but no `type: "object"` | Button is hidden (only show for AVRO and confirmed-object JSON schemas) |

### Feature G5 (Cross-Field Validation) Edge Cases

| Case | Handling |
|:---|:---|
| min.insync.replicas config is read-only for this topic | Cross-field validation still runs for the editable field — error shows if constraint violated |
| replication.factor value in config table is a string (not yet parsed) | Parse as integer before comparison; if parse fails, skip cross-field check silently |
| Both fields edited in the same session (one after the other) | Each save updates the config table state; next edit's cross-field check uses the updated value |

---

## Files Affected

| Feature | Files Modified | Files Created |
|:---|:---|:---|
| G1 (Bulk Delete) | `TopicList.tsx`, `workspaceStore.ts`, `topic-api.ts`, `types/index.ts` | None |
| G2 (ISR Health) | `TopicList.tsx`, `TopicDetail.tsx`, `topic-api.ts`, `types/index.ts` | None |
| G3 (Snippet Export/Import) | `SnippetsPanel.tsx`, `workspaceStore.ts` | `src/utils/snippet-export.ts` |
| G4 (Generate SELECT) | `SchemaDetail.tsx` | None |
| G5 (Cross-Field Validation) | `TopicDetail.tsx` | None |
| G6 (Topic Timestamps) | `TopicDetail.tsx`, `topic-api.ts`, `types/index.ts` | None |
| G7 (Audit Summary) | `workspaceStore.ts`, `App.tsx` (sidebar wiring) | `src/components/TopicPanel/TopicAuditSummary.tsx` |
| G8 (Resize Handle) | `App.tsx`, `src/index.css` | None |

---

## Test Plan (Tier 1 — Required by QA Gate)

All test files must have markers in the format `[@phase-12.7-*]`.

| Feature | Test File | Marker | Coverage Required |
|:---|:---|:---|:---|
| G1 Bulk Delete | `src/__tests__/components/Phase127BulkDelete.test.tsx` | `[@phase-12.7-bulk-delete]` | Multi-select activation, checkbox render, select-all, footer bar, confirmation dialog, typed confirmation, sequential delete, partial failure (continue/cancel), system topic exclusion, virtual scroll selection persistence |
| G2 ISR Health | `src/__tests__/components/Phase127ISRHealth.test.tsx` | `[@phase-12.7-isr-health]` | getTopicPartitions API fn, signal forwarding, ISR < RF yellow dot, ISR = 0 red dot, API failure fallback, TopicList unchanged, AbortController on topic switch |
| G3 Snippet Export/Import | `src/__tests__/components/Phase127SnippetExportImport.test.tsx` | `[@phase-12.7-snippets-export]` | Export format, import validation, duplicate resolution (replace/keep-both/skip), cap enforcement, invalid file error, 0-snippet export |
| G4 Generate SELECT | `src/__tests__/components/Phase127GenerateSelect.test.tsx` | `[@phase-12.7-generate-select]` | AVRO SELECT generation, -value suffix stripping, backtick quoting, insert into focused editor, no-editor toast, PROTOBUF button hidden, 0-field fallback to SELECT * |
| G5 Cross-Field Validation | `src/__tests__/components/Phase127CrossFieldValidation.test.tsx` | `[@phase-12.7-cross-field-validation]` | mir > RF error, RF < mir error, equal values valid, missing partner value skip, save disabled on error |
| G6 Topic Timestamps | `src/__tests__/components/Phase127TopicTimestamps.test.tsx` | `[@phase-12.7-topic-timestamps]` | Timestamps present → display, timestamps absent → hidden, date format locale |
| G7 Audit Summary | `src/__tests__/components/Phase127AuditSummary.test.tsx` | `[@phase-12.7-audit-summary]` | Cross-topic audit display, sort order (newest first), filter by topic name, filter by config key, clear history confirmation, empty state, topic name navigation |
| G8 Resize Handle | `src/__tests__/components/Phase127ResizeHandle.test.tsx` | `[@phase-12.7-resize-handle]` | Handle render, drag changes width, min/max constraints enforced, localStorage persistence, double-click reset |

### Tier 2 Tests (Async — Track C, Post-Ship)

| Feature | Test Coverage Target |
|:---|:---|
| G1 Bulk Delete | Edge cases: all-fail batch, 0-selection state, filter active during select-all |
| G2 ISR Health | Edge cases: 0-partition ISR skip, ISR equals RF (no warning), concurrent ISR + config fetch abort |
| G3 Snippet Export/Import | Edge cases: 10MB file rejection, version mismatch, empty import file |
| G4 Generate SELECT | Edge cases: JSON schema SELECT gen, subject without -value suffix, 0-field AVRO fallback |
| G5 Cross-Field Validation | Edge cases: read-only field cross-check, string value parse failure |
| G7 Audit Summary | Edge cases: 200+ entries display, scroll performance, real-time update as new edits arrive |

---

## Implementation Notes (Non-Binding Guidance for Engineering)

These notes are for engineering's benefit and do not constitute PRD requirements. Engineering may choose different approaches as long as all acceptance criteria are met.

**G1 Bulk Delete — File Ownership Hint:**
G1 touches 4 files. `topic-api.ts` only needs a `deleteTopic(topicName)` function (likely already present). `types/index.ts` needs multi-select state types. `workspaceStore.ts` manages selected topics set and multi-select mode. `TopicList.tsx` holds the UI. Consider splitting across two agents with `types/index.ts` + `workspaceStore.ts` in one agent and `TopicList.tsx` + `topic-api.ts` in another (after store types are defined).

**G2 ISR Health — API Research:**
Before B1 starts, engineering should verify the Kafka REST v3 ISR response structure: `GET /kafka/v3/clusters/{id}/topics/{name}/partitions`. If the API is unavailable (403, 404) for some topics, G2's fallback behavior (silent skip) must be robust. A2 design reviewers should confirm the API endpoint shape.

**G3 Snippet Export/Import — Pattern Reference:**
`src/utils/workspace-export.ts` is the reference implementation for the validation + merge utility pattern. `snippet-export.ts` should follow the same structure: pure functions, no imports from React or Zustand (testable standalone).

**G7 Audit Summary — Dependency:**
G7 reads from the audit log state introduced in Phase 12.6 Feature 1. G7 does not add new state — it adds a new view over existing state. Engineering must verify that the Phase 12.6 audit log store actions are accessible before implementing G7.

**G8 Resize Handle — CSS Approach:**
A CSS variable `--sidebar-width` managed by App.tsx `useState` + inline style is the simplest approach. CSS Grid or Flexbox with dynamic width variable avoids layout recalculation thrashing during drag.

---

## Release 1 Scope

**Total story points:** 42
**Threshold met:** Yes (42 ≥ 25)
**All 8 items in Release 1.** Story point distribution:

| Priority | Item | Points | Rationale |
|:---|:---|:---:|:---|
| 1 | G1: Bulk topic delete | 13 | Most-requested missing feature (User B, Phase 12.3 R3 backlog since inception) |
| 2 | G3: Snippet export/import | 8 | Natural Phase 12.6 extension, SR Flink/Kafka Engineer validated, team sharing use case |
| 3 | G2: ISR health warning | 5 | Domain expert validated (User C), correctness gap in health score |
| 4 | G7: Cross-topic audit summary | 5 | Compliance use case, SR Flink/Kafka Engineer Phase 12.6 review, extends Phase 12.6 F1 |
| 5 | G4: Generate SELECT from schema | 5 | Developer productivity, longstanding backlog item (ORIG-11), Phase 12.6 snippet context |
| 6 | G5: Cross-field validation | 3 | Correctness rule (User E), GAP-5 from Run-4 interview, small effort |
| 7 | G6: Topic timestamps | 2 | Quality of life, minimal effort (API field display only) |
| 8 | G8: Resize handle | 1 | Long-requested polish item (ORIG-13), completes sidebar UX |

---

## Out of Scope (Phase 12.8+ or Phase 13)

| Item | Points | Reason for Deferral |
|:---|:---|:---|
| Topic lag monitoring (consumer offset lag) | 8–16 | Requires consumer group API integration not yet in codebase |
| Schema evolution validation (warn before breaking change) | 8–16 | Requires Flink job topology knowledge; Phase 13 candidate |
| Snippet tagging (categorize snippets by tag) | 3–5 | Nice-to-have; 100-snippet limit + search is sufficient for Phase 12.7 scope |
| Insert snippet with variable substitution (parameterized queries) | 8–13 | Complex templating engine; Phase 13 candidate |
| Cluster topology visualization | TBD | Strategic; Phase 13+ |
| Flink job → topic lineage graph | TBD | Strategic; Phase 13+ |
| Integration with Confluent Cloud governance APIs | TBD | API dependency; Phase 13+ |

---

## PRD SIGN-OFF APPROVED

**Approved by:** TPPM
**Date:** 2026-03-01
**Total story points:** 42
**Release threshold met:** Yes (42 ≥ 25)
**Engineering unblocked:** Phase 12.7 Phase 2 may begin immediately upon Phase 12.6 Phase 4 completion.
**Next TPPM action:** Begin Phase 12.8 PRD during Phase 12.7 Phase 2–4.
