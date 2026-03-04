Confluence UI Replication Spec for Flank - Detailed Implementation Guide
EXECUTIVE SUMMARY
This document provides comprehensive specifications for replicating the Confluent Cloud SQL Workspace UI. The implementation focuses on the workspace tab with tables, views, models, functions, and external tables management.

PART 1: FUNCTIONAL REQUIREMENTS
1.1 Core Layout Architecture
Main Layout Structure

Three-Column Layout

Left Sidebar (40px wide navigation + 280px expanded explorer): Global navigation and hierarchical resource explorer
Center Editor Pane (flexible width): Query editor with SQL syntax highlighting and execution controls
Right Header Bar: Context-aware information display (user, account, cluster status)



Navigation Flow

Left sidebar contains icon-based quick navigation (collapsible)
Main content area displays workspace explorer and SQL editor
Workspace tabs at top (multi-tab support visible in UI)

1.2 Left Sidebar Navigation Structure
Nested Tree Hierarchy

Examples (read-only demo)

Marketplace (collapsed/expandable)
Tables (expandable section)


Default (environment/catalog)

Luke3 (database)

Tables (expandable list with 6+ example tables)
Views (section with "No views yet" + "Create a view" link)
Models (section with "No models yet" + "Create a model" link)
Functions (section with "No functions yet" + "Create a function" link)
External Tables (section with "No external tables yet" + "Create an external table" link)





Tree Node Features

Expandable/Collapsible Nodes: Each parent has a chevron icon (> / v) to toggle
Icons by Type:

Environment: network icon
Database/Catalog: database icon
Table: document/table icon
Views/Models/Functions/External Tables: section headers with collapsible icons


Empty State Handling: When a section has no items, display placeholder text with blue action link
Hover States: Visual feedback on tree nodes (subtle background highlight)
Drag & Drop Ready: Structure supports future drag operations

1.3 Main Content Area - Query Editor Panel
Editor Cell Components
Each SQL statement is contained in an expandable/collapsible "cell" block with:
Header Row (for each cell):

Add Button (+): Create new SQL cell above
Run/Execute Button: Purple outline button "Run" - executes the SQL
Statement Metadata: Display execution status and statement name
Control Buttons:

Info icon (?)
Duplicate button (copy icon)
Delete button (trash icon)


Collapse/Expand (chevron icon)

Content Area:

SQL syntax-highlighted editor (likely Monaco Editor or similar)
Line numbers on left
Syntax coloring: Keywords (blue), strings (red), identifiers (backticks), comments (gray)
Full-width text input with monospace font

Status/Results Row:

"Start time": Shows execution timestamp
"Statement status": Shows "Stopped", "Running", or "Completed" with status indicator
"Statement Name": Displays auto-generated or custom name (clickable/selectable)
"Last saved at": Timestamp of last save

SQL Editor Features

Syntax Highlighting: Different colors for SQL keywords, literals, identifiers
Auto-indentation: Multi-line statement support
Comment Support: -- comment style comments in gray
Backtick Escaping: Table/column names in backticks for special characters
Template Comments: Pre-populated example comments for CREATE VIEW, CREATE MODEL, etc.

1.4 Top Control Bar (Post-Header)
Left Section:

"Catalog" dropdown selector (showing "default")
"Database" dropdown selector (showing "luke3")

Right Section:

Info icon (help/context)
Settings icon (gear) - workspace settings

1.5 Right Header Panel
Workspace Context Display:

Workspace name/title (h1 heading)
Environment badge (default)
User info section:

Name: "Luke Angel"
Label: "User Account" with blue badge


Infrastructure info:

"AWS | us-east-1"
"flink-pool | " with green "Running" status indicator


Settings icon (top right)

Row with Dropdowns:

"Catalog" with current value and chevron
"Database" with current value and chevron


PART 2: DETAILED UI COMPONENTS
2.1 Collapsible Tree Items (Recursive Component)
TreeNode Component:
├── Icon (environment/database/table)
├── Label Text (clickable, selectable)
├── Chevron Toggle (if has children)
└── [If Expanded]:
    ├── Render Children
    └── If No Children: "No [type] yet" + "Create [type]" link
States:

Collapsed (chevron pointing right)
Expanded (chevron pointing down)
Empty (show placeholder text in lighter color with blue action link)
Hover (subtle background highlight)
Selected/Active (slightly darker background)

