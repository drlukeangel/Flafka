# Phase 12.3 — Topic Management

**Status**: Phase 1 PRD — Pending Engineering Sign-off
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-02-28
**Depends On**: Phase 12.1 (NavRail) ✅, Phase 12.2 (Schema Registry) ✅
**Blocks**: Phase 12.4 (Full Lifecycle Integration)

---

## Problem Statement

Flink SQL developers working with Confluent Cloud must currently switch between the Flink SQL Workspace UI, the Confluent Cloud Console, and CLI tooling to inspect and manage Kafka topics. This context switching disrupts flow, introduces errors from manual name lookups, and slows iteration cycles.

The NavRail "Topics" button exists and correctly routes to `activeNavItem === 'topics'` in App.tsx, but renders only a `<div className="coming-soon-panel">` placeholder. Users who click "Topics" see:

```
Topics management coming soon
```

There is no functional Topic Management panel.

**Goal**: Replace the placeholder with a fully functional Kafka Topic Management panel that allows Flink developers to browse topics, inspect their configurations, view partition topology, create new topics, and delete topics — all without leaving the SQL Workspace.

---

## Proposed Solution

A Topic Management panel rendered inside the existing NavRail side-panel slot when `activeNavItem === 'topics'`. The panel follows the exact structural and UX patterns of the Schema Registry panel (Phase 12.2) for consistency:

- **TopicPanel** — root container, handles load-on-mount, list/detail navigation
- **TopicList** — searchable list of all Kafka topics; shows topic name, partition count, replication factor; "Create Topic" button
- **TopicDetail** — single-topic view with overview metadata + full config table; "Delete" button with name-confirmation safety gate
- **CreateTopic** — modal dialog for creating a new topic (name, partitions, replication factor, optional cleanup policy + retention)
- **DeleteTopic** — inline confirmation overlay (same approach as SchemaDetail's `DeleteConfirm`) requiring the user to type the topic name before confirming

The feature is **read-write** — it lists, inspects, creates, and deletes topics via the Confluent Cloud Kafka REST API v3. Config editing (alter configs) is deferred to Phase 12.4.

---

## API Reference

### Confluent Cloud Kafka REST API v3

All endpoints are served by the cluster's REST Proxy endpoint (not the Kafka bootstrap server or the Flink endpoint).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/kafka/v3/clusters/{cluster_id}/topics` | List all topics |
| GET | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}` | Get single topic details |
| GET | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs` | Get all topic configs |
| POST | `/kafka/v3/clusters/{cluster_id}/topics` | Create a new topic |
| DELETE | `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}` | Delete a topic |

**Authentication**: Basic Auth using `VITE_KAFKA_API_KEY:VITE_KAFKA_API_SECRET`
**Content-Type**: `application/json`
**ClusterId**: Read from `VITE_KAFKA_CLUSTER_ID` environment variable

### Key API Response Shapes

**List Topics** — `GET /kafka/v3/clusters/{cluster_id}/topics`:
```json
{
  "kind": "KafkaTopicList",
  "data": [
    {
      "kind": "KafkaTopic",
      "topic_name": "orders",
      "is_internal": false,
      "replication_factor": 3,
      "partitions_count": 6,
      "partitions": { "related": "..." },
      "configs": { "related": "..." }
    }
  ]
}
```

**Get Topic Configs** — `GET /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs`:
```json
{
  "data": [
    { "name": "retention.ms", "value": "604800000", "is_default": false, "is_read_only": false, "is_sensitive": false },
    { "name": "cleanup.policy", "value": "delete", "is_default": true, "is_read_only": false, "is_sensitive": false }
  ]
}
```

**Create Topic** — `POST /kafka/v3/clusters/{cluster_id}/topics` body:
```json
{
  "topic_name": "my-new-topic",
  "partitions_count": 6,
  "replication_factor": 3,
  "configs": [
    { "name": "cleanup.policy", "value": "delete" },
    { "name": "retention.ms", "value": "604800000" }
  ]
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/api/kafka-rest-client.ts` | Axios client for Kafka REST API (separate auth/baseURL from confluentClient) |
| `src/api/topic-api.ts` | API functions: listTopics, getTopicDetail, getTopicConfigs, createTopic, deleteTopic |
| `src/components/TopicPanel/TopicPanel.tsx` | Root panel: load-on-mount, list/detail navigation, panel header |
| `src/components/TopicPanel/TopicList.tsx` | Searchable topic list with count badge and Create button |
| `src/components/TopicPanel/TopicDetail.tsx` | Topic detail: metadata + config table + Delete flow |
| `src/components/TopicPanel/CreateTopic.tsx` | Modal dialog: create new topic form |

---

## Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Add `/api/kafka` proxy → `VITE_KAFKA_REST_ENDPOINT` (parallel to existing `/api/schema-registry` proxy) |
| `src/config/environment.ts` | Add `kafkaClusterId`, `kafkaRestEndpoint`, `kafkaApiKey`, `kafkaApiSecret` fields; read from `VITE_KAFKA_*` env vars |
| `src/types/index.ts` | Add `KafkaTopic`, `TopicConfig` types |
| `src/store/workspaceStore.ts` | Add topic state slice: `topicList`, `selectedTopic`, `topicLoading`, `topicError` + actions |
| `src/App.tsx` | Replace `coming-soon-panel` placeholder with `<TopicPanel />` for `activeNavItem === 'topics'` |

---

## Type Definitions

### `src/types/index.ts` additions

```typescript
// Kafka Topic — shape returned by list and detail endpoints
export interface KafkaTopic {
  topic_name: string;
  is_internal: boolean;
  replication_factor: number;
  partitions_count: number;
}

// Topic configuration entry — returned by the configs endpoint
export interface TopicConfig {
  name: string;           // e.g. 'retention.ms', 'cleanup.policy'
  value: string | null;   // null when value is inherited from broker default
  is_default: boolean;
  is_read_only: boolean;
  is_sensitive: boolean;
}
```

**Design rationale for `KafkaTopic`**:
- Only the four fields above are guaranteed by the REST API across all Confluent Cloud configurations.
- `partitions_count` is available in the list response — no separate detail call needed for the list view.
- Extended metadata (size, created_at) is not reliably available via the v3 REST API and is therefore excluded to avoid partial/null data rendering problems.

---

## Zustand Store Additions

### State additions to `WorkspaceState` interface

```typescript
// Topics (runtime only, NOT persisted)
topicList: KafkaTopic[];
selectedTopic: KafkaTopic | null;
topicLoading: boolean;
topicError: string | null;
```

