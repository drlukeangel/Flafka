# Phase 13.1 — Topic Message Browser, Stream Cards & Synthetic Producer

**Status**: Phase 1 PRD — DRAFT
**Author**: Technical Principal Product Manager (TPPM)
**Date**: 2026-03-01
**Depends On**: Phase 12 series complete
**Blocks**: Phase 13.2 (Live Pipeline View — streaming consumer + end-to-end feedback loop)
**Sources**:
- Product Owner directive: Build topic message viewing + synthetic data production into the app
- Product Owner UX direction: Multi-topic stream cards in slide-out panel, play/stop producer toggle
- Confluent Cloud message viewer reference (topic `EOT-PLATFORM-EXAMPLES-LOANS-FILTERED-v1`)
- Confluent Kafka REST API v3 produce endpoint: https://docs.confluent.io/cloud/current/kafka-rest/kafka-rest-cc.html
- Confluent Stream Catalog GraphQL API: https://docs.confluent.io/cloud/current/stream-governance/graphql-apis.html
- Network analysis: Confluent Cloud message viewer uses internal Turbo GraphQL BFF (not publicly accessible)

---

## Problem Statement

The Flink SQL Workspace UI manages topics and schemas — but there is **no way to see what's actually inside a topic** and **no way to push test data into one**. Users must leave the app, navigate to Confluent Cloud, and use its Messages tab. For producing test data, they need external tools. This context-switching breaks the Flink SQL development flow.

**Specific gaps driving Phase 13.1:**

1. **No message browsing**: Users cannot inspect topic content from within the app. The "Query with Flink" button creates a visible Flink statement but lacks a purpose-built message viewer UX (partition filter, offset display, JSON expansion, multi-topic comparison).

2. **No message production**: The Kafka REST API v3 has a produce endpoint, but the app has no integration. Users cannot seed test data without external tools.

3. **No synthetic data generation**: Flink SQL development needs realistic test data in input topics. A schema-aware producer with a simple play/stop toggle would eliminate the need for custom scripts.

4. **No multi-topic view**: When developing Flink SQL pipelines that read from multiple input topics and write to output topics, users need to see messages across several topics simultaneously. Confluent Cloud only shows one topic at a time.

**Technical discovery:**
- Confluent Cloud's message viewer uses an internal GraphQL BFF (`confluent.cloud/api/turbo/v1alpha1/graphql`) — not publicly accessible.
- Kafka REST API v3 has produce (`POST /records`) but NO consume endpoint on Confluent Cloud.
- **Flink SQL is the consumption mechanism**: `SELECT * FROM topic` executes on the compute pool and returns messages through existing polling infrastructure.
- **Schema Registry provides schemas** for synthetic data generation (`getSchemaDetail()` already exists).

**Goals for Phase 13.1:**
1. Add a slide-out Stream Panel from the right side of the app
2. Show all available topics in the panel with multi-select
3. Each selected topic renders as a self-contained "Stream Card" with message table, play/stop producer, and controls
4. Support multiple simultaneous stream cards for multi-topic monitoring
5. Add Kafka REST v3 produce API and schema-aware synthetic data generator

---

## Story Points Summary

| ID | Feature | Type | Points |
|:---|:---|:---|:---:|
| F1 | Stream Panel — slide-out with topic selector | Enhancement | 8 |
| F2 | Stream Card — self-contained topic message viewer | Enhancement | 13 |
| F3 | Kafka REST v3 produce API integration | Enhancement | 3 |
| F4 | Schema-aware synthetic data generator | Enhancement | 8 |
| F5 | Play/stop synthetic producer toggle per card | Enhancement | 5 |
| F6 | Message table with JSON expansion | Enhancement | 5 |
| F7 | Shared ExpandableJsonPane extraction | Refactor | 2 |
| F8 | Background statement management | Enhancement | 5 |
| **TOTAL** | | | **49** |

---

## Proposed Solution

### Feature 1: Stream Panel — Slide-Out with Topic Selector

