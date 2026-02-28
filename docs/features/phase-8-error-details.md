# Phase 8: Expandable Error Details

**Status:** Design Phase

## Problem Statement

When a Flink SQL statement fails, the error message is displayed inline in the `.cell-error` container below the editor. However, error messages can be long and are not truncated in the current design, making them difficult to read or completely cut off by the viewport. Users need a way to view the full error message in context with other error metadata (statement name, error timestamp).

## Proposed Solution

Replace the existing `.cell-error` div with a new clickable error badge in the status bar that toggles an expandable error details panel. When clicked, the panel reveals below the editor with:
- Full error message text (word-wrapped, scrollable if needed)
- Statement name (if available)
- Time when statement execution started (labeled "STARTED AT")
- Subtle red/error-tinted background for visual consistency with error state
- Retry button integrated into the panel

The panel state is local to the EditorCell component and persists only during the current session. The panel automatically closes if the statement status changes away from error states.

## Architecture & Design

### Component Changes

**EditorCell.tsx**
- Add local state: `showErrorDetails: boolean` (useState hook, alongside `showDeleteConfirm`, `editorHeight`, etc.)
- Add useEffect that resets `showErrorDetails` to `false` whenever `statement.status` changes away from error states (`ERROR`, `FAILED`, `CANCELLED`)
- Convert error badge in status bar to a clickable button (only when `status === 'ERROR'`)
  - Pass a `clickable` parameter (or `isClickable` boolean) to `getStatusBadge()` so the badge only renders as clickable button in the status bar, NOT in collapsed preview
- Add toggle handler: `handleToggleErrorDetails()` → flips `showErrorDetails` state
- Render expandable error details panel below status bar when:
  - `!statement.isCollapsed && showErrorDetails && hasError && statement.error`
- Panel structure:
  ```
  <div className="error-details-panel">
    <div className="error-details-header">
      <FiAlertCircle /> Error Details
      <button (close/collapse)</button>
    </div>
    <div className="error-details-content">
      <div className="error-detail-item">
        <span className="error-detail-label">STARTED AT:</span>
        <span>{statement.startedAt?.toLocaleTimeString()}</span>
      </div>
      {statement.statementName && (
        <div className="error-detail-item">
          <span className="error-detail-label">STATEMENT:</span>
          <span className="statement-name">{statement.statementName}</span>
        </div>
      )}
      <div className="error-detail-item error-detail-message">
        <span className="error-detail-label">MESSAGE:</span>
        <div className="error-message-text">{statement.error}</div>
      </div>
      <button className="retry-button">Retry</button>
    </div>
  </div>
  ```
- Error badge styling: Add `cursor: pointer` and `user-select: none` when error state and `clickable={true}`
- Error badge on click: Call `handleToggleErrorDetails()`
- **Remove the existing `.cell-error` div entirely** - the new panel replaces it completely

**App.css**
- Add `.error-details-panel` styles:
  - Background: `var(--color-surface-error)` (light red in light mode, dark red in dark mode)
  - Border: `1px solid var(--color-error)` at top/bottom
  - Padding: `12px 16px`
  - Margin: consistent spacing
- Add `.error-details-header` styles:
  - Flex layout, align-items center
  - Font-weight 600, font-size 13px
  - Icon and close button
- Add `.error-details-content` styles:
  - Display flex, flex-direction column
  - Gap 8px between items
- Add `.error-detail-item` styles:
  - Display flex, align-items flex-start, gap 8px
  - Flex-wrap wrap for long values
- Add `.error-detail-label` styles:
  - Font-weight 600
  - Color: `var(--color-text-secondary)`
  - Min-width for alignment (e.g., 80px)
  - White-space nowrap
- Add `.error-message-text` styles:
  - Word-break break-word
  - White-space pre-wrap (preserve formatting)
  - Max-height 200px, overflow-y auto (scrollable if very long)
  - Monospace font (`.font-mono`)
  - Padding 8px 12px
  - Background: lighter shade for contrast within panel

### Data Flow

- **Error state source:** `statement.error` string from API response (already available in SQLStatement type)
- **Execution start time source:** `statement.startedAt` Date object (already available) - represents when the query execution started, labeled as "STARTED AT"
- **Statement name source:** `statement.statementName` optional string (already available)
- **Local UI state:** `showErrorDetails: boolean` - isolated to EditorCell component, automatically resets when status changes away from error states
- **No store changes required:** This is purely a UI toggle, no persistence needed
- **Status tracking:** The `useEffect` monitors `statement.status` to detect transitions away from error states and auto-collapse the panel

### Type Changes

No new types required. Existing SQLStatement interface already includes `error`, `startedAt`, and `statementName` fields.

### API Contract

No API changes. The error data is already being fetched and stored in the statement object when a query fails.

## Files to Modify

1. **src/components/EditorCell/EditorCell.tsx**
   - Add `showErrorDetails` state
   - Add `useEffect` that resets `showErrorDetails` to `false` when `statement.status` changes away from error states
   - Add `handleToggleErrorDetails()` handler
   - Make error badge clickable (render as button/link when `hasError`) via `clickable` parameter to `getStatusBadge()`
   - Add error details panel JSX below status bar (including Retry button)
   - **Remove the existing `.cell-error` div entirely**
   - Add keyboard accessibility (Enter/Space to toggle)

