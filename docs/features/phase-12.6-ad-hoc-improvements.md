# Phase 12.6 Ad-Hoc Improvements — Product Owner Directed

**Status**: Implemented (uncommitted on `master`)
**Author**: Product Owner (hands-on session)
**Date**: 2026-03-01
**Context**: Outside Workflow Automation
**Branch**: `master` (uncommitted working changes)

---

## Overview

Eight improvements implemented during hands-on product owner sessions. These changes are outside the automated workflow pipeline (Phases 1-5) and were directed in real-time by the product owner. They span Schema-Topic cross-navigation, side panel UX, TopicDetail layout polish, real Schema Registry API integration, and Flink session property quick-access.

---

## Feature 1: Schema to Topic Navigation Chip

**Files Changed:**
- `src/store/workspaceStore.ts` — added `navigateToTopic` async action
- `src/components/SchemaPanel/SchemaDetail.tsx` — added clickable chip in header

**Tests:**
- `src/__tests__/components/SchemaTopicLink.test.tsx` (8 UI tests)
- `src/__tests__/store/topicStore.test.ts` (5 store tests)

**What it does:**
Adds a clickable chip button in the SchemaDetail header (e.g., `[-> Topic: orders]`) that navigates directly to the corresponding topic in the Topics panel.

**Design decisions:**
- Chip only renders when the subject name ends in `-value` or `-key` (TopicNameStrategy convention). Strips the suffix to derive the topic name.
- `navigateToTopic` action mirrors the existing `navigateToSchemaSubject` pattern: sets `activeNavItem` to `'topics'`, selects the matching topic by name.
- Eager `loadTopics()` call when the topic list is empty (first navigation).
- Sets `selectedTopic` to explicit `null` when no matching topic is found (clear state rather than stale selection).

---

## Feature 2: Resizable Side Panel

**Files Changed:**
- `src/App.tsx` — mouse event handlers for drag-to-resize
- `src/App.css` — `.side-panel-resize-handle` styles

**What it does:**
Adds a drag handle on the left edge of the side panel. Users can click and drag to resize the panel width.

**Design decisions:**
- Width clamped between 200px (minimum usable) and 800px (prevents overwhelming the main workspace).
- Mouse event pattern: `mousedown` on handle starts drag, `mousemove` on `document` updates width, `mouseup` stops drag.
- Width resets to default when the active nav item changes (panel content changes often have different width needs).
- CSS: `cursor: col-resize` with a subtle hover highlight on the handle.

---

## Feature 3: Schema Association Moved to Top of TopicDetail

**Files Changed:**
- `src/components/TopicPanel/TopicDetail.tsx` — section reorder

**What it does:**
Moved the Schema Association section from below Config History to directly after the Metadata rows (before the Configuration section).

**Design decisions:**
- Better discoverability: the topic-schema relationship is a primary concern for Flink developers. Burying it below configuration history made it hard to find.
- No logic changes, purely a DOM reorder.

---

## Feature 4: Delete Button Icon-Only

**Files Changed:**
- `src/components/TopicPanel/TopicDetail.tsx` — button label removal

**What it does:**
Removed the "Delete" text label from the topic delete button, making it icon-only (trash can icon) with compact padding.

**Design decisions:**
- The trash can icon is universally understood. The text label was redundant and consumed horizontal space in the header action bar.
- Compact padding keeps the button visually balanced with other icon-only actions.

---

## Feature 5: Portal-Based BadgeTooltip Component

**Files Changed:**
- `src/components/TopicPanel/TopicDetail.tsx` — new `BadgeTooltip` component
- `src/App.css` — `.badge-tooltip-popup` styles

**What it does:**
New `BadgeTooltip` component using `ReactDOM.createPortal` to render tooltips into `document.body`. Applied to the partition count badge (e.g., "6P") and replication factor badge (e.g., "RF:3") to explain what each badge means.

**Design decisions:**
- Portal pattern solves tooltip clipping from `overflow: hidden` containers. Same pattern used by the JSON cell expander (Phase 10).
- Tooltip positioned via `getBoundingClientRect()` relative to the badge element.
- Dark background with fade-in animation for visual consistency.
- Closes on scroll, Escape, and click-outside.

---

## Feature 6: Kafka Config Key Tooltips

**Files Changed:**
- `src/components/TopicPanel/TopicDetail.tsx` — `KAFKA_CONFIG_DESCRIPTIONS` map and tooltip integration

