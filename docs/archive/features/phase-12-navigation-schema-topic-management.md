# Phase 12 - Navigation Overhaul & Schema/Topic Management

**Status**: Design Phase (PRD)
**Target**: React + TypeScript + Vite + Zustand + Monaco Editor
**Dependency**: Builds on Phase 10 (JSON expander, sidebar badges, import/export, statement labels)

---

## Problem Statement

The current Flink SQL Workspace has limited navigation and lacks integrated schema/topic management. Engineers working with Confluent Cloud must:
1. Switch between multiple tools to view database objects, Kafka topics, and schemas
2. Manually reference schema definitions when writing SQL
3. Lack quick access to topic metadata and configuration
4. Have no way to manage schemas or topics within the workspace UI
5. Navigate a sidebar that doesn't scale well as feature count grows

**Goal**: Consolidate navigation into a modern rail-based UI and integrate schema registry + Kafka topic management for a complete Flink SQL workflow without leaving the application.

---

## Proposed Solution

A three-phase rollout:

### Phase 12.1: Foldout Navigation Rail
Replace the current left sidebar with a collapsible icon rail navigation system. The rail houses the SQL Workspace view (editor), Data panels (TreeNavigator, Topics, Schemas), Tools (History, Help), and Settings. Provides a modern, scalable navigation pattern.

### Phase 12.2: Schema Management
Add a Schema Registry panel for browsing, creating, evolving, and managing Confluent Cloud schemas. Integrates with the navigation rail and supports schema visualization in multiple formats (JSON code, tree view).

### Phase 12.3: Topic Management
Add a Kafka topic management panel for listing, creating, configuring, and querying topics. Integrates with Schema Registry to show associated schemas and generates Flink SQL queries.

### Phase 12.4: Full Lifecycle Integration
Connect schemas, topics, and the SQL editor for seamless workflows: schema→Flink DDL, topic→SQL query, and cross-navigation between panels.

---

## Detailed Design

### Phase 12.1: Foldout Navigation Rail

#### Overview
A left-side icon rail (collapsed: ~48px wide, expanded: ~200px) that switches between content panels. Active item is highlighted. Expands on click or hover (configurable behavior). All existing features (SQL editor, tree navigator, history, settings) are now accessible via this rail.

#### Navigation Structure
```
WORKSPACE
  └─ SQL Workspace (editor + results)

DATA
  ├─ Database Objects (existing TreeNavigator)
  ├─ Topics
  └─ Schemas

TOOLS
  ├─ History
  └─ Help

SETTINGS
  └─ Settings
```

#### Files to Modify/Create

| File | Action | Details |
|------|--------|---------|
| `src/components/NavRail/NavRail.tsx` | CREATE | Main navigation rail component; manages expanded state, active item, transitions |
| `src/components/NavRail/NavRailItem.tsx` | CREATE | Individual nav item: icon + label; highlights when active |
| `src/App.tsx` | MODIFY | Replace current sidebar layout with NavRail + content panel pattern; adjust main area width based on rail state |
| `src/store/workspaceStore.ts` | MODIFY | Add nav state: `activeNavItem`, `navExpanded`, actions `setActiveNavItem(item)`, `toggleNavExpanded()` |
| `src/index.css` | MODIFY | CSS variables for rail widths, transition durations, icon sizes |
| `src/types/index.ts` | MODIFY | Add `type NavItem = 'workspace' \| 'tree' \| 'topics' \| 'schemas' \| 'history' \| 'help' \| 'settings'` |

#### Component Structure
```
<NavRail>
  ├─ Rail Header (logo/branding)
  ├─ NavRailSection (WORKSPACE)
  │  └─ NavRailItem (active="workspace", icon, label)
  ├─ NavRailSection (DATA)
  │  ├─ NavRailItem (activeNav="tree", icon, label)
  │  ├─ NavRailItem (activeNav="topics", icon, label)
  │  └─ NavRailItem (activeNav="schemas", icon, label)
  ├─ NavRailSection (TOOLS)
  │  ├─ NavRailItem (activeNav="history", icon, label)
  │  └─ NavRailItem (activeNav="help", icon, label)
  └─ NavRailSection (SETTINGS)
     └─ NavRailItem (activeNav="settings", icon, label)
</NavRail>

<ContentPanel>
  {activeNavItem === 'workspace' && <SQLWorkspace />}
  {activeNavItem === 'tree' && <TreeNavigator />}
  {activeNavItem === 'topics' && <TopicPanel />}
  {activeNavItem === 'schemas' && <SchemaPanel />}
  {activeNavItem === 'history' && <HistoryPanel />}
  {activeNavItem === 'help' && <HelpPanel />}
  {activeNavItem === 'settings' && <SettingsPanel />}
</ContentPanel>
```

#### Zustand Store Updates
```typescript
interface WorkspaceStore {
  // Navigation state (NEW)
  activeNavItem: NavItem
  navExpanded: boolean

  // Actions (NEW)
  setActiveNavItem: (item: NavItem) => void
  toggleNavExpanded: () => void

  // Existing state...
}

// persist config: include navExpanded in partialize, activeNavItem NOT persisted (default 'workspace')
```

#### Styling
- **Collapsed rail**: 48px wide, icon-only
- **Expanded rail**: 200px wide, icon + label + grouped sections
- **Transition**: `300ms ease-in-out` for width and opacity
- **Active item**: Accent color highlight (uses existing CSS var `--flink-accent`)
- **Dark/Light mode**: Full support via existing CSS theme system
- **Icons**: Use lucide-react (lightweight, tree-shakeable) or simple SVG

