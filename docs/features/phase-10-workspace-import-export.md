# Phase 10: Workspace Import/Export

**Status**: Design Review Pending
**Date Created**: 2026-02-28
**Feature Type**: Data Persistence / Workspace Management

## Problem Statement

Currently, users can only persist their workspace state locally via browser localStorage through the Zustand persist middleware. This approach has significant limitations:

1. **No portability** - Users cannot share workspace configurations with teammates
2. **Single device lock-in** - Workspaces cannot be transferred between machines or browsers
3. **No backup mechanism** - Losing browser data means losing all statements and workspace configuration
4. **Difficult migration** - No way to import previously exported SQL scripts or configurations from other tools

The workspace should support explicit export/import as JSON files to enable:
- Sharing workspaces with other team members
- Backing up important SQL workspace configurations
- Transferring workspaces across devices
- Version control of workspace snapshots
- Integration with external tools (e.g., Git, documentation systems)

## Solution Overview

Implement bidirectional JSON import/export for workspace state:

### Export Feature
- Add "Export Workspace" button in the settings panel (next to the existing workspace information section)
- On click, serialize workspace state to JSON and trigger a browser download
- Filename format: `{workspaceName}-{ISO8601-timestamp}.json`
- JSON structure mirrors the persisted state shape from `partialize` function
- Uses standard Blob + URL.createObjectURL pattern (already used in ResultsTable for CSV export)

### Import Feature
- Add "Import Workspace" button in the settings panel (below Export)
- Clicking opens a file input dialog (native `<input type="file" accept=".json">`)
- On file selection, read JSON, validate structure, and show confirmation dialog
- Confirmation lists: number of statements to import, workspace name, catalog, database
- On confirmation, hydrate entire store with imported data
- Show success/error toasts for user feedback

### State Serialization
Export/import uses the existing `partialize` function definition as the source of truth:
- `statements[]` (with `id`, `code`, `createdAt`, `isCollapsed`, `lastExecutedCode`)
  - **Note**: `status` is NOT exported - it's execution-specific and resets to IDLE on import
- `catalog` (string)
- `database` (string)
- `workspaceName` (string)

Runtime/transient state is NOT exported:
- Results, errors, execution metadata (transient)
- Tree nodes, selected node (derived from catalog/database)
- Toasts, focused statement, history (UI state)
- Compute pool status (runtime)
- **Theme (user preference - not workspace state; explicitly excluded)**
- **hasSeenOnboardingHint (user preference - explicitly excluded)**

## Files to Modify

### 1. `src/store/workspaceStore.ts`
- Add new action `importWorkspace(data: unknown)` to WorkspaceState interface
- Implement import logic with validation
- Return boolean or throw error for better UX feedback

### 2. `src/App.tsx`
- Import the new `importWorkspace` action in hook destructuring
- Add Export button to settings panel (after lastSavedAt if displayed)
- Add Import button to settings panel (below Export)
- Implement export handler that calls `exportWorkspace()` utility
- Handle file input via ref or inline onClick handler

### 3. `src/utils/workspace-export.ts` (NEW FILE)
- Create utility file with two functions:
  - `exportWorkspace(state: Partial<WorkspaceState>): string` - Returns JSON string
  - `validateWorkspaceJSON(data: unknown): { valid: boolean, errors: string[] }` - Returns validation result
- Export/import uses the same shape as `partialize` output
- Validation checks:
  - Data is an object
  - `statements` exists and is an array
  - Each statement has `id` (string) and `code` (string) at minimum
  - `catalog`, `database`, `workspaceName` exist and are non-empty strings

## Implementation Details

### Export Implementation

```typescript
// In src/utils/workspace-export.ts
export function exportWorkspace(state: WorkspaceExportData): string {
  return JSON.stringify({
    statements: state.statements,
    catalog: state.catalog,
    database: state.database,
    workspaceName: state.workspaceName,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

function generateFilename(workspaceName: string): string {
  // Sanitize workspace name: remove/replace filesystem-unsafe characters
  const sanitized = workspaceName
    .replace(/[/\\:*?"<>|]/g, '_') // Replace unsafe chars with underscore
    .slice(0, 200); // Limit length to 200 chars

  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5); // Remove Z and milliseconds
  // Example: "My_Workspace-2026-02-28T15-30-45.json"
  return `${sanitized}-${timestamp}.json`;
}

// In src/App.tsx
const handleExportWorkspace = () => {
  const state = useWorkspaceStore.getState();
  const jsonStr = exportWorkspace({
    statements: state.statements.map(s => ({
      id: s.id,
      code: s.code,
      // Note: status is NOT exported (it's execution-specific, will reset to IDLE on import)
      createdAt: s.createdAt,
      isCollapsed: s.isCollapsed,
      lastExecutedCode: s.lastExecutedCode ?? null,
    })),
    catalog: state.catalog,
    database: state.database,
    workspaceName: state.workspaceName,
  });

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generateFilename(state.workspaceName);
  link.click();
  URL.revokeObjectURL(url);

  addToast({ type: 'success', message: 'Workspace exported' });
};
```

