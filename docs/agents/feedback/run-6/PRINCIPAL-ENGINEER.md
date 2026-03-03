# Principal Engineer — A2 Design Review
## Phase 12.6: Config Audit, Schema Filtering & Query Templates

**Reviewer:** Principal Engineer
**Date:** 2026-03-01
**Status:** COMPLETE

---

## Review Scope

Reviewing `docs/features/phase-12.6-prd.md` for implementation approach, code patterns, edge cases, error handling, and type safety.

---

## Feature-by-Feature Implementation Review

### F1 — Config Audit Log

**Pattern Assessment:**
- Zustand store addition: `configAuditLog: ConfigAuditEntry[]` with `addConfigAuditEntry(entry)` action and `maxEntries: 200` FIFO eviction.
- TypeScript type: `ConfigAuditEntry { topicName: string; configKey: string; oldValue: string; newValue: string; timestamp: string; }` — simple, clean.
- `oldValue` must be captured BEFORE the save API call, not after. Engineering note: read the pre-edit value from the current config state when the user initiates the edit, store it as a local variable, then pass it to `addConfigAuditEntry` on save success callback.
- AC-1.8: Cancel does NOT produce entry — save the old value locally, only call store action on success path.
- AC-1.9: API error does NOT produce entry — call store action only in `.then()` success branch, not `.catch()`.
- CONCERN: AC-1.4 says "Toggle persists for the duration of the session (not reset on topic switch)." This means the collapsed/expanded state of "Config History" is a component-level state (useState), NOT topic-scoped. BUT if TopicDetail remounts on topic switch, this state WILL reset. Engineering must store expanded state in workspaceStore or sessionStorage if TopicDetail remounts on topic switch.
- FIFO cap: `slice(-200)` or array splice after push. Keep it simple.
- AC-1.6 format: `HH:MM:SS key oldValue -> newValue` in monospace. Use `font-family: monospace` or CSS var. Use `new Date(timestamp).toLocaleTimeString()` for HH:MM:SS display.

### F2 — Schema Subject List Filter

**Pattern Assessment:**
- Two `<select>` elements or custom dropdowns. Use native `<select>` first (simpler, accessible).
- Filter state: `const [typeFilter, setTypeFilter] = useState('ALL')` and `const [compatFilter, setCompatFilter] = useState('ALL')`.
- AND filtering: `subjects.filter(s => (typeFilter === 'ALL' || s.schemaType === typeFilter) && (compatFilter === 'ALL' || s.compatibility === compatFilter) && s.name.includes(search))`.
- CONCERN: Subjects with unloaded type/compat should be excluded from type/compat filtered views. Implementation: if `s.schemaType === undefined || s.schemaType === null` AND `typeFilter !== 'ALL'`, exclude. Otherwise include.
- AC-2.10: State resets on panel mount — useState initializes to 'ALL' on mount. No persistence needed.
- AC-2.11: Native `<select>` is keyboard-accessible (Tab + arrow keys) by default.
- AC-2.12: `aria-label="Filter by schema type"` and `aria-label="Filter by compatibility mode"` on the selects.

### F3 — Schema Panel Loading Skeleton

