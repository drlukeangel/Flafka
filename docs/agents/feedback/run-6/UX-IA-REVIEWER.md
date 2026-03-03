# UX/IA Reviewer — A2 Design Review
## Phase 12.6: Config Audit, Schema Filtering & Query Templates

**Reviewer:** UX/IA/Accessibility Reviewer
**Date:** 2026-03-01
**Status:** COMPLETE

---

## Review Scope

Reviewing `docs/features/phase-12.6-prd.md` for user journey coherence, discoverability, accessibility, dark/light mode compliance, and information architecture fit.

---

## Feature-by-Feature UX Assessment

### F1 — Config Audit Log

**User Journey:**
- User edits a config -> saves -> section "Config History" appears below config table -> collapsed by default -> user clicks to expand -> sees history.
- Journey is logical. Post-edit confirmation flow is natural.
- "Below config table" placement: contextually relevant. User doesn't need to search for history.

**Discoverability:**
- CONCERN: "Config History" collapsed by default — users may not discover it exists. Recommend: after the FIRST successful save in a session, automatically expand the section once to make discovery natural.
- The section header itself is visible even when collapsed. Use a visual indicator (chevron icon, expand arrow) to signal the section is clickable/expandable.

**Accessibility — BLOCKING conditions for Phase 2.6:**
- REQUIRE (U-1): The "Config History" toggle MUST have an `aria-controls` attribute pointing to the content region ID. Required for screen readers to announce the relationship.
- REQUIRE (U-2): The expanded region MUST have `role="region"` and `aria-label="Config history"` so screen readers can navigate to it directly.
- AC-1.12 Enter/Space to toggle: required, included in PRD.
- AC-1.14 `aria-expanded` on toggle button: required, included in PRD.

**Dark/Light Mode:** AC-1.10/1.11 CSS custom properties required. Compliant.

**Conditions Registered for Phase 2.6:**
- U-1 (BLOCKING): `aria-controls` on Config History toggle button
- U-2 (BLOCKING): `role="region"` + `aria-label` on expanded content area
- U-3 (non-blocking): Chevron/expand indicator on collapsed header (visual affordance)

---

### F2 — Schema Subject List Filter

**User Journey:**
- User opens Schema panel -> sees subject list with existing search bar -> now also sees Type dropdown and Compat dropdown -> selects AVRO -> list instantly filters.
- Incremental disclosure: filters are in the toolbar, always visible. No modal needed.
- Active filter visually indicated (dropdown shows selected value, not placeholder). Clear feedback.

**Discoverability:**
- Dropdowns in toolbar alongside existing search: high discoverability. Same interaction pattern as search.
- Toolbar may become crowded with 3 controls (search + 2 dropdowns). Consider visual grouping or label "Filter:" prefix.

**Accessibility — BLOCKING conditions for Phase 2.6:**
- REQUIRE (U-4): When filter reduces subjects to empty state, the empty state message "No subjects match the current filters." must be announced to screen readers. Use `aria-live="polite"` on the results container.
- AC-2.11: Tab + arrow keys for native select inherent accessibility.
- AC-2.12: `aria-label` on each dropdown.
- NOTE (U-5, non-blocking): Visible label text "Type:" and "Compat:" beside each dropdown add clarity for sighted users.

**Dark/Light Mode:** AC-2.8/2.9 CSS custom properties required. Compliant.

**Conditions Registered for Phase 2.6:**
- U-4 (BLOCKING): `aria-live="polite"` on subject list container for empty state announcement
- U-5 (non-blocking): Visible label text "Type:" and "Compat:" beside each dropdown

---

### F3 — Schema Panel Loading Skeleton

**User Journey:**
- User opens Schema panel -> while loading, sees 5 shimmer rows -> rows replaced by real content.
- Prevents "appears broken" UX. Major perceived quality improvement.

**Accessibility — BLOCKING conditions for Phase 2.6:**
- AC-3.8 `aria-busy="true"` on container while loading: correct.
- REQUIRE (U-6): Skeleton rows should have `aria-hidden="true"` so screen readers do not attempt to read the placeholder shimmer elements.

**Dark/Light Mode:** AC-3.6/3.7 CSS custom properties for shimmer. Compliant.

**Conditions Registered for Phase 2.6:**
- U-6 (BLOCKING): `aria-hidden="true"` on individual skeleton rows

---

### F4 — Config Table Sort Persistence

**User Journey:**
- User sorts config table -> switches topic -> new topic opens with same sort. Seamless.
- Power user workflow improvement. Correct use of sessionStorage.

**Accessibility — BLOCKING conditions for Phase 2.6:**
- REQUIRE (U-7): Sort column headers must have `aria-sort="ascending"` or `aria-sort="descending"` attribute on the `<th>` element. Required for screen readers to announce sort state.

**Dark/Light Mode:** Sort indicators (up/down arrows or icons) must use CSS custom properties for color.

**Conditions Registered for Phase 2.6:**
- U-7 (BLOCKING): `aria-sort` attribute on active sort column headers

---

### F5 — AbortController on Schema Diff Fetch

**User Journey:** Internal fix. No visible UX change for most cases. Rapid version switching now shows correct last-selected version.

**Conditions Registered for Phase 2.6:** None (internal fix, no UX surface)

---

### F6 — Query Templates / Saved Snippets Library