**Files:** `src/components/StreamPanel/StreamPanel.tsx` (new), `src/App.tsx`, `src/types/index.ts`, `src/store/workspaceStore.ts`

**UX Concept — The Stream Panel:**
A slide-out panel that opens from the right edge of the app (not from TopicDetail — from the main layout). It's a new top-level panel, accessible from anywhere in the app. Think of it as a "Stream Monitor" that lives alongside the workspace.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ NavRail │  Main Content (workspace/topics/etc)  │  Stream Panel          │
│         │                                        │                        │
│  [ws]   │  SELECT * FROM loans                  │  Stream Monitor    [×] │
│  [tree] │  WHERE amount > 1000                  │  ─────────────────────  │
│  [topic]│  INSERT INTO loans_filtered           │  Topics: [search...]   │
│  [sch]  │    SELECT * FROM loans                │  ☑ loans-input    [▶]  │
│  [hist] │    WHERE status = 'APPROVED'          │  ☑ loans-filtered [▶]  │
│  [⚡]   │                                        │  ☐ orders-raw          │
│         │  ┌─ Results ─────────────────┐        │  ☐ payments-stream     │
│         │  │ loan_id  amount   status  │        │  ─────────────────────  │
│         │  │ abc123   18783    APPR... │        │  ┌─ loans-input ──[■]─┐│
│         │  │ def456   5000     APPR... │        │  │ Producing... 12 ▾  ││
│         │  └───────────────────────────┘        │  │ Time   Part Key    ││
│         │                                        │  │ 15:22  5   86bd   ││
│         │                                        │  │ 15:21  2   b65e   ││
│         │                                        │  │ 8 msgs · 1.2s     ││
│         │                                        │  └──────────────────┘ │
│         │                                        │  ┌─ loans-filtered ──┐│
│         │                                        │  │ [Fetch] All▾ 50▾  ││
│         │                                        │  │ Time   Part Key   ││
│         │                                        │  │ 15:22  4   a834   ││
│         │                                        │  │ 15:21  0   cd1a   ││
│         │                                        │  │ 6 msgs · 0.8s     ││
│         │                                        │  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- A new nav icon (`⚡` or `FiRadio` / `FiActivity`) appears in the NavRail. Clicking it toggles the Stream Panel open/closed.
- The panel slides in from the right edge. The main content area narrows to make room (CSS transition ~300ms).
- Width: CSS custom property `--stream-panel-width` (default `420px`, min `360px`, max `600px`).
- **Topic Selector** at the top of the panel:
  - Shows a searchable list of all topics (reuses the topic list data already in the store).
  - Each topic has a checkbox. Checking a topic adds a Stream Card for it below.
  - Unchecking removes the card.
  - Search input filters the topic list by name (debounced 300ms, case-insensitive).
  - Maximum 5 simultaneous stream cards to prevent performance issues.
- The panel state (open/closed, selected topics) is session-scoped — not persisted to localStorage.
- Add `'streams'` to the `NavItem` union type.

**Acceptance Criteria:**

- AC-1.1: New nav icon in NavRail for Stream Panel.
- AC-1.2: Clicking toggles the panel open/closed from the right edge.
- AC-1.3: Main content narrows with CSS transition (~300ms).
- AC-1.4: Panel width: `--stream-panel-width` (default 420px).
- AC-1.5: Topic selector with searchable checkbox list of all topics.
- AC-1.6: Checking a topic adds a Stream Card. Unchecking removes it.
- AC-1.7: Search filters topic list (debounced 300ms, case-insensitive).
- AC-1.8: Max 5 simultaneous cards. 6th checkbox disabled with tooltip "Max 5 streams".
- AC-1.9: Session-scoped state (not persisted).
- AC-1.10: `'streams'` added to `NavItem` type.
- AC-1.11: CSS custom properties. Dark + light mode.
- AC-1.12: Nav icon: `aria-label="Stream monitor"`. Panel: `role="complementary"`, `aria-label="Stream monitor"`.

