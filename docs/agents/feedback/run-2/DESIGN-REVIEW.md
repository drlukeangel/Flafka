# Phase A2 Design Review — Phase 12.4: Full Lifecycle Integration

**Date**: 2026-02-28
**PRD**: `docs/features/phase-12.4-full-lifecycle-integration.md`
**Reviewers**: Principal Architect, Principal Engineer, QA Manager, UX/IA Reviewer, SR Flink/Kafka Engineer
**Status**: ALL 5 APPROVED

---

## Review Summary

| Reviewer | Verdict | Notes |
|----------|---------|-------|
| Principal Architect | APPROVE | Clean additive extension of established patterns |
| Principal Engineer | APPROVE | Implementation is sound with one clarification needed (minor, documented below) |
| QA Manager | APPROVE | Test plan is thorough; all ACs are testable |
| UX/IA Reviewer | APPROVE | Strong UX flow; all accessibility patterns match existing standard |
| SR Flink/Kafka Engineer | APPROVE | Domain semantics are correct; Kafka API usage is accurate |

---

## 1. Principal Architect Review

**Verdict: APPROVE**

### System Design Fit

Phase 12.4 is a purely additive integration feature. It wires together three panels that already exist (`TopicPanel`, `SchemaPanel`, SQL workspace) without introducing new architectural primitives. The design correctly:

- Adds no new store state beyond what is strictly needed (`navigateToSchemaSubject` action, optional `topicPartitionsExpanded` field)
- Routes cross-panel navigation through the Zustand store's existing `activeNavItem` and `selectedSchemaSubject` fields — the correct single source of truth for panel visibility
- Keeps ephemeral, component-scoped data (partition list, schema link lookup results, inline edit state) in local `useState` — the correct choice given the Zustand "lean store" principle established in CLAUDE.md

### REST API Compliance

Three new endpoints are added to `topic-api.ts`. HTTP verb selection is correct:

- `POST /topics/{name}/configs:alter` — correct; the `:alter` suffix is a Confluent-specific RPC-style action. Using POST for a mutating non-idempotent batch operation is standard for this API family.
- `GET /topics/{name}/partitions` — correct collection resource fetch.
- `GET /topics/{name}/partitions/{id}/offsets` — correct sub-resource fetch.

All three use `encodeURIComponent()` on path parameters — consistent with the existing `deleteTopic` and `getTopicConfigs` calls in `topic-api.ts`. No URL structure deviations.

The `:alter` endpoint returns HTTP 200 with empty body on success and HTTP 422 on invalid values. The PRD correctly maps these to `void` return type and a thrown error respectively. The `alterTopicConfig` function returning `Promise<void>` is the right signature.

### State Management

The one new store state field — `topicPartitionsExpanded: boolean` — is flagged as optional in the PRD, with the alternative being local component state. **The Architect's recommendation is to use local `useState` in `TopicDetail.tsx` for this flag.** The App.tsx dynamic width behavior already has a conditional pattern (`selectedSchemaSubject` triggers width expansion for Schema panel); lifting one more boolean into the store is acceptable but not required. The PRD's "alternative: 300px with horizontal scroll" fallback is a reasonable escape hatch if width complexity proves costly during implementation.

If `topicPartitionsExpanded` IS added to the store, it must be excluded from the `partialize` persist config — confirmed correct in the PRD ("runtime-only, not persisted").

### Separation of Concerns

- API layer (`topic-api.ts`): pure data-fetching functions with no UI state dependency. Clean.
- Business logic in store (`navigateToSchemaSubject`): single atomic `set({})` call, no async needed. Clean.
- Component logic: `TopicDetail.tsx` orchestrates multiple local state machines (config editing, schema lookup, partition expand/collapse). This is appropriate given these are all scoped to the detail view and would be over-engineered in the store.
- `editorRegistry.ts` cross-sibling import from `TopicPanel` is the established pattern per CLAUDE.md ("Shared `editorRegistry.ts` module: designed as a shared module"). No concern.

### Minor Observation (Non-Blocking)

The PRD references `useWorkspaceStore.getState().focusedStatementId` inside `editorRegistry.ts` — this is already the existing implementation and is not new to this phase. No change needed.

---

## 2. Principal Engineer Review

**Verdict: APPROVE**

### Implementation Approach

The feature decomposition across 6 additions within one existing component (`TopicDetail.tsx`) is feasible. The component is already complex (~1070 lines) but all new sections are isolated sub-blocks with clearly defined entry/exit conditions.

### Code Patterns