**Naming rationale**: All four fields use the `topic` prefix to avoid collision with the existing `schemaLoading`, `selectedTableSchema`, and `selectedTableName` fields already in the store.

### Action additions

```typescript
loadTopics: () => Promise<void>;
selectTopic: (topic: KafkaTopic) => void;
clearSelectedTopic: () => void;
deleteTopic: (topicName: string) => Promise<void>;
createTopic: (params: {
  topicName: string;
  partitionsCount: number;
  replicationFactor: number;
  cleanupPolicy?: 'delete' | 'compact';
  retentionMs?: number;
}) => Promise<void>;
setTopicError: (error: string | null) => void;
```

### Initial state values

```typescript
topicList: [],
selectedTopic: null,
topicLoading: false,
topicError: null,
```

### Persist config

Topic state is **NOT included** in `partialize` — same pattern as `schemaRegistrySubjects`, `statementHistory`, `computePoolPhase`. Topics are always loaded fresh from the API when the panel is opened.

---

## HTTP Client Design

### `src/api/kafka-rest-client.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

const createKafkaAuthHeader = (): string => {
  const credentials = `${env.kafkaApiKey}:${env.kafkaApiSecret}`;
  return `Basic ${btoa(credentials)}`;
};

const KAFKA_API_BASE = '/api/kafka';

export const kafkaRestClient: AxiosInstance = axios.create({
  baseURL: KAFKA_API_BASE,
  headers: {
    'Authorization': createKafkaAuthHeader(),
    'Content-Type': 'application/json',
  },
});

// Request + response interceptors with [Kafka REST] log prefix
// Error interceptor uses same handleApiError pattern as confluentClient
```

**Pattern**: Identical structure to `schema-registry-client.ts` and `confluent-client.ts`. Each API surface has its own Axios instance with isolated auth headers. This avoids header leakage between services.

### `src/api/topic-api.ts`

```typescript
import { kafkaRestClient } from './kafka-rest-client';
import { env } from '../config/environment';
import type { KafkaTopic, TopicConfig } from '../types';

// Convenience helper — avoids repeating cluster path in every call
const clusterPath = () => `/kafka/v3/clusters/${env.kafkaClusterId}`;

export async function listTopics(): Promise<KafkaTopic[]>
// GET {clusterPath}/topics
// Returns data[] array from response; filters out is_internal=true topics
// AND topics matching ^(_schemas|_confluent-.*) (Confluent system topics)
// by default (internal/system topics clutter the UI)

export async function getTopicDetail(topicName: string): Promise<KafkaTopic>
// GET {clusterPath}/topics/{encodeURIComponent(topicName)}
// topicName must be URL-encoded (encodeURIComponent) in the path — same as schema-registry-api.ts

export async function getTopicConfigs(topicName: string): Promise<TopicConfig[]>
// GET {clusterPath}/topics/{encodeURIComponent(topicName)}/configs
// topicName must be URL-encoded (encodeURIComponent) in the path — same as schema-registry-api.ts
// Returns data[] array from response

export async function createTopic(request: {
  topic_name: string;
  partitions_count: number;
  replication_factor: number;
  configs?: Array<{ name: string; value: string }>;
}): Promise<KafkaTopic>
// POST {clusterPath}/topics
// topic_name in request body does not need URL-encoding (it's a JSON field, not a URL segment)

export async function deleteTopic(topicName: string): Promise<void>
// DELETE {clusterPath}/topics/{encodeURIComponent(topicName)}
// topicName must be URL-encoded (encodeURIComponent) in the path — same as schema-registry-api.ts
// Returns 204 No Content on success
```

---

## Vite Proxy Addition

```typescript
// vite.config.ts — add alongside existing /api/schema-registry entry
'/api/kafka': {
  target: env.VITE_KAFKA_REST_ENDPOINT || 'https://pkc-placeholder.us-east-1.aws.confluent.cloud',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/kafka/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    });
  },
},
```

---

## Environment Variables

```
# .env additions (document in README)
VITE_KAFKA_CLUSTER_ID=lkc-xxxxxx
VITE_KAFKA_REST_ENDPOINT=https://pkc-xxxxx.us-east-1.aws.confluent.cloud
VITE_KAFKA_API_KEY=your-kafka-api-key
VITE_KAFKA_API_SECRET=your-kafka-api-secret
```

`kafkaClusterId` and `kafkaRestEndpoint` are optional at app startup — the panel gracefully shows a "Kafka REST endpoint not configured" error state if missing, with a hint to add the env vars.

---

## Component Architecture

### `TopicPanel.tsx` — Root Container

```
TopicPanel
├── Panel header (40px fixed)
│   ├── [selectedTopic] Back arrow + truncated topic name
│   └── [no selection] "Kafka Topics" title + Refresh button (spins while loading)
└── Panel body (flex: 1, overflow: hidden)
    ├── [selectedTopic] <TopicDetail />
    └── [no selection] <TopicList />
```

**Behavior**:
- On mount: calls `loadTopics()` from Zustand store
- `selectedTopic` drives list/detail view switch (same pattern as `selectedSchemaSubject` in SchemaPanel)
- Panel header shows back button + topic name in detail view (matches SchemaPanel header behavior exactly)
- Refresh button triggers `loadTopics()` and is disabled while `topicLoading === true`
- `aria-label="Kafka Topics panel"` on root element

### `TopicList.tsx` — List View

```
TopicList
├── Search + Create row (8px padding, border-bottom)
│   ├── Search input (flex: 1) — "Filter topics..."
│   └── Create button (32x32 icon-only, FiPlus)
├── Count bar (when topicList.length > 0)
│   └── "N topics" or "N of M topics" when filtered
└── Scrollable list (flex: 1, overflow-y: auto)
    ├── [loading] Centered spinner + "Loading topics..."
    ├── [error] Error text + Retry button
    ├── [empty, no filter] Empty state: FiServer icon + "No topics found" + Create Topic CTA button
    ├── [empty, with filter] "No results for '{query}'" + FiSearch icon
    └── [topics] topic rows (click → selectTopic)