#### Acceptance Criteria
- [ ] Icon rail always visible at top-left, collapsed by default (48px)
- [ ] Expand button/click toggles rail expansion (200px)
- [ ] Click nav item switches active panel (content below updates)
- [ ] Active item visually highlighted with accent color
- [ ] 'workspace' is default active item on app load
- [ ] Smooth expand/collapse CSS transition (300ms)
- [ ] Works perfectly in both light and dark mode
- [ ] Keyboard accessible: Tab through items, Enter/Space to activate
- [ ] Hover state on items (slightly brighter background)
- [ ] Section headers visible only when expanded
- [ ] Settings icon at bottom of rail (optional sticky footer)

---

### Phase 12.2: Schema Management

#### Overview
A Schema Registry management UI integrated into the navigation rail as a "Schemas" panel. Allows browsing, viewing, creating, evolving, and managing Confluent Cloud schemas.

#### APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/subjects` | GET | List all schema subjects |
| `/subjects/{subject}/versions` | GET | List versions for a subject |
| `/subjects/{subject}/versions/{version}` | GET | Get schema detail (JSON, type, ID) |
| `/subjects/{subject}/versions` | POST | Register new schema version (create/evolve) |
| `/compatibility/subjects/{subject}/versions/{version}` | POST | Validate schema compatibility before saving |
| `/config/{subject}` | GET | Get compatibility mode for subject |
| `/config/{subject}` | PUT | Set compatibility mode (BACKWARD, FORWARD, FULL, NONE) |
| `/subjects/{subject}` | DELETE | Delete subject (soft delete - marks all versions as deleted but recoverable. Hard delete requires `?permanent=true`.) |
| `/subjects/{subject}/versions/{version}` | DELETE | Delete specific schema version |

**Endpoint**: `https://psrc-8qvw0.us-east-1.aws.confluent.cloud` (from environment)
**Auth**: Basic Auth with `VITE_SCHEMA_REGISTRY_KEY:VITE_SCHEMA_REGISTRY_SECRET`
**Header**: `Content-Type: application/vnd.schemaregistry.v1+json`

#### New Components

**SchemaList.tsx** (`src/components/SchemaPanel/SchemaList.tsx`)
- Table view with columns: Subject, Inferred Topic, Schema Type
  - "Inferred Topic" is derived from subject naming convention (`{topic}-value` → topic `{topic}`). Move to SchemaDetail sidebar if too expensive for list view.
- Subject names only are shown in the list (no detail fetched upfront — avoids N+1 queries)
- Search/filter by subject name (client-side or API-driven)
- "+ Create Schema" button → opens CreateSchema dialog
- Click row → loads schema detail lazily via `getSchemaDetail(subject)` and navigates to SchemaDetail view
- Loading spinner, empty state "No schemas found", error state with retry

**SchemaDetail.tsx** (`src/components/SchemaPanel/SchemaDetail.tsx`)
- Header: subject name, compatibility mode (editable dropdown — all 7 modes: BACKWARD, FORWARD, FULL, NONE, BACKWARD_TRANSITIVE, FORWARD_TRANSITIVE, FULL_TRANSITIVE)
- Schema type badge (Avro/Protobuf/JSON)
- Version selector dropdown (shows all versions; **disabled during evolve/edit mode**)
- Code view toggle:
  - JSON code view: Monaco editor
  - Tree view: Hierarchical schema field visualization

**Read mode** (default):
- Monaco `readOnly=true`
- Buttons visible: "Evolve", "Delete"
- Buttons hidden: "Validate", "Save", "Cancel"

**Edit mode** (after clicking "Evolve"):
- Monaco `readOnly=false` with visible border change (e.g., accent-colored border)
- Buttons visible: "Validate", "Save", "Cancel"
- Buttons hidden: "Evolve", "Delete"
- Version selector disabled
- "Cancel" restores previous schema content and returns to read mode
- "Validate" calls compatibility check, shows inline result (success/failure with details)
- "Save" registers new version (only enabled after validation passes)

**Delete confirmation modal** (when "Delete" is clicked):
- States the subject name being deleted
- Shows topic-usage warning inline if applicable
- Uses destructive button styling (`--color-error` background)
- Explicit button label: "Delete {subject-name}"

- Sidebar (right):
  - Schema ID
  - Subject name
  - Current version / total versions
  - Inferred Topic: derived from subject naming convention (`{topic}-value` → `{topic}`)
  - References: topics using this schema (if available from metadata)
- Panel uses `--schema-panel-width: 480px` when a schema is selected (wider than default `--side-panel-width: 300px`)

**CreateSchema.tsx** (`src/components/SchemaPanel/CreateSchema.tsx`)
- Modal dialog with form:
  - Subject name input (required)
  - Schema type dropdown: Avro, Protobuf, JSON (default Avro)
  - Schema content: Monaco editor with Avro template pre-filled for type
  - Buttons: "Validate" (calls compatibility check), "Create" (POST /subjects/{subject}/versions)
  - Loading state, error display

**SchemaTreeView.tsx** (`src/components/SchemaPanel/SchemaTreeView.tsx`)
- Recursive tree component to visualize nested schema fields
- Show field name, type (string, int, record, array, etc.), default value
- Collapsible branches for nested records
- Read-only display

