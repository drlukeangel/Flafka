# Phase 12.4 — Full Lifecycle Integration

**Status**: Phase 1 PRD — Approved (PRD SIGN-OFF APPROVED)
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-02-28
**Depends On**: Phase 12.1 (NavRail) ✅, Phase 12.2 (Schema Registry) ✅, Phase 12.3 (Topic Management) ✅
**Blocks**: Phase 12.5 (TBD)

---

## Problem Statement

Phase 12.1, 12.2, and 12.3 delivered three independent panels: a NavRail, a Schema Registry panel, and a Topic Management panel. Each panel works in isolation, but Flink developers work across all three surfaces simultaneously. Today, if a developer is looking at a Kafka topic and wants to:

- Query it with Flink SQL — they must manually switch to the SQL editor, remember the topic name, type a SELECT statement by hand
- Check its associated Schema Registry subject — they must close the Topics panel, open the Schemas panel, and find the subject by convention (topic name + `-value` suffix)
- Edit a topic's configuration (e.g., extend retention) — they cannot do it in the UI at all; they must go to the Confluent Cloud Console or use the Kafka CLI
- Insert a topic name into their active SQL statement — they must copy the name and paste it, losing cursor position

These gaps force frequent context switches between the Flink SQL Workspace, the Confluent Cloud Console, and CLI tools. The promise of Phase 12 was a unified workspace where Flink developers can stay in one place. Phase 12.4 closes these gaps by wiring the panels together.

**Goals**:
1. "Query with Flink" — one click generates a ready-to-run Flink SELECT statement from any topic
2. "Insert topic name" into active SQL editor — backtick-quoted insert at cursor
3. Cross-navigation between Topics panel and Schema panel — see a topic's associated schema without switching panels manually
4. Topic config editing — alter non-read-only configs directly in the UI (POST to `:alter` endpoint)
5. Topic health indicators — warn when partition count is too low for meaningful Flink parallelism
6. Partition-level detail view — inspect partition assignments and offsets per partition

Items 5 and 6 were also flagged in the Flink Developer stress test (ENH-2 for health indicators, and Phase 12.3 "Out of Scope" for partition detail).

---

## Proposed Solution

Six targeted additions to the existing TopicPanel, SchemaPanel, and App-level routing — no new panels required. All changes are additive and follow the established pattern of each component.

### Feature 1: "Query with Flink" Button
A primary action button in `TopicDetail.tsx` header that generates a `SELECT * FROM \`topic_name\`` statement, opens the SQL workspace panel (`activeNavItem === 'workspace'`), and adds the statement as a new EditorCell via `addStatement(sql)`.

### Feature 2: "Insert topic name" Button (ENH-1)
A secondary action in `TopicDetail.tsx` (icon button, next to the copy-name button in the metadata row) that calls `insertTextAtCursor` from `editorRegistry.ts` with the backtick-quoted topic name. Only active when a SQL editor has focus (i.e., `focusedStatementId !== null`). Tooltip: "Insert into SQL editor".

### Feature 3: Cross-navigation Topics → Schema
A "View Schema" section at the bottom of `TopicDetail.tsx`. The UI looks up the Schema Registry subject that matches the topic name by Confluent naming convention (`{topic_name}-value` for value schema, `{topic_name}-key` for key schema). If found, displays the subject name with a button to navigate to it in the Schema panel. If not found, displays "No schema registered" with a link to the Schema panel to register one.

### Feature 4: Topic Config Editing
An "Edit" button (pencil icon) on each non-read-only, non-sensitive config row in the config table within `TopicDetail.tsx`. Clicking enters an inline edit mode for that single row: the value cell becomes an input, with Save (checkmark) and Cancel (×) buttons. On Save, calls the new `alterTopicConfig()` API function. Saves one config at a time (not a batch form).

### Feature 5: Topic Health Indicators (ENH-2)
A warning badge (`FiAlertTriangle`, orange) shown in the topic list row when `partitions_count < 2`. Tooltip: "Low partition count — Flink parallelism may be limited". Also shown in the detail view header, next to the partition badge. No blocking behavior — purely informational.