### Import Implementation

```typescript
// In src/store/workspaceStore.ts
// Update WorkspaceState interface:
importWorkspace: (fileData: unknown) => Promise<void>;

// Implementation:
importWorkspace: async (fileData: unknown): Promise<void> => {
  const validation = validateWorkspaceJSON(fileData);
  if (!validation.valid) {
    throw new Error(`Invalid workspace file: ${validation.errors.join(', ')}`);
  }

  const data = fileData as WorkspaceImportData;

  // Hydrate the store with imported data
  set({
    statements: data.statements.map(s => ({
      ...s,
      // Regenerate IDs to prevent collisions: Date.now() + random suffix
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date(s.createdAt),
      status: 'IDLE' as const, // Force IDLE on import - status is execution-specific
    })),
    catalog: data.catalog,
    database: data.database,
    workspaceName: data.workspaceName,
    lastSavedAt: new Date().toISOString(),
  });

  // Reload tree data with new catalog/database (non-fatal if fails)
  try {
    get().loadTreeData();
  } catch (error) {
    // Log but don't rollback - workspace was imported successfully
    console.warn('Failed to load tree data after import:', error);
  }
};
```

### File Input Handling (in App.tsx)

```typescript
const fileInputRef = useRef<HTMLInputElement>(null);

const handleImportClick = () => {
  fileInputRef.current?.click();
};

// State for import confirmation dialog
const [importConfirmation, setImportConfirmation] = useState<{
  show: boolean;
  data: unknown;
  fileName: string;
} | null>(null);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.currentTarget.files?.[0];
  if (!file) return;

  // Guard: reject files > 5MB
  if (file.size > MAX_FILE_SIZE) {
    addToast({
      type: 'error',
      message: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 5MB)`,
    });
    e.currentTarget.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Show inline confirmation dialog before importing
    setImportConfirmation({
      show: true,
      data,
      fileName: file.name,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    addToast({ type: 'error', message: `Import failed: ${msg}` });
  }

  // Reset file input
  e.currentTarget.value = '';
};