---

### Feature 2: Stream Card — Self-Contained Topic Message Viewer

**Files:** `src/components/StreamPanel/StreamCard.tsx` (new)

**UX Concept — Stream Cards:**
Each Stream Card is a self-encapsulated section within the Stream Panel. It shows one topic's messages and has its own controls. Cards stack vertically and are individually collapsible. Each card is a miniature version of the Confluent Cloud message viewer, tuned for a compact panel layout.

**Card Anatomy:**
```
┌─ topic-name ──────────────── [▶] [▾] [×] ┐
│ Partition [All▾]  Limit [50▾]  [Fetch]    │
│ ────────────────────────────────────────── │
│ Time      Part  Off   Key     Value       │
│ 15:22:30  5     1976  86bd7d  { "loan...  │
│ 15:22:01  2     1856  b65ef1  { "loan...  │
│ 15:21:57  5     1974  d447ce  { "loan...  │
│ ────────────────────────────────────────── │
│ 8 messages · Fetched in 1.2s              │
└───────────────────────────────────────────┘
```

**Header buttons:**
- `[▶]` / `[■]` — Play/stop synthetic producer (F5)
- `[▾]` — Collapse/expand the card body (keeps header visible)
- `[×]` — Remove the card (unchecks the topic in the selector)

**Behavior:**
- Each card manages its own state: fetch status, messages, producer status, filters.
- Cards are individually collapsible — collapsed cards show only the header bar with topic name + play/stop button.
- Fetch controls: Partition filter dropdown + Limit dropdown + Fetch/Refresh buttons.
- Message display: compact table (F6) within the card.
- Each card triggers its own background Flink SQL statement (F8).
- Cards can be fetching/producing independently and simultaneously.

**Compact Layout Adaptations:**
- Timestamp column shows time only (HH:MM:SS), not full ISO date — hover tooltip shows full timestamp.
- Key column truncated to 8 chars with hover tooltip.
- Value column truncated to ~40 chars with expand button.
- Table font size: `0.8rem` (smaller than workspace ResultsTable).

**Acceptance Criteria:**

- AC-2.1: `StreamCard` component renders a self-contained card for one topic.
- AC-2.2: Header shows topic name + play/stop + collapse + remove buttons.
- AC-2.3: Body shows partition filter, limit dropdown, fetch/refresh buttons.
- AC-2.4: Each card manages its own state independently.
- AC-2.5: Cards individually collapsible (header stays visible when collapsed).
- AC-2.6: Remove button (`×`) unchecks the topic in the selector.
- AC-2.7: Compact layout: time-only timestamps, truncated key/value, 0.8rem font.
- AC-2.8: Hover tooltips for truncated values.
- AC-2.9: Multiple cards fetch/produce independently.
- AC-2.10: CSS custom properties. Dark + light mode. Card has subtle border/shadow.
- AC-2.11: Card header keyboard accessible. `aria-expanded` on collapse toggle.

---

### Feature 3: Kafka REST v3 Produce API Integration

**Files:** `src/api/topic-api.ts`

**Behavior:**
- New `produceRecord()` function in `topic-api.ts`.
- Endpoint: `POST /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/records`
- Request body:
  ```json
  {
    "key": { "type": "STRING", "data": "key-value" },
    "value": { "type": "JSON", "data": { "field": "value" } }
  }
  ```
- `partition_id` optional. Response: delivery report (`partition_id`, `offset`, `timestamp`).
- Accepts `AbortSignal`. Content-Type: `application/json`.

**Acceptance Criteria:**

- AC-3.1: `produceRecord(topicName, record, signal?)` in `topic-api.ts`.
- AC-3.2: POSTs to `/kafka/v3/clusters/{clusterId}/topics/{topicName}/records`.
- AC-3.3: Supports `key` (optional), `value` (required), `partition_id` (optional).
- AC-3.4: Returns `{ partition_id, offset, timestamp }`.
- AC-3.5: Accepts `AbortSignal`. Errors thrown.
- AC-3.6: `Content-Type: application/json`.

