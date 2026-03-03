# QA Manager — A2 Design Review
## Phase 12.6: Config Audit, Schema Filtering & Query Templates

**Reviewer:** QA Manager
**Date:** 2026-03-01
**Status:** COMPLETE

---

## Review Scope

Reviewing `docs/features/phase-12.6-prd.md` Test Plan section: Tier 1/2 breakdown adequacy, coverage targets, test markers, and test file organization.

---

## Test File Inventory (from PRD)

| Feature | Test File | Marker | Assessment |
|---------|-----------|--------|------------|
| F1 Config Audit Log | `Phase126ConfigAudit.test.tsx` | `[@phase-12.6-config-audit]` | Adequate marker |
| F2 Schema Filter | `Phase126SchemaFilter.test.tsx` | `[@phase-12.6-schema-filter]` | Adequate marker |
| F3 Schema Skeleton | `Phase126SchemaSkeleton.test.tsx` | `[@phase-12.6-schema-skeleton]` | Adequate marker |
| F4 Sort Persistence | `Phase126ConfigSort.test.tsx` | `[@phase-12.6-config-sort]` | Adequate marker |
| F5 AbortController Diff | `Phase126DiffAbort.test.tsx` | `[@phase-12.6-diff-abort]` | Adequate marker |
| F6 Snippets Library | `Phase126Snippets.test.tsx` | `[@phase-12.6-snippets]` | Adequate marker |
| F7 Diff Closure Fix | `Phase126DiffClosure.test.tsx` | `[@phase-12.6-diff-closure]` | Adequate marker |
| F8 Health Dot Fix | `Phase126HealthDot.test.tsx` | `[@phase-12.6-health-dot]` | Adequate marker |
| F9 Diff Auto-Exit | Extend Phase126DiffClosure.test.tsx | `[@phase-12.6-diff-closure]` | Acceptable — shares file |
| F10 Dup Warning | Extend Phase126HealthDot.test.tsx | `[@phase-12.6-health-dot]` | Acceptable — shares file |
| F11 CSS Var Fix | Extend Phase126DiffClosure.test.tsx | `[@phase-12.6-diff-closure]` | Acceptable (SchemaDetail.tsx is the same file) |

**Total new test files: 8**

---

## Tier 1 Required Coverage

### F1 — Config Audit Log
- Entry created on successful save (happy path)
- Entry NOT created on cancel
- Entry NOT created on API error
- Entry contains all required fields: topicName, configKey, oldValue, newValue, timestamp
- Config History section renders collapsed by default
- Toggle expands/collapses section
- "No config changes this session" shown when no entries
- Entries for current topic shown most recent first
- FIFO eviction at 200 entries

### F2 — Schema Subject Filter
- Type filter "AVRO" shows only AVRO subjects
- Compat filter "BACKWARD" shows only BACKWARD subjects
- AND logic: type + compat + name search all applied
- "No subjects match" empty state shown when no matches
- "All Types" default shows all subjects
- Subjects with unloaded type excluded from type-filtered views

### F3 — Schema Skeleton
- 5 skeleton rows shown while initial fetch in progress
- Skeleton replaced by real list after fetch completes
- Skeleton replaced by empty state if fetch returns empty
- Subsequent refreshes do NOT show skeleton (hasLoadedOnce flag)

### F4 — Sort Persistence
- Sort state written to sessionStorage on column click
- Sort state read from sessionStorage on topic switch
- Default sort (Key asc) used when sessionStorage empty
- Direction reversal on clicking same column again

### F5 — AbortController Diff Fetch
- Abort called on previous controller when new diff version selected
- Abort error silently ignored (no error state update, no toast)
- Non-abort errors still surface as errors (404, network failure)
- Only last selected version's schema shown after rapid switching

