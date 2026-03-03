# Principal Architect — A2 Design Review
## Phase 12.6: Config Audit, Schema Filtering & Query Templates

**Reviewer:** Principal Architect
**Date:** 2026-03-01
**Status:** IN PROGRESS — reviewing PRD

---

## Review Scope

Reviewing `docs/features/phase-12.6-prd.md` (11 features, 41 story points).

### System Design Fit

**F1 — Config Audit Log (TopicDetail.tsx + workspaceStore.ts + types/index.ts)**
- ✅ Session-scoped audit log in Zustand store: correct pattern. Does NOT persist to localStorage — intentional. Store holds ephemeral session state.
- ✅ 200-entry FIFO cap: appropriate for in-memory session log. Prevents unbounded growth.
- ✅ Only written on confirmed save success — correct coupling to the API response, not optimistic.
- ⚠️ CONCERN: PRD says "optional: separate hook" for the log. Recommend keeping it in workspaceStore.ts for consistency — do NOT introduce a separate hook. Zustand is the single state source.
- ✅ Separation of concerns: log data in store, display in TopicDetail. Clean.

**F2 — Schema Subject List Filter (SchemaPanel.tsx)**
- ✅ Filtering on already-loaded data — no new API calls required. Correct architectural decision.
- ✅ AND logic across type/compat/name search: consistent with standard filter patterns.
- ✅ Session-scoped filter state (resets on mount): simple, no persistence needed. Correct.
- ⚠️ CONCERN: PRD says "filter state resets when user navigates away and returns" — confirm SchemaPanel unmounts/remounts when closed and reopened. If SchemaPanel is kept mounted (display:none), filter state would NOT reset. Engineering must verify component mount lifecycle.

**F3 — Schema Panel Skeleton (SchemaPanel.tsx)**
- ✅ Initial-load-only skeleton (not on re-fetch): correct. Avoids jarring flash on refresh.
- ✅ CSS shimmer pattern already in codebase (from Phase 12.2 R2, ORIG-7). No new animation code needed — reuse existing.
- ✅ `aria-busy="true"` on container: correct ARIA pattern for loading states.

**F4 — Config Table Sort Persistence (TopicDetail.tsx + sessionStorage)**
- ✅ `sessionStorage` not `localStorage` — correct scope. Resets on reload, persists across topic navigation within session.
- ✅ Key `flink-ui.configTableSort`: consistent naming convention with existing keys.
- ✅ Sorted on topic switch: initialization reads from sessionStorage on component mount/topic change.
- ⚠️ CONCERN: If TopicDetail is a single component that receives a topic prop (not unmounted/remounted on topic switch), sort state must be initialized inside a useEffect that depends on `topicName`. Engineering must handle this correctly.

**F5 — AbortController on Schema Diff Fetch (SchemaDetail.tsx + schema API)**
- ✅ Mirrors Phase 12.5 Feature 8 pattern exactly. Proven approach.
- ✅ `signal?: AbortSignal` optional parameter is backward compatible.
- ✅ Abort errors silently ignored: correct (AbortError is not a user-visible error).
- ✅ Clean: create controller on each fetch trigger, abort previous before new fetch.

**F6 — Query Templates / Snippets Library (NEW: SnippetsPanel.tsx + workspaceStore.ts + types/index.ts)**
- ✅ New panel: `src/components/SnippetsPanel/SnippetsPanel.tsx` — correct new file location.
- ✅ Uses `editorRegistry` pattern for focused editor detection — existing, proven pattern.
- ✅ localStorage persistence under `flink-ui.snippets` — correct key naming convention.
- ✅ 100-snippet cap: appropriate for localStorage storage limits.
- ⚠️ CONCERN: `QuotaExceededError` handling for localStorage is mentioned in edge cases but PRD is vague. Engineering MUST implement try/catch around every localStorage.setItem() call for snippets. Show toast on failure.
- ⚠️ CONCERN: Snippet schema includes `id` (UUID). Engineering should use `crypto.randomUUID()` (available in all modern browsers) rather than a third-party library.
- ✅ Snippets in Zustand store (for reactive updates) + localStorage (for persistence). This dual-layer is the existing pattern (zustand persist middleware). Confirm snippets use zustand persist middleware rather than manual localStorage calls.
- ⚠️ CONCERN: PRD says snippets stored in workspaceStore.ts — if using zustand persist, verify the `partialize` function includes `snippets` field. If not using persist, manual localStorage sync needed. Engineering must decide and document.