**User Journey — Save:**
- User is in EditorCell -> clicks "Save as snippet" in toolbar -> prompted for name -> confirms -> snippet appears in Snippets panel.
- Toolbar integration: consistent with existing EditorCell toolbar actions.
- CONCERN: The name prompt mechanism must NOT use `window.prompt()` (inaccessible and inconsistent). Must use an inline modal or inline input overlay consistent with existing patterns.

**User Journey — Insert:**
- User focuses an EditorCell -> opens Snippets panel -> clicks snippet -> SQL inserted.
- editorRegistry-based insertion: correct.
- Toast when no editor focused: immediate, clear feedback.
- CONCERN: "No editor focused" workflow is non-intuitive. Consider: snippet item shows tooltip "Click to insert into focused cell" to set expectations.

**User Journey — Rename:** Double-click name -> inline edit -> Enter/Escape. Consistent with workspace name pattern.

**User Journey — Delete:** DeleteConfirm pattern with inline overlay. Consistent.

**Discoverability:**
- New sidebar icon: consistent with Schema panel toggle.
- CONCERN: Sidebar icons need distinct visual identity. The Snippets panel icon must be visually distinct from Schema panel icon. Recommend a "code snippet" icon (e.g., `</>` style) to communicate purpose to technical users.
- Empty state guides user: "No snippets yet. Save a SQL cell to get started." Clear call to action.

**Accessibility — BLOCKING conditions for Phase 2.6:**
- REQUIRE (U-8): Save prompt MUST be a `<dialog>` element or ARIA modal with `role="dialog"`, `aria-modal="true"`, focus trapped inside. No `window.prompt()`.
- REQUIRE (U-9): Snippet list should use `role="list"` + `role="listitem"` with proper keyboard handling.
- REQUIRE (U-10): Search input in Snippets panel must have `aria-label="Search snippets"`.
- REQUIRE (U-11): Empty state message must have `role="status"` or be in an `aria-live` region.
- REQUIRE (U-12): Sidebar icon button for Snippets panel must have `aria-label="Snippets"` and `aria-expanded` attribute.

**Dark/Light Mode:** AC-6.14/6.15 dark/light modes, CSS custom properties. Compliant per PRD.

**Conditions Registered for Phase 2.6:**
- U-8 (BLOCKING): Save prompt MUST be a proper `<dialog>` or ARIA modal — no `window.prompt()`
- U-9 (BLOCKING): Snippet list MUST use semantic list roles
- U-10 (BLOCKING): Search input MUST have `aria-label="Search snippets"`
- U-11 (BLOCKING): Empty state MUST have `role="status"` for screen reader announcement
- U-12 (BLOCKING): Sidebar Snippets icon MUST have `aria-label="Snippets"` + `aria-expanded`
- U-13 (non-blocking): Snippet hover tooltip for insert affordance

---

### F7 — Diff View Stale Closure Fix

UX: Internal state machine fix. No visible UX degradation. No specific UX conditions needed.

---

### F8 — Health Dot Fix

UX: Reducing visual noise for healthy topics. Correct decision. Consistent with TopicList. No additional UX conditions.

---

### F9 — Diff Auto-Exit

UX: Auto-exit from broken diff state when last version deleted. Prevents user confusion. No additional UX conditions.

---

### F10 — Duplicate Warning Fix

UX: Tooltip clarity improvement. Correct. No additional UX conditions.

---

### F11 — CSS Variable Fix

UX: Visual parity fix. No user-visible change in behavior. No additional UX conditions.

---

## UX/IA Phase 2.6 Conditions Summary

| # | Condition | Feature | Blocking? |
|---|-----------|---------|-----------|
| U-1 | Config History toggle: `aria-controls` pointing to content region | F1 | BLOCKING |
| U-2 | Config History content: `role="region"` + `aria-label="Config history"` | F1 | BLOCKING |
| U-3 | Config History header: chevron/expand indicator (visual affordance) | F1 | Non-blocking |
| U-4 | Subject list: `aria-live="polite"` for empty state announcement | F2 | BLOCKING |
| U-5 | Filter dropdowns: visible "Type:" and "Compat:" label text | F2 | Non-blocking |
| U-6 | Skeleton rows: `aria-hidden="true"` on individual rows | F3 | BLOCKING |
| U-7 | Sort column headers: `aria-sort` attribute | F4 | BLOCKING |
| U-8 | Save prompt: `<dialog>` or ARIA modal (no window.prompt) | F6 | BLOCKING |
| U-9 | Snippet list: `role="list"` + `role="listitem"` | F6 | BLOCKING |
| U-10 | Search input: `aria-label="Search snippets"` | F6 | BLOCKING |
| U-11 | Empty state: `role="status"` | F6 | BLOCKING |
| U-12 | Sidebar icon: `aria-label="Snippets"` + `aria-expanded` | F6 | BLOCKING |
| U-13 | Snippet hover tooltip for insert affordance | F6 | Non-blocking |

**Blocking conditions (enforced at Phase 2.6 gate): U-1, U-2, U-4, U-6, U-7, U-8, U-9, U-10, U-11, U-12**

---

## VERDICT: APPROVE

The PRD UX design is solid. Blocking accessibility conditions (U-1, U-2, U-4, U-6, U-7, U-8, U-9, U-10, U-11, U-12) must be implemented during B1 and validated at Phase 2.6. Non-blocking conditions (U-3, U-5, U-13) are polish items for B6.

**Status:** APPROVED (with Phase 2.6 conditions registered above)
**Signed:** UX/IA Reviewer
**Date:** 2026-03-01
