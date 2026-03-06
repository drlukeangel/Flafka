# Phase 10: Statement Labels - Technical PRD

**Date**: 2026-02-28
**Status**: Design Phase
**Priority**: Medium

---

## Problem Statement

Currently, each editor cell is identified only by its numeric position (#1, #2, #3, etc.). When users have many statements in a workspace, it's difficult to:
- Quickly identify the purpose of a statement at a glance
- Distinguish between similar SELECT queries or DML operations
- Remember which cell contains a specific operation after closing/reopening

Users must click on each cell to see the actual SQL code to understand what it does. The cell number provides no semantic meaning.

---

## Solution Overview

Add **optional user-defined labels/titles** to each editor cell. Labels are:
- Displayed in the cell header next to the cell number (#1 - My Query)
- Editable inline via click-to-edit pattern
- Persistent via localStorage
- Used in collapsed cell preview when label exists (instead of showing SQL code)
- Copied with a "Copy" suffix when duplicating statements

This leverages the existing inline-edit pattern already used for the workspace name in `App.tsx`, ensuring UI consistency.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `label?: string` to `SQLStatement` interface |
| `src/store/workspaceStore.ts` | Add `updateStatementLabel` action; include `label` in `partialize` |
| `src/components/EditorCell/EditorCell.tsx` | Render label in header; implement inline editing; show label in collapsed preview |

---

## Implementation Details

### 1. Type Changes (`src/types/index.ts`)

Add optional `label` field to `SQLStatement` interface:

```typescript
export interface SQLStatement {
  id: string;
  code: string;
  status: StatementStatus;
  results?: Record<string, unknown>[];
  columns?: Column[];
  error?: string;
  executionTime?: number;
  totalRowsReceived?: number;
  statementName?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastExecutedAt?: Date;
  startedAt?: Date;
  isCollapsed?: boolean;
  lastExecutedCode?: string | null;
  label?: string;  // NEW: Optional user-defined label for the cell
}
```

### 2. Store Updates (`src/store/workspaceStore.ts`)

#### 2a. Add Action Signature

Add to `WorkspaceState` interface:
```typescript
updateStatementLabel: (id: string, label: string) => void;
```

#### 2b. Implement Action

In the store's `(set, get) => ({...})` body, add after other statement actions:

```typescript
updateStatementLabel: (id, label) => {
  set((state) => ({
    statements: state.statements.map((s) =>
      s.id === id
        ? { ...s, label: label.trim() === '' ? undefined : label.trim() }
        : s
    ),
    lastSavedAt: new Date().toISOString(),
  }));
},
```

**Logic**:
- If `label.trim()` is empty string, set to `undefined` (removes label)
- Otherwise, trim whitespace and store the label
- Update `lastSavedAt` timestamp

#### 2c. Update `duplicateStatement` Action

Modify the existing `duplicateStatement` to copy label with suffix:

```typescript
duplicateStatement: (id) => {
  const statement = get().statements.find((s) => s.id === id);
  if (!statement) return;

  const newLabel = statement.label ? `${statement.label} Copy` : undefined;

  const newStatement: SQLStatement = {
    ...statement,
    id: generateId(),
    status: 'IDLE',
    results: undefined,
    error: undefined,
    statementName: undefined,
    startedAt: undefined,
    lastExecutedCode: null,
    createdAt: new Date(),
    label: newLabel,  // NEW: Copy label with "Copy" suffix
  };

  set((state) => ({
    statements: [...state.statements, newStatement],
    lastSavedAt: new Date().toISOString(),
  }));
},
```

#### 2d. Update `partialize` (Persistence)

In the `partialize` function (currently around line 664), add `label` to the persisted statement fields:

```typescript
partialize: (state) => ({
  statements: state.statements.map((s) => ({
    id: s.id,
    code: s.code,
    status: s.status === 'RUNNING' || s.status === 'PENDING' ? 'IDLE' as const : s.status,
    createdAt: s.createdAt,
    isCollapsed: s.isCollapsed,
    lastExecutedCode: s.lastExecutedCode ?? null,
    label: s.label,  // NEW: Persist the label
  })),
  catalog: state.catalog,
  database: state.database,
  lastSavedAt: state.lastSavedAt,
  theme: state.theme,
  workspaceName: state.workspaceName,
  hasSeenOnboardingHint: state.hasSeenOnboardingHint,
}),
```

### 3. EditorCell UI (`src/components/EditorCell/EditorCell.tsx`)

#### 3a. Add State and Ref for Inline Editing

At the top of the component function, after existing `useState` hooks:

```typescript
const [isEditingLabel, setIsEditingLabel] = useState(false);
const [editLabelValue, setEditLabelValue] = useState(statement.label ?? '');
const labelCancelledRef = useRef(false);
```

#### 3b. Add Action Handlers

Add these handlers after other handlers like `handleAddCell`, `handleDelete`, etc.:

```typescript
const handleLabelClick = () => {
  labelCancelledRef.current = false;
  setEditLabelValue(statement.label ?? '');
  setIsEditingLabel(true);
};

const handleLabelSave = () => {
  updateStatementLabel(statement.id, editLabelValue);
  setIsEditingLabel(false);
};

const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    labelCancelledRef.current = false;
    handleLabelSave();
  } else if (e.key === 'Escape') {
    labelCancelledRef.current = true;
    setIsEditingLabel(false);
  }
};

const handleLabelBlur = () => {
  if (labelCancelledRef.current) {
    labelCancelledRef.current = false;
    return;
  }
  handleLabelSave();
};
```

#### 3b. Extract Store Actions

Add `updateStatementLabel` to the existing destructure block in EditorCell (around lines 146-156):

```typescript
const {
  addStatement,
  deleteStatement,
  updateStatementCode,
  duplicateStatement,
  updateStatementLabel,  // ADD THIS
  runStatement,
  cancelStatement,
  toggleCollapse,
  // ... other actions
} = useWorkspaceStore((state) => ({
  addStatement: state.addStatement,
  deleteStatement: state.deleteStatement,
  updateStatementCode: state.updateStatementCode,
  duplicateStatement: state.duplicateStatement,
  updateStatementLabel: state.updateStatementLabel,  // ADD THIS
  runStatement: state.runStatement,
  cancelStatement: state.cancelStatement,
  toggleCollapse: state.toggleCollapse,
  // ... other actions
}));
```

#### 3c. Render Label in Cell Header

In the cell header section (around line 508), after the `cell-number` span, add label display:

**Location**: After this line:
```typescript
<span className="cell-number">#{index + 1}</span>
```

**Add this**:
```typescript
<div className="cell-label-group" onClick={!isEditingLabel ? handleLabelClick : undefined}>
  {isEditingLabel ? (
    <input
      className="cell-label-input"
      value={editLabelValue}
      onChange={(e) => setEditLabelValue(e.target.value)}
      onKeyDown={handleLabelKeyDown}
      onBlur={handleLabelBlur}
      autoFocus
      maxLength={50}
      placeholder="Add label..."
    />
  ) : (
    <>
      {statement.label ? (
        <span className="cell-label">{statement.label}</span>
      ) : (
        <span className="cell-label-placeholder">Add label...</span>
      )}
    </>
  )}
</div>
```

**CSS Styling** (to be added to `src/App.css`):
```css
.cell-label-group {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-left: 8px;
}

.cell-label {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.cell-label-placeholder {
  color: var(--color-text-muted);
  font-size: 14px;
  font-style: italic;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cell-header-left:hover .cell-label-placeholder {
  opacity: 1;
}

.cell-label-input {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 500;
  background: var(--color-input-bg);
  color: var(--color-text);
  max-width: 200px;
}

.cell-label-input:focus {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}
```

#### 3d. Show Label in Collapsed Preview

In the collapsed preview section (around line 708), modify the preview display:

**Current code**:
```typescript
{statement.isCollapsed && (
  <div className="cell-collapsed-preview">
    <code className="cell-collapsed-sql">{getPreviewLine(statement.code)}</code>
    {getStatusBadge(false)}
    {hasResults && (
      <span className="cell-collapsed-rows">
        ({statement.totalRowsReceived != null && statement.totalRowsReceived > (statement.results?.length ?? 0)
          ? `${statement.totalRowsReceived.toLocaleString()}`
          : statement.results?.length} rows)
      </span>
    )}
  </div>
)}
```

**Replace with**:
```typescript
{statement.isCollapsed && (
  <div className="cell-collapsed-preview">
    {statement.label ? (
      <span className="cell-collapsed-label">{statement.label}</span>
    ) : (
      <code className="cell-collapsed-sql">{getPreviewLine(statement.code)}</code>
    )}
    {getStatusBadge(false)}
    {hasResults && (
      <span className="cell-collapsed-rows">
        ({statement.totalRowsReceived != null && statement.totalRowsReceived > (statement.results?.length ?? 0)
          ? `${statement.totalRowsReceived.toLocaleString()}`
          : statement.results?.length} rows)
      </span>
    )}
  </div>
)}
```

**Additional CSS**:
```css
.cell-collapsed-label {
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}
```

---

## Acceptance Criteria

### Core Functionality
- [ ] Label field added to `SQLStatement` type and optional in interface
- [ ] `updateStatementLabel` action works: accepts statement id and label string
- [ ] Empty string removes label (sets to `undefined`)
- [ ] Labels persist to localStorage via `partialize`
- [ ] Labels survive page refresh

### Header Display
- [ ] Label displays in cell header next to cell number when set (#1 - My Query)
- [ ] Placeholder "Add label..." appears muted next to cell number when label not set
- [ ] Placeholder only visible on hover over header
- [ ] Click label or placeholder enters edit mode
- [ ] Edit input shows current label text (or empty for new label)
- [ ] Input maxLength is 50 characters
- [ ] Enter key saves label and exits edit mode
- [ ] Escape key cancels edit without saving
- [ ] Blur saves label and exits edit mode
- [ ] Input automatically focused when entering edit mode

### Collapsed Preview
- [ ] When label is set AND statement is collapsed, collapsed preview shows label instead of SQL code
- [ ] Label text is truncated with ellipsis if too long (max ~60 chars)
- [ ] When label not set, collapsed preview shows SQL code (current behavior)

### Duplication
- [ ] When duplicating a statement with label "Query A", new statement gets label "Query A Copy"
- [ ] When duplicating a statement without label, new statement has no label
- [ ] Duplicated statement inherits label persistence (saved to localStorage)

### Edge Cases
- [ ] Label with only whitespace is treated as empty (removes label)
- [ ] Special characters in label don't break rendering
- [ ] Very long labels (e.g., 50 chars) are truncated with ellipsis in header
- [ ] Label persists across: add/delete other statements, collapse/expand, run/cancel
- [ ] Clicking placeholder when label is empty initializes edit mode with empty input

### No Regressions
- [ ] Existing statement duplication logic unaffected (except label copying)
- [ ] Cell header layout unchanged (label added next to number)
- [ ] Collapsed/expanded state unaffected
- [ ] Results table rendering unaffected
- [ ] Monaco editor behavior unaffected

---

## Edge Cases & Considerations

1. **Whitespace Handling**: Labels with only spaces should be treated as empty and remove the label
2. **Character Limit**: 50 character max to keep headers clean and readable
3. **Truncation**: Long labels in header should truncate with ellipsis; not wrapping to multiple lines
4. **Persistence Priority**: Label is persisted but not the SQL results/status/error (current behavior)
5. **Duplication Suffix**: "Copy" suffix prevents identical labels when duplicating; users can edit after duplication
6. **Null vs Empty**: Empty string after trim → set to `undefined` to keep state clean
7. **Focus Management**: Input auto-focuses when entering edit mode; blur triggers save (same as workspace name)
8. **Accessibility**: Consider title attribute on label showing full text if truncated

---

## API & Type Contract

### New Store Action
```typescript
updateStatementLabel: (id: string, label: string) => void
```

### Type Addition
```typescript
label?: string;  // in SQLStatement interface
```

### Persistence
Label is included in `partialize()` output, so it will be saved to localStorage alongside `code`, `status`, `createdAt`, `isCollapsed`, and `lastExecutedCode`.

---

## UI/UX Reference Pattern

The implementation follows the existing inline-edit pattern used for workspace name in `App.tsx`:
- Click to enter edit mode
- Input with maxLength
- Enter/Escape key handling
- Blur save
- Auto-focus on enter

This ensures visual and behavioral consistency across the app.

---

## Testing Strategy

- **Unit**: Store action correctly updates label and persists
- **Integration**: Label displays in header, edit mode works, persistence survives reload
- **UI**: Collapsed preview shows label when set, header layout is clean
- **Edge Cases**: Whitespace, special chars, duplication suffix, persistence across operations

---

## Future Enhancements (Out of Scope)

- Color-coded labels/tags
- Label autocomplete from history
- Bulk label operations
- Label search/filter
- Label in statement history panel