**Feature 1 — "Query with Flink":**
`addStatement(sql)` followed by `setActiveNavItem('workspace')` is the correct two-call sequence. Verified that `addStatement` already handles undefined `afterId` by appending to the end of the list. The generated SQL `SELECT * FROM \`${topic_name}\`;` is syntactically valid for Flink SQL with special-character topic names.

**Feature 2 — Insert at Cursor:**
`insertTextAtCursor` in `editorRegistry.ts` uses `executeEdits` with the current selection range — this replaces selected text or inserts at cursor with no selection. The fallback toast on `return false` is the correct defensive pattern (already established in Phase 6.3 for the tree navigator insert).

**Feature 3 — Schema Lookup:**
Using `Promise.allSettled` (not `Promise.all`) for the three subject lookups (`-value`, `-key`, exact) is explicitly called out in the PRD. This is the correct choice: a 404 on `{topic}-value` must not abort the `{topic}-key` check. The engineer must confirm this in the implementation; `Promise.all` would be a regression bug here.

**Feature 4 — Inline Config Editing:**
The "one row at a time" constraint implemented via a single `editingConfigName: string | null` state is clean. The PRD specifies that clicking a second row's edit icon auto-cancels the first row silently (no save). This requires the state update to clear `editingConfigName` before setting the new one — trivially correct with a single `setEditingConfigName(newName)` call.

The "cancel during in-flight save" pattern (AC-21 note: "cancelled flag so response is ignored if it arrives after cancel") requires a `useRef` or a request ID pattern. The existing `requestIdRef` pattern in `TopicDetail` for `fetchConfigs` is the exact model to follow. The engineer should replicate it for the save operation.

**Feature 5 — Health Indicators:**
Purely visual, no async. `partitions_count < 2` is a simple inline conditional. No implementation risk.

**Feature 6 — PartitionTable:**
Parallel `Promise.all` for up to 100 offset fetches is correct. The PRD's "wrap each in try/catch" to show "—" per-partition is important — the engineer must NOT use a single outer try/catch that would fail all offsets on one failure. The `mounted ref` pattern (guard against state updates after unmount) is already established in `TopicDetail.fetchConfigs` — `PartitionTable` must use it since partition + offset fetches could be long-running.

### Edge Cases

The PRD documents all material edge cases:
- Topic name with backticks: impossible (naming convention blocks them)
- Schema Registry 401 vs 404: correctly differentiated (401 = auth error shown, 404 = "not found")
- Stale partition fetch when topic changes: `useEffect` cleanup cancels (PRD explicitly specifies mounted-ref guard)
- Config edit Escape during save: PRD specifies cancel is allowed; result discarded via cancelled flag

### Type Safety

Three new types in `types/index.ts`:
- `KafkaPartition` — correctly models the nested `leader`, `replicas`, `isr` arrays. The `leader: { broker_id: number } | null` union handles the leaderless case (AC-32).
- `PartitionOffsets` — simple flat object; correct.
- `TopicConfigAlterRequest` — matches the `:alter` endpoint body exactly.

No changes to existing `KafkaTopic` or `TopicConfig` types — clean extension.

### One Implementation Note (Non-Blocking)

The `navigateToSchemaSubject` store action calls `set({ activeNavItem: 'schemas', selectedSchemaSubject: subject })` atomically. However, the Schema panel's `useEffect` calls `loadSchemaRegistrySubjects()` on mount — since the Schema panel is rendered (not remounted) when nav switches to `'schemas'` (assuming it was already visited), this effect will not re-fire. The engineer should verify in testing whether the subjects list is populated when navigating via `navigateToSchemaSubject` from the Topic panel. This is a runtime behavior to confirm in browser testing, not a design flaw. If the Schema panel was never opened, the subjects list would be empty but `selectedSchemaSubject` would be set — SchemaDetail reads from `selectedSchemaSubject` directly, so it would show the correct detail. This is fine.

---

## 3. QA Manager Review

**Verdict: APPROVE**

### Test Plan Assessment

The PRD provides a complete Tier 1 / Tier 2 breakdown across four test files:
- `topic-api.test.ts` (12 new tests: 9 T1, 3 T2)
- `TopicDetail.test.tsx` (38 new tests: 30 T1, 8 T2)
- `TopicList.test.tsx` (4 new tests: 3 T1, 1 T2)
- `PartitionTable.test.tsx` (new file: 12 tests, 9 T1, 3 T2)
- `workspaceStore.test.ts` (5 new tests: all T1)

