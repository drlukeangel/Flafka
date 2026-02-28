# Phase 11: Session Properties Editor

**Date:** 2026-02-28
**Status:** Design Phase
**Feature:** Allow users to configure Flink SQL session properties via UI instead of hardcoding them

---

## Problem Statement

Currently, the Flink SQL Workspace hardcodes session properties in `executeSQL()` (flink-api.ts:lines). Users cannot customize critical runtime behavior without modifying source code:

- `sql.local-time-zone` - affects timestamp parsing and display
- `sql.tables.scan.startup.mode` - controls streaming data consumption (earliest-offset vs latest-offset for tailing)
- `parallelism.default` - affects query execution parallelism
- Other Flink SQL properties like `table.exec.mini-batch.enabled`, `table.exec.sink.upsert-materialize`, etc.

This prevents users from:
1. Tailing live data streams (requires `latest-offset`)
2. Adjusting query parallelism for performance tuning
3. Setting timezone for temporal operations
4. Using any other Flink SQL session property not hardcoded

The Confluent Cloud UI exposes this via a "Statement Properties" tab. Our workspace should match this UX pattern.

---

## Solution

Implement a Session Properties Editor that:

1. **Store State** - Add `sessionProperties: Record<string, string>` to Zustand store (persisted)
2. **Store Actions** - Provide `setSessionProperty` and `removeSessionProperty` to modify properties
3. **UI Component** - Add key-value editor section in existing Settings panel
4. **API Integration** - Modify `executeSQL` to merge user properties with hardcoded defaults
5. **Defaults** - Pre-populate with common Flink properties on first load
6. **Validation** - Prevent override of reserved keys (`sql.current-catalog`, `sql.current-database`)

---

## Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `src/store/workspaceStore.ts` | Add `sessionProperties` state + setters + persist config | Core logic |
| `src/api/flink-api.ts` | Modify `executeSQL` signature to accept `extraProperties` param | API layer |
| `src/App.tsx` | Add property editor UI to Settings panel | UI |
| `src/App.css` | Add styles for property editor rows | Styling |

---

## Implementation Details

### 1. Store State (workspaceStore.ts)

**Update WorkspaceState interface:**
Add the following fields to the existing `WorkspaceState` interface:
```typescript
interface WorkspaceState {
  // ... existing fields ...
  sessionProperties: Record<string, string>;
}
```

**Update store actions interface:**
```typescript
setSessionProperty: (key: string, value: string) => void;
removeSessionProperty: (key: string) => void;
resetSessionProperties: () => void;
```

**Add to initial state:**
```typescript
sessionProperties: {
  'sql.local-time-zone': 'UTC',
  'parallelism.default': '1',
},
```

**Implementation:**
```typescript
setSessionProperty: (key, value) => {
  const trimmedKey = key.trim();

  // Reject empty keys
  if (!trimmedKey) return;

  // Reject reserved keys and show toast
  const reserved = ['sql.current-catalog', 'sql.current-database'];
  if (reserved.includes(trimmedKey)) {
    // Show toast: "Cannot override reserved property: " + trimmedKey
    console.warn(`Cannot override reserved key: ${trimmedKey}`);
    return;
  }

  // Reject empty values (validate against empty string)
  if (typeof value !== 'string') {
    console.warn(`Property value must be a string`);
    return;
  }

  set(state => ({
    sessionProperties: {
      ...state.sessionProperties,
      [trimmedKey]: value,
    }
  }));
},

removeSessionProperty: (key) => {
  set(state => {
    const updated = { ...state.sessionProperties };
    delete updated[key];
    return { sessionProperties: updated };
  });
},

resetSessionProperties: () => {
  set({
    sessionProperties: {
      'sql.local-time-zone': 'UTC',
      'parallelism.default': '1',
    }
  });
},
```

**Update persist() call:**
```typescript
persist(
  (set) => ({ /* store */ }),
  {
    name: 'flink-workspace',
    partialize: (state) => ({
      // ... existing fields
      sessionProperties: state.sessionProperties,
    }),
  }
)
```

**Update executeStatement action - IMPORTANT:**
Only user-initiated statement execution should include session properties. Internal callers (tree loading, schema panel, DESCRIBE queries, etc.) should NOT inherit session properties:

