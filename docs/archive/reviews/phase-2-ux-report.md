# UX Review: Phase 2 Features

**Reviewer:** Senior UX Designer
**Date:** 2026-02-28
**Features reviewed:** 2.1 Statement Status Bar, 2.2 Table Schema Panel, 2.4 Workspace Persistence
**Files reviewed:**
- `src/components/EditorCell/EditorCell.tsx`
- `src/components/TreeNavigator/TreeNavigator.tsx`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/store/workspaceStore.ts`
- `src/types/index.ts`
- `docs/roadmap/03-confluent-ui-features.md`

---

## Overall Score: 6.5 / 10

The three features are functionally correct and correctly wired to the store. Design token usage is mostly consistent. The biggest gaps are: the status bar is a redundant layer that creates information hierarchy confusion alongside the existing cell-header badge system; the schema panel is spatially constrained and missing key Confluent-parity affordances; and the persistence footer saves `lastSavedAt` at bundle initialisation time rather than on actual user edits, making the timestamp misleading.

---

## Feature 2.1 — Statement Status Bar

### What was built

A horizontal strip rendered immediately below the Monaco editor (before the results table). Visible only when `statement.startedAt` is set (i.e. when the statement has been executed at least once). Contains three labelled items: START TIME, STATUS (colored dot + text), and STATEMENT NAME.

---

### PASS items

**P — Design token usage is correct**
`var(--color-surface-secondary)`, `var(--color-border)`, `var(--color-text-secondary)`, `var(--color-text-tertiary)`, and `var(--color-primary)` are all drawn from the token set defined in `index.css`. No hardcoded hex values appear in the status-bar rules. The `font-size: 12px` for values and `font-size: 11px` for uppercase labels matches the visual scale used in `.cell-number` and `.results-info` elsewhere.

**P — Status dot colors are semantically correct**
`running` maps to `--color-success` (#22C55E), `error` to `--color-error` (#EF4444), `pending` to `--color-warning` (#F59E0B), `completed` to `--color-success`, `cancelled`/`idle` to `--color-text-tertiary`. These match the badge colors in `.status-badge.*` for visual consistency.

**P — Statement name overflow is handled**
`.statement-name` applies `max-width: 300px`, `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`. Long names (matching the Confluent pattern `example-workspace-450aa1ba-9949-4b9a-af56-63f76e650...`) will truncate correctly.

**P — The running dot animates**
`.status-dot.running` uses the `pulse` keyframe (`opacity 2s ease-in-out infinite`). This matches the Confluent reference which shows a pulsing green dot for the RUNNING state.

---

### NEEDS_CHANGE items

**NC-2.1-01 — Duplicate status display between cell header and status bar**
- **Severity:** P2
- **Description:** The cell header already renders `getStatusBadge()` in `.cell-header-center`, which shows the same state (PENDING / RUNNING / COMPLETED / ERROR / CANCELLED) with the same icons and colors. The status bar below the editor then repeats `STATUS: [dot] RUNNING`. A user executing a query sees the same status rendered twice within the same cell: once in the header above the editor, once in the bar below it. This creates noise and undermines the hierarchy principle that the most important information should appear once, prominently.
- **Suggested fix:** Remove the STATUS item from the status bar and instead treat the bar as "metadata about the completed or in-flight execution" — START TIME and STATEMENT NAME only. The live status signal belongs exclusively in the cell header badge, where it is visible at a glance without scrolling past the editor. If both locations must show status, give each a distinct role: header = current state, status bar = final outcome (e.g. show duration next to COMPLETED instead of repeating the word).

**NC-2.1-02 — Statement name is not a clickable link**
- **Severity:** P2
- **Description:** The Confluent reference explicitly shows the statement name as a purple hyperlink that opens a 4-tab detail panel (Activity, Statement Properties, SQL Content, Logs). The current implementation renders the name as a styled `<span className="statement-name">` with `color: var(--color-primary)` — it looks like a link (blue/purple, monospace) but is not interactive. This violates the affordance principle: an element that is styled as a link must behave as a link. Users will click it and get no feedback.
- **Suggested fix (minimum):** Either add `cursor: pointer` + a click handler that navigates to or opens a statement detail view, or change the styling to plain `color: var(--color-text-primary)` monospace text with no link appearance until the detail panel exists. The misleading affordance is worse than a missing feature.

**NC-2.1-03 — Status bar is visible for IDLE statements after a page reload**
- **Severity:** P3
- **Description:** The persistence layer (feature 2.4) restores `status` from localStorage but resets RUNNING/PENDING to IDLE. It does not persist `startedAt`. However, if a statement is persisted with status COMPLETED and `startedAt` is a `Date` object stored in localStorage, the store may restore it (Zustand `persist` serialises the entire state slice including `startedAt` unless explicitly excluded via `partialize`). Looking at `workspaceStore.ts` line 531–543, the `partialize` function only stores `id`, `code`, `status`, `createdAt`, and `isCollapsed` — it does not store `startedAt`. So after reload, `startedAt` will be `undefined` and the status bar correctly stays hidden. This is correct behaviour; however it creates a subtle inconsistency: on reload, the cell shows its last status (e.g. COMPLETED) in the header badge but no status bar. This is slightly confusing but acceptable. Document the intentional omission in a code comment next to the `partialize` function.
- **Suggested fix:** Add a comment in `workspaceStore.ts` `partialize` noting that `startedAt` is intentionally excluded so the status bar does not show stale timestamps on reload.

**NC-2.1-04 — No `aria-label` on status dot**
- **Severity:** P2
- **Description:** The `<span className="status-dot ..."></span>` elements in the status bar are purely visual — they convey state through color alone. Screen readers will announce nothing for these elements. A user relying on assistive technology reading the status bar will hear "START TIME: [value] STATUS: RUNNING" because the dot span is empty, but only if the screen reader picks up the adjacent text node. In the cell header, `FiCheckCircle` and `FiAlertCircle` have accessible SVG markup from react-icons, but the plain dot spans do not.
- **Suggested fix:** Add `role="img"` and `aria-label` to the status dot:
  ```tsx
  <span
    className={`status-dot ${statement.status.toLowerCase()}`}
    role="img"
    aria-label={statement.status}
  />
  ```

**NC-2.1-05 — START TIME uses `toLocaleTimeString()`, losing date context**
- **Severity:** P3
- **Description:** The Confluent reference shows start time as a full ISO timestamp: `2026-02-28T06:49:51.746976Z`. The implementation calls `statement.startedAt.toLocaleTimeString()`, which produces only the time portion (e.g. `6:49:51 AM`). For a query started the day before (which can persist across midnight if the user leaves the tab open), the date is lost. Additionally, `toLocaleTimeString()` output varies by OS locale, which can cause test assertions to break and makes the format inconsistent with the ISO format shown in the Confluent reference.
- **Suggested fix:** Use a consistent format. Minimum: `toLocaleString()` to include date. Better: a helper that formats as `YYYY-MM-DDTHH:mm:ss.sssZ` to match the Confluent reference exactly.

**NC-2.1-06 — Status bar not responsive on narrow widths**
- **Severity:** P3
- **Description:** The `.statement-status-bar` uses `display: flex` with `gap: 24px` and no wrapping. At the `768px` breakpoint, the sidebar is hidden but the main content can still be narrow. With three items at `gap: 24px`, the bar can reach ~600px minimum width. If the browser window is narrowed below that, the items will overflow or clip. There is no `flex-wrap: wrap` or responsive rule for `.statement-status-bar` in the `@media (max-width: 768px)` block.
- **Suggested fix:** Add `flex-wrap: wrap` and reduce `gap` to `12px` at `768px` or below:
  ```css
  @media (max-width: 768px) {
    .statement-status-bar {
      flex-wrap: wrap;
      gap: 12px;
    }
  }
  ```

---

## Feature 2.2 — Table Schema Panel

### What was built

A panel anchored at the bottom of the sidebar (`flex-shrink: 0`, `max-height: 250px`, `overflow-y: auto`). Renders when `selectedTableName` is truthy. Shows the table name as a heading, a "Schema (N)" section title, and a list of column rows with name on the left and type on the right. Has loading and empty states.

---

### PASS items

**P — Loading state is implemented**
`schemaLoading` correctly shows a spinner + "Loading..." message in `.schema-loading`. This matches the pattern used in the tree navigator loading state and uses the same `FiLoader` + `animate-spin` combination.

**P — Empty state is implemented**
When `selectedTableSchema.length === 0` and `schemaLoading` is false, `.schema-empty` renders "No columns found" in italicised tertiary text. This gracefully handles the case where the API returns an empty schema.

**P — Column hover state is present**
`.schema-column:hover` applies `background-color: var(--color-surface-secondary)`. This provides lightweight row-level hover feedback consistent with `.tree-node:hover` and `.dropdown-option:hover`.

**P — Monospace font on column names and types**
Both `.column-name` and `.column-type` use `font-family: monospace`. This correctly distinguishes schema data (code) from UI chrome (prose), matching the Confluent panel which renders column names in a code-style font.

**P — `max-height` with `overflow-y: auto` prevents sidebar overflow**
The `max-height: 250px` cap with `overflow-y: auto` ensures the panel does not push the tree navigator's content off screen for tables with many columns.

---

### NEEDS_CHANGE items

**NC-2.2-01 — No close/dismiss button on the schema panel**
- **Severity:** P2
- **Description:** Once a table is selected and the schema panel appears, there is no way to dismiss it short of clicking a non-table node. In a narrow sidebar (280px, or 240px at `1024px` breakpoint), the schema panel consumes up to 250px of vertical space. This can crowd out the tree view, especially when a catalog has many levels of nesting. The Confluent reference shows a close affordance on the panel header and allows navigating away by clicking elsewhere.
- **Suggested fix:** Add a close button to `.schema-header`:
  ```tsx
  <div className="schema-header">
    <h4>{selectedTableName}</h4>
    <button
      className="icon-btn"
      onClick={() => set({ selectedTableName: null, selectedTableSchema: [] })}
      title="Close schema panel"
      aria-label="Close schema panel"
    >
      <FiX size={14} />
    </button>
  </div>
  ```
  Expose a `clearSelectedTable` action from the store to encapsulate this.

**NC-2.2-02 — Schema panel and tree navigator share one scroll container incorrectly**
- **Severity:** P2
- **Description:** The `tree-navigator` component uses `display: flex; flex-direction: column; height: 100%`. The `.tree-content` area has `flex: 1; overflow-y: auto`. The `.schema-panel` has `flex-shrink: 0; max-height: 250px`. However, the sidebar itself (`.sidebar`) has `overflow: hidden`. When the schema panel is at its max-height (250px), the remaining height for `.tree-content` shrinks accordingly. If the tree has many nodes, `.tree-content` becomes very short and the user must scroll within a small region. This is a cramped layout. At a minimum, the panel should be resizable or the sidebar should allow the user to toggle the panel.
- **Suggested fix (minimum):** Reduce `max-height` to `200px` and add a visual resize handle or collapse toggle on the schema panel header so the user can reclaim tree space. A more complete fix is a draggable split between tree and schema panel.

**NC-2.2-03 — Monospace font is `monospace` generic, not the design token**
- **Severity:** P3
- **Description:** The `.column-name` and `.column-type` rules use `font-family: monospace` (generic system monospace). The project's monospace design token in `index.css` is the `.font-mono` class, which maps to `"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`. Using the generic keyword means column names will render in whatever the OS default monospace is (often Courier New on Windows), which looks noticeably different from the Monaco editor content and from the collapsed preview in `.cell-collapsed-preview code`, which correctly uses `var(--font-mono, monospace)`. Note: `index.css` defines `--font-mono` as a class, not a CSS custom property, which means it cannot be used with `var()`. The App.css review note in the task states the token is `--font-mono: 'JetBrains Mono', monospace` but the actual `index.css` defines it as a class `.font-mono`. The correct approach is to define it as a CSS custom property.
- **Suggested fix:** Add to `index.css`:
  ```css
  :root {
    --font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
  }
  ```
  Then in `App.css`:
  ```css
  .column-name,
  .column-type {
    font-family: var(--font-mono);
  }
  ```