Total: 71 new tests (51 T1, 20 T2). T1 coverage of all ACs is complete. T2 covers the meaningful edge cases (topic name variants, escape key, >100 partitions, offset failure per-partition, both subjects found).

### AC Testability Audit

All 42 acceptance criteria are testable with the proposed test plan. Confirmed mapping:

| AC Range | Covered By | All Testable? |
|----------|------------|---------------|
| AC-1 to AC-5 (Feature 1: Query) | TopicDetail.test.tsx | Yes |
| AC-6 to AC-9 (Feature 2: Insert) | TopicDetail.test.tsx | Yes |
| AC-10 to AC-16 (Feature 3: Cross-nav) | TopicDetail.test.tsx | Yes — `getSchemaDetail` can be mocked with resolved/rejected promises |
| AC-17 to AC-24 (Feature 4: Config Edit) | TopicDetail.test.tsx | Yes — `alterTopicConfig` mockable |
| AC-25 to AC-27 (Feature 5: Health) | TopicList.test.tsx + TopicDetail.test.tsx | Yes |
| AC-28 to AC-36 (Feature 6: Partitions) | PartitionTable.test.tsx | Yes — `getTopicPartitions` + `getPartitionOffsets` mockable |
| AC-37 to AC-42 (Cross-feature) | TopicDetail.test.tsx + browser verification | Yes for accessibility; dark/light mode verified in browser |

### Marker Compliance

All tests use dual markers `[@topic-detail][@phase-12-4]` — this conforms to the established pattern of feature-scoped markers. The `PartitionTable` component uses `[@partition-table][@phase-12-4]`. Topic API additions use `[@topic-api]`. Store additions use `[@store][@phase-12-4]`. All markers are consistent with the project's QA subset-execution model.

### Coverage Impact

Adding 71 new tests against new code (1 new file, 5 modified files with significant new surface) should maintain or improve the overall 80% coverage target. The `PartitionTable.tsx` component is tested exhaustively (12 tests for a single-purpose component). The `TopicDetail.tsx` additions are large (30+ new tests), keeping inline with the component's complexity.

### Tier 1 Gate Compliance

All Tier 1 tests are functional: they verify correct API calls, state changes, and rendered output. They do not depend on CSS or visual regression. All can be run in jsdom with React Testing Library. The QA Manager confirms these are executable in the existing Vitest environment without additional tooling.

### One Gap (Non-Blocking — Tier 2)

The test plan does not explicitly include a test for AC-39's keyboard accessibility for the new "Partitions" toggle header button. The browser verification checklist covers this, and it is an informational-style toggle (not a destructive or navigation action), so its absence from Tier 1 unit tests is acceptable. It should be added to the Tier 2 stub list during Track C.

---

## 4. UX/IA Reviewer Review

**Verdict: APPROVE**

### User Journey Assessment

The six features form a coherent workflow for the primary Flink developer persona:
1. See a topic → immediately query it (Feature 1) — zero copy-paste friction
2. See a topic → insert its name into an open SQL statement (Feature 2) — cursor-preserving
3. See a topic → discover its schema without switching panels (Feature 3) — reduces tool-switching
4. Edit a config inline without leaving the topic view (Feature 4) — eliminates CLI fallback
5. Spot low-parallelism topics at a glance (Feature 5) — proactive guidance
6. Inspect partition topology without leaving the UI (Feature 6) — diagnostic power

The features are appropriately ordered in the UI by user intent frequency: Query (primary, in header) → Insert (secondary, next to existing copy button) → Schema link (discovery, below configs) → Partition details (diagnostic, collapsed by default).

### Information Architecture

**TopicDetail layout after Phase 12.4 (top to bottom):**
1. Header bar: back ← | topic name (monospace) [no change]
2. Sub-header: [N P · RF:M] [Low partition count badge] [Refresh] [Query] [Delete] ← correct placement hierarchy
3. Metadata rows: Topic Name | Partitions | Replication | Internal [no change]
4. Configuration section [existing] + inline edit enhancements [new]
5. Schema Association section [new]
6. Partitions section (collapsible) [new]

This layout respects the established information hierarchy: persistent metadata → config (most commonly used) → cross-references → diagnostic details. The collapsible Partitions section at the bottom is correct — it's the heaviest section (most API calls, most data) and least frequently needed.

### Discoverability