```typescript
// User statement execution - includes session properties
const result = await executeSQL(
  statement.sql,
  {
    catalog: env.flinkCatalog,
    database: env.flinkDatabase,
    sessionProperties: state.sessionProperties,  // Pass user's session properties
  }
);
```

**Internal callers use empty config:**
```typescript
// Internal calls (tree loading, DESCRIBE, schema introspection)
// Do NOT pass session properties - use workspace defaults only
const schemaResult = await executeSQL(
  describeSQL,
  {
    catalog: env.flinkCatalog,
    database: env.flinkDatabase,
    // sessionProperties intentionally omitted
  }
);
```

### 2. API Layer (flink-api.ts)

**Clarify executeSQL signature and `name` parameter:**
```typescript
export async function executeSQL(
  sql: string,
  options?: {
    catalog?: string;
    database?: string;
    sessionProperties?: Record<string, string>;  // Session properties from store
    name?: string;  // Used for statement naming if provided
  }
): Promise<ExecuteSQLResponse>
```

**Note on `name` parameter:** The `name` parameter is used for statement naming when provided. If not supplied, the API generates a default name or uses the SQL text summary.

**Update properties merge logic:**
```typescript
const reservedProperties = {
  'sql.current-catalog': catalog || env.flinkCatalog,
  'sql.current-database': database || env.flinkDatabase,
};

const properties = {
  ...reservedProperties,
  ...(options?.sessionProperties || {}),
};

// CRITICAL: Always enforce reserved keys (never allow override)
properties['sql.current-catalog'] = reservedProperties['sql.current-catalog'];
properties['sql.current-database'] = reservedProperties['sql.current-database'];
```

**Important:** Do NOT set a default for `sql.tables.scan.startup.mode`. This should only be configured if the user explicitly sets it in session properties. Flink server will use its own default if not specified.

**Send in POST payload:**
```typescript
const response = await confluent.post('/sql/execute', {
  sql,
  properties,
  execution_timeout: '30s',
});
```

**Concurrent execution note:** Session properties apply to ALL statements executed in this workspace session. When multiple statements are run concurrently or sequentially, they will all use the same session properties set at the time of their execution.

### 3. UI Component (App.tsx)

**Add SessionPropertiesEditor component inside Settings panel:**

```typescript
// Inside the settings panel JSX, after existing sections:
<div className="settings-section">
  <h3>Session Properties</h3>
  <p className="settings-help">
    Configure Flink SQL session properties. These apply to all statements.
  </p>

  <div className="property-editor">
    {Object.entries(store.sessionProperties).map(([key, value]) => (
      <div key={key} className="property-row">
        <input
          type="text"
          value={key}
          disabled
          className="property-key"
          title={`Reserved key: ${['sql.current-catalog', 'sql.current-database'].includes(key) ? 'managed by workspace' : 'user-defined'}`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => store.setSessionProperty(key, e.target.value)}
          className="property-value"
          placeholder="value"
        />
        <button
          onClick={() => store.removeSessionProperty(key)}
          className="btn-delete"
          title="Remove property"
        >
          ✕
        </button>
      </div>
    ))}
  </div>

  <button
    onClick={() => {
      const newKey = prompt('Property key (e.g., sql.local-time-zone):');
      if (newKey?.trim()) {
        store.setSessionProperty(newKey.trim(), '');
      }
    }}
    className="btn-secondary"
  >
    + Add Property
  </button>

  **Note:** Tech debt - `prompt()` is used for simplicity. Future enhancement: replace with inline input or modal dialog matching the label edit pattern.

  <button
    onClick={() => store.resetSessionProperties()}
    className="btn-secondary"
    style={{ marginLeft: '0.5rem' }}
  >
    Reset to Defaults
  </button>
</div>
```

**Notes:**
- Key input is disabled to prevent user editing (keys are immutable)
- Value input is editable inline
- Delete button removes property immediately
- "Add Property" uses `prompt()` for simplicity (can be enhanced to modal later)
- "Reset" restores hard-coded defaults

### 4. Styling (App.css)