---

### Feature 4: Schema-Aware Synthetic Data Generator

**Files:** `src/utils/synthetic-data.ts` (new)

**Behavior:**
- Generates realistic synthetic JSON from an Avro or JSON Schema definition.
- Input: `schemaText` (string) + `schemaType` (`'AVRO' | 'JSON'`).
- Output: `{ data: Record<string, unknown>, error?: string }`.
- **Avro type mapping:**
  - `string` → heuristic based on field name (`id`→UUID, `name`→name, `email`→email, `status`→random status, `date/time/created`→ISO timestamp, default→alphanumeric)
  - `int`/`long` → random integer (1–100000)
  - `float`/`double` → random decimal (0.01–99999.99, 2dp)
  - `boolean` → random true/false
  - `null` → `null`
  - Union `["null", "string"]` → 80% non-null, 20% null
  - `array` → 1–3 items
  - `record` (nested) → recursive
  - `enum` → random from symbols
  - `map` → 1–3 entries
- JSON Schema: similar mapping (string/number/integer/boolean/null/array/object).
- Protobuf: deferred to Phase 13.2.
- Pure TypeScript, no external deps. Optional `seed` for determinism.

**Acceptance Criteria:**

- AC-4.1: `generateSyntheticRecord(schemaText, schemaType)` in `synthetic-data.ts`.
- AC-4.2: Avro primitives: string, int, long, float, double, boolean, null.
- AC-4.3: Avro unions: 80% non-null.
- AC-4.4: Avro nested records, enums, arrays, maps.
- AC-4.5: Field name heuristics (id→UUID, name→name, email→email, etc.).
- AC-4.6: JSON Schema basic support.
- AC-4.7: Returns `{ data, error? }`. Error if schema parse fails.
- AC-4.8: No external deps. Optional seed parameter.

---

### Feature 5: Play/Stop Synthetic Producer Toggle Per Card

**Files:** `src/components/StreamPanel/StreamCard.tsx`

**UX Concept:**
Each Stream Card has a play/stop toggle button in its header. One click to start producing, one click to stop. Minimal UI.

**Behavior:**
- **Play (`▶`)**: Starts synthetic producer for this card's topic.
  1. Looks up schema via `{topicName}-value` subject in Schema Registry.
  2. No schema → inline error in card: "No schema found."
  3. Schema found → starts producing at 1 msg/sec.
  4. Each message generated by `generateSyntheticRecord()`, sent via `produceRecord()`.
  5. Button switches to `■`. Counter: "Producing... {N} sent" in card header.
  6. Continues until Stop or card removal.
- **Stop (`■`)**: Halts production. Shows "Produced {N}". Returns to `▶`.
- Production managed via `setInterval` in React ref per card.
- Produce error → auto-stop + error in card.
- Card removal / panel close → stops production.

**Acceptance Criteria:**

- AC-5.1: Play/stop toggle in each Stream Card header.
- AC-5.2: Play: schema lookup → produce at 1 msg/sec.
- AC-5.3: No schema → error in card.
- AC-5.4: Button toggles `▶` ↔ `■`. Counter in header.
- AC-5.5: Stop halts immediately. Shows final count.
- AC-5.6: Auto-stop on error, card removal, panel close.
- AC-5.7: Per-card interval via React ref.
- AC-5.8: Each message gets unique key.
- AC-5.9: CSS custom properties. Dark + light mode.

---

### Feature 6: Message Table with JSON Expansion (Compact)

**Files:** `src/components/StreamPanel/StreamCardTable.tsx` (new)

**Behavior:**
- Compact message table rendered inside each Stream Card.
- Columns: Timestamp (HH:MM:SS), Partition, Offset, Key (8-char truncated), Value (40-char truncated).
- JSON expand via shared `ExpandableJsonPane` (F7).
- Sortable by Timestamp (default descending).
- Row count + fetch duration in card footer.
- No virtual scrolling (max 1000 rows per card via LIMIT).
- Font size: `0.8rem`. Compact row height.