### Feature 6: Partition-Level Detail View
A collapsible "Partitions" section in `TopicDetail.tsx`, below the config table. Uses a new `getTopicPartitions()` API call to fetch the `partitions` sub-resource. Renders a table with: Partition ID, Leader Broker, Replica Count, ISR Count (In-Sync Replicas), and earliest/latest offsets. Collapsed by default (reduces panel height; most users don't need partition topology every time).

---

## API Reference

### Confluent Cloud Kafka REST API v3 (new endpoints only)

All requests use the same `kafkaRestClient` instance and the `clusterPath()` helper from Phase 12.3.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs:alter` | Alter one or more topic configs |
| GET | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/partitions` | List topic partitions with broker assignments |
| GET | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/partitions/{partition_id}/offsets` | Get earliest/latest offsets for a partition |

No proxy changes needed — all new calls route through the existing `/api/kafka` Vite proxy.

### Schema Registry (existing endpoint, new usage)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/subjects/{subject_name}/versions/latest` | Check if a subject exists for cross-panel linking |

This is the existing `getSchemaDetail()` call from `schema-registry-api.ts`. No new API function needed — reuse it with a try/catch to detect missing subjects.

### API Response Shapes (new endpoints)

**Alter Topic Configs** — `POST /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs:alter` body:
```json
{
  "data": [
    { "name": "retention.ms", "value": "1209600000" }
  ]
}
```
Returns HTTP 200 with an empty body on success. Returns HTTP 422 if value is invalid.

**List Partitions** — `GET /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/partitions`:
```json
{
  "kind": "KafkaPartitionList",
  "data": [
    {
      "partition_id": 0,
      "leader": { "broker_id": 1 },
      "replicas": [{ "broker_id": 1 }, { "broker_id": 2 }, { "broker_id": 3 }],
      "isr": [{ "broker_id": 1 }, { "broker_id": 2 }, { "broker_id": 3 }]
    }
  ]
}
```

**Get Partition Offsets** — `GET /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/partitions/{partition_id}/offsets`:
```json
{
  "beginning_offset": 0,
  "end_offset": 12450
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/TopicPanel/PartitionTable.tsx` | Collapsible partition detail table inside TopicDetail |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/api/topic-api.ts` | Add `alterTopicConfig()`, `getTopicPartitions()`, `getPartitionOffsets()` functions |
| `src/types/index.ts` | Add `KafkaPartition`, `PartitionOffsets`, `TopicConfigAlterRequest` types |
| `src/components/TopicPanel/TopicDetail.tsx` | Add: "Query with Flink" button, "Insert into editor" button, health indicator badge, inline config edit, "View Schema" cross-nav section, `<PartitionTable />` |
| `src/components/TopicPanel/TopicList.tsx` | Add: health indicator warning badge on low-partition rows |
| `src/store/workspaceStore.ts` | Add `navigateToSchemaSubject()` action (sets `activeNavItem = 'schemas'` + `selectedSchemaSubject`) |
| `src/App.tsx` | Update side panel width logic to also widen for `activeNavItem === 'topics'` when partition table is open (optional — see Technical Notes) |

---

## Type Definitions

### `src/types/index.ts` additions

```typescript
// Kafka Partition — shape returned by the partitions list endpoint
export interface KafkaPartition {
  partition_id: number;
  leader: { broker_id: number } | null;
  replicas: Array<{ broker_id: number }>;
  isr: Array<{ broker_id: number }>;  // In-Sync Replicas
}

// Partition offset boundaries
export interface PartitionOffsets {
  beginning_offset: number;  // earliest retained offset
  end_offset: number;        // latest (exclusive) offset; message count = end - beginning
}

// Request body for :alter endpoint
export interface TopicConfigAlterRequest {
  data: Array<{
    name: string;
    value: string;
  }>;
}
```

**No changes to `KafkaTopic` or `TopicConfig`** — all existing types remain stable.

---

## Component Architecture

### Changes to `TopicDetail.tsx`

`TopicDetail.tsx` is the largest change surface. All additions are isolated sub-sections within the existing component to minimize merge risk.

#### 1. "Query with Flink" Button — Detail Header Bar

Add a third action button in the header bar, between the Refresh button and the Delete button:

```
[Refresh icon] [Query with Flink button] [Delete button (red)]
```

Button label: "Query" with a `FiPlay` icon (16px). Tooltip: "Open SELECT * FROM `{topic_name}` in SQL editor".

Behavior on click:
1. Call `addStatement(`SELECT * FROM \`${selectedTopic.topic_name}\`;`)` from Zustand store — creates a new SQL cell with the query pre-filled
2. Call `setActiveNavItem('workspace')` — navigates the NavRail to the workspace view, closing the Topics panel
3. The new EditorCell scrolls into view automatically (existing `addStatement` behavior)

This is a navigation-level action. It does NOT run the query — it only creates the cell so the developer can review and run it. Visual weight: secondary button style (same as existing Refresh button, not the destructive red Delete button).

#### 2. "Insert topic name" Button — Metadata Row

In the metadata section, next to the topic name copy button, add a second icon button (`FiCode`, 14px). Tooltip: "Insert backtick-quoted name at cursor".

Visibility rules:
- Always rendered
- Disabled (grayed, cursor: not-allowed) when `focusedStatementId === null` (no editor focused)
- Tooltip when disabled: "No SQL editor focused — click an editor cell first"

On click:
```typescript
const quoted = `\`${selectedTopic.topic_name}\``;
const success = insertTextAtCursor(quoted);
if (!success) {
  addToast({ type: 'warning', message: 'No SQL editor focused. Click a cell first.' });
}
```

Import: `insertTextAtCursor` from `../../components/EditorCell/editorRegistry`.

#### 3. Health Indicator — Detail Header Bar

When `selectedTopic.partitions_count < 2`, render a health warning badge in the header bar's left section, after the partition count badge:

```
[N partitions · RF:M] [⚠ badge]
```

Badge: `FiAlertTriangle` icon (12px) + text "Low partition count" in a `var(--color-warning)` pill. Tooltip: "Flink parallelism is limited when partition count < 2. Consider recreating this topic with more partitions."

This badge is informational and non-blocking. No click behavior.

#### 4. Inline Config Editing

For each config row in the config table where `is_read_only === false` AND `is_sensitive === false`, add a hover-revealed edit button (`FiEdit2`, 13px) in a fourth column.

**Read mode** (default for all rows):
```
[config name] | [config value (with formatting)] | [Default?] | [Edit icon (hover only)]
```

**Edit mode** (when edit icon clicked):
- The value cell transforms into an `<input type="text">` pre-filled with the raw `config.value`
- The edit icon cell transforms into two buttons: Save (`FiCheck`, green) and Cancel (`FiX`)
- The row is highlighted with a `var(--color-primary)` left border (2px)
- Only one row can be in edit mode at a time — clicking edit on a different row auto-cancels any active edit

On Save:
1. Calls `alterTopicConfig(selectedTopic.topic_name, configName, newValue)` from `topic-api.ts`
2. While saving: Save button shows spinner, input disabled
3. On success: row exits edit mode, `fetchConfigs()` is re-called to refresh the full config list (ensures server-authoritative state)
4. On error: `role="alert"` inline error below the input row; Cancel remains active; row stays in edit mode

On Cancel (click or Escape key):
- Row returns to read mode with the previous value, no API call
- **Critical**: If Cancel is clicked while a save is in progress, use the `requestIdRef` pattern (already established for `fetchConfigs` in TopicDetail) to track the save request ID and mark it as cancelled. This way, if the API response arrives after cancel, it is silently discarded, preventing stale state updates.

**Read-only configs** (where `is_read_only === true`): No edit button. These configs display a lock icon (`FiLock`, 11px, `var(--color-text-tertiary)`) in the fourth column instead. Tooltip: "This configuration is read-only and cannot be changed."

**Sensitive configs**: No edit button, no lock icon in the fourth column (the value is masked; editing a masked value would be confusing). Fourth column is empty for sensitive configs.

#### 5. "View Schema" Cross-Navigation Section

A new section below the config table (above the Partition section), with a section divider + label "Schema Association".

On mount (and on refresh), the component looks up the Schema Registry subject by convention:
- Primary: `{topic_name}-value`
- Secondary: `{topic_name}-key` (checked only if primary not found)
- Fallback: `{topic_name}` (exact match)

Lookup uses the existing `getSchemaDetail()` from `schema-registry-api.ts` (try/catch 404 = not found).

**States:**
- Loading: small spinner (same as configs loading)
- Found (value subject): "Schema: `{topic_name}-value`" label with `FiExternalLink` button → clicking calls `navigateToSchemaSubject(subject)` which sets `activeNavItem = 'schemas'` and `selectedSchemaSubject` to the loaded detail object
- Found (key subject only): same, but labeled "Key Schema: `{topic_name}-key`"
- Both found: show both, stacked vertically
- Not found: Italic text "No schema registered" + `FiPlus` button "Register schema" → clicking navigates to Schemas panel (sets `activeNavItem = 'schemas'`, `selectedSchemaSubject = null` so the list is shown)
- Schema Registry not configured: Do not render the section at all (guard on `env.schemaRegistryUrl`)

**This lookup is lazy** — triggered by `useEffect` when `selectedTopic` changes. Uses local `useState` for `schemaLinkLoading`, `schemaLinks` (array of found subjects). NOT added to the Zustand store.

#### 6. `PartitionTable.tsx` — Collapsible Partition Section

A new section below the Schema Association section in `TopicDetail.tsx`, with a collapsible toggle header:

```
▶ Partitions (N)    [Refresh icon]
```

When collapsed (default), the partition data is NOT fetched. When expanded:
1. `getTopicPartitions()` is called
2. Renders a table with columns: `Partition`, `Leader`, `Replicas`, `ISR`, `Messages`
3. `Messages` column requires per-partition offset calls — these are fetched in parallel (`Promise.all`) for all partitions, up to a cap of 100 partitions (beyond that, offset fetch is skipped and "—" shown)

Table row anatomy:
```
[partition_id] | [leader_broker_id] | [replica_count] | [isr_count] | [end - beginning or "—"]
```

Partition with `isr.length < replicas.length`: rendered with warning style (`var(--color-warning)` text + `FiAlertTriangle` icon). This indicates an under-replicated partition.

Partition with `leader === null`: rendered with error style (`var(--color-error)` text). This indicates a leaderless partition.

`PartitionTable` is its own file (`src/components/TopicPanel/PartitionTable.tsx`) because it manages its own async loading state (`partitionsLoading`, `partitionsError`, `partitions`, `offsets`) via `useState` + `useEffect`. It receives `topicName: string` and `isExpanded: boolean` as props. The `isExpanded` prop is controlled by parent state in `TopicDetail.tsx`.

---

### Changes to `TopicList.tsx`

Add a health indicator badge to topic list rows where `partitions_count < 2`:

```
[FiServer icon] [topic_name]   [N partitions · RF:M] [⚠] [FiChevronRight]
```

The `⚠` is a `FiAlertTriangle` icon (11px) in `var(--color-warning)`, with `title="Partition count < 2 — Flink parallelism may be limited"`. No click behavior.

Only rendered when `topic.partitions_count < 2`. This catches single-partition topics (a common misconfiguration for Flink-sourced topics).

---

### Changes to `workspaceStore.ts`

Add one new action and one new optional state field:

```typescript
navigateToSchemaSubject: (subject: SchemaSubject) => void;
topicPartitionsExpanded?: boolean;
setTopicPartitionsExpanded: (expanded: boolean) => void;
```

Implementation:
```typescript
navigateToSchemaSubject: (subject) => {
  set({
    activeNavItem: 'schemas',
    selectedSchemaSubject: subject,
  });
},
setTopicPartitionsExpanded: (expanded) => {
  set({ topicPartitionsExpanded: expanded });
},
```

The `navigateToSchemaSubject` action reuses existing state fields (`activeNavItem`, `selectedSchemaSubject`) already used by the Schema panel. Reusing existing fields avoids any new store state beyond the partition expand flag.

The `topicPartitionsExpanded` field is **runtime-only** and must be **excluded from the `partialize` persist config** (not saved to localStorage). This flag controls temporary UI state (panel width expand/collapse) and should reset on page reload.

**No new component-level state fields beyond these** — no `partitionList`, no `schemaLink`. All Feature 3, 4, and 6 state is local component state (`useState`) to keep the store lean.

---

### Changes to `topic-api.ts`

Three new exported functions:

```typescript
export async function alterTopicConfig(
  topicName: string,
  configName: string,
  newValue: string
): Promise<void>
// POST {clusterPath}/topics/{encodeURIComponent(topicName)}/configs:alter
// Body: { data: [{ name: configName, value: newValue }] }
// Returns void on HTTP 200

export async function getTopicPartitions(
  topicName: string
): Promise<KafkaPartition[]>
// GET {clusterPath}/topics/{encodeURIComponent(topicName)}/partitions
// Returns data[] array from response

export async function getPartitionOffsets(
  topicName: string,
  partitionId: number
): Promise<PartitionOffsets>
// GET {clusterPath}/topics/{encodeURIComponent(topicName)}/partitions/{partitionId}/offsets
// Returns { beginning_offset, end_offset }
```

All three use the same `kafkaRestClient` and `clusterPath()` helper already in the file.

---

## Acceptance Criteria

All criteria are testable via automated tests and/or browser verification.

### Feature 1: "Query with Flink" Button

#### AC-1: Button Presence and Label
**Given** a topic is selected and `TopicDetail` is rendered
**Then** a "Query" button with a play icon is visible in the detail header bar, between the Refresh button and the Delete button.

#### AC-2: "Query with Flink" — Happy Path
**Given** TopicDetail is open for topic `orders`
**When** the user clicks the "Query" button
**Then** a new EditorCell is created in the workspace containing `SELECT * FROM \`orders\`;` AND `activeNavItem` changes to `'workspace'`, showing the SQL editor with the new cell scrolled into view.

#### AC-3: "Query with Flink" — Topic Name with Dots
**Given** a topic named `my.topic.v1` is selected
**When** the user clicks the "Query" button
**Then** the generated SQL is `SELECT * FROM \`my.topic.v1\`;` (backtick-quoted, dots preserved — no escaping beyond backticks).

#### AC-4: "Query with Flink" — Topic Name with Hyphens and Underscores
**Given** a topic named `user-events_raw` is selected
**When** the user clicks "Query"
**Then** the generated SQL is `SELECT * FROM \`user-events_raw\`;`.

#### AC-5: "Query with Flink" — Does Not Execute
**Given** the user clicks "Query"
**Then** the new cell's status is `IDLE` (not RUNNING, not PENDING). The query is staged for review, not auto-executed.

### Feature 2: "Insert topic name" Button

#### AC-6: Insert Button Presence
**Given** a topic is selected in TopicDetail
**Then** a code/insert icon button is visible next to the topic name copy button in the metadata section. Its tooltip indicates "Insert into SQL editor".

#### AC-7: Insert Button — Enabled State
**Given** a SQL editor cell has focus (`focusedStatementId !== null`)
**When** the user clicks the insert button in TopicDetail
**Then** the backtick-quoted topic name (e.g., `` `orders` ``) is inserted at the cursor position in the focused editor, and focus returns to the editor.

#### AC-8: Insert Button — Disabled State
**Given** no SQL editor has focus (`focusedStatementId === null`)
**Then** the insert button is visually disabled (reduced opacity, cursor: not-allowed). Clicking it shows a toast: "No SQL editor focused. Click a cell first."

#### AC-9: Insert Button — Long Topic Name Quoting
**Given** a topic named `my.topic.with.dots` is selected
**When** the user clicks the insert button with an editor focused
**Then** the string `` `my.topic.with.dots` `` (backtick-wrapped) is inserted — not the plain name.

### Feature 3: Cross-Navigation Topics → Schema

#### AC-10: Schema Association — Found (value subject)
**Given** a topic named `orders` is selected AND a Schema Registry subject `orders-value` exists
**When** the Schema Association section loads
**Then** the section shows "Schema: orders-value" with a navigation button (`FiExternalLink`).

#### AC-11: Schema Association — Navigate to Schema
**Given** AC-10 conditions are met
**When** the user clicks the navigation button next to `orders-value`
**Then** `activeNavItem` changes to `'schemas'`, `selectedSchemaSubject` is set to the `orders-value` schema detail object, and the Schema panel opens directly to that subject's detail view.

#### AC-12: Schema Association — Found (key subject only)
**Given** a topic `orders` has `orders-key` registered but NOT `orders-value`
**Then** the section shows "Key Schema: orders-key" with a navigation button.

#### AC-13: Schema Association — Both Subjects Found
**Given** both `orders-value` and `orders-key` exist in Schema Registry
**Then** both are shown in the Schema Association section, stacked vertically, each with its own navigation button.

#### AC-14: Schema Association — Not Found
**Given** no Schema Registry subject matching `{topic_name}-value`, `{topic_name}-key`, or `{topic_name}` exists
**Then** the section shows italicized "No schema registered" text and a "Register schema" button. Clicking navigates to the Schema panel list view (not a specific subject).

#### AC-15: Schema Association — Registry Not Configured
**Given** `env.schemaRegistryUrl` is empty or missing
**Then** the Schema Association section is not rendered at all. No error state, no placeholder.

#### AC-16: Schema Association — Loading State
**Given** the lookup is in progress
**Then** a small inline spinner is shown in the Schema Association section (matches the config loading spinner pattern).

### Feature 4: Topic Config Editing

#### AC-17: Edit Button Visibility
**Given** the config table is rendered
**Then** edit buttons (pencil icon) appear on hover for every config row where `is_read_only === false` AND `is_sensitive === false`. Read-only rows show a lock icon instead. Sensitive rows have no icon in the fourth column.

#### AC-18: Inline Edit Mode — Entry
**Given** a non-read-only config row is shown
**When** the user clicks the edit (pencil) icon
**Then** the value cell becomes a text input pre-filled with the current raw `config.value` (e.g., "604800000"), and Save and Cancel buttons appear. The row gets a `var(--color-primary)` left border accent.

#### AC-19: Config Edit — Only One Row Editable at a Time
**Given** config row A is in edit mode
**When** the user clicks the edit icon on config row B
**Then** row A silently exits edit mode (no save), and row B enters edit mode.

#### AC-20: Config Edit — Save Happy Path
**Given** a config row is in edit mode with a new value typed
**When** the user clicks Save
**Then** `alterTopicConfig()` is called with the correct topic name, config name, and new value. On API success, the row exits edit mode and the config table refreshes to show the server-authoritative value.

#### AC-21: Config Edit — Save Shows Spinner
**Given** a config edit save is in progress
**Then** the Save button shows a loading spinner and the input is disabled. Cancel remains clickable to abort the pending save (sets a cancelled flag so the response is ignored if it arrives after cancel).

#### AC-22: Config Edit — API Error
**Given** the `alterTopicConfig()` call returns an error (e.g., 422 Invalid value)
**Then** an inline error message appears below the input row with `role="alert"`. The row stays in edit mode so the user can correct the value. The Cancel button closes edit mode without saving.

#### AC-23: Config Edit — Cancel
**Given** a config row is in edit mode
**When** the user clicks Cancel or presses Escape
**Then** the row returns to read mode with the previous value. No API call is made.

#### AC-24: Config Edit — Read-Only Lock Icon
**Given** a config row where `is_read_only === true`
**Then** a lock icon (`FiLock`, 11px, muted color) is shown in the fourth column. Tooltip: "This configuration is read-only."

### Feature 5: Topic Health Indicators

#### AC-25: Health Badge in Topic List
**Given** the topic list contains a topic with `partitions_count === 1`
**Then** a warning icon (`FiAlertTriangle`, orange) is shown in that topic's row, after the partition/RF metadata. Tooltip: "Partition count < 2 — Flink parallelism may be limited".

#### AC-26: Health Badge — Not Shown for Adequate Partition Count
**Given** a topic with `partitions_count >= 2`
**Then** no health warning badge is shown on that topic's list row.

#### AC-27: Health Badge in Topic Detail Header
**Given** the selected topic has `partitions_count < 2`
**Then** a warning badge appears in the detail header bar adjacent to the partition count badge. Tooltip matches AC-25.

### Feature 6: Partition-Level Detail View

#### AC-28: Partition Section — Collapsed by Default
**Given** a topic is selected and TopicDetail is rendered
**Then** the "Partitions" section is collapsed. No partition API calls are made in collapsed state.

#### AC-29: Partition Section — Expand on Click
**Given** the user clicks the "Partitions" section header toggle
**Then** `getTopicPartitions()` is called, the section expands, and a loading spinner is shown while partitions load.

#### AC-30: Partition Table — Data Display
**Given** partitions load successfully
**Then** a table is shown with columns: Partition ID, Leader Broker ID, Replica Count, ISR Count, and Message Count (end_offset − beginning_offset). All values are numeric. Message Count shows "—" if offset fetch failed or was skipped (> 100 partitions).

#### AC-31: Partition Table — Under-Replicated Warning
**Given** a partition where `isr.length < replicas.length`
**Then** that partition row is styled with `var(--color-warning)` text and a `FiAlertTriangle` icon in the Partition ID cell.

#### AC-32: Partition Table — Leaderless Error
**Given** a partition where `leader === null`
**Then** that partition row is styled with `var(--color-error)` text.

#### AC-33: Partition Table — Collapse After Expand
**Given** the Partitions section is expanded
**When** the user clicks the toggle again
**Then** the section collapses. Previously loaded partition data is retained in local state (no re-fetch on next expand unless Refresh is clicked).

#### AC-34: Partition Table — Refresh
**Given** the Partitions section is expanded
**When** the user clicks the Refresh icon in the Partitions section header
**Then** `getTopicPartitions()` and all offset calls are re-fetched and the table updates.

#### AC-35: Partition Table — Large Topic (> 100 Partitions)
**Given** a topic with more than 100 partitions
**Then** partition metadata (leader, replicas, ISR) is fetched for all partitions. Offset calls are skipped — Message Count column shows "—" for all rows. A note "Offset fetch skipped for topics with > 100 partitions" is shown below the table.

#### AC-36: Partition Table — Error State
**Given** `getTopicPartitions()` fails (e.g., 403, network error)
**Then** an error message is shown in the expanded section with a Retry button.

### Cross-Feature Acceptance Criteria

#### AC-37: Dark Mode — All New Elements
**Given** the app is in dark mode (`data-theme="dark"`)
**Then** all new UI elements (health badges, schema association section, partition table, inline config edit inputs, "Query" button, insert button) render correctly using CSS custom properties. No hardcoded hex colors.

#### AC-38: Light Mode — All New Elements
**Given** the app is in light mode
**Then** all new UI elements render correctly.

#### AC-39: Keyboard Accessibility — New Buttons
**Given** any new button in TopicDetail or TopicList (Query, Insert, health badge — informational only, no tab stop needed, Edit config, Save config, Cancel config, Schema nav, Partitions toggle)
**Then** all interactive elements are keyboard-reachable via Tab, activatable via Enter or Space, and have descriptive `aria-label` attributes where the button has no visible text label.

#### AC-40: ARIA — Inline Config Edit
**Given** a config row is in edit mode
**Then** the input has `aria-label="Edit {configName} value"`. The Save button has `aria-label="Save {configName}"`. The Cancel button has `aria-label="Cancel editing {configName}"`. The error alert has `role="alert"`.

#### AC-41: Schema Registry Not Available
**Given** `env.schemaRegistryUrl` is empty
**Then** Feature 3 (schema cross-nav) renders nothing. Features 1, 2, 4, 5, and 6 are unaffected.

#### AC-42: Kafka REST Not Configured
**Given** `env.kafkaClusterId` or `env.kafkaRestEndpoint` is missing
**Then** the entire TopicPanel shows the "not configured" error state (existing AC-25 from Phase 12.3). Features 1-6 never render. No new guards needed inside the feature components.

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Topic name contains backticks (not allowed by Kafka naming rules — AC-11 of Phase 12.3 blocks this) | Cannot happen — CREATE validation already prevents it |
| Topic name is 249 chars | "Query with Flink" generates a 249-char backtick-wrapped identifier. Valid Flink SQL. |
| Schema Registry lookup returns 401 | Schema Association section shows: "Schema Registry authentication failed" (single-line error, not a full error state) |
| Schema Registry lookup returns 500 | Schema Association section shows: "Could not check schema association" with a Retry button |
| `alterTopicConfig` called with empty string value | API returns 422. UI shows error: "Config value cannot be empty." |
| `alterTopicConfig` called with value exceeding broker limits | API returns 422 with message. Display the API error message verbatim |
| `getTopicPartitions` returns empty array | Partition table shows "No partitions found" (edge case for brand-new topics mid-creation) |
| All partitions have ISR = replicas (healthy) | No warning styles rendered in partition table |
| Offset fetch for partition takes > 5s | Individual offset requests time out after 5s (via the existing 30s client timeout — acceptable, no per-partition timeout needed) |
| User navigates away from TopicDetail mid-partition fetch | useEffect cleanup cancels fetches (mounted ref guard, same pattern as config fetch) |
| Inline config edit — Escape while saving in progress | Cancel is allowed during save. If save later succeeds, its result is discarded (mounted/cancelled flag). Row exits to read mode with original value |
| Insert topic name — Monaco editor not focused but `focusedStatementId` is stale | `insertTextAtCursor` returns `false` → show toast warning. No crash |
| "Query with Flink" clicked when workspace has 50 EditorCells | New cell added at the bottom (existing `addStatement()` behavior). NavRail navigates to workspace. Scroll-to new cell follows existing addStatement scroll behavior |
| Schema Association found, but Schema Registry is then opened — back to Topics | User can navigate back to Topics panel. `selectedSchemaSubject` persists in store. Topics panel reloads from existing `topicList` cache |
| Partition section expanded, user selects different topic | Partition section resets to collapsed state when `selectedTopic` changes (controlled by `useEffect` in `TopicDetail`) |
| Config edit row — new value is identical to current value | Save is allowed (no client-side equality check). API call goes through. Server may return 200 with no change |

---

## Technical Notes

### "Query with Flink" — Statement Format

The generated SQL always uses the Flink SQL backtick-quoted table name convention. The format is:

```sql
SELECT * FROM `{topic_name}`;
```

No `LIMIT` clause is added — Flink streaming SELECT does not use LIMIT in the same way as batch SQL. The developer is expected to press Escape or Cancel to stop a running streaming SELECT. Adding `LIMIT 10` would be incorrect for streaming semantics and could confuse developers expecting streaming behavior.

### `navigateToSchemaSubject` Action — Store Reuse

`navigateToSchemaSubject` sets two existing fields: `activeNavItem` and `selectedSchemaSubject`. This pattern is safe because:
- `activeNavItem = 'schemas'` causes `App.tsx` to render `<SchemaPanel />` instead of `<TopicPanel />`
- `selectedSchemaSubject` is already read by `SchemaPanel` to determine list vs. detail view
- Setting both atomically (in a single `set({})` call) avoids a render flash between list and detail views

The App.tsx side panel width logic currently widens for `activeNavItem === 'schemas'` based on `selectedSchemaSubject`. When `navigateToSchemaSubject()` sets both simultaneously, the Schema panel opens directly to the correct width.

**Edge case**: When navigating to a specific schema subject via `navigateToSchemaSubject()` on a first-time visit (Schema panel never opened before), the Schema panel's subject list may not be populated since `loadSchemaRegistrySubjects()` has not run yet. The browser test must verify that the `selectedSchemaSubject` detail loads correctly even when the list is empty. If the Schema panel was already visited earlier in the session, the subjects list will be populated by the existing `useEffect`.

### Schema Lookup Convention

Confluent Cloud by convention names Schema Registry subjects as `{topic_name}-value` (for value schema) and `{topic_name}-key` (for key schema). This is a convention, not enforced by the platform. The lookup tries:

1. `{topic_name}-value` — Confluent's default for Kafka Connect and Flink connectors
2. `{topic_name}-key` — key schema (less common but valid)
3. `{topic_name}` — some teams omit the suffix

Each lookup is a separate `getSchemaDetail()` call. **Critical**: Use **`Promise.allSettled` (NOT `Promise.all`)** so a 404 on `orders-value` does not prevent the `orders-key` check from running. This ensures all three subject patterns are checked in parallel without one failure aborting the others.

If Schema Registry is not configured (`env.schemaRegistryUrl` empty), skip all lookups and render nothing.

### Inline Config Edit — Scope Limitation

Only `is_read_only === false, is_sensitive === false` configs are editable. Read-only configs include:
- `min.insync.replicas` (in some Confluent Cloud tiers)
- `replication.factor` (always read-only post-create)
- `num.partitions` (always read-only post-create — partition count increase requires a separate API, not the alter endpoint)

These cannot be altered via the `:alter` endpoint and are correctly marked `is_read_only: true` by the API. The lock icon communicates this clearly without needing to enumerate which configs are read-only in the UI.

### PartitionTable — Offset Fetch Strategy

Each partition requires a separate GET request for offsets. For a topic with N partitions:
- N <= 100: fetch all offsets in parallel via `Promise.all`
- N > 100: skip offset fetches, show "—" in Message Count column

The 100-partition cap prevents the UI from firing 1000+ concurrent requests on large enterprise clusters. 100 parallel requests to the Kafka REST API is reasonable for a UI tool; 1000+ is not.

**Critical**: Each offset request MUST be individually wrapped in try/catch — do NOT use a single outer catch that would fail all partitions if one request fails. Individual failures show "—" for that partition without failing the entire table. This ensures the partition table renders as complete as possible even with some offset fetch failures.

Example:
```typescript
const offsets = await Promise.all(
  partitions.map(p =>
    getPartitionOffsets(topicName, p.id)
      .then(o => ({ partitionId: p.id, ...o }))
      .catch(err => ({ partitionId: p.id, beginning_offset: null, end_offset: null }))
  )
);
```

### Panel Width for Topic Detail

The Topic panel at Phase 12.3 uses the default `--side-panel-width` (300px). With Phase 12.4 additions (Schema Association section, Partition table), 300px is narrow for the partition table which has 5 columns.

**Recommendation**: Do NOT change the default TopicPanel width to 300px when the partition section is collapsed (default). When the partition section is expanded, expand the side panel to `var(--schema-panel-width)` (480px) using the same dynamic width logic as `activeNavItem === 'schemas'`.

App.tsx width logic (add a second condition):

```typescript
style={
  (activeNavItem === 'schemas' && selectedSchemaSubject) ||
  (activeNavItem === 'topics' && topicPartitionsExpanded)
    ? { width: 'var(--schema-panel-width)', minWidth: 'var(--schema-panel-width)' }
    : undefined
}
```

This requires `topicPartitionsExpanded` state to be lifted to the store OR to App.tsx level. The simplest approach: add a `topicPartitionsExpanded: boolean` field to the Zustand store (runtime-only, not persisted), defaulting to `false`. `PartitionTable.tsx` toggles it via a new `setTopicPartitionsExpanded(bool)` action.

If the complexity of lifting this state is deemed too high during implementation, the alternative is to always use 300px and rely on horizontal scrolling for the partition table. QA should flag this during browser validation.

### `insertTextAtCursor` Import in TopicDetail

`TopicDetail.tsx` imports `insertTextAtCursor` directly from `../../components/EditorCell/editorRegistry`. This creates a component-to-component import across the component tree (TopicPanel → EditorCell). This cross-sibling import is already the established pattern: `editorRegistry.ts` is explicitly designed as a shared module (see CLAUDE.md "Shared `editorRegistry.ts` module"). The import is safe.

### Config Edit — No Batch Mode

Phase 12.4 implements single-row config editing only. There is no "edit all" form. This design choice:
- Reduces the risk of accidentally altering multiple configs at once
- Keeps the `:alter` endpoint usage simple (single item in the `data` array)
- Avoids the need to validate multiple config values simultaneously

Bulk config editing (e.g., "edit all non-default configs") is a future enhancement.

---

## Test Plan

### Unit Tests — `src/__tests__/api/topic-api.test.ts` (additions)

| Test | Marker | Tier |
|------|--------|------|
| `alterTopicConfig()` sends correct POST body to `:alter` endpoint | `[@topic-api]` | T1 |
| `alterTopicConfig()` resolves void on HTTP 200 | `[@topic-api]` | T1 |
| `alterTopicConfig()` throws on HTTP 422 (invalid value) | `[@topic-api]` | T1 |
| `alterTopicConfig()` throws on HTTP 403 | `[@topic-api]` | T1 |
| `alterTopicConfig()` URL-encodes topic name in path | `[@topic-api]` | T2 |
| `getTopicPartitions()` returns mapped array from API | `[@topic-api]` | T1 |
| `getTopicPartitions()` handles empty partitions array | `[@topic-api]` | T1 |
| `getTopicPartitions()` throws on HTTP 403 | `[@topic-api]` | T1 |
| `getTopicPartitions()` URL-encodes topic name | `[@topic-api]` | T2 |
| `getPartitionOffsets()` returns beginning_offset and end_offset | `[@topic-api]` | T1 |
| `getPartitionOffsets()` throws on network error | `[@topic-api]` | T1 |
| `getPartitionOffsets()` URL-encodes topic name | `[@topic-api]` | T2 |

### Unit Tests — `src/__tests__/components/TopicDetail.test.tsx` (additions)

| Test | Marker | Tier |
|------|--------|------|
| "Query" button is rendered in detail header | `[@topic-detail][@phase-12-4]` | T1 |
| Clicking "Query" calls addStatement with correct SQL | `[@topic-detail][@phase-12-4]` | T1 |
| Clicking "Query" sets activeNavItem to 'workspace' | `[@topic-detail][@phase-12-4]` | T1 |
| Generated SQL uses backtick-quoted topic name | `[@topic-detail][@phase-12-4]` | T1 |
| Topic name with dots generates correctly quoted SQL | `[@topic-detail][@phase-12-4]` | T2 |
| Topic name with hyphens generates correctly quoted SQL | `[@topic-detail][@phase-12-4]` | T2 |
| Insert button rendered next to topic name copy button | `[@topic-detail][@phase-12-4]` | T1 |
| Insert button disabled when focusedStatementId is null | `[@topic-detail][@phase-12-4]` | T1 |
| Insert button calls insertTextAtCursor with backtick-quoted name | `[@topic-detail][@phase-12-4]` | T1 |
| Insert button shows toast when insertTextAtCursor returns false | `[@topic-detail][@phase-12-4]` | T1 |
| Health badge shown for topic with partitions_count < 2 | `[@topic-detail][@phase-12-4]` | T1 |
| Health badge NOT shown for topic with partitions_count >= 2 | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association section renders loading spinner | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association shows subject name and nav button when found | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association shows 'No schema registered' when 404 | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association nav button calls navigateToSchemaSubject | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association not rendered when schemaRegistryUrl empty | `[@topic-detail][@phase-12-4]` | T1 |
| Schema Association checks both -value and -key subjects | `[@topic-detail][@phase-12-4]` | T2 |
| Schema Association shows both subjects when both found | `[@topic-detail][@phase-12-4]` | T2 |
| Edit icon shown on hover for non-read-only, non-sensitive config | `[@topic-detail][@phase-12-4]` | T1 |
| Lock icon shown for read-only config, no edit icon | `[@topic-detail][@phase-12-4]` | T1 |
| No icon shown for sensitive config in fourth column | `[@topic-detail][@phase-12-4]` | T1 |
| Clicking edit icon enters inline edit mode for that row | `[@topic-detail][@phase-12-4]` | T1 |
| Input pre-filled with current raw config value | `[@topic-detail][@phase-12-4]` | T1 |
| Only one row can be in edit mode at a time | `[@topic-detail][@phase-12-4]` | T1 |
| Save calls alterTopicConfig with correct args | `[@topic-detail][@phase-12-4]` | T1 |
| Save triggers fetchConfigs on success | `[@topic-detail][@phase-12-4]` | T1 |
| API error on save shows inline alert | `[@topic-detail][@phase-12-4]` | T1 |
| Cancel exits edit mode without API call | `[@topic-detail][@phase-12-4]` | T1 |
| Escape key cancels edit mode | `[@topic-detail][@phase-12-4]` | T2 |
| Save shows spinner while request in flight | `[@topic-detail][@phase-12-4]` | T2 |
| Partition section collapsed by default | `[@topic-detail][@phase-12-4]` | T1 |
| Expanding partition section calls getTopicPartitions | `[@topic-detail][@phase-12-4]` | T1 |
| Partition table shows Partition, Leader, Replicas, ISR, Messages columns | `[@topic-detail][@phase-12-4]` | T1 |
| Under-replicated partition row shown in warning style | `[@topic-detail][@phase-12-4]` | T1 |
| Leaderless partition row shown in error style | `[@topic-detail][@phase-12-4]` | T1 |
| Collapsing partition section hides table | `[@topic-detail][@phase-12-4]` | T1 |
| Partition error state shows Retry button | `[@topic-detail][@phase-12-4]` | T1 |
| Offset fetch skipped for topics with > 100 partitions | `[@topic-detail][@phase-12-4]` | T2 |
| Partition toggle header button is keyboard-accessible (Tab + Enter/Space) | `[@topic-detail][@phase-12-4]` | T2 |

### Unit Tests — `src/__tests__/components/TopicList.test.tsx` (additions)

| Test | Marker | Tier |
|------|--------|------|
| Health badge rendered for topic with partitions_count = 1 | `[@topic-list][@phase-12-4]` | T1 |
| Health badge rendered for topic with partitions_count = 0 | `[@topic-list][@phase-12-4]` | T2 |
| Health badge NOT rendered for topic with partitions_count = 2 | `[@topic-list][@phase-12-4]` | T1 |
| Health badge has correct title attribute | `[@topic-list][@phase-12-4]` | T1 |

### Unit Tests — `src/__tests__/components/PartitionTable.test.tsx` (new file)

| Test | Marker | Tier |
|------|--------|------|
| Does not fetch when isExpanded=false | `[@partition-table][@phase-12-4]` | T1 |
| Fetches partitions when isExpanded=true | `[@partition-table][@phase-12-4]` | T1 |
| Shows loading spinner while fetching | `[@partition-table][@phase-12-4]` | T1 |
| Renders partition rows with all 5 columns | `[@partition-table][@phase-12-4]` | T1 |
| Under-replicated row has warning class | `[@partition-table][@phase-12-4]` | T1 |
| Leaderless partition has error class | `[@partition-table][@phase-12-4]` | T1 |
| Error state renders with Retry button | `[@partition-table][@phase-12-4]` | T1 |
| Retry button re-fetches partitions | `[@partition-table][@phase-12-4]` | T1 |
| 'No partitions found' shown for empty array | `[@partition-table][@phase-12-4]` | T1 |
| Offset calls are skipped for > 100 partitions | `[@partition-table][@phase-12-4]` | T2 |
| Message count shows '—' when offset fetch fails | `[@partition-table][@phase-12-4]` | T2 |
| Message count = end_offset - beginning_offset | `[@partition-table][@phase-12-4]` | T1 |
| Note shown when offset fetch skipped | `[@partition-table][@phase-12-4]` | T2 |

### Unit Tests — `src/__tests__/store/workspaceStore.test.ts` (additions)

| Test | Marker | Tier |
|------|--------|------|
| `navigateToSchemaSubject()` sets activeNavItem to 'schemas' | `[@store][@phase-12-4]` | T1 |
| `navigateToSchemaSubject()` sets selectedSchemaSubject | `[@store][@phase-12-4]` | T1 |
| `setTopicPartitionsExpanded(true)` sets topicPartitionsExpanded | `[@store][@phase-12-4]` | T1 |
| `setTopicPartitionsExpanded(false)` resets to collapsed | `[@store][@phase-12-4]` | T1 |
| `topicPartitionsExpanded` is NOT persisted to localStorage | `[@store][@phase-12-4]` | T1 |

### Browser Verification Checklist

- [ ] "Query with Flink" button visible in TopicDetail header
- [ ] Clicking "Query" creates a new SQL cell with correct backtick-quoted SELECT statement and navigates to workspace
- [ ] Insert button is disabled when no editor focused; shows warning toast on click
- [ ] Insert button inserts backtick-quoted name at cursor when an editor is focused
- [ ] Schema Association section loads and shows linked subject for a topic that has one
- [ ] Schema Association "Navigate" button opens Schema panel directly to that subject's detail view
- [ ] Schema Association shows "No schema registered" for a topic with no matching subject
- [ ] Config edit icon appears on hover for editable configs; lock icon for read-only configs
- [ ] Clicking edit enters inline edit mode with pre-filled value
- [ ] Only one config row editable at a time
- [ ] Save calls API and refreshes config table
- [ ] API error shown inline in edit row
- [ ] Cancel returns to read mode without API call
- [ ] Health warning badge on topics with < 2 partitions in list AND detail views
- [ ] Partition section collapsed by default; click to expand
- [ ] Partition table renders with correct columns and values
- [ ] Under-replicated partition row styled in warning color
- [ ] Panel widens to 480px when partition section expanded
- [ ] All elements render correctly in dark mode and light mode
- [ ] All new buttons keyboard-accessible (Tab, Enter/Space)

---

## Out of Scope

- Consumer group offset display (requires `/consumer-groups` endpoint — different auth scope)
- Bulk topic config editing (batch form editing multiple configs simultaneously)
- Topic recreation wizard (change partition count — requires delete + recreate; high risk, deferred)
- Schema Registry subject creation from the Topics panel (users navigate to Schema panel to register; creation UX stays in SchemaPanel/CreateSchema)
- Flink watermark or connector metadata overlay (would require Flink connector catalog API — separate surface)
- Partition reassignment (broker-level operation; not available in Kafka REST API v3)
- Topic-level ACL management (separate Confluent RBAC API; different auth scope)
- Message browsing (consume messages from a topic — extremely complex; separate product scope)

---

## Definition of Done

- [ ] One new file created (`PartitionTable.tsx`)
- [ ] Five files modified (`topic-api.ts`, `types/index.ts`, `TopicDetail.tsx`, `TopicList.tsx`, `workspaceStore.ts`)
- [ ] Optional: `App.tsx` modified for dynamic panel width on partition expand
- [ ] All 42 acceptance criteria verified
- [ ] All unit tests written with `[@phase-12-4]` markers, 100% passing
- [ ] New test files: `PartitionTable.test.tsx` — created
- [ ] Existing test files `TopicDetail.test.tsx`, `TopicList.test.tsx`, `topic-api.test.ts`, `workspaceStore.test.ts` — additions only, no regressions
- [ ] 80%+ total code coverage maintained
- [ ] Browser-verified in Chrome: dark mode + light mode
- [ ] QA Manager sign-off received
- [ ] UX/IA sign-off received