Add:
```css
.settings-section {
  margin-bottom: 1.5rem;
}

.settings-help {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.property-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  background-color: var(--bg-secondary);
}

.property-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.property-key {
  padding: 0.4rem;
  background-color: var(--bg-disabled);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.85rem;
  cursor: not-allowed;
}

.property-value {
  padding: 0.4rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.85rem;
}

.property-value:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 3px rgba(var(--accent-rgb), 0.3);
}

.btn-delete {
  padding: 0.3rem 0.6rem;
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9rem;
  min-width: 32px;
}

.btn-delete:hover {
  background-color: var(--error-color-dark);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background-color: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-secondary:hover {
  background-color: var(--secondary-color-dark);
}
```

---

## Acceptance Criteria

### Core Functionality
- [ ] `sessionProperties: Record<string, string>` added to WorkspaceState interface
- [ ] `sessionProperties` state initialized with 2 defaults: `sql.local-time-zone: 'UTC'`, `parallelism.default: '1'`
- [ ] `sessionProperties` persists to localStorage via `partialize()` and survives page reload
- [ ] `setSessionProperty(key, value)` adds/overwrites property in state
- [ ] `setSessionProperty()` trims whitespace from keys before storing
- [ ] `setSessionProperty()` rejects empty/whitespace-only keys (no-op, no error)
- [ ] `setSessionProperty()` rejects reserved keys with toast notification and console warning
- [ ] `removeSessionProperty(key)` deletes property from state
- [ ] `resetSessionProperties()` restores exactly 2 factory defaults (removes all custom properties)
- [ ] Reserved keys (`sql.current-catalog`, `sql.current-database`) cannot be overridden (UI and store level)
- [ ] UI shows all current properties as editable rows
- [ ] "Add Property" button opens prompt, accepts any non-empty key
- [ ] "Reset" button restores factory defaults with 2 properties
- [ ] Delete button removes single property immediately

### API Integration
- [ ] `executeSQL()` signature updated to accept optional `sessionProperties?: Record<string, string>` parameter
- [ ] `executeSQL()` merges user `sessionProperties` with reserved key overrides
- [ ] Reserved keys always enforced by API layer (never allow user override)
- [ ] User sessionProperties override implicit defaults
- [ ] DO NOT set implicit default for `sql.tables.scan.startup.mode` (let server decide)
- [ ] User-initiated statements pass `store.sessionProperties` to `executeSQL()`
- [ ] Internal statements (tree loading, DESCRIBE, schema queries) do NOT pass sessionProperties
- [ ] Statement execution API payload includes all session properties

### UI/UX
- [ ] Settings panel renders property editor without errors
- [ ] Property rows are visually distinct (border, background)
- [ ] Key input is disabled and grayed out
- [ ] Value input is editable with focus state and visual feedback
- [ ] Delete button is small and right-aligned
- [ ] "Add Property" and "Reset" buttons are visible and accessible
- [ ] Property editor scrolls if >5 properties (max-height: 300px)

### Edge Cases
- [ ] Empty key in "Add Property" → ignored, no error
- [ ] Empty value is allowed (stores as `""`)
- [ ] Duplicate key → overwrites existing value
- [ ] User tries to set `sql.current-catalog` or `sql.current-database` → console warning, not stored
- [ ] Delete all properties → sessionProperties is empty, executeSQL still uses hardcoded defaults
- [ ] Very long values (>100 chars) → text input scrolls horizontally, no layout break

---

## Edge Cases & Validation

### Reserved Keys
- **sql.current-catalog** and **sql.current-database** must always match the workspace configuration (env.flinkCatalog, env.flinkDatabase)
- If user attempts to set these in the editor, show a **toast notification** "Cannot override reserved property: [key]" and reject the change
- In `executeSQL()`, these keys are always overwritten with workspace defaults (never allow user override)

### Whitespace Handling
- Keys with leading/trailing whitespace should be **trimmed** before storing
- `setSessionProperty('  sql.timezone  ', 'UTC')` → stored as `sql.timezone`
- Empty keys (or keys that only contain whitespace) → no-op, do not store