- "Query" button in the header bar is immediately visible — correct for the primary action
- "Insert" icon next to the copy icon is discoverable by proximity — users who copy topic names will naturally see the insert option
- Health badges in the topic list are visible without interaction — appropriate for warnings that users might not know to look for
- Schema Association section: always visible when Schema Registry is configured — users don't need to know to look for it
- Partition section: collapsed by default with a visible expand toggle — correct for advanced/diagnostic content

### Accessibility

All new UI elements follow the established patterns from existing code:

**Buttons:**
- All non-icon buttons have explicit `aria-label` (specified in PRD)
- Health badge (non-interactive): PRD correctly specifies "no tab stop needed" for informational-only icon badges
- Inline config edit input: `aria-label="Edit {configName} value"` (AC-40) — correct
- Save/Cancel in edit mode: labeled (AC-40) — correct
- Error alert: `role="alert"` (AC-40) — correct

**Keyboard Navigation:**
- All new interactive elements are keyboard-reachable via Tab
- Partition toggle header: activatable via Enter/Space (standard button behavior)
- Inline edit cancel via Escape key (AC-23 specified) — consistent with existing patterns (delete confirm dialog, workspace name editing all use Escape-to-cancel)
- Lock icon rows: not interactive, correctly excluded from tab order

**Focus Management:**
- Insert button, when clicked: `insertTextAtCursor` ends with `editor.focus()` in `editorRegistry.ts` — focus returns to the editor. Correct.
- Schema nav button: navigates to Schema panel. Focus will land on the Schema panel header. Acceptable.
- Delete confirm dialog: already has focus-on-mount on Cancel button (existing `cancelBtnRef.current?.focus()`). Not changed.

**Dark/Light Mode:**
- All new elements use CSS custom properties: `var(--color-warning)`, `var(--color-primary)`, `var(--color-error)`, etc.
- PRD explicitly prohibits hardcoded hex colors (AC-37/38)
- Inline config edit input uses `var(--color-surface-secondary)`, `var(--color-border)`, `var(--color-text-primary)` — same as existing config filter input and CreateTopic modal inputs
- The left-border accent on edit mode (`var(--color-primary)` 2px) matches the existing focus ring pattern for primary interactive elements

### Consistency with Existing Patterns

| New Element | Pattern Source | Consistent? |
|-------------|----------------|-------------|
| "Query" button (icon + label, secondary style) | Existing Delete button layout (different semantic but same structural pattern) | Yes |
| "Insert" icon button | Existing copy icon buttons in TopicDetail metadata section | Yes |
| Inline edit save/cancel | SchemaDetail edit mode (Validate/Save/Cancel) | Yes |
| Partition collapsible toggle | No prior collapsible in this panel, but pattern from Phase 8's SQL formatter collapse is established | Yes |
| Schema Association section | Similar to SchemaDetail's version selector and compatibility mode display | Yes |
| Health badge pill | Existing "Low parallelism" warning badge in TopicDetail (already implemented in Phase 12.3) | Yes |

### Minor Observation (Non-Blocking)

The "Register schema" button in the Schema Association "not found" state navigates to the Schema panel list view (AC-14). The Schema panel's list view has a "+ New Schema" button at the bottom of the list. This is a two-click flow (navigate → click create). The PRD correctly scopes Schema creation out of the Topics panel per "Out of Scope". This is acceptable — it is a power-user flow (registering a schema is infrequent).

---

## 5. SR Flink/Kafka Engineer Review

**Verdict: APPROVE**

### Domain Correctness

**Feature 1 — "Query with Flink" Statement Format:**
`SELECT * FROM \`{topic_name}\`;` without a LIMIT clause is correct for Flink streaming SQL. A LIMIT clause in Flink SQL is meaningful but applies differently from batch SQL (Flink limits rows output, not rows scanned). The PRD's rationale — "the developer is expected to press Escape to stop a streaming SELECT" — is correct and consistent with how Flink developers work with unbounded streaming tables. Adding `LIMIT 10` would produce a bounded result set and not demonstrate streaming behavior, which is confusing for developers expecting to see live records.

The backtick-quoting convention is correct for Flink SQL identifiers. Topics named with hyphens (`user-events-raw`), dots (`my.topic.v1`), underscores, and digits all require backtick quoting in Flink SQL because they contain characters outside the `[a-zA-Z_$][0-9a-zA-Z_$]*` unquoted identifier set.

**Feature 3 — Schema Naming Convention:**
The `{topic_name}-value` / `{topic_name}-key` / `{topic_name}` lookup sequence is the correct Confluent Platform convention. Confluent Connect, Flink connectors (Table API), and Schema Registry auto-registrations all follow the `-value` / `-key` subject naming convention. The three-step fallback (value → key → exact) correctly handles the cases where:
- Confluent Connect auto-registered `orders-value` (most common)
- A team manually registered `orders-key` only (less common)
- A team used the legacy exact-name convention (rare but valid)