2. **src/components/EditorCell/EditorCell.tsx** (or relevant helper function)
   - Update `getStatusBadge()` function signature to accept `clickable?: boolean` parameter
   - Only apply cursor pointer and onclick handler when `clickable === true`
   - Ensure badge is NOT clickable in collapsed preview context

3. **src/App.css**
   - `.error-details-panel` - main container
   - `.error-details-header` - header with icon and close button
   - `.error-details-content` - flex column layout
   - `.error-detail-item` - individual field (time, statement, message)
   - `.error-detail-label` - field labels with consistent styling
   - `.error-message-text` - error message text (monospace, scrollable, word-wrapped)
   - `.error-detail-item.error-detail-message` - special styling for message field
   - `.retry-button` - styling for the Retry button within the panel
   - Dark mode compatibility via `[data-theme="dark"]` vars

## Acceptance Criteria

- [ ] Existing `.cell-error` div is completely removed and replaced by the new error details panel
- [ ] Error badge is clickable only when statement has status `ERROR`
- [ ] Error badge in status bar is clickable; error badge in collapsed preview is NOT clickable
- [ ] Clicking error badge in status bar toggles visibility of error details panel below editor
- [ ] Error details panel shows: execution start time (labeled "STARTED AT"), statement name (if available), full error message, Retry button
- [ ] Full error message is visible and not truncated (scrollable if very long)
- [ ] Error details panel has error-tinted background (`var(--color-surface-error)`)
- [ ] Panel is collapsible by clicking badge again or close button
- [ ] Panel automatically closes when statement status changes away from error states
- [ ] Styling is consistent with existing error styles (uses same CSS vars)
- [ ] Works correctly in dark mode (colors adjust via CSS vars)
- [ ] Panel only renders when expanded (not in DOM when collapsed, for performance)
- [ ] Error badge has cursor: pointer visual feedback (only in status bar context)
- [ ] Retry button in panel is functional and calls the existing retry handler

## Edge Cases

1. **Very long error messages:** Panel message area should have max-height and overflow-y: auto for scrolling
2. **Missing statement name:** Panel gracefully omits statement name field if `statement.statementName` is undefined
3. **Missing error time:** Use statement.startedAt; if undefined, omit or show "unavailable"
4. **Collapsed cell:** Error details panel not shown or accessible (only visible when cell is expanded)
5. **Cell transitions from error to another status:** Panel automatically closes via useEffect when status changes away from error states (ERROR, FAILED, CANCELLED)
6. **Very long statement names:** Text should wrap or be truncated with ellipsis in the name field
7. **Special characters in error message:** Text should handle HTML entities, Unicode, etc. safely (React auto-escapes)
8. **Badge in collapsed preview:** When cell is collapsed, `getStatusBadge()` is called for the preview badge; this badge must NOT be clickable (pass `clickable={false}`)
9. **Multiple rapid error state changes:** The useEffect dependency on `statement.status` ensures the panel closes correctly regardless of how quickly status changes

## Deferred / Out of Scope

- Copy-to-clipboard button for error message (can be Phase 9)
- Error message syntax highlighting (beyond monospace font)
- Error severity levels or error codes extraction
- Integration with error reporting/analytics service
- Smart error suggestions or solutions
- Export error to file

## Implementation Notes

- Error badge in status bar currently rendered via `getStatusBadge()` function
  - Status badge has icon (FiAlertCircle) + text "Error"
  - Current style: `.status-badge.error` with background `var(--color-surface-error)`
  - **Modification:** Add `clickable?: boolean` parameter (default true for status bar context)
  - In collapsed preview, pass `clickable={false}` to prevent dual-use issues
- The error details panel REPLACES the existing `.cell-error` div entirely
  - Remove `.cell-error` container from EditorCell.tsx
  - Move Retry button from `.cell-error` into the panel
  - Reuse the same error background color: `var(--color-surface-error)` (already in use, confirmed to exist)
- The error details panel should sit between the status bar and results table
- Use same styling patterns as `.statement-status-bar` for consistency
- Consider vertical spacing/borders between elements:
  - Status bar has `border-bottom: 1px solid var(--color-border)`
  - Error panel could have `border-top` + `border-bottom`
- Toggle button interaction should be instant (no loading states)
- useEffect dependency list: `[statement.status]` - resets panel when status changes
- No animation needed (can add later, e.g., slide-down via CSS)

## Implementation Decisions

1. **Panel closure:** Close when user clicks badge again or close button; no outside-click closure needed
2. **Close button:** Provided for UX polish; badge click is the primary toggle
3. **Max-height for error message:** 200px with overflow-y: auto (reasonable for most error messages)
4. **Timestamp format:** `.toLocaleTimeString()` for consistency with existing statement status bar time display
5. **Dual-use of badge:** Handled via `clickable` parameter to `getStatusBadge()` - only clickable in status bar context, not in collapsed preview
6. **Auto-collapse on status change:** useEffect listens to `statement.status` and closes panel when status moves away from error states