**Acceptance Criteria:**

- AC-6.1: Compact table in StreamCard: Timestamp, Partition, Offset, Key, Value.
- AC-6.2: Timestamp: HH:MM:SS with full ISO tooltip.
- AC-6.3: Key truncated to 8 chars. Value to ~40 chars. Hover tooltips.
- AC-6.4: JSON expand via `ExpandableJsonPane`.
- AC-6.5: Sortable by Timestamp (default descending).
- AC-6.6: Footer: "{N} messages · Fetched in {X.X}s".
- AC-6.7: Font `0.8rem`. Compact rows.
- AC-6.8: CSS vars. Dark + light mode.

---

### Feature 7: Shared ExpandableJsonPane Extraction

**Files:** `src/components/shared/ExpandableJsonPane.tsx` (new), `src/components/ResultsTable/ResultsTable.tsx` (refactor)

**Behavior:**
- Extract JSON cell expander from `ResultsTable.tsx` into shared component.
- Props: `value: unknown`, `anchorRect: DOMRect`, `onClose: () => void`.
- Portal to `document.body`. Pretty-print + copy. Close on Esc/outside/scroll.
- Both `ResultsTable` and `StreamCardTable` use it. No behavior change to ResultsTable.

**Acceptance Criteria:**

- AC-7.1: `ExpandableJsonPane` in `src/components/shared/`.
- AC-7.2: Props: `value`, `anchorRect`, `onClose`.
- AC-7.3: Portal, pretty-print, copy, close on Esc/outside/scroll.
- AC-7.4: `ResultsTable` refactored — no behavior change.
- AC-7.5: `StreamCardTable` uses it.

---

### Feature 8: Background Statement Management

**Files:** `src/store/workspaceStore.ts`, `src/types/index.ts`

**Behavior:**
- New `backgroundStatements: BackgroundStatement[]` in the store.
- Background statements are invisible to the workspace UI and history panel.
- Each has `purpose: 'topic-messages'` and `contextId: topicName`.
- Actions:
  - `executeBackgroundStatement(sql, purpose, contextId)` — creates and executes.
  - `cancelBackgroundStatement(contextId)` — cancels running statement for a context.
  - `clearBackgroundStatements(contextId?)` — clears completed/cancelled statements.
- Max 1 running background statement per contextId.
- NOT persisted to localStorage.
- Panel close / topic deselect → cancel running background statements.

**Acceptance Criteria:**

- AC-8.1: `backgroundStatements` array in store.
- AC-8.2: `executeBackgroundStatement(sql, purpose, contextId)` action.
- AC-8.3: `cancelBackgroundStatement(contextId)` action.
- AC-8.4: Background statements invisible in workspace cells + history.
- AC-8.5: Max 1 per contextId.
- AC-8.6: Not persisted to localStorage.
- AC-8.7: Cleanup on panel close / topic deselect.

---

## Files to Create/Modify

| Action | File | Features |
|:---|:---|:---|
| **Create** | `src/components/StreamPanel/StreamPanel.tsx` | F1 |
| **Create** | `src/components/StreamPanel/StreamCard.tsx` | F2, F5 |
| **Create** | `src/components/StreamPanel/StreamCardTable.tsx` | F6 |
| **Create** | `src/components/shared/ExpandableJsonPane.tsx` | F7 |
| **Create** | `src/utils/synthetic-data.ts` | F4 |
| Modify | `src/App.tsx` | F1 (panel layout + nav icon) |
| Modify | `src/api/topic-api.ts` | F3 |
| Modify | `src/store/workspaceStore.ts` | F1, F8 (streams state + background stmts) |
| Modify | `src/types/index.ts` | F1, F3, F8 (new types + NavItem) |
| Modify | `src/components/ResultsTable/ResultsTable.tsx` | F7 (refactor to shared pane) |