**NC-2.2-04 — No refresh button on the schema panel**
- **Severity:** P3
- **Description:** The Confluent reference explicitly shows a circular-arrow refresh icon next to the table name in the schema panel header. The current implementation has no refresh affordance. Once a schema is loaded, it stays cached in the store until a different table is selected. If a schema changes (a column is added/dropped) during a session, the user has no way to reload it without clicking a different table and back. The `loadTableSchema` action already exists in the store and accepts the same parameters.
- **Suggested fix:** Add a refresh button to `.schema-header`:
  ```tsx
  <button
    className="icon-btn"
    onClick={() => loadTableSchema(catalog, database, selectedTableName)}
    title="Refresh schema"
    aria-label="Refresh schema"
  >
    <FiRefreshCw size={14} />
  </button>
  ```

**NC-2.2-05 — Schema panel has no aria role or landmark**
- **Severity:** P2
- **Description:** The `.schema-panel` div has no ARIA role, label, or landmark. A screen reader navigating the sidebar will encounter the tree navigator content and then fall into the schema panel with no announcement of the section change. The `<h4>` tag inside `.schema-header` is the only heading, but it has no parent region role to scope it.
- **Suggested fix:**
  ```tsx
  <div
    className="schema-panel"
    role="region"
    aria-label={`Schema for ${selectedTableName}`}
  >
  ```