#### Modal Pattern (Accessibility Contract)

All modal dialogs in Phase 12.2 (CreateSchema, Delete Confirmation) must implement the following pattern:

- `role="dialog"` on the modal container
- `aria-modal="true"` on the modal container
- `aria-labelledby` pointing to the modal heading element
- `autoFocus` on the first interactive element when modal opens
- **Focus trap**: Tab and Shift+Tab cycle focus only within the modal while it is open
- **Escape** closes the modal and cancels the action
- When modal closes, focus is returned to the trigger element that opened it

#### New Files
- `src/api/schema-registry-api.ts` — API functions (listSchemas, getSchemaDetail, getSchemaVersions, createSchema, validateSchemaCompatibility, getCompatibilityMode, setCompatibilityMode, deleteSchema, deleteSchemaVersion)
- `src/api/schema-registry-client.ts` — Axios client with Schema Registry auth (separate HTTP client for Schema Registry, similar to confluentClient)
- `src/components/SchemaPanel/SchemaList.tsx`
- `src/components/SchemaPanel/SchemaDetail.tsx`
- `src/components/SchemaPanel/CreateSchema.tsx`
- `src/components/SchemaPanel/SchemaTreeView.tsx`

#### Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Add proxy: `'/api/schema-registry': { target: schemaRegistryUrl, ... }` |
| `src/config/environment.ts` | Add: `schemaRegistryUrl`, `schemaRegistryKey`, `schemaRegistrySecret` |
| `src/store/workspaceStore.ts` | Add schema state: `schemaRegistrySubjects: SchemaListItem[]`, `selectedSchemaSubject: SchemaSubject \| null`, `schemaRegistryLoading: boolean`, `schemaRegistryError: string \| null`, actions: `setSchemaRegistrySubjects()`, `setSelectedSchemaSubject()`, `setSchemaRegistryLoading()`, `setSchemaRegistryError()`. **Note**: names prefixed with `schemaRegistry` to avoid collision with existing `schemaLoading` in workspaceStore. |
| `src/types/index.ts` | Add types: `SchemaListItem`, `SchemaSubject`, `SchemaVersion` |

#### Type Definitions
```typescript
// src/types/index.ts

// Lightweight list item — returned by listSchemas() (GET /subjects)
interface SchemaListItem {
  subject: string           // e.g., "my-topic-value"
}

// Full detail — returned by getSchemaDetail() (GET /subjects/{subject}/versions/{version})
interface SchemaSubject {
  subject: string           // e.g., "my-topic-value"
  version: number           // latest version number
  id: number                // schema ID
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON'
  schema: string            // JSON string of schema definition
  compatibilityLevel?: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE' | 'BACKWARD_TRANSITIVE' | 'FORWARD_TRANSITIVE' | 'FULL_TRANSITIVE'
  references?: Array<{
    name: string
    subject: string
    version: number
  }>
}

interface SchemaVersion {
  subject: string
  version: number
  id: number
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON'
  schema: string
  references?: Array<{
    name: string
    subject: string
    version: number
  }>
}

interface SchemaField {
  name: string
  type: string | SchemaField[]  // primitive or nested record
  default?: any
  doc?: string
  avroMetadata?: Record<string, unknown>  // for extra Avro/Protobuf-specific fields
}
```

#### Acceptance Criteria
- [ ] List all schemas from Schema Registry
- [ ] Search/filter schemas by subject name (real-time)
- [ ] View schema JSON in code view (Monaco, read-only in read mode)
- [ ] View schema in tree view (hierarchical field visualization)
- [ ] Version selector dropdown shows all versions for selected schema (disabled during evolve/edit mode)
- [ ] Create new schema: subject name, type dropdown, code editor, validate + create buttons
- [ ] Evolve schema — read mode: shows Evolve + Delete buttons, Monaco readOnly=true
- [ ] Evolve schema — edit mode (after Evolve): Monaco readOnly=false with visual border, shows Validate + Save + Cancel; Cancel restores content and returns to read mode
- [ ] Compatibility check before saving (shows inline validation result with success/failure details)
- [ ] Edit compatibility mode per subject (dropdown: BACKWARD, FORWARD, FULL, NONE, BACKWARD_TRANSITIVE, FORWARD_TRANSITIVE, FULL_TRANSITIVE)
- [ ] Delete schema with confirmation modal: states subject name, shows topic-usage warning, destructive button styled with `--color-error`, button label "Delete {subject-name}"
- [ ] Modal dialogs implement full accessibility contract (role=dialog, aria-modal, focus trap, Escape-to-close, focus return)
- [ ] Loading spinner when fetching schemas/details
- [ ] Error state with retry button (Schema Registry unavailable)
- [ ] Empty state: "No schemas found" with "Create Schema" prompt
- [ ] Works in light and dark mode
- [ ] Responsive: panels adjust for expanded/collapsed nav rail

---

### Phase 12.3: Topic Management

#### Overview
A Kafka topic management UI integrated into the navigation rail as a "Topics" panel. Allows browsing, creating, configuring, and querying topics. Shows associations with schemas.

#### APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/kafka/v3/clusters/{cluster_id}/topics` | GET | List all topics in cluster |
| `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}` | GET | Get topic details |
| `/kafka/v3/clusters/{cluster_id}/topics` | POST | Create new topic |
| `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}` | DELETE | Delete topic |
| `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs` | GET | Get topic configs |
| `/kafka/v3/clusters/{cluster_id}/topics/{topic_name}/configs:alter` | PUT | Update topic configs |