**Pattern Assessment:**
- Track initial load state: `const [hasLoadedOnce, setHasLoadedOnce] = useState(false)`.
- On fetch complete: `setHasLoadedOnce(true)`.
- Render: `if (!hasLoadedOnce && isLoading) return <SkeletonRows count={5} />`.
- CONCERN: If SchemaPanel is unmounted/remounted, `hasLoadedOnce` resets to false — skeleton shows again on re-open. This is acceptable per PRD (the flag only lives for the component's mount lifecycle).
- AC-3.6: Skeleton uses CSS custom properties. Do NOT hardcode colors. Use `--color-bg-skeleton` or equivalent existing var.
- AC-3.8: `aria-busy="true"` attribute on the skeleton container `<div>`.
- Shimmer animation: reuse existing CSS class (from ORIG-7, Phase 12.2 R2). Do not re-declare the keyframes.

### F4 — Config Table Sort Persistence

**Pattern Assessment:**
- `sessionStorage.getItem('flink-ui.configTableSort')` on component mount (or when `topicName` changes if component doesn't remount).
- `sessionStorage.setItem('flink-ui.configTableSort', JSON.stringify({ column, direction }))` on each sort change.
- Type: `{ column: 'key' | 'value' | 'default' | 'readOnly'; direction: 'asc' | 'desc' }`.
- Default: `{ column: 'key', direction: 'asc' }` if nothing in sessionStorage.
- CONCERN: sessionStorage parse can throw if value is corrupted. Wrap in try/catch: if parse fails, fall back to default sort.
- AC-4.8: sessionStorage not localStorage. Correct.

### F5 — AbortController on Schema Diff Fetch

**Pattern Assessment:**
- Add `useRef<AbortController | null>(null)` for diffFetchAbortRef.
- In `handleDiffVersionChange`: `diffFetchAbortRef.current?.abort(); const controller = new AbortController(); diffFetchAbortRef.current = controller; fetchSchemaVersion(version, { signal: controller.signal })`.
- In schema API function: add `config?: { signal?: AbortSignal }` param, pass to axios: `axios.get(url, { signal: config?.signal })`.
- In the fetch `.catch()`: `if (error.name === 'AbortError' || axios.isCancel(error)) return;` — silently ignore.
- AC-5.7: Optional signal = backward compatible.
- Cleanup: `useEffect` cleanup should also call `diffFetchAbortRef.current?.abort()` on unmount.

### F6 — Query Templates / Snippets Library

**Pattern Assessment:**
- This is the most complex feature (13 pts). Engineering breakdown:
  - Types: `Snippet { id: string; name: string; sql: string; createdAt: string; updatedAt: string }` in `types/index.ts`.
  - Store: `snippets: Snippet[]` in `workspaceStore.ts`. Actions: `addSnippet`, `deleteSnippet`, `renameSnippet`, `loadSnippets`.
  - Persistence: Use zustand persist middleware. Add `snippets` to the `partialize` list. Key: `flink-ui.snippets`.
  - New component: `SnippetsPanel.tsx` — renders snippet list, search input, empty state, handles CRUD.
  - EditorCell integration: Add "Save as snippet" button to EditorCell toolbar.
  - App.tsx integration: Add Snippets panel toggle to sidebar (similar to Schema panel toggle).

- CONCERN: UUID generation — use `crypto.randomUUID()`. Available in Chrome 92+, Firefox 95+, Safari 15.4+. No third-party lib needed.
- CONCERN: Storage limit. Implement the 100-snippet hard cap BEFORE calling the store action. Don't rely on localStorage quota exception alone.
- CONCERN: Inline rename (AC-6.9): double-click -> `<input>` with current name pre-filled -> Enter saves, Escape reverts. Use `labelCancelledRef` pattern (from workspace name / statement label).
- AC-6.7: If no editor focused, show toast. Use `editorRegistry` to check if `focusedEditorId` is set before insert.
- AC-6.5: Disabled "Save" button if name is empty. Plus helper text "Snippet name is required."
- AC-6.17: Delete confirmation uses `DeleteConfirm` pattern (same as SchemaPanel subject delete).
- AC-6.16: List items keyboard accessible. Use `role="listitem"` + `tabIndex={0}` + `onKeyDown` for Enter to insert.

### F7 — Diff View Stale Closure Fix

**Pattern Assessment:**
- The stale closure means `handleVersionChange` captured `diffVersion` at the time of render, not the current value.
- Fix: pass current primary version as a parameter to the inner handler, or use a ref `diffVersionRef.current` instead of the stale closure.
- When new primary === current diff: find next available version from `versions` array (filter out new primary, take first).
- If filtered list is empty: call `setDiffMode(false)`.

### F8 — Health Dot Fix

**Pattern Assessment:**
- Single guard: `if (health.level === 'green') return null;` in the health dot render path in TopicDetail.tsx.
- Copy pattern from TopicList.tsx. One-liner.

### F9 — Diff Auto-Exit

**Pattern Assessment:**
- After successful version delete and version list refetch: `if (newVersions.length < 2) setDiffMode(false);`.
- Simple. Shares file with F7 — same agent.

### F10 — Duplicate Health Warning Fix

**Pattern Assessment:**
- Early-return in `computeHealthScore`: if `partitions_count === 0`, push critical message and `return` before evaluating yellow conditions.
- Same for `replication_factor === 0`.
- Match TopicList.tsx's early-return logic exactly.

### F11 — CSS Custom Property

**Pattern Assessment:**
- Add `--color-button-danger-text: #ffffff;` to `:root` and `[data-theme="dark"]` in index.css.
- Replace `color: '#ffffff'` with `color: 'var(--color-button-danger-text)'` in SchemaDetail.tsx.
- Two locations in SchemaDetail.tsx: VersionDeleteConfirm and DeleteConfirm (subject-level).
- Simple find/replace.

---

## Edge Case Coverage Assessment

### F1 Edge Cases
- Same config edited twice: Two entries — no deduplication.
- Old value === new value: Entry still written (user explicitly saved).
- Special chars in topic name: Store as raw string; no encoding needed.
- 200+ entries: FIFO eviction — `if (log.length >= 200) log.shift()` (or slice).

### F5 Edge Cases
- Same version rapid-clicked: Abort + re-fire = fine.
- Subject switch during diff fetch: Subject-change useEffect fires, previous abort ref cleaned up.

### F6 Edge Cases
- Empty SQL snippet: PRD says still saveable.
- Duplicate names: Allowed (ID is unique key, not name).
- localStorage full: Catch QuotaExceededError, show toast.
- Focused editor removed: editorRegistry lookup returns undefined, no-op.

---

## Type Safety Assessment

- All new types must be in `src/types/index.ts`. No inline type declarations in components.
- `ConfigAuditEntry`: fully typed with required fields.
- `Snippet`: fully typed. `id: string` (TypeScript does not have a UUID type by default).
- Sort state type: `{ column: string; direction: 'asc' | 'desc' }` — use string union for direction.
- No `any` types allowed. All API responses typed via existing interfaces.

---

## VERDICT: APPROVE

**Conditions (non-blocking, implement during B1):**
1. F1: Capture `oldValue` BEFORE API call, pass to store action on success only
2. F1: Clarify expanded-state persistence — if TopicDetail remounts on topic switch, store expanded state in sessionStorage or Zustand (not just useState)
3. F4: Wrap sessionStorage parse in try/catch with default fallback
4. F5: Add cleanup `abort()` in useEffect return function on unmount
5. F6: Use `crypto.randomUUID()` — no third-party UUID lib
6. F6: Implement 100-snippet hard cap check before store action (don't rely on localStorage quota alone)
7. F6: Use `labelCancelledRef` pattern for rename blur/escape handling

**Status:** APPROVED
**Signed:** Principal Engineer
**Date:** 2026-03-01