**NC-2.2-06 — Column type contrast is insufficient at 11px**
- **Severity:** P2
- **Description:** `.column-type` uses `color: var(--color-text-tertiary)` which resolves to `#9CA3AF` and `font-size: 11px`. Against the `#FFFFFF` surface background, `#9CA3AF` has a contrast ratio of approximately 2.85:1. WCAG AA requires 4.5:1 for normal text under 18pt/14pt bold. At 11px, this is well below the threshold. Even WCAG AA Large (3:1) is not met. Users with moderate vision loss will struggle to read data types in the panel.
- **Suggested fix:** Use `var(--color-text-secondary)` (#6B7280) for `.column-type`, which achieves approximately 4.6:1 contrast against white — just above the AA threshold. Alternatively, keep tertiary color but increase `font-size` to `12px` (matching `.column-name`) to improve legibility at the same contrast level. Using `var(--color-text-secondary)` is the cleaner fix.

**NC-2.2-07 — No "Options" section (Confluent parity gap)**
- **Severity:** P3
- **Description:** The Confluent reference shows an "Options (7)" expandable section below the Schema section, exposing table configuration key-value pairs. The current implementation has only the Schema section. This is a parity gap noted in `03-confluent-ui-features.md`. While the API may not yet expose this data, the UI should at minimum scaffold the section with a disabled/placeholder state rather than silently omitting it.
- **Suggested fix:** Add a collapsed "Options" section stub that shows "Options (loading...)" or "Options (unavailable)" with a disclosure triangle, visually indicating the section exists but is not yet populated. This sets user expectations rather than hiding the gap entirely.

**NC-2.2-08 — Double-click to insert SELECT query is not discoverable**
- **Severity:** P3
- **Description:** `TreeNodeComponent` handles `onDoubleClick` for table and view nodes, inserting a `SELECT * FROM ... LIMIT 10` statement. However, there is no visual affordance indicating this interaction exists. No tooltip, no hover hint, no documentation badge. A user seeing the tree for the first time has no signal that double-clicking a table name does anything useful. Single-click already selects and loads the schema, so double-click for a different action is a non-obvious two-tier interaction.
- **Suggested fix:** Add a tooltip or inline hint. At minimum, update the `title` attribute on the row element for table/view nodes:
  ```tsx
  title={
    node.type === 'table' || node.type === 'view'
      ? `Click to view schema. Double-click to insert SELECT query.`
      : undefined
  }
  ```

---

## Feature 2.4 — Workspace Persistence

### What was built

Zustand `persist` middleware writing to `localStorage` under the key `flink-workspace`. The `partialize` function saves: `statements` (code, id, status, createdAt, isCollapsed — RUNNING/PENDING normalized to IDLE), `catalog`, `database`, and `lastSavedAt` (set to `new Date().toISOString()` at serialisation time). The footer in `App.tsx` reads `lastSavedAt` from the store and renders "Last saved at [toLocaleTimeString()]".

---

### PASS items

**P — RUNNING/PENDING status is normalized to IDLE on persist**
`workspaceStore.ts` line 535: `status: s.status === 'RUNNING' || s.status === 'PENDING' ? 'IDLE' : s.status`. This correctly prevents a statement from loading in a permanent RUNNING state after a page reload when no actual execution is in progress. This is the correct safe default.

**P — Transient fields are excluded from persistence**
`results`, `error`, `statementName`, `executionTime`, `totalRowsReceived`, `startedAt`, `lastExecutedAt`, and `updatedAt` are not included in `partialize`. This keeps localStorage size bounded and prevents stale result data from being shown on reload.

**P — "Last saved at" footer aligns with Confluent reference**
The Confluent reference shows "Last saved at 2/28/26, 1:49 AM" in the footer left. The implementation places the same information in `.editor-footer` using `new Date(lastSavedAt).toLocaleTimeString()`. The position matches. The formatting is acceptable though slightly less complete (see NC-2.4-02 below).

**P — Minimum viable empty-statement guard**
`deleteStatement` ensures at least one blank statement remains when all are deleted, preventing the user from saving an empty workspace that would cause a blank editor on reload.

---

### NEEDS_CHANGE items

**NC-2.4-01 — `lastSavedAt` is set at serialize time, not at write time — timestamp is always stale**
- **Severity:** P1
- **Description:** This is the most significant issue in the three features. In `workspaceStore.ts`, `partialize` returns `lastSavedAt: new Date().toISOString()` (line 542). The `partialize` function runs every time Zustand serialises state to localStorage, which happens on every single state change — including `treeLoading: true` toggling, toast additions/removals, schema loading, `selectedNodeId` changes, and any UI state update. This means `lastSavedAt` is not "last time the user's SQL was saved" — it is "last time any state change occurred." On a fresh page load, the store hydrates from localStorage and the `lastSavedAt` from the persisted snapshot is shown; but within seconds of the page loading (as `loadCatalogs`, `loadDatabases`, `loadTreeData` fire), the timestamp will update to the current time even though the user has not edited anything. The footer will show "Last saved at [just now]" immediately after load, which is misleading.
- **Suggested fix:** Track `lastSavedAt` as explicit state that is only updated when statement content changes. Remove `lastSavedAt` from `partialize` (so it is not serialized as part of the snapshot), and instead set it in `updateStatement`, `addStatement`, `deleteStatement`, and `duplicateStatement`:
  ```ts
  updateStatement: (id, code) => {
    set((state) => ({
      statements: state.statements.map(...),
      lastSavedAt: new Date().toISOString(),
    }));
  },
  ```
  Because `lastSavedAt` is in-memory only (not in `partialize`), it will correctly be `null` after reload until the user makes an edit. The footer should handle `null` gracefully: show nothing or "Not saved yet." Alternatively, persist it explicitly but only update it from the actions listed above.

**NC-2.4-02 — "Last saved at" shows time only, not date**
- **Severity:** P3
- **Description:** `new Date(lastSavedAt).toLocaleTimeString()` produces `"1:49:35 AM"`. The Confluent reference shows `"Last saved at 2/28/26, 1:49 AM"` (date + time, no seconds). If the user left the workspace open overnight and returns the next morning, the footer will show a time from yesterday with no date, providing no useful context. Additionally, `toLocaleTimeString()` includes seconds which adds visual clutter.
- **Suggested fix:** Use `toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })` to produce `"2/28/26, 1:49 AM"`, matching the Confluent reference format:
  ```tsx
  Last saved at {new Date(lastSavedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
  ```

**NC-2.4-03 — Footer has no visual save indicator when a save occurs**
- **Severity:** P2
- **Description:** When the user types in the editor, Zustand immediately serialises to localStorage (synchronous). The "Last saved at" timestamp updates silently. There is no micro-animation, no brief flash, and no "Saving..." intermediate state to reassure the user that their work is being persisted. This is in contrast to tools like Notion, Google Docs, and Confluent itself, where the save indicator briefly shows a "saving" state before settling to "saved at [time]." For a developer tool handling SQL queries that may represent hours of work, silent persistence offers less confidence than expected.
- **Suggested fix:** Add a transient "Saving..." state with a brief 800ms display, then resolve to the timestamp:
  ```tsx
  // In App.tsx, maintain a local isSaving state.
  // In workspaceStore, add a savingSignal (incrementing counter or timestamp).
  // When savingSignal changes, flash "Saving..." for 800ms then show "Last saved at".
  ```
  Minimum viable alternative: a brief CSS keyframe on the `.last-saved` element that fades it in when `lastSavedAt` changes, giving a visual "blink" that signals the value updated.

**NC-2.4-04 — `cell-count` span in footer lacks semantic label**
- **Severity:** P3
- **Description:** `App.tsx` line 96 renders `<span className="cell-count">{statements.length} statement(s)</span>`. The Confluent reference shows "3 / 20 cells" (current scroll position / total). The current implementation shows only the total count, not the user's current position. Additionally, `statement(s)` is grammatically awkward — it should be `"1 statement"` (singular) or `"N statements"` (plural) depending on count.
- **Suggested fix:** Implement singular/plural correctly:
  ```tsx
  {statements.length === 1 ? '1 statement' : `${statements.length} statements`}
  ```
  For full Confluent parity, track the currently-focused/visible cell index and render `{activeIndex + 1} / {statements.length} cells`.

**NC-2.4-05 — No user-facing error handling for localStorage quota exceeded**
- **Severity:** P2
- **Description:** `localStorage` has a ~5MB limit per origin. A workspace with many statements, each containing large SQL queries, could exceed this. Zustand's `persist` middleware does not surface `QuotaExceededError` to the UI — it silently fails. The user would continue editing, believing their work is being saved, but it is not. There is no toast, no warning, and no fallback.
- **Suggested fix:** Wrap the persist middleware's `storage` option with a custom implementation that catches `QuotaExceededError` and calls `addToast({ type: 'error', message: 'Could not save workspace: storage quota exceeded. Consider deleting unused statements.' })`. Example:
  ```ts
  storage: createJSONStorage(() => ({
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          useWorkspaceStore.getState().addToast({
            type: 'error',
            message: 'Workspace could not be saved: storage limit reached.',
          });
        }
      }
    },
    removeItem: (name) => localStorage.removeItem(name),
  })),
  ```

**NC-2.4-06 — `createdAt` is serialized as a Date object but deserializes as a string**
- **Severity:** P2
- **Description:** `SQLStatement.createdAt` is typed as `Date` in `types/index.ts`. The `partialize` function persists it as-is into JSON, which means it is stored as an ISO string in localStorage. On hydration, Zustand restores it as a string, not a `Date` object. Any code that calls `.toLocaleDateString()` or other `Date` methods on `createdAt` after reload will throw `TypeError: s.createdAt.toLocaleDateString is not a function`. The same risk applies to `startedAt` and `lastExecutedAt` if they were ever persisted. Currently the cell header does not display `createdAt` directly, but the risk exists for future use.
- **Suggested fix:** Either type `createdAt` as `string` (ISO format) throughout, or add a migration/reviver in the Zustand `persist` options:
  ```ts
  {
    name: 'flink-workspace',
    partialize: ...,
    onRehydrateStorage: () => (state) => {
      if (state) {
        state.statements = state.statements.map(s => ({
          ...s,
          createdAt: new Date(s.createdAt),
        }));
      }
    },
  }
  ```

---

## Summary

### Top 3 Priorities

**Priority 1 — NC-2.4-01: `lastSavedAt` updates on every state change, not only on user edits (P1)**
The "Last saved at" timestamp is fundamentally broken as a user trust signal. It will show a timestamp from earlier in the session for operations the user never initiated (API loading, tree toggling). This must be fixed before the feature ships. Move `lastSavedAt` updates into the write actions (`updateStatement`, `addStatement`, `deleteStatement`, `duplicateStatement`) and remove it from `partialize`.

**Priority 2 — NC-2.1-02: Statement name is styled as a link but is not interactive (P2)**
An element with `color: var(--color-primary)` and monospace font in a context next to other interactive elements will be clicked. Receiving no feedback destroys user trust in the UI and implies a bug. Either wire it to a detail panel or remove the link styling immediately.

**Priority 3 — NC-2.2-06: Column type text fails WCAG AA contrast at 11px (P2)**
`#9CA3AF` at 11px on white is approximately 2.85:1, well below the 4.5:1 AA threshold. Schema panels are used by developers reading column types when writing queries — this is a high-frequency legibility context. Change `.column-type` to `color: var(--color-text-secondary)` (#6B7280) immediately.

---

### Full findings summary table

| ID | Feature | Severity | Title |
|----|---------|----------|-------|
| NC-2.1-01 | Status Bar | P2 | Duplicate status display in header badge and status bar |
| NC-2.1-02 | Status Bar | P2 | Statement name styled as link but is not interactive |
| NC-2.1-03 | Status Bar | P3 | Stale status bar behavior after reload should be documented |
| NC-2.1-04 | Status Bar | P2 | Status dot has no aria-label (color-only state indicator) |
| NC-2.1-05 | Status Bar | P3 | START TIME uses toLocaleTimeString(), loses date context |
| NC-2.1-06 | Status Bar | P3 | Status bar not responsive — no flex-wrap at narrow widths |
| NC-2.2-01 | Schema Panel | P2 | No close/dismiss button on schema panel |
| NC-2.2-02 | Schema Panel | P2 | Schema panel and tree compete for fixed sidebar height |
| NC-2.2-03 | Schema Panel | P3 | Column font uses generic `monospace`, not design token |
| NC-2.2-04 | Schema Panel | P3 | No refresh button on schema panel header (Confluent parity) |
| NC-2.2-05 | Schema Panel | P2 | Schema panel has no ARIA region or landmark |
| NC-2.2-06 | Schema Panel | P2 | Column type contrast fails WCAG AA (2.85:1 at 11px) |
| NC-2.2-07 | Schema Panel | P3 | Options section absent (Confluent parity gap) |
| NC-2.2-08 | Schema Panel | P3 | Double-click to insert query is not discoverable |
| NC-2.4-01 | Persistence | P1 | lastSavedAt updates on every state change, not user edits |
| NC-2.4-02 | Persistence | P3 | Last saved shows time only, not date+time |
| NC-2.4-03 | Persistence | P2 | No visual save indicator micro-interaction |
| NC-2.4-04 | Persistence | P3 | Statement count uses awkward "statement(s)" copy |
| NC-2.4-05 | Persistence | P2 | No error handling for localStorage quota exceeded |
| NC-2.4-06 | Persistence | P2 | createdAt deserializes as string, not Date, after reload |