**Endpoint**: Confluent Cloud REST API v3 (e.g., `https://pkc-xyz.us-east-1.provider.confluent.cloud`)
**Auth**: Basic Auth with `VITE_KAFKA_API_KEY:VITE_KAFKA_API_SECRET`
**ClusterId**: Retrieved from environment or Confluent Cloud API

#### New Components

**TopicList.tsx** (`src/components/TopicPanel/TopicList.tsx`)
- Table view with columns: Topic Name, Partitions, Replication Factor, Associated Schema, Status
- Search/filter by topic name
- "+ Create Topic" button → opens CreateTopic dialog
- Click row → navigates to TopicDetail view
- Loading spinner, empty state "No topics found", error state with retry

**TopicDetail.tsx** (`src/components/TopicPanel/TopicDetail.tsx`)
- Header: topic name, partition count, replication factor
- Tabs:
  - **Overview**: Topic configuration summary, creation timestamp, leader info
  - **Schema**: Associated value schema (if any), key schema (if any), "Associate Schema" button
  - **Settings**: Topic config table (retention, cleanup policy, compression, etc.), edit button
- Buttons:
  - "Query with Flink" → generates SELECT statement and switches to workspace
  - "Associate Schema" → dropdown to pick from existing schemas or create new
  - "Delete" → delete topic with confirmation
- Sidebar (right):
  - Topic name
  - Partition count
  - Replication factor
  - Last modified
  - Size (if available)

**CreateTopic.tsx** (`src/components/TopicPanel/CreateTopic.tsx`)
- Modal dialog with form:
  - Topic name input (required)
  - Partitions count input (default 6)
  - Replication factor input (default 3, auto-filled from cluster defaults)
  - Optional: Cleanup policy dropdown (delete, compact)
  - Optional: Retention time picker
  - Optional: Associate schema during creation (dropdown from existing schemas)
  - Buttons: "Create" (POST), "Cancel"
  - Loading state, error display

#### New Files
- `src/api/kafka-rest-api.ts` — API functions (listTopics, getTopic, createTopic, deleteTopic, getTopicConfigs, updateTopicConfigs, etc.)
- `src/api/kafka-rest-client.ts` — Axios client with Kafka REST auth (separate HTTP client)
- `src/components/TopicPanel/TopicList.tsx`
- `src/components/TopicPanel/TopicDetail.tsx`
- `src/components/TopicPanel/CreateTopic.tsx`

#### Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Add proxy: `'/api/kafka': { target: kafkaRestEndpoint, ... }` |
| `src/config/environment.ts` | Add: `kafkaClusterId`, `kafkaRestEndpoint`, `kafkaApiKey`, `kafkaApiSecret` |
| `src/store/workspaceStore.ts` | Add topic state: `topics: KafkaTopic[]`, `selectedTopic: KafkaTopic \| null`, `topicLoading: boolean`, `topicError: string \| null`, actions: `setTopics()`, `setSelectedTopic()`, `setTopicLoading()`, `setTopicError()` |
| `src/types/index.ts` | Add types: `KafkaTopic`, `TopicConfig`, `TopicPartition` |

#### Type Definitions
```typescript
// src/types/index.ts

interface KafkaTopic {
  topic_name: string
  partitions_count: number
  replication_factor: number
  is_internal: boolean
  topic_id?: string
  created_at?: number  // timestamp
  updated_at?: number
  size_bytes?: number

  // Derived from schema registry subject naming convention (topic-value, topic-key)
  valueSchema?: SchemaSubject
  keySchema?: SchemaSubject
}

interface TopicConfig {
  name: string  // e.g., 'retention.ms', 'cleanup.policy'
  value: string
  is_default: boolean
  is_sensitive: boolean
  is_read_only: boolean
}

interface TopicPartition {
  partition_id: number
  leader_id: number
  replicas: number[]
  in_sync_replicas: number[]
}
```

#### Acceptance Criteria
- [ ] List all Kafka topics with partition count, replication factor
- [ ] Search/filter topics by topic name
- [ ] View topic details: Overview tab shows config summary
- [ ] Schema tab: show associated value/key schemas, "Associate Schema" action
- [ ] Settings tab: display topic configs in editable form (with edit button)
- [ ] Create new topic: name, partitions, replication factor, cleanup policy
- [ ] "Query with Flink" button generates SELECT and opens workspace with statement
- [ ] Associate/disassociate schema with topic
- [ ] Delete topic with confirmation modal
- [ ] Loading spinner when fetching topics/details
- [ ] Error state with retry button (Kafka REST API unavailable)
- [ ] Empty state: "No topics found" with "Create Topic" prompt
- [ ] Works in light and dark mode
- [ ] Responsive: adjusts for expanded/collapsed nav rail

---

### Phase 12.4: Full Lifecycle Integration

#### Overview
Connect schemas, topics, and the SQL editor for seamless Flink engineering workflows. One-click operations to generate SQL, navigate between related objects, and create end-to-end data pipelines.

#### Integration Points