2.2 SQL Editor Cell Component
EditorCell Component:
├── Header Row:
│   ├── Add (+) Button
│   ├── Run Button (primary action)
│   ├── Status Display
│   ├── Statement Name
│   └── Action Buttons (info, duplicate, delete)
├── Editor Content:
│   ├── Line Numbers
│   ├── Syntax-Highlighted Code
│   └── Monospace Text Input
├── Status Row:
│   ├── Execution Metadata
│   └── Status Indicator
└── Results Preview (if executed)
Interactive States:

Focused (blue border/highlight on editor)
Executing (Run button shows loading state)
Error (red border, error message displayed)
Success (green check, results shown)

2.3 Dropdown Selectors (Catalog & Database)

Style: Inline dropdown buttons
Format: [Label] [Current Value] [Chevron Icon]
Behavior: Click to open dropdown menu with available options
Current Selection: Highlighted in the dropdown

2.4 Status Indicators
Running State:

Green dot icon
Text: "Running"

Stopped State:

Gray circle icon
Text: "Stopped"

User Account Badge:

Blue background
White text
Slightly rounded corners


PART 3: DATA & STATE MANAGEMENT
3.1 Workspace State Structure
javascript{
  workspace: {
    id: "workspace-2026-01-19-175600",
    name: "workspace-2026-01-19-175600",
    environment: "default",
    user: { name: "Luke Angel", email: "..." },
    infrastructure: {
      provider: "AWS",
      region: "us-east-1",
      cluster: "flink-pool",
      status: "Running"
    },
    catalog: {
      name: "default",
      databases: [
        {
          name: "luke3",
          tables: [ /* array of table objects */ ],
          views: [ /* array or empty */ ],
          models: [ /* array or empty */ ],
          functions: [ /* array or empty */ ],
          externalTables: [ /* array or empty */ ]
        }
      ]
    },
    sqlStatements: [
      {
        id: "statement-1",
        type: "SELECT", // or "CREATE VIEW", "CREATE MODEL", etc.
        code: "SELECT * FROM ...",
        status: "Stopped", // or "Running", "Completed"
        statementName: "workspace-2026-01-19-175600-b12dcd6b-c98d-4595-bb71-b74cacafa05c",
        startTime: "2026-01-19T17:56:08.765854Z",
        results: [ /* if executed */ ],
        lastSaved: "2026-01-19T19:01:00Z"
      }
    ]
  }
}
3.2 Tree Expansion State
javascript{
  expandedNodes: {
    "examples": true,
    "examples.marketplace": false,
    "examples.marketplace.tables": true,
    "default": true,
    "default.luke3": true,
    "default.luke3.tables": true,
    "default.luke3.views": false,
    "default.luke3.models": false,
    "default.luke3.functions": false,
    "default.luke3.externalTables": true
  }
}
3.3 Editor State
javascript{
  activeCell: null, // or cell ID
  cellOrder: [ "statement-1", "statement-2", "statement-3" ],
  selectedCatalog: "default",
  selectedDatabase: "luke3",
  statementEdits: { /* unsaved changes per statement */ }
}

PART 4: INTERACTION PATTERNS
4.1 Tree Navigation

Click chevron to toggle expansion
Click item name to select/highlight
Right-click for context menu (future: rename, delete, etc.)
Double-click to open in editor (if applicable)
Blue links (e.g., "Create a view") navigate to creation modal/page

4.2 SQL Editor Workflow

Click "+ Add" button to create new cell
Type/paste SQL into editor (syntax highlights automatically)
Click "Run" to execute (status changes to "Running", then updates)
View results in collapsible results section
Click "Duplicate" to copy statement to new cell
Click trash to delete cell (with confirmation)

4.3 Dropdown Selection

Click dropdown button
Menu appears with available options
Click to select option
UI updates to show new selection (content reloads if needed)


PART 5: TECHNOLOGY STACK ANALYSIS
5.1 Framework & Architecture

Frontend Framework: React (confirmed via DevTools detection and component structure)
Architecture Pattern: Single Page Application (SPA)
Component Model: React functional components with hooks (modern approach)

5.2 UI Component Libraries & Styling