```

**Topic row anatomy**:
```
[FiServer icon] [topic_name — truncated]   [N partitions · RF:M]  [FiChevronRight]
```
- `topic_name` in monospace, truncated with `text-overflow: ellipsis`, full name in `title` tooltip
- Partition count + replication factor as secondary metadata in `var(--color-text-tertiary)`, font-size 11px
- Internal topics (`is_internal: true`) are filtered out in `listTopics()` — not shown in list
- Row: `role="listitem"`, `tabIndex={0}`, keyboard: Enter/Space to select, ArrowUp/Down to navigate
- Hover: `var(--color-bg-hover)` background; Focus: `2px solid var(--color-primary)` outline inset

**Search debounce**: 300ms (same as SchemaList pattern)

### `TopicDetail.tsx` — Detail View

```
TopicDetail
├── [DeleteConfirm overlay — absolute positioned when showDeleteConfirm=true]
├── Header bar (metadata + actions)
│   ├── Left: partition badge + replication badge
│   ├── Flex spacer
│   └── Right: Refresh icon button + Delete button (FiTrash2, red border)
├── Metadata section (key-value rows)
│   ├── Topic Name (monospace, copy-on-click)
│   ├── Partitions
│   ├── Replication Factor
│   └── Internal: No / Yes
├── Divider + "Configuration" section label
└── Config table (scrollable)
    ├── [configsLoading] Spinner
    ├── [configsError] Error + Retry
    └── [configs] Table: Name | Value | Default?
        - Rows with is_default=true styled in var(--color-text-tertiary)
        - is_sensitive values shown as "••••••••"
        - Non-default values styled in var(--color-text-primary) with slight emphasis
```

**Config table design**:
- Two-column: `name` (monospace, font-size 12px) | `value` (monospace, font-size 12px)
- "Default" chip on rows where `is_default === true`
- Key configs surfaced prominently (not first, but visually distinct):
  - `retention.ms` — shown with human-readable conversion (e.g. "7d" from ms)
  - `cleanup.policy` — shown with badge (delete = blue, compact = orange)
- Remaining configs in alphabetical order
- Config section loaded lazily when topic is selected (separate `getTopicConfigs()` call)

**Implementation note:** `configsLoading` and `configsError` are local React state (`useState`) in `TopicDetail.tsx`, NOT additions to the Zustand store. This matches the lazy-loading pattern where configs are component-scoped.

**Delete flow** (inline overlay, same as SchemaDetail's `DeleteConfirm`):
- Overlay dims the panel background (`rgba(0,0,0,0.5)`)
- Dialog: title "Delete {topic_name}?", warning body, **topic name confirmation input**
- User must type exact topic name into an input field before the "Delete" button enables
- This is stricter than the schema delete (which has no name confirmation) because topic deletion is immediate and irreversible
- Confirm button: `var(--color-error)` background, label "Delete {topic_name}"
- Cancel button focuses on open; Escape cancels (unless deletion is in progress)
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on title

### `CreateTopic.tsx` — Modal Dialog

```
CreateTopic (fixed-position modal, zIndex 1000)
├── Backdrop (semi-transparent, click-to-close)
└── Dialog (role="dialog", aria-modal, maxWidth 480px)
    ├── Header: "Create Topic" + X close button
    ├── Body (scrollable)
    │   ├── Topic Name input (required, monospace, autoFocus, validates: non-empty, no spaces, no special chars except -._)
    │   ├── Partitions input (number, default 6, min 1, max 1000)
    │   ├── Replication Factor input (number, default 3, min 3)
    │   ├── [Advanced section — collapsed by default, FiChevronDown toggle]
    │   │   ├── Cleanup Policy select: delete | compact (default: delete)
    │   │   └── Retention (ms) input (optional, number, placeholder "604800000 = 7 days")
    │   └── Error alert (role="alert") if API error
    └── Footer
        ├── Cancel button
        └── Create button (primary, disabled until topicName valid, shows spinner while creating)
```

**Replication Factor note**: Minimum value is 3. Confluent Cloud enforces RF >= 3 at the broker level. Setting min=3 prevents UI-level confusion from a 422 rejection when a lower value is submitted.

**Validation rules for topic name**:
- Required (non-empty after trim)
- Max 249 characters (Kafka limit)
- Only alphanumeric, hyphen, underscore, period: `/^[a-zA-Z0-9._-]+$/`
- Cannot be `.` or `..`
- Inline error shown below input field when invalid

**Advanced section**: collapsed by default to reduce cognitive load for simple cases. Clicking the toggle label expands it in-place (no animation required, just show/hide with CSS).

**Focus trap**: Tab/Shift+Tab cycle within dialog while open (same pattern as CreateSchema).
**Escape**: closes dialog unless creation is in progress.
**Focus return**: after close (success or cancel), focus returns to the Create button in TopicList.

---

## App.tsx Integration

Replace the placeholder block (lines 447-451 of current App.tsx):

```tsx
// BEFORE:
{activeNavItem === 'topics' && (
  <div className="coming-soon-panel">
    <span className="coming-soon-text">Topics management coming soon</span>
  </div>
)}

// AFTER:
{activeNavItem === 'topics' && <TopicPanel />}
```

Add import at top of App.tsx:
```tsx
import TopicPanel from './components/TopicPanel/TopicPanel';
```

No layout changes needed — TopicPanel fills the existing `side-panel-content` container, exactly like SchemaPanel.

---

## Acceptance Criteria

All criteria are testable via automated tests and/or browser verification.

### AC-1: Topic List — Load and Display
**Given** the Topics nav item is clicked
**When** the panel opens
**Then** a loading spinner is shown, `loadTopics()` is called, and the topic list renders with topic name, partition count, and replication factor for each non-internal topic.

### AC-2: Topic List — Empty State
**Given** the Kafka cluster has no user-created topics
**When** the Topics panel opens
**Then** an empty state is shown with an icon, "No topics found" message, and a "Create Topic" call-to-action button.

### AC-3: Topic List — Search and Filter
**Given** the topic list has loaded
**When** the user types in the search input
**Then** the list filters in real-time (300ms debounce) to show only topics whose name contains the query (case-insensitive), and the count bar updates to show "N of M topics". Clearing the search restores the full list.

### AC-4: Topic List — No Search Results
**Given** the user has typed a search query that matches no topics
**Then** a "No results for '{query}'" message is shown with a search icon. No error state or spinner.

### AC-5: Topic Detail — Navigation
**Given** the topic list is rendered
**When** the user clicks a topic row (or presses Enter/Space on a focused row)
**Then** the panel transitions to TopicDetail view, the panel header changes to show a back arrow and the topic name (truncated with ellipsis if over ~28 characters), and `selectedTopic` is set in the Zustand store.

### AC-6: Topic Detail — Back Navigation
**Given** TopicDetail is shown
**When** the user clicks the back arrow in the panel header
**Then** `clearSelectedTopic()` is called, the list view is restored, and the previously selected topic row receives focus.

### AC-7: Topic Detail — Metadata Display
**Given** a topic is selected
**Then** the detail view shows: topic name (monospace, clickable to copy), partition count, replication factor, and whether the topic is internal.

### AC-8: Topic Detail — Config Table
**Given** a topic is selected
**When** `getTopicConfigs()` completes
**Then** all topic configs are displayed in a scrollable table with name and value columns. Non-default values are visually distinct from default values. `is_sensitive` values are masked. `retention.ms` is shown with its human-readable equivalent. `cleanup.policy` has a visual badge.

### AC-8a: Topic Detail — Empty Config Table
**Given** `getTopicConfigs()` returns an empty array
**Then** the config table section shows a 'No configurations found' message instead of an empty table.

### AC-9: Topic Detail — Config Load Error
**Given** the configs API call fails (e.g., 403, 503, network timeout)
**Then** an error message is shown in the config section with a Retry button that re-fetches configs without reloading the topic metadata.

### AC-10: Create Topic — Happy Path
**Given** the user clicks "Create Topic" (either from the list header or the empty state CTA)
**When** the dialog opens, the user enters a valid topic name, sets partitions and replication factor, and clicks "Create"
**Then** the API call `createTopic()` is made, a success toast appears ("Topic '{name}' created"), the dialog closes, `loadTopics()` is called to refresh the list, and the newly created topic is visible in the list.

### AC-11: Create Topic — Validation
**Given** the Create Topic dialog is open
**When** the user enters an invalid topic name (empty, contains spaces, contains `!@#`, is `.` or `..`, exceeds 249 chars) or sets partitions to 0
**Then** an inline validation error is shown below the relevant field and the Create button remains disabled.