**What it does:**
Added a `KAFKA_CONFIG_DESCRIPTIONS` map with approximately 35 entries providing plain-English descriptions for all standard Kafka topic configuration keys. Config key names in the config table are wrapped in `BadgeTooltip` when a description exists.

**Design decisions:**
- Inline map rather than external file: these are static, well-known Kafka configs. No API dependency.
- Only shows tooltip when a description exists in the map (graceful degradation for unknown/custom configs).
- Helps users who are not Kafka experts understand what each configuration setting controls.

---

## Feature 7: Schema Association Real API Integration

**Files Changed:**
- `src/components/TopicPanel/TopicDetail.tsx` — rewrote SchemaAssociation component

**What it does:**
Rewrote the SchemaAssociation component to use the real Confluent Schema Registry API instead of a static lookup. Users can now search existing subjects, pick one, and register it under the topic's naming convention.

**Design decisions:**
- Search existing subjects in the registry, pick one, fetch its schema via `getSchemaDetail()`.
- Register under `{topicName}-{value|key}` via `registerSchema()` (POST to `/subjects/{subject}/versions`).
- Suffix toggle lets users choose between `-value` and `-key` registration.
- The subject naming convention IS the topic-schema mapping in Confluent (no separate association API).
- Loading state, error display, and success toast for user feedback.
- Auto-refreshes the schema lookup after successful registration via a `refreshKey` counter pattern.

---

## Feature 8: Per-Statement Scan Startup Mode Panel

**Files Changed:**
- `src/components/ScanModePanel/ScanModePanel.tsx` — new component (NEW)
- `src/components/ScanModePanel/ScanModePanel.css` — panel styles (NEW)
- `src/components/EditorCell/EditorCell.tsx` — renders `<ScanModePanel>` in cell-header-right, before the Run button
- `src/types/index.ts` — added `scanMode`, `scanTimestampMillis`, `scanSpecificOffsets` to `SQLStatement`
- `src/store/workspaceStore.ts` — added `setStatementScanMode` action, per-statement scan mode merged into execution properties, fields persisted via `partialize`

**What it does:**
Adds a compact pushdown panel on each editor cell for setting `sql.tables.scan.startup.mode` per-statement. Each statement can independently control where Flink starts reading Kafka topics. The trigger button sits in the cell header next to Run and shows the current mode (e.g., "Earliest", "Default"). Selecting a mode overrides the global session property for that statement only.

**Scan modes:**
| Mode | Label | Extra Input |
|------|-------|-------------|
| `earliest-offset` | Read from Beginning | None |
| `latest-offset` | Read from End (Latest) | None |
| `group-offsets` | Resume from Group Offsets | None |
| `timestamp` | Read from Timestamp | Text input for `scanTimestampMillis` |
| `specific-offsets` | Read from Specific Offsets | Text input for `scanSpecificOffsets` |

**Design decisions:**
- Per-statement, not global: scan mode is stored on `SQLStatement` (`scanMode`, `scanTimestampMillis`, `scanSpecificOffsets`), not on `sessionProperties`. At execution time, the store merges per-statement scan mode into global session properties before calling `executeSQL`.
- Component takes `statementId` prop, reads the statement from the store, writes via `setStatementScanMode(id, mode, params)`.
- Compact trigger button (11px font, 4px/8px padding) fits naturally in the cell-header-right area without crowding existing controls.
- Active mode highlighted with primary color tint background (`--color-surface-primary-tint`) so users can see at a glance which statements have scan mode overrides.
- Custom radio button circles (CSS-only, not native `<input type="radio">`) matching the app's design language.
- Conditional input fields slide in below timestamp/specific-offsets radio options when selected.
- "Default (Not Set)" option clears all scan-mode fields, letting the Flink server (or global session property) decide.
- Click-outside-to-close pattern reused from the existing Dropdown component.
- Scan mode fields are persisted to localStorage alongside other statement fields.

---

## Summary

| # | Feature | Scope | Points (est.) |
|---|---------|-------|:---:|
| 1 | Schema -> Topic navigation chip | Store + SchemaDetail | 5 |
| 2 | Resizable side panel | App shell | 3 |
| 3 | Schema association moved up in TopicDetail | TopicDetail layout | 1 |
| 4 | Delete button icon-only | TopicDetail UI | 1 |
| 5 | Portal-based BadgeTooltip | TopicDetail + CSS | 3 |
| 6 | Kafka config key tooltips | TopicDetail | 3 |
| 7 | Schema association real API | TopicDetail | 8 |
| 8 | Scan startup mode pushdown panel | ScanModePanel + App header | 5 |
| | **Total** | | **29** |