Component Library: Custom design system (Confluent-branded)
CSS Approach: Likely CSS-in-JS or modular SCSS
Icon Library: SVG-based custom icons (network, database, table, chevron, etc.)
Typography: Custom sans-serif font (likely system font stack or Confluent custom)
Color Scheme: Dark mode with light text, purple/blue accents for primary actions

5.3 Code Editor
Analysis: Looking at the SQL syntax highlighting and features:

Line numbers (left margin)
Syntax coloring by token type
Monospace font rendering
Multi-line support

Most Likely: Monaco Editor (VS Code's editor engine)

Industry standard for web-based SQL editors
Excellent SQL language support
Syntax highlighting built-in
Performance optimized
Confluent likely chose this over CodeMirror or Ace

Alternative Possibility: CodeMirror 6 (but Monaco is more common for this use case)
5.4 State Management

State Library: Likely Redux or Zustand (or Context API for simpler state)
Pattern: Centralized store for workspace state, dropdown selections, editor content
Persistence: LocalStorage for temporary state, API calls to backend for persistent data

5.5 Backend Communication

API Type: REST or GraphQL endpoints
Authentication: OAuth/JWT (typical for cloud services)
Real-time Features: WebSocket or polling for execution status updates
Key Endpoints (inferred):

GET /workspaces/{id} - Fetch workspace metadata
POST /workspaces/{id}/statements - Create SQL statement
POST /workspaces/{id}/statements/{statementId}/execute - Run SQL
GET /workspaces/{id}/catalogs/{catalog}/databases/{db}/tables - List tables
etc.



5.6 Build & Development Stack

Build Tool: Likely Webpack (via Create React App or custom Webpack config)
Package Manager: npm or yarn
TypeScript: Likely used (best practice for large React applications)
Testing: Jest + React Testing Library (or similar)

5.7 Performance Optimizations Observed

Virtualization: Tree likely uses react-window for virtualization (handles large table lists efficiently)
Code Splitting: Separate chunks for different pages/features
Lazy Loading: Tree nodes load children on demand
Memoization: Components likely use React.memo to prevent unnecessary re-renders

5.8 Key Libraries (High Confidence)
json{
  "core": ["react", "react-dom"],
  "editor": ["monaco-editor"],
  "state": ["react-hooks or redux"],
  "http": ["axios or fetch API"],
  "styling": ["css-in-js or postcss"],
  "icons": ["custom svg"],
  "utilities": ["lodash, date-fns, classnames"]
}

PART 6: IMPLEMENTATION RECOMMENDATIONS FOR CLAUDE CODE
6.1 Phase 1: Foundation (Week 1)

Setup React Project

Create React app with TypeScript
Install Monaco Editor
Setup mock API layer


Build Core Components

TreeNode (recursive, collapsible)
SQLEditorCell
DropdownSelector
StatusBadge


Implement Layout

Three-column grid layout
Responsive breakpoints
Navigation sidebar with icons



6.2 Phase 2: Feature Development (Weeks 2-3)

Tree Explorer with Data

Connect tree to mock workspace data
Implement expand/collapse logic
Handle empty states


SQL Editor Integration

Integrate Monaco Editor
Syntax highlighting for SQL
Cell management (add, delete, duplicate)


Dropdowns & Selectors

Implement catalog/database selection
Connect to data filtering



6.3 Phase 3: Polish & Enhancement (Week 4)

Styling & Theming

Match Confluent's design system
Dark mode defaults
Hover/active states


Interactions

Smooth animations
Loading states
Error handling


Backend Integration

Replace mock data with real API calls
Handle async state updates
Error boundaries and fallbacks



6.4 Tech Stack Recommendation
javascript{
  framework: "React 18+",
  language: "TypeScript",
  styling: "Tailwind CSS or styled-components",
  editor: "monaco-editor",
  stateManagement: "Zustand or Redux Toolkit",
  http: "axios with interceptors",
  icons: "react-icons or custom SVG",
  componentLibrary: "Custom or Shadcn/ui (for base)",
  virtualization: "react-window (for large lists)"
}

PART 7: DETAILED COMPONENT SPECIFICATIONS
7.1 TreeExplorer Component API
typescriptinterface TreeNode {
  id: string;
  label: string;
  icon: IconType;
  type: 'environment' | 'database' | 'table' | 'view' | 'model' | 'function' | 'externalTable';
  children?: TreeNode[];
  isExpandable: boolean;
  metadata?: Record<string, any>;
}

interface TreeExplorerProps {
  rootNodes: TreeNode[];
  onNodeClick: (node: TreeNode) => void;
  onNodeExpand: (nodeId: string, expanded: boolean) => void;
  expandedNodeIds: Set<string>;
  selectedNodeId?: string;
}
7.2 SQLEditorCell Component API
typescriptinterface SQLStatement {
  id: string;
  code: string;
  type: 'SELECT' | 'CREATE_VIEW' | 'CREATE_MODEL' | 'CREATE_FUNCTION';
  status: 'Stopped' | 'Running' | 'Completed' | 'Error';
  startTime?: Date;
  endTime?: Date;
  statementName: string;
  results?: any[];
  error?: string;
  lineCount: number;
}

interface SQLEditorCellProps {
  statement: SQLStatement;
  onRun: (statementId: string) => Promise<void>;
  onDuplicate: (statementId: string) => void;
  onDelete: (statementId: string) => void;
  onChange: (statementId: string, newCode: string) => void;
  isLoading?: boolean;
}
7.3 Workspace Header Component API
typescriptinterface WorkspaceContext {
  workspaceName: string;
  userName: string;
  userEmail: string;
  region: string;
  provider: 'AWS' | 'GCP' | 'Azure';
  clusterName: string;
  clusterStatus: 'Running' | 'Stopped' | 'Starting';
  catalogOptions: string[];
  selectedCatalog: string;
  databaseOptions: string[];
  selectedDatabase: string;
}

interface WorkspaceHeaderProps {
  context: WorkspaceContext;
  onCatalogChange: (catalog: string) => void;
  onDatabaseChange: (database: string) => void;
  onSettingsClick: () => void;
}
```

---

## PART 8: DATA FLOW DIAGRAM
```
User Interaction
    ↓
React Component (onClick, onChange, etc.)
    ↓
Action/Event Handler
    ↓
State Update (Zustand/Redux)
    ↓
API Call (if needed) → Backend REST/GraphQL
    ↓
Response
    ↓
State Updated
    ↓
Component Re-render
    ↓
UI Display Updated

PART 9: STYLING APPROACH
9.1 Design Tokens

Color Palette:

Background: #1a1a1a (dark)
Text Primary: #ffffff
Text Secondary: #999999
Accent: #5b5df5 (purple)
Success: #22c55e (green)
Error: #ef4444 (red)
Warning: #f59e0b (amber)


Typography:

Font Family: -apple-system, BlinkMacSystemFont, "Segoe UI"
Base Size: 14px
Headings: 18-24px


Spacing: 8px base unit (8, 16, 24, 32, 48px)
Border Radius: 4-8px
Shadows: Subtle dark shadows for depth

9.2 Component Styling Examples

Buttons: 8px padding, 4px radius, hover opacity shift
Inputs: 12px padding, 4px border, focus ring
Tree Items: 8px vertical padding, hover background #2a2a2a
Dropdowns: Inline style, chevron rotates 180° when open


PART 10: EDGE CASES & CONSIDERATIONS
10.1 Empty States

"No views yet" → Show placeholder with action link
Large table lists → Use virtualization to render only visible items
Network errors → Retry mechanism with exponential backoff

10.2 Accessibility

ARIA labels for tree items and buttons
Keyboard navigation (arrow keys for tree, Tab for inputs)
Screen reader support for status indicators
Color contrast ratios meet WCAG AA standards

10.3 Performance

Memoize tree nodes to prevent re-renders
Debounce editor changes before autosave
Use react-window for large lists
Lazy load tree children on expand

10.4 Error Handling

SQL syntax errors → Highlight in editor
Execution errors → Show error message below cell
Network errors → Show retry banner
State corruption → Log and recover gracefully


CONCLUSION
This specification provides a complete blueprint for replicating the Confluent Cloud SQL Workspace UI for Flank. The implementation uses modern React with TypeScript, Monaco Editor for SQL editing, and a component-based architecture. The technology choices prioritize performance, maintainability, and user experience, following industry best practices for cloud-based SQL development tools.
Key Takeaways for Development:

React + TypeScript foundation for type safety
Monaco Editor for professional SQL editing
Component-based, modular architecture
Proper state management (Zustand/Redux)
Performance optimizations (virtualization, memoization)
Comprehensive error handling and accessibility