### AC-12: Create Topic — API Error
**Given** the Create Topic dialog is open with a valid form
**When** the API returns an error (e.g., 409 Conflict — topic already exists, or 422 Unprocessable Entity, or 403 Unauthorized)
**Then** the error message from the API is shown as an alert inside the dialog. The dialog stays open. The user can correct and retry.

### AC-13: Create Topic — Escape and Cancel
**Given** the Create Topic dialog is open
**When** the user presses Escape (and creation is not in progress) or clicks Cancel
**Then** the dialog closes without making any API call.

### AC-14: Delete Topic — Name Confirmation Gate
**Given** TopicDetail is open
**When** the user clicks the Delete button
**Then** a confirmation overlay appears with the topic name, a warning that the action is irreversible, a text input requiring the user to type the exact topic name, and a "Delete {topic_name}" button that is disabled until the input matches exactly.

### AC-15: Delete Topic — Happy Path
**Given** the delete confirmation overlay is open and the user has typed the correct topic name
**When** the user clicks "Delete {topic_name}"
**Then** the `deleteTopic()` API is called, a success toast appears ("Topic '{name}' deleted"), the panel returns to the list view, and `loadTopics()` refreshes the list.

### AC-16: Delete Topic — API Error
**Given** the delete confirmation overlay is showing
**When** the API returns an error
**Then** the error is shown inside the overlay (role="alert"), the overlay stays open, and the user can retry or cancel.

### AC-17: Error State — Full Panel
**Given** the `loadTopics()` call fails (403, 503, network timeout)
**Then** an error state is shown in the TopicList area with the error message and a Retry button that calls `loadTopics()` again. No stale data is shown.

### AC-18: Internal and System Topics — Filtered Out
**Given** the Kafka cluster has internal topics (e.g., `__consumer_offsets`) and Confluent system topics (e.g., `_schemas`, `_confluent-metrics`, `_confluent-command`)
**When** the topic list loads
**Then** topics where `is_internal === true` AND topics matching the prefix pattern `^(_schemas|_confluent-.*)` are NOT shown in the topic list.

### AC-19: Long Topic Names — Truncation
**Given** a topic has a name longer than fits in the list row or the panel header
**Then** the name is truncated with `text-overflow: ellipsis` and the full name is accessible via the `title` attribute (tooltip on hover).

### AC-20: Keyboard Navigation — Topic List
**Given** the topic list is rendered
**Then** the user can Tab into the search input, then Tab to the first topic row; Arrow Down/Up navigates between rows; Enter or Space on a row opens that topic's detail. All without using a mouse.

### AC-21: Keyboard Navigation — Modals
**Given** the Create Topic dialog or the Delete confirmation overlay is open
**Then** Tab/Shift+Tab cycle focus only within the modal (focus trap). Escape closes the modal when no async operation is in progress.

### AC-22: Dark Mode
**Given** the app is in dark mode (`data-theme="dark"`)
**Then** all TopicPanel elements render correctly using CSS custom properties — no hardcoded hex colors, no invisible text, no broken contrast. Panel background matches `var(--color-surface)`, borders use `var(--color-border)`.

### AC-23: Light Mode
**Given** the app is in light mode (default)
**Then** all TopicPanel elements render correctly using CSS custom properties.

### AC-24: Accessibility — ARIA
**Given** any state of the TopicPanel
**Then**: root panel has `aria-label="Kafka Topics panel"`, topic list has `role="list"`, topic rows have `role="listitem"` and `aria-label="Topic: {topic_name}"`, loading states have `aria-live="polite"`, error states have `role="alert"`, modals have `role="dialog"` and `aria-modal="true"` and `aria-labelledby` pointing to the dialog title.

### AC-25: Environment Not Configured
**Given** `VITE_KAFKA_CLUSTER_ID` or `VITE_KAFKA_REST_ENDPOINT` is missing
**Then** the Topics panel shows a clear "Kafka REST endpoint not configured" error state with a hint message about required env vars. The app does not crash.

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Topic name with dots (`my.topic.v1`) | Renders and URL-encodes correctly in API calls |
| Topic name with hyphens and underscores | Renders and URL-encodes correctly |
| Topic name 249 characters long | Accepted; truncated with ellipsis in UI |
| Topic name 250+ characters | Validation error shown in CreateTopic form |
| Topics list has 1000+ topics | List renders with virtual scrolling (or at minimum, no browser freeze); search filters client-side |
| Topic with 0 configs returned | Config section shows "No configurations found" |
| `retention.ms` value is `-1` | Show "Infinite" or "No limit" label |
| `retention.ms` value is very large | Show human-readable (e.g. "365d") |
| Delete confirmation input: partial match | Delete button remains disabled (exact match required) |
| Delete confirmation input: extra whitespace | Delete button remains disabled (no trim — must be exact) |
| Config value is `null` | Show empty cell or em-dash (—) |
| API returns 403 on list | Error state: "Permission denied. Check API key permissions." |
| API returns 401 on list | Error state: "Authentication failed. Check API key and secret." |
| Kafka REST endpoint unreachable (network error) | Error state: "Cannot connect to Kafka REST endpoint." with retry |
| Creating topic that already exists | API returns 409 or 422; show "A topic with this name already exists" in modal |
| Deleting topic while Flink query is running | No blocking from the UI — warn: "Active Flink queries referencing this topic may fail." in the confirmation overlay |
| Topic panel opened before cluster ID configured | Same as AC-25; early-exit with config error state |
| Very long config value (e.g., JSON blob) | Truncated to single line with tooltip showing full value |