**Schema → SQL (DDL Generation)**
- From SchemaDetail, add "Use in Flink SQL" button
- Generates CREATE TABLE DDL with schema fields mapped to Flink SQL types:
  - Avro `string` → Flink `VARCHAR`
  - Avro `int` / `long` → Flink `INT` / `BIGINT`
  - Avro `boolean` → Flink `BOOLEAN`
  - Avro `bytes` → Flink `BYTES`
  - Avro `array` → Flink `ARRAY<...>`
  - Avro `record` → Flink `ROW(...)`
  - Avro `map` → Flink `MAP<K,V>`
  - Avro `enum` → Flink `VARCHAR`
  - Avro `fixed` → Flink `BINARY(n)`
  - Avro `union` → Flink nullable type (with NULL)
  - Avro logical `date` → Flink `DATE`
  - Avro logical `time-millis` → Flink `TIME`
  - Avro logical `timestamp-millis` → Flink `TIMESTAMP(3)`
  - Avro logical `timestamp-micros` → Flink `TIMESTAMP(6)`
  - Avro logical `decimal` → Flink `DECIMAL`
- Assumes topic name matches schema subject (e.g., schema subject "orders-value" → topic "orders")
- Inserts generated DDL into current editor cell or creates new cell
- Automatically switches to workspace panel

**Topic → SQL (Query Generation)**
- From TopicDetail, add "Query with Flink" button
- Generates SELECT statement:
  ```sql
  SELECT * FROM topic_name
  LIMIT 100;
  ```
- If topic has associated schema, generates typed SELECT with schema fields
- Inserts into editor and switches to workspace

**SQL → Topic/Schema (Tree Navigator Enhancement)**
- When viewing a table in TreeNavigator (database objects tree), show "Backed by topic" label if applicable
- Click label → navigate to Topics panel with topic pre-selected
- Show associated schema in table hover tooltip

**Create Workflow (Multi-step)**
- One-click path: Create topic → associate schema → generate Flink DDL → open in editor
- "Create Topic" button can optionally link to SchemaPanel for schema creation in same workflow
- After topic creation, "Would you like to associate a schema?" prompt
- After schema association, "Generate Flink SQL" button pre-fills CREATE TABLE in workspace

**Cross-Navigation**
- Schema detail can show "Associated Topics" sidebar list
- Click topic name → navigates to TopicPanel with topic selected
- Topic detail shows "Value Schema" and "Key Schema" links
- Click schema link → navigates to SchemaPanel with schema selected
- All navigation preserves scroll position / panel state where possible

#### Files to Modify

| File | Changes |
|------|---------|
| `src/components/SchemaPanel/SchemaDetail.tsx` | Add "Use in Flink SQL" button; generates CREATE TABLE DDL from schema fields; action: `setActiveNavItem('workspace')`, insert SQL into editor |
| `src/components/TopicPanel/TopicDetail.tsx` | Add "Query with Flink" button; generates SELECT * FROM topic; action: `setActiveNavItem('workspace')`, insert SQL into editor |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Show schema info on table hover; click schema link navigates to SchemaPanel |
| `src/store/workspaceStore.ts` | No new store actions needed for SQL insertion. SQL insertion uses the existing `editorRegistry.ts` module (Phase 6.3 pattern). Navigation to workspace uses the existing `setActiveNavItem('workspace')` action. |
| `src/utils/schema-to-flink.ts` | NEW: Helper functions (`generateFlinkDDL`, `generateTopicQuery`, `mapAvroTypeToFlink`) — pure utility, not in Zustand |

#### Type Mappings (Avro → Flink SQL)
```typescript
// src/utils/schema-to-flink.ts

const AVRO_TO_FLINK_TYPE_MAP: Record<string, string> = {
  // Primitive types
  'string': 'VARCHAR',
  'int': 'INT',
  'long': 'BIGINT',
  'float': 'FLOAT',
  'double': 'DOUBLE',
  'boolean': 'BOOLEAN',
  'bytes': 'BYTES',
  'null': 'NULL',
  // Avro logical types
  'date': 'DATE',                       // logicalType: "date"
  'time-millis': 'TIME',                // logicalType: "time-millis"
  'timestamp-millis': 'TIMESTAMP(3)',   // logicalType: "timestamp-millis"
  'timestamp-micros': 'TIMESTAMP(6)',   // logicalType: "timestamp-micros"
  'decimal': 'DECIMAL',                 // logicalType: "decimal" (precision/scale from schema)
  // Complex types handled in mapAvroTypeToFlink():
  //   map   → MAP<K,V>
  //   enum  → VARCHAR
  //   fixed → BINARY(n)
}

function mapAvroTypeToFlink(avroType: string | any[]): string {
  if (typeof avroType === 'string') {
    return AVRO_TO_FLINK_TYPE_MAP[avroType] || avroType.toUpperCase()
  }

  if (Array.isArray(avroType)) {
    // union type: filter out null, use the non-null type (nullable in Flink)
    const nonNullTypes = avroType.filter(t => t !== 'null')
    if (nonNullTypes.length === 1) {
      return mapAvroTypeToFlink(nonNullTypes[0])
    }
    // complex union: map each and join
    return nonNullTypes.map(t => mapAvroTypeToFlink(t)).join(' OR ')
  }

  if (typeof avroType === 'object') {
    if (avroType.type === 'array') {
      return `ARRAY<${mapAvroTypeToFlink(avroType.items)}>`
    }
    if (avroType.type === 'record') {
      const fields = avroType.fields
        .map(f => `${f.name} ${mapAvroTypeToFlink(f.type)}`)
        .join(', ')
      return `ROW(${fields})`
    }
  }

  return 'VARCHAR' // default fallback
}

function generateCreateTableDDL(schema: SchemaSubject, topicName: string): string {
  const schemaObj = JSON.parse(schema.schema)
  const fields = schemaObj.fields
    .map(f => `  ${f.name} ${mapAvroTypeToFlink(f.type)}`)
    .join(',\n')

  return `CREATE TABLE \`${topicName}\` (
${fields}
) WITH (
  'connector' = 'kafka',
  'topic' = '${topicName}',
  'properties.bootstrap.servers' = '...',
  'properties.group.id' = '...',
  'scan.startup.mode' = 'earliest-offset',
  'format' = 'avro-confluent',
  'avro-confluent.url' = '...'
);`
}
```

#### Acceptance Criteria
- [ ] Schema "Use in Flink SQL" generates CREATE TABLE DDL with correct Avro→Flink type mappings
- [ ] Topic "Query with Flink" generates SELECT statement with topic name
- [ ] Generated SQL inserted into editor (new cell or current cell)
- [ ] Action automatically switches to workspace panel
- [ ] Schema detail shows "Associated Topics" list; click navigates to TopicPanel
- [ ] Topic detail shows "Value Schema" / "Key Schema" links; click navigates to SchemaPanel
- [ ] TreeNavigator shows schema info on table hover/detail
- [ ] One-click workflow: create topic → optional schema association → optional SQL generation
- [ ] Cross-navigation preserves state (back button navigates between panels correctly)
- [ ] All generated SQL is properly formatted and executable in Flink

---

## API Contracts

### Schema Registry Client
```typescript
// src/api/schema-registry-api.ts