### Empty Values
- Empty string values (`""`) are technically valid Flink properties, but should be **validated**
- If user explicitly sets a property to an empty string, allow it (don't treat as "unset")
- Consider warning user that empty values may cause server-side validation errors

### Persistence
- sessionProperties must be included in `partialize()` function
- On first load, initialize with common Flink properties (see Initial State above)
- On app update, if sessionProperties key is missing from localStorage, use factory defaults
- Workspace export/import must include sessionProperties in the export payload

### API Merge Logic
- Reserved properties (sql.current-catalog, sql.current-database) are ALWAYS highest priority and enforced by API layer
- User sessionProperties override implicit defaults (but only if explicitly set)
- Do NOT set implicit defaults for other properties like `sql.tables.scan.startup.mode` - let Flink server use its own defaults unless user explicitly configures

Example merge order:
```
1. Reserved keys (sql.current-catalog = workspace catalog, sql.current-database = workspace database) ← HIGHEST priority
2. User sessionProperties (sql.tables.scan.startup.mode: 'latest-offset') ← if set by user
3. Server defaults (Flink server provides its own defaults) ← if property not specified
```

### Internal vs User Statement Execution
- **User statements** (from editor, manual execution): include sessionProperties
- **Internal statements** (tree loading, DESCRIBE, schema introspection): do NOT include sessionProperties, use workspace defaults only
- This prevents session properties from interfering with background operations

---

## Testing Strategy

### Unit Tests (not required for this phase, but suggested for future)
- `setSessionProperty()` with valid key/value
- `setSessionProperty()` with empty key (should be no-op)
- `setSessionProperty()` with reserved key (should warn and no-op)
- `removeSessionProperty()` with existing/non-existing key
- `resetSessionProperties()` restores defaults
- Merge logic in `executeSQL()` prioritizes correctly

### Manual QA (required)
1. **UI Rendering**
   - Open Settings panel → Session Properties section visible
   - 2 default properties shown (sql.local-time-zone, parallelism.default)

2. **Add Property**
   - Click "Add Property" → prompt appears
   - Enter key `sql.query-timeout` → property row added with empty value
   - Leave value empty → run a statement → API includes `sql.query-timeout: ""`
   - Try to add property with only whitespace (e.g., `   `) → rejected, no property added

3. **Edit Property**
   - Click value input for `sql.local-time-zone` → change to `America/New_York`
   - Close Settings panel → reopen → value is still `America/New_York` (persisted)
   - Run a statement → verify API payload includes `sql.local-time-zone: 'America/New_York'`

4. **Delete Property**
   - Click delete button on any property → row removed immediately
   - Reload page → property is still gone (persisted)
   - Run statement → API does not include deleted property

5. **Reset**
   - Add custom property `sql.query-timeout: '30s'`
   - Delete `sql.local-time-zone` default
   - Click "Reset" → both defaults restored (sql.local-time-zone, parallelism.default), custom property gone

6. **Reserved Keys Protection**
   - Try to add `sql.current-catalog` via "Add Property"
   - Expect: toast notification "Cannot override reserved property: sql.current-catalog", property not added
   - Try to add `sql.current-database` via "Add Property"
   - Expect: toast notification "Cannot override reserved property: sql.current-database", property not added
   - Manually try `setSessionProperty('sql.current-catalog', 'other')` in console
   - Expect: no-op, console warning, no toast (defensive)

7. **Whitespace Trimming**
   - Add property with key `  sql.timezone  ` → stored as `sql.timezone` (whitespace trimmed)
   - Add property with key `   ` (only spaces) → rejected, no property added

8. **Persistence**
   - Set 5 custom properties
   - Reload page
   - All 5 properties still present
   - localStorage key `flink-workspace` contains sessionProperties object

9. **API Integration**
   - Set `sql.tables.scan.startup.mode: 'latest-offset'`
   - Set `parallelism.default: '4'`
   - Run any SELECT statement
   - Open network tab → POST to `/api/flink/sql/execute`
   - Verify payload includes both properties
   - Verify `sql.current-catalog` and `sql.current-database` are set to workspace values (not user overrides)

10. **Internal Statements Use Defaults Only**
    - Set `parallelism.default: '8'` in session properties
    - Open TreeNavigator → expand a catalog/database (internal SHOW query)
    - Open schema panel → expand a table (internal DESCRIBE query)
    - These internal queries should NOT use `parallelism.default: '8'` (use workspace defaults)
    - Verify by checking network tab that internal queries have different payload than user statements

### Edge Case QA
- [ ] Add property with empty key (just spaces) → rejected, no property added, no error
- [ ] Add property with key `sql.query-timeout`, leave value empty string → execute query → API payload includes the property with empty value, no server error
- [ ] Add property with very long value (500+ chars) → UI doesn't break, text input scrolls horizontally
- [ ] Delete all properties → only defaults remain
- [ ] Try to add duplicate key → overwrites existing value
- [ ] Resize browser window → property editor responsive, doesn't overflow, scrolls if >5 properties
- [ ] Add property with key containing leading/trailing spaces → spaces trimmed before storage
- [ ] Try to set reserved key via console → console warning, toast shown, property rejected

---

## Common Flink SQL Properties Reference

**Pre-populated defaults:**

| Property | Default | Purpose |
|----------|---------|---------|
| `sql.local-time-zone` | `UTC` | Timezone for temporal operations |
| `parallelism.default` | `1` | Default query parallelism |

**Commonly configured properties (users can add):**

| Property | Recommended | Purpose |
|----------|---------|---------|
| `sql.tables.scan.startup.mode` | `latest-offset` | **IMPORTANT:** Use `latest-offset` for interactive streaming queries (reads new data only). **WARNING:** `earliest-offset` reads ALL historical data which can be extremely expensive and cause long delays - only use if you explicitly need full historical replay |
| `table.exec.state.ttl` | `1 hour` | State retention time for stateful queries (e.g., `1 hour`, `30 minutes`) - helps with memory management in streaming |
| `table.exec.mini-batch.enabled` | `false` | Enable mini-batch optimization for better throughput |
| `table.exec.mini-batch.allow-latency` | `1000ms` | Mini-batch latency window |
| `table.exec.sink.upsert-materialize` | `auto` | Upsert sink materialization strategy |
| `sql.catalog.iceberg.database.default` | N/A | Default Iceberg database |

**Reserved properties (managed by workspace, cannot be overridden):**
- `sql.current-catalog` - Set by workspace configuration
- `sql.current-database` - Set by workspace configuration

Users can add any of the properties listed above or other Flink SQL properties not included in this reference.

---

## Implementation Sequence

Given the multi-file nature, implementation should follow this order to avoid merge conflicts:

1. **Haiku Agent 1**: Store state + actions (workspaceStore.ts)
   - Add `sessionProperties` field to WorkspaceState interface
   - Add `sessionProperties` to initial state (2 defaults only)
   - Add `setSessionProperty`, `removeSessionProperty`, `resetSessionProperties` actions
   - Implement trimming of whitespace from keys
   - Implement reserved key validation with toast notification
   - Update persist() with partialize to include sessionProperties
   - Do NOT modify executeStatement yet (depends on API changes)

2. **Haiku Agent 2**: API layer (flink-api.ts)
   - Modify executeSQL signature to accept `sessionProperties?: Record<string, string>` and clarify `name` param
   - Implement merge logic: reserved keys enforced, user properties applied, no implicit defaults for startup mode
   - Add comments documenting that internal callers should NOT pass sessionProperties
   - Add documentation on concurrent execution behavior

3. **Haiku Agent 3**: UI + styling (App.tsx + App.css)
   - Add SessionPropertiesEditor component to Settings panel
   - Add all styles to App.css
   - Connect UI to store actions
   - Implement prompt-based "Add Property" with whitespace trimming
   - Show toast when user tries to add reserved key

4. **Haiku Agent 2 Redux**: Workspace export/import (workspaceStore.ts)
   - Update workspace export functionality to include `sessionProperties`
   - Update workspace import to restore `sessionProperties` from export
   - Verify types align with API

5. **Haiku Agent 1 Redux**: Link store to API (workspaceStore.ts)
   - Update executeStatement action to pass `store.sessionProperties` to executeSQL()
   - Ensure internal callers (tree loading, DESCRIBE, schema queries) do NOT pass sessionProperties
   - Test that user statements include session properties, internal statements do not

---

## Success Metrics

- Users can configure any Flink SQL session property from the UI
- Properties persist across browser reloads
- Session properties are included in all statement executions
- Reserved keys cannot be overridden
- No validation errors or console warnings on normal usage
- UI is responsive and intuitive for >10 properties