---

## Technical Notes

### Environment Guard

**Environment guard:** `TopicPanel.tsx` must check `env.kafkaClusterId` and `env.kafkaRestEndpoint` on mount BEFORE calling `loadTopics()`. If either is empty/missing, render the 'not configured' error state immediately without making any API calls.

### Naming Collision Avoidance

The existing `workspaceStore.ts` has these fields that could collide:
- `schemaLoading` (panel-level schema loading for TreeNavigator/schema panel)
- `selectedTableSchema` (tree navigator selection)
- `selectedTableName`

The new topic state fields use the `topic` prefix across all four fields (`topicList`, `selectedTopic`, `topicLoading`, `topicError`) to avoid any collision. This mirrors the `schemaRegistry` prefix used for Phase 12.2 state.

### Internal Topic Filtering

The `listTopics()` API function filters both `is_internal === true` entries AND topics matching the prefix pattern `^(_schemas|_confluent-.*)` before returning. This prevents Confluent Cloud system topics (`__consumer_offsets`, `_schemas`, `_confluent-metrics`, `_confluent-command`, etc.) from cluttering the list. The filter happens in `topic-api.ts`, not in the component, so the store state (`topicList`) always contains only user-facing topics.

### Config Loading Strategy

Configs are NOT loaded during `listTopics()` — that would require N+1 API calls. Configs are loaded lazily in `TopicDetail.tsx` via a `useEffect` that fires when `selectedTopic` changes. The detail view renders topic metadata immediately (from the list data) while configs load separately with their own loading spinner in the config table section.

### No Schema Integration in This Phase

Phase 12.3 does **not** include schema association (linking topics to Schema Registry subjects). That cross-panel feature belongs in Phase 12.4 (Full Lifecycle Integration). The TopicDetail view should not include a "Schema" tab or "Associate Schema" button — those are Phase 12.4 concerns. Keeping Phase 12.3 scoped prevents blocking on Schema Registry API availability.

### Panel Width

TopicPanel uses the standard `--side-panel-width` (300px) — the same as the default side panel. It does NOT use the wider `--schema-panel-width` (480px), because topic configs are tabular key-value data that fits well at 300px. This avoids the dynamic width-switching logic in App.tsx (which currently only triggers for `activeNavItem === 'schemas'`).

### `vite.config.ts` Auth Note

The Kafka REST proxy must rewrite the path from `/api/kafka` to `/` (removing the prefix entirely), so that calls to `/api/kafka/kafka/v3/clusters/...` become `/kafka/v3/clusters/...` at the target. The auth header is forwarded by the proxy's `proxyReq` handler (same pattern as the existing proxies).

---

## Test Plan

### Unit Tests — `src/__tests__/api/topic-api.test.ts`

| Test | Marker | Tier |
|------|--------|------|
| `listTopics()` returns mapped array and filters internal topics | `[@topic-api]` | T1 |
| `listTopics()` filters topics matching `^(_schemas\|_confluent-.*)` | `[@topic-api]` | T1 |
| `listTopics()` throws on 401 | `[@topic-api]` | T1 |
| `listTopics()` throws on 503 | `[@topic-api]` | T1 |
| `listTopics()` throws on network error | `[@topic-api]` | T1 |
| `listTopics()` handles topic names with dots | `[@topic-api]` | T2 |
| `getTopicDetail()` returns single topic | `[@topic-api]` | T1 |
| `getTopicDetail()` URL-encodes topic name with dots | `[@topic-api]` | T2 |
| `getTopicDetail()` throws on 404 | `[@topic-api]` | T1 |
| `getTopicDetail()` throws on network error | `[@topic-api]` | T1 |
| `getTopicConfigs()` returns configs array | `[@topic-api]` | T1 |
| `getTopicConfigs()` URL-encodes topic name with special chars | `[@topic-api]` | T2 |
| `getTopicConfigs()` throws on 403 | `[@topic-api]` | T1 |
| `getTopicConfigs()` throws on 503 | `[@topic-api]` | T1 |
| `getTopicConfigs()` throws on network error | `[@topic-api]` | T1 |
| `createTopic()` sends correct POST body | `[@topic-api]` | T1 |
| `createTopic()` handles special chars in topic name | `[@topic-api]` | T2 |
| `createTopic()` throws on 409 Conflict | `[@topic-api]` | T1 |
| `createTopic()` throws on 422 | `[@topic-api]` | T1 |
| `createTopic()` throws on network error | `[@topic-api]` | T1 |
| `deleteTopic()` calls DELETE and resolves | `[@topic-api]` | T1 |
| `deleteTopic()` URL-encodes topic name | `[@topic-api]` | T2 |
| `deleteTopic()` rejects on 404 | `[@topic-api]` | T1 |
| `deleteTopic()` throws on 403 | `[@topic-api]` | T1 |
| `deleteTopic()` throws on network error | `[@topic-api]` | T1 |

### Unit Tests — `src/__tests__/components/TopicPanel.test.tsx`

| Test | Marker | Tier |
|------|--------|------|
| Panel renders 'Kafka Topics' title when no topic selected | `[@topic-panel]` | T1 |
| Panel renders back arrow + topic name when topic selected | `[@topic-panel]` | T1 |
| Panel calls loadTopics() on mount | `[@topic-panel]` | T1 |
| Refresh button calls loadTopics() | `[@topic-panel]` | T1 |
| Refresh button disabled while topicLoading=true | `[@topic-panel]` | T1 |
| Panel has aria-label='Kafka Topics panel' | `[@topic-panel]` | T1 |
| Panel shows 'Kafka REST endpoint not configured' when env vars missing (AC-25) | `[@topic-panel]` | T1 |
| activeNavItem='topics' renders TopicPanel, not coming-soon placeholder | `[@topic-panel]` | T1 |

### Unit Tests — `src/__tests__/components/TopicList.test.tsx`