export async function listSchemas(): Promise<string[]>
// GET /subjects → returns string[] (subject names only; NO per-subject detail fetched here to avoid N+1 queries)

export async function getSchemaDetail(subject: string, version?: 'latest' | number): Promise<SchemaSubject>
// GET /subjects/{subject}/versions/{version|'latest'} → returns full SchemaSubject detail
// Called lazily on row click in SchemaList; version defaults to 'latest'

export async function getSchemaVersions(subject: string): Promise<SchemaVersion[]>
// GET /subjects/{subject}/versions → returns SchemaVersion[]

export async function createSchema(subject: string, schemaObj: object, schemaType: string): Promise<{ id: number }>
// POST /subjects/{subject}/versions → { schema: JSON.stringify(schemaObj), schemaType }

export async function validateSchemaCompatibility(
  subject: string,
  schemaObj: object,
  schemaType: string,
  version: 'latest' | number = 'latest'
): Promise<{ is_compatible: boolean }>
// POST /compatibility/subjects/{subject}/versions/{version}
// Body: { schema: JSON.stringify(schemaObj), schemaType }

export async function getCompatibilityMode(subject: string): Promise<{ compatibilityLevel: string }>
// GET /config/{subject}

export async function setCompatibilityMode(
  subject: string,
  level: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE' | 'BACKWARD_TRANSITIVE' | 'FORWARD_TRANSITIVE' | 'FULL_TRANSITIVE'
): Promise<{ compatibility: string }>
// PUT /config/{subject} → { compatibility: level }

export async function deleteSchema(subject: string): Promise<number[]>
// DELETE /subjects/{subject} → returns array of deleted version numbers

export async function deleteSchemaVersion(subject: string, version: number): Promise<void>
// DELETE /subjects/{subject}/versions/{version}
```

### Kafka REST Client
```typescript
// src/api/kafka-rest-api.ts

export async function listTopics(): Promise<KafkaTopic[]>
// GET /kafka/v3/clusters/{clusterId}/topics

export async function getTopic(topicName: string): Promise<KafkaTopic>
// GET /kafka/v3/clusters/{clusterId}/topics/{topicName}

export async function createTopic(request: {
  name: string
  partitions_count: number
  replication_factor: number
  configs?: Record<string, string>
}): Promise<{ topic_id: string }>
// POST /kafka/v3/clusters/{clusterId}/topics

export async function deleteTopic(topicName: string): Promise<void>
// DELETE /kafka/v3/clusters/{clusterId}/topics/{topicName}

export async function getTopicConfigs(topicName: string): Promise<TopicConfig[]>
// GET /kafka/v3/clusters/{clusterId}/topics/{topicName}/configs

export async function updateTopicConfigs(topicName: string, configs: Record<string, string>): Promise<void>
// PUT /kafka/v3/clusters/{clusterId}/topics/{topicName}/configs:alter → { data: [{ name, value }] }
```

---

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Schema Registry unavailable | Show error banner with retry button; graceful fallback (no schema panel accessible) |
| Empty Schema Registry | "No schemas found" empty state with "Create Schema" button |
| Schema validation failure | Inline error message in editor; highlight problematic field if possible |
| Schema type not supported (custom) | Show raw JSON in tree view; note "(Custom type)" label |
| Topic with no associated schema | "No schema associated" label with "Associate" button in TopicDetail |
| Network timeout on large schema list | Show partial results with "More..." button or pagination; loading indicator |
| Concurrent schema evolution | Version conflict error: "A new version was created while you were editing"; prompt to reload |
| Delete schema used by topics | Warn user: "This schema is used by X topics; deleting may cause issues" |
| Delete topic with active streaming query | Warn: "Active Flink queries may be using this topic" |
| Kafka REST API unavailable | Show error banner with retry; gracefully hide Topics panel |
| Invalid cluster ID | Error on load; prompt to configure cluster settings |
| Schema field type unmappable to Flink | Fallback to VARCHAR with warning comment in generated DDL |

---

## Type Changes Summary

```typescript
// src/types/index.ts - NEW TYPES

