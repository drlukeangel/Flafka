# Phase 13.1 — Stream Monitor, Synthetic Producer & Message Browser

## Overview
Phase 13.1 adds real-time topic message browsing, synthetic data production, and multi-topic stream monitoring to the Flink SQL Workspace UI — all without leaving the app.

## Features

### F1: Stream Monitor Panel
- Right-side panel independent of the left nav panel
- Opens via the Activity icon (FiActivity) in the NavRail Tools section
- Supports monitoring up to 5 topics simultaneously
- Search and filter topics by name
- Empty state when no topics selected

### F2: Stream Cards
- Self-contained card per topic with play/stop, collapse, and remove controls
- Fetches messages via background Flink SQL statements using metadata columns
- Client-side partition filtering
- Configurable row limit (10/25/50/100)
- Compact table display with timestamp, partition, offset, key, and value columns

### F3: Produce API
- `produceRecord()` in `topic-api.ts` — POSTs to Kafka REST v3 `/records` endpoint
- Uses `kafkaRestClient` with AbortSignal support
- URL-encodes topic names for special characters

### F4: Synthetic Data Generator
- `generateSyntheticRecord()` in `utils/synthetic-data.ts`
- Parses Avro and JSON Schema definitions
- Field name heuristics: id → UUID, name → fake name, email → fake email, status → random enum, date → ISO timestamp
- Avro type support: all primitives, unions (80/20 null distribution), nested records, enums, arrays, maps
- Deterministic output with optional seed parameter
- Protobuf support deferred (returns error message)

### F5: Synthetic Producer
- Schema lookup via Schema Registry (`{topicName}-value` subject)
- 1-message-per-second production rate via setInterval
- Auto-stop on unmount, error, or card removal
- Live counter in `aria-live="polite"` region
- Unique key per message prevents deduplication

### F6: Stream Card Table
- Compact table with `font-size: 0.85rem` (WCAG compliant)
- Fixed table layout with explicit column widths
- Metadata columns: `_ts` (HH:MM:SS), `_partition`, `_offset`, `_key` (8-char truncated)
- JSON expand via shared ExpandableJsonPane component
- Sorted by timestamp (newest first)

### F7: Shared ExpandableJsonPane
- Extracted from ResultsTable into `components/shared/ExpandableJsonPane.tsx`
- Portal into `document.body` with fixed positioning
- Close on: Escape, click-outside, window scroll
- Copy button for formatted JSON
- Reused by both ResultsTable and StreamCardTable

### F8: Background Statements
- Separate `backgroundStatements` array in store (not mixed with workspace statements)
- Named with `bg-` prefix for HistoryPanel filtering
- Max 1 per contextId (cancels prior before new execution)
- Auto-cancelled when panel closes or card removed
- Not persisted to localStorage

## Architecture

```
NavRail | Left Panel (topics/schemas/etc) | Main Content (workspace) | Stream Panel (right)
```

- Stream Panel uses `streamPanelOpen: boolean` (NOT `activeNavItem`)
- Background statements use Flink SQL with metadata columns (`$rowtime`, `$partition`, `$offset`, `$key`)
- Producer uses Kafka REST v3 POST `/records`
- All CSS uses CSS custom properties — no hardcoded colors

## Files Added/Modified

### New Files
- `src/components/StreamPanel/StreamPanel.tsx` + `.css`
- `src/components/StreamPanel/StreamCard.tsx` + `.css`
- `src/components/StreamPanel/StreamCardTable.tsx`
- `src/components/shared/ExpandableJsonPane.tsx`
- `src/utils/synthetic-data.ts`

### Modified Files
- `src/types/index.ts` — BackgroundStatement, ProduceRecord, ProduceResult, SyntheticResult, StreamCardState, 'streams' NavItem
- `src/store/workspaceStore.ts` — stream panel state + actions
- `src/api/topic-api.ts` — produceRecord function
- `src/components/NavRail/NavRail.tsx` — streams button
- `src/App.tsx` — stream panel aside
- `src/App.css` — stream panel layout
- `src/components/ResultsTable/ResultsTable.tsx` — refactored to use ExpandableJsonPane

## Test Coverage
- `@stream-store` — 13 tests (store state + actions)
- `@topic-produce` — 8 tests (produce API)
- `@synthetic-data` — 19 tests (data generator)
- `@expandable-json-pane` — 7 tests (shared component)
- `@stream-panel` — 9 tests (panel UI)
- `@stream-nav-rail` — 2 tests (NavRail integration)
- `@stream-card` — 11 tests (card + producer)
- **Total: 69 new tests**

## Story Points: 49