| Test | Marker | Tier |
|------|--------|------|
| Renders loading spinner while topics load | `[@topic-list]` | T1 |
| Renders topic rows with name, partitions, RF | `[@topic-list]` | T1 |
| Renders empty state when topicList is empty | `[@topic-list]` | T1 |
| Renders no-results state when search matches nothing | `[@topic-list]` | T1 |
| Renders error state with Retry button | `[@topic-list]` | T1 |
| Filters topics by search query (case-insensitive) | `[@topic-list]` | T1 |
| Clicking a topic row calls selectTopic | `[@topic-list]` | T1 |
| Enter/Space on a focused row calls selectTopic | `[@topic-list]` | T1 |
| Create Topic button opens CreateTopic modal | `[@topic-list]` | T1 |
| Count bar shows "N of M topics" when filtered | `[@topic-list]` | T2 |
| Topic list has role='list' | `[@topic-list]` | T1 |
| Topic rows have role='listitem' and aria-label | `[@topic-list]` | T1 |
| Loading state has aria-live='polite' | `[@topic-list]` | T1 |
| Error state has role='alert' | `[@topic-list]` | T1 |

### Unit Tests — `src/__tests__/components/TopicDetail.test.tsx`

| Test | Marker | Tier |
|------|--------|------|
| Renders topic name, partitions, RF from selectedTopic | `[@topic-detail]` | T1 |
| Renders loading spinner while configs load | `[@topic-detail]` | T1 |
| Renders config table rows when configs loaded | `[@topic-detail]` | T1 |
| Default configs rendered in muted style | `[@topic-detail]` | T1 |
| Sensitive configs masked as bullets | `[@topic-detail]` | T1 |
| Clicking Delete opens confirmation overlay | `[@topic-detail]` | T1 |
| Delete confirm button disabled until name typed | `[@topic-detail]` | T1 |
| Delete confirm button enabled when name matches exactly | `[@topic-detail]` | T1 |
| Partial match keeps Delete button disabled | `[@topic-detail]` | T2 |
| Escape closes delete overlay | `[@topic-detail]` | T1 |
| Successful delete calls clearSelectedTopic and loadTopics | `[@topic-detail]` | T1 |
| Delete API error shown in overlay | `[@topic-detail]` | T1 |
| Delete overlay has role='dialog' and aria-modal='true' | `[@topic-detail]` | T1 |
| retention.ms shown as human-readable (e.g., '7d') | `[@topic-detail]` | T2 |
| retention.ms=-1 shown as 'Infinite' | `[@topic-detail]` | T2 |
| cleanup.policy=delete shows blue badge | `[@topic-detail]` | T2 |
| cleanup.policy=compact shows orange badge | `[@topic-detail]` | T2 |
| Config with null value shows em-dash | `[@topic-detail]` | T2 |
| Zero configs shows 'No configurations found' | `[@topic-detail]` | T1 |

### Unit Tests — `src/__tests__/components/CreateTopic.test.tsx`

| Test | Marker | Tier |
|------|--------|------|
| Modal renders when isOpen=true | `[@create-topic]` | T1 |
| Modal does not render when isOpen=false | `[@create-topic]` | T1 |
| Escape closes modal when not creating | `[@create-topic]` | T1 |
| Empty topic name shows validation error | `[@create-topic]` | T1 |
| Topic name with space shows validation error | `[@create-topic]` | T1 |
| Topic name with invalid chars shows validation error | `[@create-topic]` | T1 |
| Topic name "." shows validation error | `[@create-topic]` | T1 |
| 249-char topic name passes validation | `[@create-topic]` | T2 |
| 250-char topic name shows validation error | `[@create-topic]` | T2 |
| Partitions=0 keeps Create button disabled | `[@create-topic]` | T1 |
| Valid form enables Create button | `[@create-topic]` | T1 |
| Create button calls createTopic with correct args | `[@create-topic]` | T1 |
| API error shown inside dialog | `[@create-topic]` | T1 |
| Advanced section toggles on click | `[@create-topic]` | T2 |
| Focus trap: Tab cycles within dialog | `[@create-topic]` | T2 |
| Dialog has role='dialog', aria-modal, aria-labelledby | `[@create-topic]` | T1 |

### Unit Tests — `src/__tests__/store/topicStore.test.ts`

| Test | Marker | Tier |
|------|--------|------|
| `loadTopics()` sets topicList on success | `[@topic-store]` | T1 |
| `loadTopics()` sets topicError on failure | `[@topic-store]` | T1 |
| `selectTopic()` sets selectedTopic | `[@topic-store]` | T1 |
| `clearSelectedTopic()` sets selectedTopic to null | `[@topic-store]` | T1 |
| `createTopic()` calls loadTopics after success | `[@topic-store]` | T1 |
| `deleteTopic()` calls clearSelectedTopic and loadTopics after success | `[@topic-store]` | T1 |
| Topic state is NOT persisted to localStorage | `[@topic-store]` | T1 |

### Browser Verification Checklist

- [ ] Topics panel opens when NavRail "Topics" item is clicked
- [ ] Topic list loads and renders real topics from Confluent Cloud
- [ ] Search filters work in real-time
- [ ] Clicking a topic opens detail with metadata visible
- [ ] Config table loads and renders topic configs
- [ ] Delete confirmation overlay opens on Delete click
- [ ] Delete button remains disabled until exact topic name typed
- [ ] Create Topic modal opens, validates, and creates a topic
- [ ] Dark mode: no hardcoded colors, all text visible
- [ ] Light mode: correct appearance
- [ ] Keyboard navigation: Tab through list, Enter to open detail, Escape from modals

---

## Out of Scope (Deferred to Phase 12.4)

- Schema association (linking topics to Schema Registry subjects)
- "Query with Flink" button (generates SELECT * FROM topic)
- Topic config editing (alter configs — POST to `:alter` endpoint)
- Partition-level detail view
- Consumer group offset display
- Cross-navigation between Topics panel and Schema panel

---

## Definition of Done

- [x] All six new files created (`kafka-rest-client.ts`, `topic-api.ts`, `TopicPanel.tsx`, `TopicList.tsx`, `TopicDetail.tsx`, `CreateTopic.tsx`)
- [x] Five files modified (`vite.config.ts`, `environment.ts`, `types/index.ts`, `workspaceStore.ts`, `App.tsx`)
- [x] All 25 acceptance criteria verified
- [x] All unit tests written with markers, passing, 80%+ coverage
- [x] QA Manager sign-off received
- [x] UX/IA sign-off received

---

## Release 2 — Critical Bugs + High-Priority Fixes

**Shipped:** 2026-02-28 (Phase 2 complete)
**Points:** 62 (18 items)
**Source:** Phase 4B Flink Developer stress tests Run-1 + Run-2

### Items Fixed (18 total)

