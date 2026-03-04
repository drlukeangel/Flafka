Detailed Functional Requirements for Confluent UI Replication
1. WORKSPACE EXPLORER (LEFT SIDEBAR)
1.1 Tree Navigation & Expansion
Requirement: Users must be able to explore hierarchical database structure

Expand/Collapse Nodes: Click chevron icon (>) to expand, (v) to collapse

Click target area: 24x24px icon area
Smooth animation (200ms transition)
State persists during session
Keyboard support: Arrow Right to expand, Arrow Left to collapse


Multi-level Hierarchy: Support 4+ levels of nesting

Level 1: Environment/Catalog (e.g., "examples", "default")
Level 2: Database (e.g., "luke3")
Level 3: Resource Type (e.g., "Tables", "Views", "Models")
Level 4: Individual Items (e.g., specific table names)


Visual Feedback:

Indentation increases 16px per level
Hover state: Subtle background highlight (#2a2a2a)
Active/selected: Darker background + bold text
Icons scale with importance (larger for catalogs, smaller for items)



1.2 Tree Item Selection
Requirement: Users can select and interact with individual resources

Click to Select: Single click on item name highlights it

Selected state persists until another item is clicked
Visual indicator: Background color change + optional left border
Can copy selected item name (Ctrl+C)


Context Menu (Right-Click):

Show menu with options: View Details, Rename, Copy Name, Delete
Position menu at cursor location
Close menu when clicking outside or selecting option


Double-Click Action:

Tables: Open in new editor cell with SELECT * FROM table_name LIMIT 10
Views: Open definition in new cell
Models/Functions/External Tables: Open definition or metadata



1.3 Empty State Handling
Requirement: Clear indication when resource categories are empty

Display Pattern:

  ┌─ [Icon] Views
  └─ No views yet
     └─ Create a view (blue link)

Empty Message Properties:

Text color: #999999 (secondary gray)
Font style: italic or regular (not bold)
Should be clearly distinguishable from actual items


Action Links:

Text: "Create a [resource_type]"
Color: #5b5df5 (purple accent)
Click opens creation modal or wizard
Cursor changes to pointer on hover



1.4 Lazy Loading & Performance
Requirement: Handle large datasets efficiently

Load Children on Expand: Don't load table lists until user clicks expand

Show loading spinner while fetching
Cache results to avoid re-fetching
Timeout after 10 seconds with error message


Virtualization for Long Lists:

If >50 items in a category, use virtual scrolling
Only render visible items + 5 buffer items above/below
Smooth scroll performance
Maintain scroll position when collapsing/expanding


Search/Filter within Tree:

Ctrl+F to open search box at top of tree
Filter items by name (case-insensitive)
Highlight matching text within item names
Arrow keys to navigate matches
Escape to close search



1.5 Drag & Drop (Future-Ready)
Requirement: Structure supports drag-and-drop operations

Draggable Items: Tables, Views, Models (for reordering or moving)
Drop Zones: Can drop into different databases or categories
Visual Feedback:

Item becomes semi-transparent while dragging
Drop zone highlights with dashed border
Cursor shows copy/move icon


Restrictions: Some items may not be droppable (e.g., Views can't move to another DB)


2. SQL EDITOR PANEL (CENTER)
2.1 Query Editor Cell Structure
Requirement: Users can write, execute, and manage SQL statements

Cell Container:

Each SQL statement occupies one "cell"
Cells are vertically stacked and independently collapsible
White background (#ffffff) with subtle border (#e0e0e0)
Shadow underneath for depth
Min height: 80px (when collapsed), expandable to full viewport


Cell Header Section:

Fixed height: 40px
Contains controls and metadata in single row
Background: Light gray (#f5f5f5)
Flex layout: Start with buttons, end with status info



2.2 Editor Controls
Requirement: Users can manage and execute SQL statements
Add Statement Button:

Icon: Plus (+) in circle
Location: Left edge of cell header
Click behavior: Insert new empty cell above current cell
Tooltip: "Add new statement"
Keyboard shortcut: Ctrl+Shift+N (optional)
Position: Top-left corner, 8px margin

Run Button:

Text: "Run"
Style: Purple outline button (#5b5df5)
Dimensions: ~100px width, 32px height
Hover: Background fills with purple color, text becomes white
Click behavior:

Executes SQL query
Changes to loading state (spinner + "Running...")
Updates statement status below editor
Fetches and displays results


States:

Normal: Purple outline, transparent background
Hover: Purple background, white text
Loading: Spinner + "Running..." text, button disabled
Error: Red outline, shows "Error" state
Success: Green check mark, "Completed" indicator


Position: Right side of header, 8px from edge

Collapse/Expand Button:

Icon: Chevron (v when expanded, > when collapsed)
Location: Right edge of cell
Click: Collapses editor and results, shows only header
Useful for viewing multiple cells without scrolling

Info Button:

Icon: Circle with "i"
Location: Right header area, 40px from right edge
Click: Shows cell metadata (ID, created time, last modified, execution stats)
Tooltip: "Cell information"

Duplicate Button:

Icon: Two overlapping rectangles
Location: Right header area, next to info button
Click: Creates exact copy of this statement below current cell
Keyboard shortcut: Ctrl+D
Tooltip: "Duplicate statement"

Delete Button:

Icon: Trash can
Location: Far right of header
Click:

Shows confirmation dialog: "Are you sure you want to delete this statement?"
If confirmed, removes cell from workspace
Updates cell numbering


Tooltip: "Delete statement"
Dangerous action: Red icon color

2.3 SQL Editor Content Area
Requirement: Professional SQL editing with syntax highlighting
Editor Instance (Monaco Editor):

Language: SQL (with Flink SQL dialect support)
Theme: Dark theme (matching Confluent UI)
Font: Monospace (Monaco's default)
Font size: 13px (configurable in settings)
Line height: 1.6

Line Numbers:

Left margin, 40px wide
Dark background (#1a1a1a)
Light text (#999999)
Current line highlight: Subtle background
Click line number to select entire line
Double-click to select and copy

Syntax Highlighting:

Keywords (SELECT, FROM, WHERE, etc.): Blue (#569cd6)
Strings ('...'): Red (#ce9178)
Numbers: Green (#b5cea8)
Comments (--): Gray (#6a9955)
Identifiers (backticks): Purple (#c586c0)
Operators (+, -, =, etc.): Light gray (#d4d4d4)

Editor Features:

Auto-indentation: Maintains indentation on Enter
Bracket matching: Highlights matching brackets/parentheses
Auto-complete:

Triggers on typing (after 2 characters)
Shows table names, column names, SQL keywords
Case-insensitive matching
ESC to dismiss suggestions
Enter/Tab to accept suggestion


Multi-line support: Full text wrapping, scrollable horizontal
Selection: Click and drag to select text
Copy/Paste: Ctrl+C, Ctrl+V work normally
Undo/Redo: Ctrl+Z, Ctrl+Y
Find & Replace: Ctrl+H opens find/replace dialog
Go to Line: Ctrl+G
Word Wrap: Ctrl+Alt+W to toggle

Validation:

Syntax errors shown with red squiggly underline
Hover over error to see message
Error description in status bar below editor

2.4 Statement Metadata Row
Requirement: Show execution details and statement identity
Status Information:

"Start time: [ISO timestamp]"

Shows when statement execution began
Format: "2026-01-19T17:56:08.765854Z"
Only visible if statement has been executed


"Statement status: [Running|Stopped|Completed|Error]"

Status indicator dot (green for running, gray for stopped)
Click status to see detailed message
Updates in real-time for running statements


"Statement Name: [auto-generated or custom]"

Format: "workspace-2026-01-19-175600-b12dcd6b-c98d-4595-bb71-b74cacafa05c"
Can be edited (click to open inline edit)
Used for bookmarking/sharing/history
Must be unique within workspace



Save Status:

"Last saved at [time]"
Updates automatically when code changes
Auto-save every 10 seconds
Can disable auto-save in settings

2.5 Results Display
Requirement: Show query execution results
Results Container (appears below editor when executed):

Background: Light gray (#f9f9f9)
Border top: 1px solid #e0e0e0)
Max height: 300px (scrollable if longer)
Can be collapsed with chevron

Results Table:

Column headers: Row with background #e0e0e0
Column names as headers
Data rows with alternating backgrounds (#ffffff, #f5f5f5)
Hover row: Background #efefef
Scrollable horizontally if many columns
"X rows returned" indicator at bottom

Empty Results:

Message: "No results returned"
Shows execution time: "Completed in 1.234 seconds"

Error Display:

Red background (#ffe0e0)
Error message: "ERROR: [error type]"
Full error details in expandable section
"Learn more" link to documentation

Result Metadata:

Row count: "3 / 20 cells" (shown at bottom right)
Execution time
Query plan (expandable)


3. CATALOG & DATABASE SELECTION
3.1 Catalog Dropdown
Requirement: Users can switch between different catalogs
Dropdown Component:

Label: "Catalog"
Current Value: "default"
Icon: Chevron down (rotates 180° when open)
Style: Inline button style, light gray background
Dimensions: ~120px width, 36px height

Interaction:

Click to open dropdown menu
Menu appears below button
Shows list of available catalogs with checkmark for current
Click option to select (menu closes, value updates)
Keyboard: Arrow Up/Down to navigate, Enter to select, Escape to close

Styling:

Hover: Background slightly darker (#e8e8e8)
Focus: Blue outline ring
Open state: Chevron inverted, menu visible below
Option hover: Background highlight (#f0f0f0)

3.2 Database Dropdown
Requirement: Users can select database within catalog
Dropdown Component:

Label: "Database"
Current Value: "luke3"
Icon: Chevron down
Style: Matches Catalog dropdown
Dimensions: ~120px width, 36px height
Position: Right of Catalog dropdown

Behavior:

Changes when catalog changes (resets to first available DB)
Only shows databases available in selected catalog
Updates table list when changed
Filters Views, Models, Functions, External Tables by database

Dynamic Content:

Database list fetched from API after catalog selection
Shows loading spinner while fetching
Error state: "Failed to load databases" with retry button


4. WORKSPACE HEADER & CONTEXT
4.1 Workspace Information Display
Requirement: Show workspace metadata and user context
Header Layout:

Title: "workspace-2026-01-19-175600" (h1 heading)
Subtitle: Environment name "default"
User section: "Luke Angel" with "User Account" badge
Infrastructure: "AWS | us-east-1" with cluster status
All in single row, right-aligned

Workspace Title:

Font size: 24px, bold
Color: #1a1a1a
Hover: Shows copy button
Click: Can rename (opens inline edit dialog)

User Account Badge:

Background: Blue (#2563eb)
Text: White, 12px bold
Padding: 4px 8px
Border radius: 4px
Shows on hover: Tooltip with email and role

Cluster Status Indicator:

Dot icon before text
Colors:

Green: Running
Orange: Starting
Red: Stopped
Gray: Unknown


Text: "Running" or status name
Click: Shows cluster details modal

Settings Icon:

Location: Top right corner
Click: Opens workspace settings panel
Icon: Gear (⚙)
Tooltip: "Workspace settings"

4.2 Workspace Settings
Requirement: Configure workspace behavior
Settings Panel (side panel or modal):

Title: "Workspace Settings"
Sections:

General

Workspace name (text input)
Description (textarea)
Owner (display only)


Execution

Auto-execute on cell creation (toggle)
Statement timeout: [seconds input]
Results limit: [number input]


Editor

Font size (8-16px slider)
Theme (dark/light radio)
Auto-save interval (dropdown: 5s, 10s, 30s, manual)
Show line numbers (toggle)
Word wrap (toggle)


Advanced

SQL dialect (dropdown)
Default schema
Custom variables




Save button: "Save Settings"
Close button or click outside to close


5. RESOURCE MANAGEMENT
5.1 Tables
Requirement: Browse and interact with database tables
Table List:

Location: Under "Tables" section in selected database
Each item shows:

Table icon
Table name (clickable)
Hover: Shows row count, last modified date
Right-click: Context menu with options



Table Actions:

Click Name: Open table definition and metadata

Shows column names, types, constraints
Shows indexes, primary keys
Shows sample data (first 10 rows)


Double-Click: Insert into editor

Creates new cell: SELECT * FROM [database].[table] LIMIT 10
Automatically runs


Refresh Icon (next to Tables header):

Reload table list from database
Shows loading spinner
Keyboard shortcut: F5


Add Table (+) icon:

Opens "Create Table" wizard
Fields: Name, columns (add/remove), types, constraints
Submit creates table and adds to list


Info Icon:

Shows table metadata (size, row count, creation date, last modified)
Opens in tooltip or expandable section



5.2 Views
Requirement: Manage database views
Views List:

Similar to tables, but with view-specific actions
Icon: Different from table icon (e.g., window/viewport icon)
Can have >0 views or empty state

View Actions:

Click Name: Open view definition SQL

Shows as read-only in modal or panel


Double-Click: Insert into editor

Creates new cell: SELECT * FROM [view_name]


Create a View link:

Opens wizard with SQL editor
Can write custom SQL or use query builder
Validates SQL before creation
Submit creates view in database


Refresh: Reload list from database
Delete: Remove view from database (with confirmation)

5.3 Models
Requirement: Manage ML models for inference
Models List:

Shows registered models (ML models, usually from external providers)
Icon: Neural network or model icon
Can be empty

Model Actions:

Click Name: View model details

Provider (OpenAI, Bedrock, Azure ML, etc.)
Inputs/outputs specification
Configuration parameters
Status: Ready, Training, Failed


Create a Model link:

Opens creation wizard
Fields: Name, provider, task type (classification, generation, etc.)
Credentials/connection setup
Test inference before saving


Use in Query: Insert into editor

Template: SELECT sentiment FROM MODEL(model_name, SELECT ...)


Delete: Remove model registration

5.4 Functions
Requirement: Manage custom functions and UDFs
Functions List:

Custom SQL functions or User-Defined Functions (UDFs)
Icon: Function/formula icon
Can be empty

Function Actions:

Click Name: View function definition

Shows SQL code
Shows parameters and return type
Shows when created/modified


Create a Function link:

Opens editor with function template
Fields: Name, parameters (type), return type, function body
Syntax validation
Submit compiles and registers


Test Function: Run with sample inputs

Open test panel with input fields
Execute and see results


Delete: Remove function

5.5 External Tables
Requirement: Manage connections to external data sources
External Tables List:

Tables that reference external systems (S3, Kafka, etc.)
Icon: External link icon
Can be empty

External Table Actions:

Click Name: View external connection details

Source system (S3, Kafka, etc.)
Connection parameters
Schema/structure
Data location/topic


Create an External Table link:

Opens wizard
Step 1: Select data source type
Step 2: Connection details and authentication
Step 3: Schema mapping
Step 4: Preview data
Step 5: Save


Refresh Schema: Re-scan external source for schema changes
Delete: Remove external table definition


6. CELL MANAGEMENT
6.1 Adding Cells
Requirement: Users can create new SQL statement cells
Method 1: Plus Button:

Click + button in any cell header
New empty cell inserted above current cell
Cursor automatically focused in new editor
Cell auto-numbered

Method 2: Keyboard Shortcut:

Ctrl+Shift+N creates new cell at end
Enters insert mode automatically

Method 3: Context Menu:

Right-click in editor area
Select "Insert Cell Above/Below"

Method 4: Double-Click Tree Item:

Double-click a table, view, or function
Automatically creates new cell with appropriate SQL template
Cell is pre-populated and ready to edit

6.2 Reordering Cells
Requirement: Users can change cell order
Drag & Drop:

Click and hold cell header
Drag to new position (visual guide shows drop location)
Release to drop

Cut & Paste:

Ctrl+X to cut cell
Click at target position
Ctrl+V to paste

Keyboard Navigation:

Alt+Up Arrow: Move cell up
Alt+Down Arrow: Move cell down

6.3 Duplicating Cells
Requirement: Copy existing statement to create variation
Duplicate Button:

Click duplicate icon in cell header
Creates exact copy directly below current cell
Same code, but new statement ID
Can edit independently

Keyboard:

Ctrl+D while focused in cell

6.4 Deleting Cells
Requirement: Remove unwanted statements
Delete Button:

Click trash icon in cell header
Confirmation dialog appears
Dialog: "Are you sure you want to delete this statement?"
Options: Cancel, Delete
If deleted, cell removed and cell numbers updated

Keyboard:

Ctrl+Shift+Delete to delete current cell

Undo:

Ctrl+Z restores deleted cell (within session)


7. SQL EXECUTION & RESULTS
7.1 Statement Execution
Requirement: Run SQL queries against database
Execution Flow:

User writes SQL in editor
User clicks "Run" button
Button changes to loading state ("Running...")
SQL sent to backend API
Backend executes against Flink SQL engine
Results returned to frontend
Results displayed in results area below editor
Execution time and row count shown
Status changes to "Completed"

Execution Context:

Current catalog/database automatically included in query path
Tables referenced with full qualified name: catalog.database.table
Timeout: 5 minutes (configurable in settings)
Max result rows: 10,000 (configurable)

Concurrent Execution:

Multiple cells can run simultaneously
Each has independent status indicator
"Stop" button appears while running (to cancel)

7.2 Results Display
Requirement: Show query results in readable format
Table Results:

HTML table with:

Sticky header (scrolls with content)
Column names as headers
Data rows with alternating row colors
Scrollable both horizontally and vertically
Column resize handles (drag column border)
Column sort (click header to sort ascending/descending/unsorted)
Column filter (click filter icon in header)



Results Information:

Row count: "1,234 rows returned"
Execution time: "2.345 seconds"
Data size: "2.3 MB"
Query plan (expandable): Shows Flink execution plan

Results Actions:

Export:

Format options: CSV, JSON, Parquet, Excel
Click export button in results header
File downloads to computer


Copy as Table: Copy results as markdown table

Ctrl+Shift+C in results area


View as JSON: Toggle results format

Shows JSON array representation


Full Screen: Expand results to full window

ESC to close



No Results:

Message: "Query executed successfully. No rows returned."
Execution time still shown

7.3 Error Handling
Requirement: Display and explain SQL errors
Error Display:

Results area shows red background
Error message in bold red text
Full error details below (may be very long)
Expandable sections for stack trace, suggestions

Common Errors:

Syntax errors: Shows "Syntax error near [token]" with position
Table not found: "Table not found: [table_name]" with suggestions
Column not found: Similar to table errors
Type mismatch: "Cannot apply [operator] to [type1] and [type2]"
Permission denied: Shows user role and required permissions

Error Actions:

Learn More: Link to documentation for error type
Fix Suggestion: AI-generated hint (if available)
Report Bug: Send error details to support


8. PERSISTENCE & AUTO-SAVE
8.1 Auto-Save
Requirement: Automatically save statement content
Auto-Save Behavior:

Saves every 10 seconds after changes (configurable: 5s, 10s, 30s)
Shows "Saving..." indicator briefly
Updates "Last saved at" timestamp
No explicit Save button needed (but Ctrl+S works)

Conflict Resolution:

If workspace edited in another tab/window, shows warning
"This workspace has been modified elsewhere"
Options: Reload, Merge, Keep Local

8.2 Version History
Requirement: Track changes and allow rollback
Access History:

Click workspace name → "View History" option
Shows list of saved versions with timestamps
Can preview each version
Click to load/restore old version

Version Information:

Timestamp: When saved
Author: User who made changes
Change summary: (auto-generated)
Diff view: Shows what changed


9. SEARCH & FILTERING
9.1 Global Search
Requirement: Find resources across workspace
Search Bar (top of left sidebar):

Icon: Magnifying glass
Placeholder: "Search tables, views, models..."
Searches across all databases
Real-time as user types

Search Results:

Grouped by type (Tables, Views, Models, Functions, External Tables)
Shows matches with context (database name)
Click result to navigate and select it
ESC to close search results

Keyboard Shortcut:

Ctrl+F to focus search box
Arrow keys to navigate results
Enter to select

9.2 Filter by Resource Type
Requirement: Show only specific resource categories
Filter Buttons (above tree):

Tabs: All, Tables, Views, Models, Functions, External
Click to toggle visibility
Can select multiple filters
Updates tree display instantly


10. KEYBOARD SHORTCUTS
Table of Shortcuts:
ActionShortcutNew CellCtrl+Shift+NRun CellCtrl+EnterDuplicate CellCtrl+DDelete CellCtrl+Shift+DeleteFind & ReplaceCtrl+HGo to LineCtrl+GSaveCtrl+SUndoCtrl+ZRedoCtrl+YGlobal SearchCtrl+FStop ExecutionCtrl+Shift+XExpand Tree NodeRight ArrowCollapse Tree NodeLeft ArrowMove Cell UpAlt+UpMove Cell DownAlt+DownFocus EditorCtrl+1Focus TreeCtrl+2Word Wrap ToggleCtrl+Alt+WToggle Line NumbersCtrl+Alt+L

11. NOTIFICATIONS & FEEDBACK
11.1 Toast Notifications
Requirement: Provide user feedback for actions
Types:

Success: Green background, checkmark icon

"Statement saved successfully"
"Cell deleted"
"Results copied to clipboard"


Error: Red background, X icon

"Failed to save statement"
"SQL execution error"
"Network error - retrying..."


Warning: Orange background, ! icon

"This workspace is read-only"
"Results may be truncated (10,000 row limit)"


Info: Blue background, i icon

"Execution took X seconds"
"Y rows returned"



Behavior:

Appear in bottom-right corner
Auto-dismiss after 5 seconds (or on click)
Stack vertically if multiple appear
Don't block interaction

11.2 Status Indicators
Requirement: Show ongoing processes
Spinning Loader:

Shows during data fetches, execution
Text "Loading..." or "Executing..."
Center of relevant area

Progress Bar:

For multi-step operations (create external table wizard)
Shows percent complete
Step indicator

Inline Validation:

Red squiggly underline for SQL syntax errors
Tooltip on hover with error message


12. RESPONSIVE BEHAVIOR
12.1 Desktop (1920x1080)

Full three-column layout
All controls visible
No horizontal scroll needed

12.2 Tablet/Laptop (1366x768)

Left sidebar can collapse to icons only
Editor takes up remaining space
Dropdowns adjust width as needed

12.3 Small Laptop (1024x768)

Left sidebar auto-collapses to icon-only view
Chevron icon to expand temporarily (hover reveals labels)
Editor full width
Results panel may overlay editor

12.4 Responsiveness Rules

Never hide critical controls
"Run" button always visible
Tree search always accessible
Results can be collapsed
Header remains sticky at top


13. ACCESSIBILITY REQUIREMENTS
13.1 Keyboard Navigation

All interactive elements reachable via Tab/Shift+Tab
Tab order: Navigation → Tree → Editor → Controls
Focus visible (blue outline ring)
Modals trap focus

13.2 Screen Reader Support

All buttons have aria-label
Tree items have role="treeitem" with aria-expanded
Status indicators have aria-live="polite"
Tables have proper thead/tbody structure
Form labels associated with inputs

13.3 Color Contrast

All text meets WCAG AA standard (4.5:1 ratio)
Status colors not the only indicator (use icons + text)
Links underlined or clearly distinguished

13.4 Focus Management

Focus moves to new cell when created
Focus moves to error message on validation fail
Modals return focus to trigger when closed


14. SECURITY & PERMISSIONS
14.1 Read-Only Mode
Requirement: Support read-only workspaces
Indicators:

"Read-only demo" badge next to workspace name
Edit controls disabled (Run button disabled)
Delete buttons hidden
Create buttons hidden

Behavior:

Can still view code
Can still run SELECT queries (if allowed by backend)
Cannot modify statements
Cannot execute DDL (CREATE, ALTER, DROP)

14.2 Permission-Based UI
Requirement: Show only available actions
Backend Provides:

canExecute: Can run SQL
canCreateTable: Can create tables
canCreateView: Can create views
canDeleteResource: Can delete resources
etc.

UI Updates:

Disable/hide buttons based on permissions
Show warning: "You don't have permission to [action]"
Lock icon next to disabled features


15. DATA EXPORT & SHARING
15.1 Export Statement
Requirement: Save statement code for external use
Export Options:

Download as .sql file
Copy to clipboard
Share link (generates shareable URL)
Export as JSON (includes metadata)

15.2 Export Results
Requirement: Save query results
Formats:

CSV (click "Export" in results header)
JSON
Excel (.xlsx)
Parquet (for big data)

Behavior:

All rows exported (not limited to visible)
Column order preserved
Data types preserved where applicable
Download to default Downloads folder

15.3 Share Workspace
Requirement: Collaborate with team members
Share Button:

Location: Workspace header (next to settings)
Opens share dialog:

Copy shareable link
Add team members (by email)
Set permissions: View, Edit, Admin
Revoke access



Share Link Behavior:

Read-only by default (unless configured)
Can set expiration date
Can track who accessed link


This completes the comprehensive functional requirements specification. Each requirement is now detailed enough for developers to understand exactly what the feature should do, how it should behave, and what edge cases to handle.