type NavItem = 'workspace' | 'tree' | 'topics' | 'schemas' | 'history' | 'help' | 'settings'

type CompatibilityLevel =
  | 'BACKWARD'
  | 'FORWARD'
  | 'FULL'
  | 'NONE'
  | 'BACKWARD_TRANSITIVE'
  | 'FORWARD_TRANSITIVE'
  | 'FULL_TRANSITIVE'

// Lightweight list item returned by listSchemas() (GET /subjects)
interface SchemaListItem {
  subject: string
}

// Full detail returned by getSchemaDetail()
interface SchemaSubject {
  subject: string
  version: number
  id: number
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON'
  schema: string
  compatibilityLevel?: CompatibilityLevel
  references?: SchemaReference[]
}

interface SchemaVersion {
  subject: string
  version: number
  id: number
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON'
  schema: string
  references?: SchemaReference[]
}

interface SchemaReference {
  name: string
  subject: string
  version: number
}

interface SchemaField {
  name: string
  type: string | any[] | SchemaField[]
  default?: any
  doc?: string
  avroMetadata?: Record<string, unknown>
}

interface KafkaTopic {
  topic_name: string
  partitions_count: number
  replication_factor: number
  is_internal: boolean
  topic_id?: string
  created_at?: number
  updated_at?: number
  size_bytes?: number
  valueSchema?: SchemaSubject
  keySchema?: SchemaSubject
}

interface TopicConfig {
  name: string
  value: string
  is_default: boolean
  is_sensitive: boolean
  is_read_only: boolean
}

interface TopicPartition {
  partition_id: number
  leader_id: number
  replicas: number[]
  in_sync_replicas: number[]
}
```

### Zustand Store Additions
```typescript
interface WorkspaceStore {
  // Navigation (NEW)
  activeNavItem: NavItem
  navExpanded: boolean
  setActiveNavItem: (item: NavItem) => void
  toggleNavExpanded: () => void

  // Schemas (NEW)
  // NOTE: All names prefixed with `schemaRegistry` to avoid collision with existing `schemaLoading` in workspaceStore
  schemaRegistrySubjects: SchemaListItem[]
  selectedSchemaSubject: SchemaSubject | null
  schemaRegistryLoading: boolean
  schemaRegistryError: string | null
  setSchemaRegistrySubjects: (subjects: SchemaListItem[]) => void
  setSelectedSchemaSubject: (schema: SchemaSubject | null) => void
  setSchemaRegistryLoading: (loading: boolean) => void
  setSchemaRegistryError: (error: string | null) => void

  // Topics (NEW)
  topics: KafkaTopic[]
  selectedTopic: KafkaTopic | null
  topicLoading: boolean
  topicError: string | null
  setTopics: (topics: KafkaTopic[]) => void
  setSelectedTopic: (topic: KafkaTopic | null) => void
  setTopicLoading: (loading: boolean) => void
  setTopicError: (error: string | null) => void

  // Cross-navigation (NEW)
  // NOTE: SQL insertion uses the existing editorRegistry.ts module (Phase 6.3 pattern) — NOT added to Zustand.
  // Navigation uses setActiveNavItem('workspace') which is already in the store.