| ID | Type | Description | File(s) Changed |
|----|------|-------------|-----------------|
| CRIT-1 | Bug | Auth header moved to request interceptor (was burned at module load) | `kafka-rest-client.ts` |
| CRIT-2 | Bug | System topic regex now includes `__confluent-*` and `_confluent-*` variants | `topic-api.ts` |
| CRIT-3 | Bug | Double `loadTopics()` race eliminated — store only does API call, component orchestrates navigation | `workspaceStore.ts`, `TopicDetail.tsx` |
| HIGH-1 | Bug | Unmount guard (`cancelled` flag) in `TopicPanel.useEffect` prevents stale state writes | `TopicPanel.tsx` |
| HIGH-2 | Bug | Network error branch now reachable — Axios sets `response: undefined` (not absent) | `workspaceStore.ts` |
| HIGH-3 | Bug | Deleted topic no longer ghost-appears — optimistic removal from `topicList` before API call | `workspaceStore.ts` |
| HIGH-4 | Bug | `cleanup.policy=delete,compact` now renders both DELETE + COMPACT badges correctly | `TopicDetail.tsx` |
| HIGH-5 | Bug | Rapid topic switching cancels previous config fetch via `AbortController` | `TopicDetail.tsx` |
| R2-ABT | Bug | `AbortController.signal` forwarded to Axios `getTopicConfigs` HTTP layer (not just React guard) | `topic-api.ts`, `TopicDetail.tsx` |
| MED-2 | Enhancement | Virtual scrolling integrated via `@tanstack/react-virtual` — 1000+ topics render without freeze | `TopicList.tsx` |
| MED-3 | Bug | Space-only topic names now show explicit error (previously silently disabled Create button) | `CreateTopic.tsx` |
| MED-5 | Bug | Decimal `retention.ms` values (e.g. `1.5`) now show validation error (was silently truncated) | `CreateTopic.tsx` |
| MED-6 | Bug | HTTP timeout added to Kafka REST client (`timeout: 30000` on Axios instance) | `kafka-rest-client.ts` |
| LOW-6 | Bug | Partition/RF/cleanup badges use CSS variables (`--color-primary-badge-bg`) instead of hardcoded hex | `TopicDetail.tsx` |
| LOW-1 | Bug | `console.log` in Kafka REST interceptors guarded with `import.meta.env.DEV` | `kafka-rest-client.ts` |
| ENH-2 | Enhancement | Health indicator warning badge for topics with `partitions_count < 2` | `TopicList.tsx`, `TopicDetail.tsx` |
| ENH-3 | Enhancement | Config search/filter input within TopicDetail config table | `TopicDetail.tsx` |
| ENH-6 | Enhancement | Copy config value button on row hover (hover-reveal pattern from Phase 5.4) | `TopicDetail.tsx` |

### Implementation Notes

**AbortController Pattern (R2-ABT + HIGH-5):**
- `TopicDetail.tsx` creates a new `AbortController` at the start of each `fetchConfigs()` call
- The controller's `signal` is now passed to `getTopicConfigs(topicName, signal)` in `topic-api.ts`
- Axios forwards the signal to the native XHR/fetch layer, cancelling the HTTP request
- A `requestIdRef` stale-response guard provides an additional layer of protection
- On component unmount: `abortControllerRef.current?.abort()` in `useEffect` cleanup cancels in-flight requests
- Previously: signal guarded React state updates only; HTTP request continued running on slow networks

**Virtualization (MED-2):**
- `@tanstack/react-virtual` was already in `package.json` dependencies (unused)
- Integration uses `position: absolute` items with `translateY` transforms inside a fixed-height container
- `ITEM_HEIGHT = 41px` (8px padding × 2 + 25px content + 1px border)
- `overscan: 5` buffers 5 invisible rows above and below the visible area
- Test mock renders all items flat (jsdom has no layout engine) — verified with 50-item list

**Auth Interceptor (CRIT-1):**
- Previously: `btoa(key + ':' + secret)` evaluated at module load time — credentials couldn't rotate
- Now: `btoa(env.kafkaApiKey + ':' + env.kafkaApiSecret)` evaluated in the Axios request interceptor
- Any credential rotation in `env` config takes effect on the next request without re-import

### Test Coverage

- **Test file:** `src/__tests__/components/TopicPanel.test.tsx`
- **New R2 markers:** 13 new `@topic-r2-*` describe blocks covering all 18 items
- **Run command:** `npm test -- -t "@topic-r2" --run`
- **Result:** 29 tests pass, 0 failures
- **Full file result:** 148 tests pass, 0 failures

### R2 Test Markers

| Marker | Items Covered |
|--------|---------------|
| `@topic-r2-crit1` | CRIT-1: auth interceptor per-request |
| `@topic-r2-crit2` | CRIT-2: system topic regex |
| `@topic-r2-crit3` | CRIT-3: delete race condition |
| `@topic-r2-high1` | HIGH-1: unmount guard |
| `@topic-r2-high2` | HIGH-2: network error branch |
| `@topic-r2-high3` | HIGH-3: ghost topic elimination |
| `@topic-r2-high4` | HIGH-4: combined cleanup policy badge |
| `@topic-r2-high5` | HIGH-5: rapid switch abort |
| `@topic-r2-abt` | R2-ABT: AbortController signal to Axios |
| `@topic-r2-med2` | MED-2: virtual scroll 1000+ topics |
| `@topic-r2-med3` | MED-3: space-only name validation |
| `@topic-r2-med5` | MED-5: decimal retention validation |
| `@topic-r2-med6` | MED-6: HTTP timeout |
| `@topic-r2-low6` | LOW-6: CSS vars for badge colors |
| `@topic-r2-low1` | LOW-1: console.log production guard |
| `@topic-r2-enh2` | ENH-2: health indicator badge |
| `@topic-r2-enh3` | ENH-3: config search/filter |
| `@topic-r2-enh6` | ENH-6: copy config value button |

### Performance Metrics

- **Virtual scroll rendering:** 1000+ topics in `TopicList` no longer blocks the browser main thread
- **Cancelled HTTP requests:** With AbortController, switching topics rapidly fires 1 HTTP request (the current one), not N concurrent requests
- **Auth header evaluation:** ~0ms overhead per request (simple `btoa()` call in interceptor vs. none previously)

### Known Limitations

- Virtual scroll keyboard navigation (`scrollToIndex` on `focusedIndex` change) deferred to Release 3 (R2-VS)
- Focus restoration to previously selected topic on back-nav deferred to Release 3 (LOW-2)
- `focusedIndex` debounce sync reset on fast Enter deferred to Release 3 (R2-DEB)

---

## Release 3 — Topic Management Polish + Major Enhancements