### F6 — Snippets Library
- Save snippet: name + SQL saved to store + localStorage
- Insert snippet: SQL inserted into focused editor via editorRegistry
- Insert with no focused editor: toast message shown
- Delete snippet: DeleteConfirm pattern, removed from store after confirm
- Rename snippet: double-click, Enter saves, Escape reverts
- Persistence: snippets survive page reload (localStorage)
- Storage limit: 101st snippet triggers informational message, no save
- Empty name: "Save" button disabled, "Snippet name is required" shown
- Empty state: "No snippets yet. Save a SQL cell to get started."
- Search filter: type in search input, only matching snippets shown

### F7 — Diff Closure Fix
- Primary changed to match diff version -> diff version auto-updated to next available
- Primary changed, no alternative diff version -> diff mode exited
- Two different schemas shown side by side (no self-compare)
- Diff version picker shows valid (non-primary) version selected

### F8 — Health Dot Fix
- Green topic (partitions >= 2, replication >= 2): NO health dot in TopicDetail header
- Yellow topic (partitions < 2): yellow dot shown
- Red topic (partitions < 1 or replication < 1): red dot shown

### F9 — Diff Auto-Exit
- Delete reduces to 1 version -> diffMode set to false automatically
- Delete leaves 2+ versions -> diffMode NOT changed
- Diff button disappears after delete (versions.length < 2)

### F10 — Duplicate Warning Fix
- 0-partition topic: tooltip shows ONLY "Topic has no partitions" (not single-partition message)
- 0-replication topic: tooltip shows ONLY "Topic has no replication"
- 1-partition topic: shows ONLY "Single-partition" message (not critical 0-partition message)

### F11 — CSS Var Fix
- `--color-button-danger-text` defined in :root in index.css
- VersionDeleteConfirm button renders with CSS var (no hardcoded #ffffff in DOM)
- DeleteConfirm (subject-level) button renders with CSS var

---

## Tier 2 (Async — Post-Ship, Track C)

| Feature | Tier 2 Stubs |
|---------|-------------|
| F1 | Concurrent edits across topics; 200-entry FIFO eviction race; same config key edited multiple times |
| F2 | Large subject list (200+) filter performance; filter + paginated load interaction |
| F4 | sessionStorage corrupted value fallback; rapid topic switching session state race |
| F5 | Network timeout during abort; AbortError on cleanup unmount (not just version switch) |
| F6 | localStorage QuotaExceededError; two snippets identical names; focused editor cell removed mid-insert; very large SQL snippet |
| F7 | handleVersionChange called with same value (no-op); diffVersion 'latest' edge case |
| F9 | Delete version while fetch in flight (race condition) |

---

## Acceptance Criteria Coverage

| Feature | AC Count | Tier 1 Tests | Coverage % |
|---------|----------|-------------|------------|
| F1 | 14 | 9 | ~64% |
| F2 | 12 | 6 | ~50% |
| F3 | 8 | 4 | 50% |
| F4 | 8 | 4 | 50% |
| F5 | 7 | 4 | ~57% |
| F6 | 19 | 10 | ~53% |
| F7 | 5 | 4 | 80% |
| F8 | 5 | 3 | 60% |
| F9 | 4 | 3 | 75% |
| F10 | 5 | 3 | 60% |
| F11 | 5 | 3 | 60% |

**Overall Tier 1 coverage: ~58% on critical paths. Meets >=40% Tier 1 requirement.**

---

## Concerns / Non-Blocking Notes

1. F6 Snippets test file will be large (10 scenarios, 19 ACs). Recommend splitting into sub-describes within the single file but sharing marker `[@phase-12.6-snippets]`.
2. F11 CSS var test: jsdom cannot easily test CSS custom property values. Test that the component does NOT contain hardcoded `#ffffff` in inline styles. Snapshot test acceptable.
3. F5 AbortController test: jsdom does not support fetch natively. Engineering must mock abort behavior. Confirm implementation uses Axios (not native fetch) — Axios mock is already in `src/test/mocks/api.ts`.

---

## VERDICT: APPROVE

Test plan is adequate. Tier 1 tests cover all critical paths. Tier 2 stubs are documented. Markers are consistent and runnable. Coverage targets are realistic.

**Status:** APPROVED
**Signed:** QA Manager
**Date:** 2026-03-01