---

## Type Definitions

```typescript
// New/modified types in src/types/index.ts

// Updated NavItem
type NavItem = 'workspace' | 'tree' | 'topics' | 'schemas' | 'history'
             | 'help' | 'settings' | 'streams';

/** Background statement — invisible to workspace UI */
interface BackgroundStatement extends SQLStatement {
  purpose: 'topic-messages';
  contextId: string; // topic name
}

/** Kafka REST v3 produce request */
interface ProduceRecord {
  key?: { type: 'STRING' | 'BINARY' | 'JSON'; data: string | object };
  value: { type: 'STRING' | 'BINARY' | 'JSON'; data: string | object };
  partition_id?: number;
}

/** Kafka REST v3 produce response */
interface ProduceResult {
  cluster_id: string;
  topic_name: string;
  partition_id: number;
  offset: number;
  timestamp: string;
}

/** Synthetic data generator result */
interface SyntheticResult {
  data: Record<string, unknown>;
  error?: string;
}

/** Per-card stream state */
interface StreamCardState {
  topicName: string;
  isCollapsed: boolean;
  producer: { isProducing: boolean; messagesSent: number; error?: string };
  consumer: { status: 'idle' | 'fetching' | 'done' | 'error' | 'cancelled'; messages: TopicMessage[]; fetchDuration?: number; error?: string };
  filters: { partition: number | null; limit: number };
}
```

---

## API Reference

### Produce Records (Kafka REST v3)

```
POST /kafka/v3/clusters/{cluster_id}/topics/{topic_name}/records
Content-Type: application/json
Authorization: Basic <base64(kafkaApiKey:kafkaApiSecret)>

Request:
{ "key": { "type": "JSON", "data": "a7b3c9d2" },
  "value": { "type": "JSON", "data": { "loan_id": "a7b3c9d2", "amount": 18783.19, "status": "APPROVED" } } }

Response (200):
{ "cluster_id": "lkc-xxx", "topic_name": "my-topic",
  "partition_id": 2, "offset": 1547, "timestamp": "2026-03-01T15:30:00Z" }
```

### Message Consumption (Flink SQL — background statement)

```sql
SELECT * FROM `catalog`.`database`.`topic_name` LIMIT 50;
```

### Schema Lookup (existing — no changes)

```
GET /subjects/{topicName}-value/versions/latest
→ { schemaType: "AVRO", schema: "{...}" }
```

---

## Phasing Context

| Phase | Feature | Key Capability |
|:---|:---|:---|
| **13.1** | Stream Panel + Stream Cards + Synthetic Producer | Multi-topic message browsing + schema-aware data generation with play/stop |
| **13.2** | Live Pipeline View | Streaming Flink SQL consumer + end-to-end: produce → SQL → see output live |

Phase 13.1 builds the Stream Panel infrastructure, produce API, synthetic generator, and background statement management. Phase 13.2 adds streaming mode (long-running Flink queries) and the pipeline orchestration UX (connect input → SQL → output).

---

## Open Questions (To Resolve During A2 Design Review)

1. **Flink partition filter syntax**: Does `WHERE \`$metadata.partition\` = N` work? Fallback: client-side filter.
2. **Column mapping**: How to map Flink `SELECT *` columns to Timestamp/Partition/Offset/Key/Value?
3. **Panel resize**: Fixed 420px or drag-to-resize? (Rec: fixed for 13.1, resize in 13.2.)
4. **Producer rate**: Fixed 1 msg/sec or configurable? (Rec: fixed for 13.1.)
5. **Max cards**: Is 5 the right limit? Consider compute pool CFU impact with 5 simultaneous queries.
6. **Card ordering**: Fixed (order of selection) or draggable? (Rec: fixed for 13.1.)
7. **Protobuf**: Defer to 13.2? (Rec: yes — Avro + JSON Schema in 13.1.)