**Shipped:** 2026-02-28 (Phase 2 complete)
**Points:** 36 (14 items)
**Source:** Phase 4B Flink Developer stress tests Run-3 + Phase 4D customer interviews

### Items Implemented (14 total)

| ID | Type | Description | File(s) Changed |
|----|------|-------------|-----------------|
| MED-1 | Bug | `formatRetentionMs` already correct — confirmed no change needed | — |
| MED-4 | Bug | `submitted=true` guard in `handleCreate` already correct — confirmed | — |
| MED-7 | Enhancement | Tooltip value for `.ms` config keys already implemented — confirmed | — |
| LOW-3 | Bug | Delete dialog title ellipsis overflow already correct — confirmed | — |
| LOW-4 | Bug | `triggerRef` focus return on delete dialog close already correct — confirmed | — |
| LOW-5 | Enhancement | `getTopicDetail` JSDoc `@reserved` annotation already present — confirmed | — |
| ENH-1 | Enhancement | `handleInsertTopicName` via `insertTextAtCursor` already correct — confirmed | — |
| ENH-7 | Enhancement | Compact policy warning in `CreateTopic` already implemented — confirmed | — |
| R2-ABT | Bug | `getTopicConfigs` `signal` param already forwarded correctly — confirmed | — |
| LOW-2 | Bug | Focus restoration to previously selected topic on back-nav — store `lastFocusedTopicName`, `data-topic-name` attribute, `requestAnimationFrame` deferred focus | `workspaceStore.ts`, `TopicList.tsx` |
| R2-VS | Bug | `scrollToIndex` on `focusedIndex` change — `useEffect` with optional chaining `?.` for jsdom safety | `TopicList.tsx` |
| R2-DEB | Bug | Synchronous `setFocusedIndex(-1)` in `handleSearchChange` (not just debounced effect) prevents stale highlight on fast Enter | `TopicList.tsx` |
| ENH-4 | Enhancement | Show `created_at` / `last_modified_at` metadata in TopicDetail overview — `formatRelativeTime()` helper, conditional rows | `types/index.ts`, `TopicDetail.tsx` |
| ENH-5 | Enhancement | Bulk delete — multi-select mode with toolbar, select-all, confirmation dialog with topic list, sequential deletion to avoid rate limits | `workspaceStore.ts`, `TopicList.tsx` |

### Implementation Notes

#### LOW-2: Focus Restoration
- `lastFocusedTopicName: string | null` added to Zustand store; set whenever `selectTopic` is called
- On `TopicList` mount, a `useEffect` (empty deps, runs once) finds the matching row via `querySelector('[data-topic-name="..."]')` using `CSS.escape()` for special characters
- `rowVirtualizer.scrollToIndex?.()` scrolls the row into view first, then `requestAnimationFrame` defers the `.focus()` call so it runs after the virtualizer renders the row
- After restoring focus, `setLastFocusedTopicName(null)` clears the stored name to prevent re-triggering

#### R2-VS: Virtual Scroll Keyboard Navigation
- `useEffect` watching `[focusedIndex, filteredTopics.length, rowVirtualizer]` calls `rowVirtualizer.scrollToIndex?.(focusedIndex, { align: 'auto' })`
- Optional chaining `?.` is critical — jsdom (test environment) virtualizer mock doesn't include `scrollToIndex`, so without `?.` tests crash with "not a function"
- `align: 'auto'` keeps the item in view with minimal scrolling (doesn't always center)

#### R2-DEB: Search Debounce Race Fix
- Previously only the debounced filter effect reset `focusedIndex` — if a user typed and pressed Enter within the debounce window (300ms), `filteredTopics` still contained old matches but `focusedIndex` pointed to the correct new index
- Fix: `setFocusedIndex(-1)` called synchronously in `handleSearchChange` onChange handler, so the index is always cleared immediately on any keystroke

#### ENH-4: Topic Timestamps
- `created_at?: string` and `last_modified_at?: string` added as optional fields to `KafkaTopic` type (guarded by `// ENH-4` comment)
- `formatRelativeTime(iso: string)` helper in `TopicDetail.tsx` converts ISO timestamps to human-readable relative time ("3 days ago", "2 hours ago", "just now")
- Conditional rows only rendered when the fields are present (API version may not include them)

#### ENH-5: Bulk Delete
- Store additions: `isBulkMode: boolean`, `bulkSelectedTopics: string[]`, and 6 new actions (`enterBulkMode`, `exitBulkMode`, `toggleBulkTopicSelection`, `selectAllBulkTopics`, `clearBulkSelection`, `deleteTopicsBulk`)
- `deleteTopicsBulk` uses **sequential** deletion (not `Promise.all`) to avoid Kafka REST rate limits — each topic waits for the previous to complete
- Optimistic UI: list is filtered before API calls, with `loadTopics()` refresh after all calls complete
- Bulk mode activates via a "Select" toolbar button; a sticky action bar shows "Select All / N selected / Delete (N) / Cancel"
- Confirmation dialog lists the first 5 topic names + "and N more..." overflow text, requiring one explicit click to proceed

### Test Coverage

| Marker | Tests | Description |
|--------|-------|-------------|
| `@topic-r3-debounce` | 3 | R2-DEB synchronous focusedIndex reset on search change |
| `@topic-r3-scroll` | 3 | R2-VS scrollToIndex called on focusedIndex change |
| `@topic-r3-focus` | 3 | LOW-2 focus restoration on mount from lastFocusedTopicName |
| `@topic-r3-bulk` | 7 | ENH-5 bulk delete mode: toolbar, selection, confirmation dialog, delete action |
| `@topic-r3-meta` | 3 | ENH-4 created_at/last_modified_at rendering and formatRelativeTime |
| `@topic-r3-warning` | 3 | ENH-7 compact policy warning in CreateTopic |
| `@topic-r3-store-bulk` | 27 | Store actions: enterBulkMode, exitBulkMode, toggleBulkTopicSelection, selectAllBulkTopics, clearBulkSelection, deleteTopicsBulk |

**Total R3 tests: 49 (all passing)**

### Known Limitations

- R2-COPY: Config copy button DOM query (`querySelector('[data-copy-btn]')`) in `TopicDetail.tsx` `onMouseEnter` handler causes cosmetic flicker on rapid row hover. This is a cosmetic-only issue (no functional impact) — deferred to Track C Tier 2 tests
- `created_at` / `last_modified_at` fields only appear if the Confluent Cloud Kafka REST API version includes them — not all clusters expose these fields
- Bulk delete is sequential by design; for 20+ topics this can take several seconds; no per-topic progress indicator (planned for future release)