const handleImportConfirm = async () => {
  if (!importConfirmation?.data) return;

  try {
    await importWorkspace(importConfirmation.data);
    addToast({ type: 'success', message: 'Workspace imported' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    addToast({ type: 'error', message: `Import failed: ${msg}` });
  }

  setImportConfirmation(null);
};

const handleImportCancel = () => {
  setImportConfirmation(null);
};

// In JSX settings panel:
<input
  ref={fileInputRef}
  type="file"
  accept=".json"
  onChange={handleFileSelected}
  style={{ display: 'none' }}
/>
<button onClick={handleImportClick}>Import Workspace</button>
<button onClick={handleExportWorkspace}>Export Workspace</button>

// Inline confirmation dialog (e.g., modal or inline confirmation UI):
{importConfirmation?.show && (
  <div className="confirmation-dialog">
    <h3>Import Workspace?</h3>
    <p>
      Name: <strong>{importConfirmation.data?.workspaceName || 'Unknown'}</strong><br/>
      Statements: <strong>{importConfirmation.data?.statements?.length || 0}</strong><br/>
      Catalog: <strong>{importConfirmation.data?.catalog || 'Unknown'}</strong><br/>
      Database: <strong>{importConfirmation.data?.database || 'Unknown'}</strong>
    </p>
    <p className="warning">Are you sure? This will replace your current workspace.</p>
    <div className="dialog-buttons">
      <button onClick={handleImportConfirm}>Confirm</button>
      <button onClick={handleImportCancel}>Cancel</button>
    </div>
  </div>
)}
```

### Validation Logic

```typescript
// In src/utils/workspace-export.ts
export interface WorkspaceImportData {
  statements: Array<{
    id: string;
    code: string;
    status?: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
    createdAt: string; // JSON serialization: always string, converted to Date on import
    isCollapsed?: boolean;
    lastExecutedCode?: string | null;
  }>;
  catalog: string;
  database: string;
  workspaceName: string;
}

export function validateWorkspaceJSON(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('File must contain a valid JSON object');
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Check required fields exist
  if (!Array.isArray(obj.statements)) {
    errors.push('Missing or invalid "statements" array');
  } else {
    // Guard: reject if > 500 statements
    if (obj.statements.length > 500) {
      errors.push(`Too many statements: ${obj.statements.length} (max 500)`);
    }

    // Validate each statement (empty arrays are valid - new workspaces)
    obj.statements.forEach((stmt, idx) => {
      if (typeof stmt !== 'object' || !stmt) {
        errors.push(`Statement ${idx}: must be an object`);
      } else {
        const s = stmt as Record<string, unknown>;
        if (!s.id || typeof s.id !== 'string') {
          errors.push(`Statement ${idx}: missing required "id" (string)`);
        }
        if (!s.code || typeof s.code !== 'string') {
          errors.push(`Statement ${idx}: missing required "code" (string)`);
        }
        // Validate createdAt is a valid ISO date string
        if (s.createdAt && typeof s.createdAt === 'string') {
          if (isNaN(Date.parse(s.createdAt))) {
            errors.push(`Statement ${idx}: invalid "createdAt" date string`);
          }
        } else if (s.createdAt === undefined) {
          errors.push(`Statement ${idx}: missing required "createdAt"`);
        } else {
          errors.push(`Statement ${idx}: "createdAt" must be a string`);
        }
      }
    });
  }

  if (!obj.catalog || typeof obj.catalog !== 'string') {
    errors.push('Missing or invalid "catalog" (string)');
  }

  if (!obj.database || typeof obj.database !== 'string') {
    errors.push('Missing or invalid "database" (string)');
  }

  if (!obj.workspaceName || typeof obj.workspaceName !== 'string') {
    errors.push('Missing or invalid "workspaceName" (string)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

## Type Definitions

Add to `src/types/index.ts`:

```typescript
export interface WorkspaceExportData {
  statements: Array<{
    id: string;
    code: string;
    // Note: status is NOT exported (execution-specific, reset to IDLE on import)
    createdAt: Date;
    isCollapsed?: boolean;
    lastExecutedCode?: string | null;
  }>;
  catalog: string;
  database: string;
  workspaceName: string;
}

export interface WorkspaceImportData {
  statements: Array<{
    id: string;
    code: string;
    status?: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
    createdAt: string; // JSON serialization: always string
    isCollapsed?: boolean;
    lastExecutedCode?: string | null;
  }>;
  catalog: string;
  database: string;
  workspaceName: string;
  exportedAt?: string;
  version?: string;
}
```

## Acceptance Criteria

### Export Feature
- [ ] Export button appears in settings panel below "Workspace" section
- [ ] Clicking Export downloads a `.json` file
- [ ] Filename format matches `{workspaceName}-{ISO8601}.json`
- [ ] Exported JSON is valid, pretty-printed with 2-space indentation (human readable)
- [ ] JSON contains all statements with: id, code, createdAt, isCollapsed, lastExecutedCode
- [ ] **Status field is NOT exported** (execution-specific)
- [ ] JSON contains: catalog, database, workspaceName
- [ ] JSON does NOT contain: results, errors, tree nodes, toasts, theme, status, hasSeenOnboardingHint
- [ ] Filename is sanitized: unsafe filesystem characters (/, \, :, *, ?, ", <, >, |) replaced with underscore
- [ ] Success toast shown after export
- [ ] Exported file can be manually verified in browser DevTools

### Import Feature
- [ ] Import button appears in settings panel below Export button
- [ ] Clicking Import opens OS file picker with `.json` filter
- [ ] **File size guard**: Rejects files > 5MB with error toast
- [ ] **Statement count guard**: Rejects imports with > 500 statements with error toast
- [ ] Selecting a valid `.json` file shows **inline confirmation panel** (not native dialog)
- [ ] Confirmation panel shows: workspace name, statement count, catalog, database, warning text
- [ ] Clicking "Cancel" in panel closes it without changing state
- [ ] Clicking "Confirm" in panel imports workspace:
  - All current statements are replaced
  - Catalog and database are updated
  - Workspace name is updated
  - **Statement IDs are regenerated** (Date.now() + random) to prevent collisions
  - **Status is set to IDLE** for all statements regardless of exported status
  - Tree data is reloaded (non-fatal if fails; logged to console)
- [ ] Success toast shown on import
- [ ] Invalid JSON shows error toast with validation error message
- [ ] Missing required fields shows detailed error toast
- [ ] **Invalid createdAt dates** are caught by validator with specific error message
- [ ] Empty statements array is valid (new workspaces)
- [ ] lastSavedAt is updated to current time

### State Integrity
- [ ] Exported workspace can be re-imported successfully
- [ ] **Statement IDs are regenerated on import** (old IDs discarded to prevent collisions)
- [ ] Imported statements appear in editor in same order as exported
- [ ] isCollapsed state is preserved through export/import cycle
- [ ] lastExecutedCode is preserved through export/import cycle
- [ ] createdAt dates are valid after import (converted from string to Date)
- [ ] **Status is always IDLE on imported statements** (execution state not preserved)

## Edge Cases

### Export Edge Cases
1. **Workspace name with special characters** (e.g., `My/Workspace:2024`)
   - Sanitize filename by removing or replacing `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`
   - Replace with underscore or similar safe character

2. **Very large workspace** (e.g., 1000 statements, 100KB+ JSON)
   - JSON.stringify should handle gracefully
   - Browser download should work for files up to several MB
   - Consider optional compression in future phases

3. **Workspace with unicode characters** (e.g., `我的工作区`)
   - UTF-8 JSON handles natively
   - Filename should also preserve unicode (browsers support this)

### Import Edge Cases
1. **File is not JSON**
   - JSON.parse throws, caught, error toast shown

2. **File is valid JSON but wrong schema**
   - Validation catches missing fields, shows detailed error

3. **User cancels import confirmation**
   - No changes made to store
   - File input ref is reset for future imports

4. **Imported workspace has different catalog/database than current**
   - Import proceeds anyway
   - Tree data reloads with new catalog/database
   - User may see a brief "loading" state in tree navigator

5. **loadTreeData fails after import** (e.g., catalog/database not accessible)
   - **Non-fatal**: Workspace is imported successfully; store is fully updated
   - Error is logged to console (console.warn) but not shown as error toast
   - Tree navigator may show loading state or be empty until user manually selects catalog/database
   - No rollback occurs - workspace data is preserved
   - This design prevents data loss when tree data is temporarily unavailable

6. **Duplicate statement IDs**
   - Unlikely since IDs are `${Date.now()}-${random}`
   - If it happens during import, preserve the ID (assumes file is source of truth)

## Testing Strategy

### Manual Testing (QA Phase)
1. Export a workspace with 3 statements, verify file downloads
2. Delete all statements, import the exported file, verify restoration
3. Import with invalid JSON, verify error handling
4. Import with missing `code` field, verify validation error
5. Export workspace with unicode characters in name, verify filename
6. Export, modify JSON manually (remove a required field), import, verify validation
7. Create two workspaces, export both, verify different filenames
8. Import with confirmation dialog open in two tabs (race condition testing)

### Type Safety
- Validate WorkspaceImportData and WorkspaceExportData types compile
- Ensure partialize output matches export structure
- No "any" types in validation code

## Future Enhancements (Not in Scope)

- Workspace versioning (keep multiple snapshots)
- Encryption of exported files (PII in SQL code)
- Cloud sync (export to cloud storage like S3)
- Diff viewer (compare two exported workspaces)
- Selective import (choose which statements to import)
- Merge import (append imported statements instead of replacing)
- Git integration (auto-commit exported workspaces)

## Related Code References

- Partialize function: `src/store/workspaceStore.ts:664`
- CSV export pattern: `src/components/ResultsTable/ResultsTable.tsx` (see how download is triggered)
- Settings panel structure: `src/App.tsx:281-327`
- Toast system: `src/components/ui/Toast.tsx`
- Type definitions: `src/types/index.ts`

## Implementation Notes

- Both export and import should be async-safe (no race conditions with concurrent exports)
- Filename sanitization prevents filesystem issues on Windows/Mac/Linux
- Confirmation dialog must clearly state "replace current workspace" to prevent accidental data loss
- Consider showing "last exported at" timestamp in settings panel for user awareness