  // Existing state & actions...
}
```

---

## Implementation Order

**Phase 12.1** (Foundation - must complete first):
- NavRail component, NavRailItem component
- App.tsx layout refactor
- Store nav state in Zustand
- CSS variables for rail widths/transitions
- Move existing panels (TreeNavigator, HistoryPanel, SettingsPanel) into NavRail content system

**Phase 12.2 & 12.3** (Can run in parallel after 12.1):
- Schema Registry API client and components (SchemaList, SchemaDetail, SchemaTreeView, CreateSchema)
- Kafka REST API client and components (TopicList, TopicDetail, CreateTopic)
- Integrate both into NavRail panels
- Test Schema Registry and Kafka REST proxies in vite.config.ts

**Phase 12.4** (Depends on 12.2 + 12.3):
- DDL generation utility (Avro→Flink type mapping)
- "Use in Flink SQL" and "Query with Flink" button handlers
- Cross-navigation actions in Zustand
- TreeNavigator schema association display
- End-to-end integration testing

---

## Acceptance Criteria (All Phases)

**Phase 12.1: Navigation Rail**
- [ ] Icon rail visible at all times (collapsed: 48px, expanded: 200px)
- [ ] Expand toggle button works; smooth CSS transition
- [ ] All nav items clickable; active item highlighted
- [ ] 'workspace' is default active on app load
- [ ] Existing panels (TreeNavigator, History, Settings, Help) accessible via rail
- [ ] Dark/light mode fully supported
- [ ] Keyboard accessible (Tab, Enter/Space to activate)
- [ ] No layout shift during expand/collapse
- [ ] No performance regression (smooth 300ms transition)

**Phase 12.2: Schema Management**
- [ ] List schemas (subject names only, no N+1 detail fetching on list load)
- [ ] Search/filter by subject name in real-time
- [ ] Schema detail loaded lazily on row click via `getSchemaDetail()`
- [ ] View schema in JSON code view (read-only in read mode) and tree view
- [ ] Version selector works; shows all versions; disabled during edit mode
- [ ] Read mode: Evolve + Delete visible; Monaco readOnly=true
- [ ] Edit mode: Validate + Save + Cancel visible; Monaco readOnly=false with visual border change
- [ ] Cancel in edit mode restores previous content and returns to read mode
- [ ] Create new schema: validate before save; modal uses accessibility contract
- [ ] Compatibility validation before save (shows inline success/failure)
- [ ] Edit compatibility mode (all 7 modes: BACKWARD, FORWARD, FULL, NONE, BACKWARD_TRANSITIVE, FORWARD_TRANSITIVE, FULL_TRANSITIVE)
- [ ] Delete schema: confirmation modal states subject name, topic-usage warning, destructive styling, "Delete {subject-name}" label
- [ ] Schema detail panel uses `--schema-panel-width: 480px`; schema list uses default `--side-panel-width: 300px`
- [ ] No naming collision with existing `schemaLoading` (all new fields use `schemaRegistry` prefix)
- [ ] SQL insertion uses `editorRegistry.ts` module (not Zustand)
- [ ] Loading, error, empty states
- [ ] Dark/light mode support

**Phase 12.3: Topic Management**
- [ ] List topics with name, partitions, replication factor, schema
- [ ] Search/filter by topic name
- [ ] View topic details: Overview, Schema, Settings tabs
- [ ] Create topic: name, partitions, replication factor, optional cleanup policy
- [ ] Associate/disassociate schemas with topics
- [ ] "Query with Flink" generates SELECT and opens workspace
- [ ] Delete topic with confirmation
- [ ] Loading, error, empty states
- [ ] Dark/light mode support

**Phase 12.4: Full Integration**
- [ ] Schema "Use in Flink SQL" generates CREATE TABLE with correct types
- [ ] Topic "Query with Flink" generates SELECT with topic name
- [ ] Generated SQL inserted into editor and switches to workspace
- [ ] Schema detail shows associated topics; click navigates to TopicPanel
- [ ] Topic detail shows associated schemas; click navigates to SchemaPanel
- [ ] TreeNavigator shows schema info on table hover
- [ ] Type mappings: Avro→Flink conversions correct (string→VARCHAR, int→INT, long→BIGINT, boolean→BOOLEAN, bytes→BYTES, date→DATE, time-millis→TIME, timestamp-millis→TIMESTAMP(3), timestamp-micros→TIMESTAMP(6), decimal→DECIMAL, map→MAP<K,V>, enum→VARCHAR, fixed→BINARY(n))
- [ ] Cross-navigation smooth; state preserved
- [ ] No console errors or warnings

---

## Notes for Implementation Teams

### Architecture Decisions
1. **Separate HTTP clients**: Schema Registry and Kafka REST use their own Axios clients (like confluentClient) to keep auth/baseURL isolated
2. **Vite proxies**: Each new API service gets a distinct proxy path (`/api/schema-registry`, `/api/kafka`) to avoid auth header conflicts
3. **Zustand state splitting**: Nav state (`activeNavItem`, `navExpanded`) is transient; topic/schema state is populated on demand
4. **Component isolation**: Each panel (SchemaPanel, TopicPanel) is self-contained; navigation handled by Zustand actions

### Testing Strategy
- Unit tests for type mapping functions (Avro→Flink)
- Integration tests for API clients with mocked responses
- Component tests for UI interactions (expand/collapse, search, create, delete with modals)
- E2E tests for cross-navigation workflows (schema→SQL→workspace)
- Browser visual tests for dark/light mode consistency

### Performance Considerations
- Lazy-load TopicPanel and SchemaPanel components (only render when active)
- Debounce search/filter inputs (300ms)
- Paginate schema list if registry has >1000 subjects
- Cache topic/schema lists with stale-while-revalidate pattern
- Use React.memo on NavRailItem to prevent unnecessary re-renders

### Accessibility Checklist
- ARIA labels on all icon buttons ("Expand navigation", "Create schema", etc.)
- Focus visible on nav items (outline or background)
- Keyboard navigation: Tab through items, Enter/Space to activate
- Modal dialogs: focus trap, Escape to close, focus returned to trigger element
- Color not sole indicator (use icons + labels)
- Dark mode: ensure sufficient contrast (WCAG AA minimum)

---

## References & Resources

- Confluent Cloud Schema Registry API: https://docs.confluent.io/cloud/current/schema-registry/index.html
- Confluent Cloud Kafka REST API v3: https://docs.confluent.io/kafka-rest/current/api.html
- Flink SQL DDL Documentation: https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql/create/
- Avro Type Mappings: https://avro.apache.org/docs/current/spec.html
- Lucide React Icons: https://lucide.dev/

---

**PRD Version**: 1.1
**Last Updated**: 2026-02-28
**Author**: Claude Code (Opus)
**Revision Notes**: v1.1 — Applied design review feedback: N+1 fix (listSchemas→string[], lazy getSchemaDetail), schemaRegistry prefix naming, removed insertSQLAtCursor/navigateAndInsertSQL from Zustand, 7 compatibility modes, PUT body fix ({ compatibility }), validateSchemaCompatibility signature fix (schemaType param), modal accessibility contract, read/edit mode UX split, delete modal spec, schema panel width, format=avro-confluent DDL fix, deleteSchema→Promise<number[]>, soft delete description fix, SchemaField.avroMetadata, SchemaVersion.schemaType union, Inferred Topic column, version selector disabled in edit mode, SchemaListItem split type, CompatibilityLevel union type, Avro logical type mappings.