**F7 — Diff View Stale Closure Fix (SchemaDetail.tsx)**
- ✅ Root cause clearly identified: stale closure in `handleVersionChange`. Fix is to pass new primary version explicitly.
- ✅ Auto-update diff version to next available: correct fallback.
- ✅ Exit diff mode if no alternative: correct terminal state handling.

**F8 — Health Dot Fix for Healthy Topics (TopicDetail.tsx)**
- ✅ Single-line parity fix: apply same guard from TopicList.tsx to TopicDetail.tsx.
- ✅ No architectural change needed.

**F9 — Diff Auto-Exit on Last-Version Delete (SchemaDetail.tsx)**
- ✅ After version delete callback: check version list length, auto-exit if < 2. Simple guard.
- ✅ Shares file with F7 — assign to same engineering agent (same file ownership).

**F10 — Duplicate Health Warning Fix (TopicDetail.tsx)**
- ✅ Refactor to early-return pattern: correct. Eliminates fall-through conditions.
- ✅ Shares file with F1, F4, F8 — assign to same TopicDetail engineering agent.

**F11 — CSS Custom Property (SchemaDetail.tsx + index.css)**
- ✅ Define `--color-button-danger-text` in `:root` and `[data-theme="dark"]`. Same value (#ffffff) in both — correct (danger button text is white on dark red backgrounds in both themes).
- ✅ Shares SchemaDetail.tsx with F5, F7, F9 — assign to same engineering agent.

### REST API Compliance
- F1: No API changes. Config saves already use existing PATCH/PUT to Confluent API. ✅
- F2: No new API calls. Filtering on existing loaded data. ✅
- F3: No API changes. UI only. ✅
- F4: No API changes. sessionStorage only. ✅
- F5: Schema version fetch — existing API function gets `signal?: AbortSignal` parameter. Not a new endpoint. Axios accepts signal in config. ✅
- F6: No external API calls. All localStorage-backed. ✅
- F7-F11: No API changes. ✅

### State Management
- workspaceStore.ts is touched by F1 (audit log state) and F6 (snippets state). **These must go to ONE engineering agent** — cannot split workspaceStore.ts across two agents.
- types/index.ts is touched by F1 (ConfigAuditEntry type) and F6 (Snippet type). **Same agent handles both.**
- All other features are component-only changes.

### Separation of Concerns
- ✅ API layer unchanged for most features
- ✅ Store holds state, components render it
- ✅ New SnippetsPanel is self-contained with its own file
- ✅ editorRegistry injection for snippets: correct (not direct DOM access)

---

## VERDICT: APPROVE

**Conditions (non-blocking, implement during B1):**
1. Keep config audit log in workspaceStore.ts — do NOT introduce a separate hook
2. Verify SchemaPanel mount lifecycle for filter state reset behavior
3. Use `crypto.randomUUID()` for snippet IDs — no third-party UUID library
4. Implement try/catch around all localStorage.setItem() calls for snippets
5. Use zustand persist middleware for snippets (not manual localStorage sync) — verify partialize includes snippets

**File Ownership Recommendation for B1:**
- **Agent A (Store + Types):** `workspaceStore.ts`, `types/index.ts` — F1 audit log state + F6 snippet state/types
- **Agent B (TopicDetail):** `TopicDetail.tsx` — F1 display, F4, F8, F10
- **Agent C (SchemaDetail + CSS):** `SchemaDetail.tsx`, `index.css` — F5, F7, F9, F11
- **Agent D (SchemaPanel + SnippetsPanel):** `SchemaPanel.tsx`, new `SnippetsPanel.tsx`, `App.tsx` — F2, F3, F6 panel
- Agent B depends on Agent A (needs Zustand store types). Agent D depends on Agent A (needs snippet types). Stagger: Agent A first (or concurrent with C), then B and D can start.

**Status:** ✅ A2 APPROVED
**Signed:** Principal Architect
**Date:** 2026-03-01