Using `Promise.allSettled` for all three checks simultaneously (rather than sequential try/catch) is more efficient (3 parallel requests instead of up to 3 sequential) and correctly handles each independently.

**Feature 4 — Topic Config Alter:**
The `:alter` endpoint (`POST /topics/{name}/configs:alter`) is the correct Confluent Cloud Kafka REST API v3 endpoint for modifying existing topic configurations. It accepts a partial set of configs (one or more name/value pairs in the `data` array). The PRD correctly scopes this to non-read-only, non-sensitive configs only.

The read-only configs listed in the PRD (`min.insync.replicas`, `replication.factor`, `num.partitions`) are correctly identified. In Confluent Cloud:
- `replication.factor` is set at creation and cannot be changed after the fact
- `num.partitions` is read-only post-creation (increasing partitions requires a separate Kafka Admin API call, not the REST API's `:alter` endpoint, and is not available in Confluent Cloud managed Kafka)
- `min.insync.replicas` may be read-only depending on the cluster tier

The PRD's approach of relying on the API's `is_read_only` flag (rather than a client-side allowlist) is correct — the server is authoritative on which configs are editable.

**Feature 6 — Partition Topology:**
The offset calculation `message_count = end_offset - beginning_offset` is correct for Kafka partition offsets. This gives the number of messages currently retained in the partition (not the total ever produced). For compacted topics (`cleanup.policy=compact`), this count underestimates the logical record count (some records may be superseded by compaction), but showing the retained message count is the standard way partition offsets are displayed in Kafka tooling.

The ISR (In-Sync Replica) warning condition `isr.length < replicas.length` correctly identifies under-replicated partitions. This is the standard diagnostic signal — it means the partition is vulnerable to data loss if the leader fails before the lagging replicas catch up.

The `leader === null` check for leaderless partitions (AC-32) is correct. A leaderless partition cannot serve reads or writes and is a critical cluster health issue.

The 100-partition cap for offset fetches is pragmatic. At 100 partitions × 1 request each = 100 parallel HTTP requests to the Kafka REST proxy. This is within the acceptable range for an interactive tool. At 1000+ partitions (enterprise cluster), 1000 concurrent REST requests would overwhelm the proxy and is correctly skipped.

### Enhancement Observation (Non-Blocking, Informational)

The PRD explicitly defers consumer group offset display (e.g., consumer lag per partition) to a future phase, citing the `/consumer-groups` endpoint's different auth scope. This is the correct scope decision. Consumer group lag is valuable context but represents a distinct API surface requiring separate credentials setup. The partition offset table (begin/end) provides meaningful insight into data volume without the auth complexity.

One future consideration: the `:alter` endpoint also supports the `retention.bytes` config (byte-based retention). The current PRD does not special-case this in the config table rendering (unlike `retention.ms` which gets human-readable formatting). This is acceptable for Phase 12.4 — `retention.ms` is far more commonly adjusted. A future phase could add `formatBytes()` rendering for `retention.bytes`.

---

## PHASE A2 DESIGN REVIEW: ALL 5 APPROVED

All five reviewers have independently reviewed the PRD and codebase and approve Phase 12.4 for implementation. The design is sound, coherent with the existing architecture, and all acceptance criteria are testable.

### Implementation Notes for Engineers

1. Use `Promise.allSettled` (not `Promise.all`) for the three Schema Registry subject lookups (Feature 3). This is critical — one 404 must not abort the others.

2. Use the `requestIdRef` / AbortController pattern (already in `TopicDetail.fetchConfigs`) for the inline config save operation to handle cancel-during-save correctly (Feature 4, AC-21).

3. Each per-partition offset call in `PartitionTable` must be individually wrapped in try/catch — do not use a single outer catch that fails all (Feature 6, AC-30).

4. The `mounted ref` guard pattern (guard state updates after unmount) is required in `PartitionTable` as partition + offset fetches are long-running (Feature 6).

5. `topicPartitionsExpanded` may be implemented as local `useState` in `TopicDetail.tsx` rather than Zustand store state if the dynamic panel width feature (App.tsx conditional) is judged too complex. QA must verify panel width behavior during browser testing.

6. All new buttons, inputs, and interactive elements must use only CSS custom properties for color — no hardcoded hex values (AC-37/38).
