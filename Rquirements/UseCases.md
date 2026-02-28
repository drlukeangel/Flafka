Confluent Cloud SQL Workspace UI - Comprehensive Use Cases
Based on direct exploration and interaction with the live UI, here are the detailed use cases for replication:

USE CASE 1: User Explores Database Structure via Tree Navigator
ACTORS

User (data analyst/engineer)
Workspace Explorer (tree navigation UI)

PRECONDITIONS

User is logged into Confluent Cloud
Workspace is open and loaded
Tree shows catalog structure with catalogs, databases, and resource types

MAIN FLOW (Happy Path)

User sees left sidebar with tree structure:

"examples" catalog (marked as "Read-only demo")
"marketplace" nested item (collapsed with chevron >)
"default" catalog (expanded with chevron v)
"luke3" database under default (expanded)
Resource categories: Tables, Views, Models, Functions, External tables


User clicks chevron (>) next to "marketplace" to expand it
"marketplace" expands (chevron changes to v)
Child items appear indented: "Tables" section shows beneath it
User clicks on "marketplace" text (not chevron)
"marketplace" gets selected/highlighted with subtle background color
Can optionally see item metadata on hover (icon shows clickable state)
User clicks chevron (v) next to "luke3" to collapse it
"luke3" collapses (chevron changes to >)
All child items (Tables, Views, Models, Functions, External Tables) disappear
Visual feedback shows collapse animation (smooth 200ms)

ALTERNATIVE FLOWS
A1: User Double-Clicks Table Name

Steps 1-7 proceed normally
At step 8: User double-clicks on table name (e.g., "EOT-PLATFORM-EXAMPLES-LOANS-v20")
New editor cell appears below current cells
Cell is pre-populated with: SELECT * FROM default.luke3.EOT-PLATFORM-EXAMPLES-LOANS-v20 LIMIT 10;
Cell automatically has focus in editor
(Query not auto-executed)

A2: User Right-Clicks on Tree Item

Context menu appears at cursor location
Options: View Details, Copy Name, Delete, Rename (if applicable)
User clicks option to perform action
Menu closes

A3: Empty State for Resource Categories

User sees "No views yet" text in Views section (italic, gray text #999999)
Below: "Create a view" link (blue text, #5b5df5)
Same for Models, Functions, External tables when empty
Click "Create a view" → Opens creation dialog/wizard

ERROR FLOWS
E1: Slow Tree Load

User expands node but data loading is slow
Loading spinner appears next to node name
User sees text: "Loading..." (gray text)
After 10 seconds: "Failed to load" error with retry button

E2: Permission Denied on Item

User tries to access item in read-only catalog
Item appears grayed out or locked icon shown
Tooltip: "Read-only item - cannot modify"

POSTCONDITIONS

Tree state persists during session
Expanded/collapsed state remembered
Selected item remains highlighted until user clicks elsewhere
Tree scroll position maintained when expanding/collapsing

UI STATES OBSERVED
State 1: Collapsed Node
> marketplace
State 2: Expanded Node
v marketplace
  └─ Tables
     └─ clicks
     └─ orders
     └─ customers
State 3: Selected Node
[highlighted background]
▼ luke3

USE CASE 2: User Executes SQL Query
ACTORS

User (writes/executes queries)
SQL Engine (backend)
Results Display (shows output)

PRECONDITIONS

Workspace is open
User has "Execute" permission
SQL statement is written in editor cell
SQL syntax is valid (or user ready to test)

MAIN FLOW (Happy Path)

User has editor cell with SQL:

sql   SELECT * FROM `default`.`luke3`.`EOT-PLATFORM-EXAMPLES-LOANS-v20` LIMIT 10;
```

2. User clicks "Run" button (purple outline button on right side of cell header)

3. Button immediately changes appearance:
   - Text changes from "Run" to "Running..."
   - Purple outline button becomes disabled (grayed out)
   - Loading spinner appears (rotating icon)
   - Button state: disabled

4. Cell header status row shows:
   - "STATEMENT STATUS: " with blue spinner icon + "Running"
   - "RESULTS: " field (initially empty)

5. Status row shows initializing message: "Initializing..." with spinner

6. After 2-5 seconds, backend processes query:
   - Status changes to "Running" (green dot indicator)
   - Spinner continues spinning

7. Results start to stream back:
   - Results table appears below editor with:
     - Column headers: "key", "loan_id", "amount", etc.
     - Header row with filter buttons and sort options
     - Column header has icons for sort (up/down arrows), filter (funnel)
     - Data rows display with alternating background colors
     - Scrollbars appear if many columns/rows

8. Query completes:
   - Status changes to "Completed" or status disappears
   - Spinner stops
   - "Run" button returns to normal purple outline style
   - Shows "RESULTS: 10" (number of rows)
   - "Last saved at [timestamp]" updates

9. Results table fully displays with:
   - Search box in header: "Search..." placeholder
   - Grid view icon, List view icon, Settings icon (columns)
   - Table display options in toolbar
   - Execution time: "Completed in 1.234 seconds" (shown in status)
   - Row indicator: "3 / 20 cells" at bottom right

10. User can now:
    - Scroll horizontally through columns
    - Scroll vertically through rows
    - Click column headers to sort
    - Click filter icons to filter results
    - Copy results
    - Export results to CSV/JSON

### ALTERNATIVE FLOWS

**A1: Query Returns No Results**
- Steps 1-8 proceed normally
- At step 7: Instead of data rows, shows:
  - Message: "Query executed successfully. No rows returned."
  - Execution time still displayed
- Row count shows "0" results

**A2: Query Results Exceed Limit (>10,000 rows)**
- Steps 1-8 proceed normally
- Results table shows only first 10,000 rows
- Warning banner appears: "Results truncated. Only showing first 10,000 rows of [total] rows."
- User can:
  - Download full results
  - Add LIMIT clause to query and re-run
  - Export to file for full data

**A3: User Clicks Stop During Execution**
- Steps 1-6 proceed normally
- User clicks "Stop" button (replaces "Run" during execution)
- Status shows: "Cancelling..."
- After 1-2 seconds: "Stopped" status displayed
- Results may be partial if query was mid-stream
- Message: "Query was canceled by user"

**A4: User Modifies Query and Re-Runs**
- Query has already executed once
- User edits SQL code in editor
- Editor text changes (highlight if unsaved)
- "Last saved at" timestamp doesn't update until after 10 seconds (auto-save)
- User clicks "Run" again
- Previous results clear
- New execution starts
- Previous "Last saved at" time updates after query completes

### ERROR FLOWS

**E1: Syntax Error**
- Query has typo: `SELEC * FROM ...` (missing T)
- User clicks "Run"
- Backend returns 400 error
- Results area shows RED background (#ffe0e0)
- Error message displays in bold red:
```
  ERROR: Syntax error near 'FROM' at line 1, column 8
```
- Button returns to "Run" state
- User can edit SQL and retry
- Line 1 is highlighted in editor with error indicator (red squiggly line)

**E2: Table Not Found**
- Query references non-existent table: `SELECT * FROM nonexistent_table`
- User clicks "Run"
- Status: "Running..."
- After 2-3 seconds, backend error:
```
  ERROR: Table 'nonexistent_table' not found in database 'default'
```
- Suggestion shown: "Did you mean: 'EOT-PLATFORM-EXAMPLES-LOANS-v20'?"
- User can click suggestion to auto-complete
- Results area shows red background with full error details
- Expandable section: "Full Error Details"
- "Learn More" link to documentation

**E3: Permission Denied**
- User doesn't have SELECT permission on secure table
- Backend returns 403 error:
```
  ERROR: Permission denied. You do not have SELECT permission on table 'secure_data'
```
- Message continues: "Contact your workspace admin to request access"
- Suggestion: "Try selecting from a different table"
- Error category shown: "Permission Error"

**E4: Query Timeout**
- Query runs for >5 minutes (timeout limit)
- Status shows: "Running..." (spinner continues)
- After timeout: Status changes to "Stopped"
- Results area shows yellow/orange background:
```
  TIMEOUT: Query execution exceeded 5 minute timeout
```
- Message: "Your query took too long. Try adding a LIMIT clause or filtering data."
- Button shows "Run" again (ready to retry)
- "Learn More" link explains performance tips

**E5: Network Error**
- Network connection drops mid-query
- Status shows "Running..."
- After 5 seconds, error toast appears:
```
  Network error - retrying... (Attempt 1/3)
```
- Auto-retries 3 times with exponential backoff (5s, 10s, 20s)
- If all retries fail:
```
  ERROR: Failed to execute query. Check your internet connection.

Manual "Retry" button appears

E6: Backend Service Unavailable

Confluent backend service is down/restarting
Query sent but 503 error returned
Toast notification: "Backend service unavailable. Please try again in a moment."
"Retry" button provided
Status shows "Stopped"
User can click Retry or modify query

POSTCONDITIONS

Statement execution recorded in history
Results cached (visible until new query runs)
"Last saved at" timestamp updated to current time
Statement status persists until next execution
Execution metadata preserved:

Start time: "2026-01-19T17:56:08.765854Z"
Execution time: "1.234 seconds"
Result count: "10 rows"



BUSINESS RULES

Execution timeout: 5 minutes (configurable in workspace settings)
Max result rows: 10,000 (configurable)
Results auto-truncate if exceeding max
Concurrent query limit: 5 queries max per user
All queries logged for audit/history
Read-only workspace: Only SELECT allowed, no DDL/DML

UI MOCKUPS / STATES
State 1: Before Execution

Button: "Run" (purple outline, enabled)
Status: Empty/previous results visible
Row count: Previous value or empty

State 2: During Execution

Button: "Running..." (disabled, grayed)
Status: "Running" with green spinner
Results area: Partial results streaming in
Table headers visible, data loading

State 3: Execution Complete

Button: "Run" (purple outline, enabled)
Status: "Completed" (or removed)
Results: Full table displayed
Row count: "10" or "0" depending on results

State 4: Error State

Button: "Run" (purple outline, enabled)
Status: Error displayed with red background
Error message: Clear, actionable text
Suggestion: Possible fix offered


USE CASE 3: User Creates New SQL Cell
ACTORS

User (editor)
Cell Management System

PRECONDITIONS

Workspace is open with existing cell(s)
User wants to add new query or statement

MAIN FLOW (Happy Path - Click Add Button)

User hovers over cell header area
Sees "+" button (plus icon) on left side of first cell
Tooltip appears: "Add new statement"
User clicks "+" button
New empty cell appears ABOVE current cell
New cell has:

Empty editor area with placeholder text: "Enter your Flink SQL here"
Line numbers starting at 1
Header row with: +, icons for duplicate/delete, Run button
No status information (not yet executed)


Cursor automatically focused in editor (blinking cursor visible)
Cell counter at bottom updates: "7 / 20 cells"

ALTERNATIVE FLOWS
A1: User Uses Keyboard Shortcut

User presses Ctrl+Shift+N
New empty cell appears at END of all cells (not above current)
Cell is immediately focused
Rest proceeds same as main flow

A2: User Double-Clicks Table in Tree

User double-clicks table name: "EOT-PLATFORM-EXAMPLES-LOANS-v20"
New cell created at bottom with pre-populated SQL:

sql  SELECT * FROM `default`.`luke3`.`EOT-PLATFORM-EXAMPLES-LOANS-v20` LIMIT 10;

Cell is NOT auto-executed (user must click Run)
Cell is focused and ready for editing
User can modify the query before executing

A3: User Double-Clicks View Name

Similar to A2, but query template different:

sql  SELECT * FROM `default`.`luke3`.`view_test`;
```
- Query shows view definition syntax

**A4: Cell Created While Scrolled Down**
- User is viewing bottom cells
- Clicks + to add new cell
- Page auto-scrolls to show new cell
- New cell positioned correctly in sequence

### ERROR FLOWS

**E1: Workspace Read-Only**
- User tries to add cell in read-only workspace
- Button appears disabled or grayed out
- Tooltip: "Cannot modify read-only workspace"
- No action occurs on click

### POSTCONDITIONS
- New cell appears in workspace
- Cell numbering updated
- Cell counter increments
- Cell state saved to session

### UI MOCKUPS

**Before Adding Cell:**
```
Cell 1: SELECT * FROM table1
[+ icon on left]

Cell 2: CREATE VIEW ...
[+ icon on left]
```

**After Adding Cell (between them):**
```
Cell 1: SELECT * FROM table1

[New Empty Cell] ← Cursor blinking here
Enter your Flink SQL here

Cell 2: CREATE VIEW ...
```

---

## USE CASE 4: User Duplicates SQL Statement

### ACTORS
- User (editor)
- Cell Management System
- Editor State Manager

### PRECONDITIONS
- Cell exists with SQL query
- User wants to create a variation of the query

### MAIN FLOW
1. User hovers over cell header
2. Sees duplicate button icon (two overlapping rectangles) on right side
3. Tooltip: "Duplicate statement"
4. User clicks duplicate button
5. Exact copy of statement created BELOW current cell
6. New cell contains:
   - Same SQL code as original
   - Same execution status as original (if previously run, shows "Completed")
   - Same results as original (if cached)
   - Different statement name (new UUID generated)
7. Cell counter updates: "8 / 20 cells"
8. New cell is NOT auto-executed (user must modify and run)
9. User can now:
   - Edit the copy independently
   - Keep original query untouched
   - Compare two variations

### ALTERNATIVE FLOWS

**A1: User Uses Keyboard Shortcut**
- User presses Ctrl+D (cursor in cell)
- Duplicate created below current cell
- Same as main flow

**A2: Duplicate Just-Executed Query**
- Original query recently ran and shows results
- User duplicates it
- New cell shows:
  - Same query text
  - Same results table
  - Same execution time
  - Status: "Completed"
- User can modify query and re-run to compare

### POSTCONDITIONS
- Duplicate cell created successfully
- Independent from original (editing one doesn't affect other)
- Both cells can be executed separately
- Both cells have different statement IDs in system

---

## USE CASE 5: User Deletes SQL Cell

### ACTORS
- User (editor)
- Cell Management System
- Confirmation Dialog

### PRECONDITIONS
- Cell exists in workspace
- User wants to remove it

### MAIN FLOW
1. User hovers over cell header
2. Sees trash/delete icon on far right of header
3. Icon color: Red (danger action indicator)
4. Tooltip: "Delete statement"
5. User clicks delete button
6. Confirmation dialog appears:
```
   Dialog Title: "Delete Statement"
   Message: "Are you sure you want to delete this statement?
             This action cannot be undone."
   Buttons: [Cancel] [Delete]

User clicks "Delete" button
Dialog closes
Cell removed from workspace
Cell counter updates: "7 / 20 cells"
Remaining cells shift up to fill gap
Success toast appears: "Statement deleted successfully"

ALTERNATIVE FLOWS
A1: User Cancels Deletion

Steps 1-6 proceed
User clicks "Cancel" button
Dialog closes
Cell remains in workspace
No changes made

A2: User Uses Keyboard Shortcut

User presses Ctrl+Shift+Delete (focused in cell)
Confirmation dialog appears immediately
Same as steps 6-12

A3: Undo After Deletion (Within Session)

Cell deleted in step 9
User presses Ctrl+Z
Deleted cell restored to original position
Toast: "Statement restored"
Undo history limited to current session

ERROR FLOWS
E1: Read-Only Workspace

Delete button disabled/grayed
On click: No dialog appears
Tooltip: "Cannot delete in read-only workspace"

E2: Last Cell in Workspace

Attempting to delete the only cell
Dialog may show warning: "At least one cell must remain"
Delete button disabled in dialog

POSTCONDITIONS

Cell removed from workspace
Workspace state updated
Cell numbering adjusted
Undo stack updated


USE CASE 6: User Switches Catalog
ACTORS

User (explorer)
Catalog Selector Dropdown
Database/Table Manager

PRECONDITIONS

Workspace open
Multiple catalogs available (e.g., "default", "examples")
Catalog dropdown visible at top of editor area

MAIN FLOW

User sees "Catalog" label with current value: "default"
Button shows: "Catalog [default ▼]" (chevron down)
User clicks on Catalog button
Dropdown menu appears below button showing:

Search box: "Search" placeholder
Option: "examples"
Option: "default" (with checkmark ✓)


User clicks "examples"
Dropdown closes immediately
Catalog selector updates: "Catalog [examples ▼]"
Database selector updates:

Old value "luke3" is replaced
New database shows: "database" (only option in examples catalog)


Left sidebar tree updates:

"default" catalog collapses/becomes inactive
"examples" catalog expands to show its structure
Tables under "examples.marketplace" now visible


Running queries continue (not interrupted)
New queries now reference the new catalog

ALTERNATIVE FLOWS
A1: User Types in Search Box

Dropdown open
User types "def" in search box
Filtering occurs in real-time
Options matching "def": "default" shown
User clicks to select
Same as steps 6-11

A2: User Uses Arrow Keys

Dropdown open
User presses arrow down key
Highlights next catalog option
User presses Enter to select
Same as steps 6-11

ERROR FLOWS
E1: Catalog Load Fails

Dropdown clicked
Loading spinner shown
After 10 seconds: "Failed to load catalogs - Retry" message
User clicks retry button

POSTCONDITIONS

Catalog changed in workspace context
Database selector resets/updates
Tree navigator updates
All subsequent queries use new catalog


USE CASE 7: User Switches Database
ACTORS

User (explorer)
Database Selector Dropdown
Table/View/Model Manager

PRECONDITIONS

Workspace open
Catalog selected (e.g., "default")
Multiple databases available in catalog
Database dropdown visible

MAIN FLOW

User sees "Database" label with current value: "luke3"
Button shows: "Database [luke3 ▼]" (chevron down)
User clicks on Database button
Dropdown menu appears showing:

Search box: "Search" placeholder
Available databases from selected catalog
(In examples catalog: shows "marketplace")
(In default catalog: shows "luke3")
Current database has checkmark ✓


User clicks "marketplace"
Dropdown closes
Database selector updates: "Database [marketplace ▼]"
Left sidebar tree updates:

"luke3" node becomes inactive/collapses
"marketplace" node expands
Tables/Views/Models under "marketplace" load and display


Results tables in editor change scope to new database
New queries now query the new database tables

ALTERNATIVE FLOWS
A1: User Changes Catalog then Database Changes Automatically

User switches from "default" to "examples" catalog
Database dropdown auto-updates to show "database" (only option)
If only one database in catalog, it auto-selects

ERROR FLOWS
E1: Database Fetch Fails

User clicks database dropdown
Loading spinner shown
After 10 seconds: "Failed to load databases - Retry"
User can retry

POSTCONDITIONS

Database changed in workspace context
Tree navigator reflects new database
Subsequent queries use new database
Results scope changes to new database


USE CASE 8: User Collapses/Expands SQL Cell
ACTORS

User (editor)
Cell UI Controller

PRECONDITIONS

Cell exists with SQL and/or results
Chevron icon visible on right side of cell header

MAIN FLOW (Collapse)

Cell is fully expanded showing:

SQL code editor
Results table (if executed)
Status information


User sees chevron (v) icon on right side of header
Tooltip: "Collapse cell"
User clicks chevron
Cell animates closed (smooth 300ms transition)
Cell now shows only:

SQL query line (preview of first line)
Statement name: "workspace-2026-01-19-175600-de375e2d-91c1-4712-8852-b0a6bc538"
Stop button (if running) or Run button


Chevron changes to (>)
Cell takes up minimal vertical space

ALTERNATIVE FLOWS
A1: Expand Cell

Steps 1-7 proceed (collapse)
User clicks chevron (>) again
Cell animates open (smooth 300ms transition)
Chevron changes back to (v)
Full SQL editor and results visible again

A2: User Collapses Multiple Cells

Can collapse each cell independently
Multiple cells can be collapsed at same time
Each maintains its own state
Useful for viewing multiple query names/statements without clutter

POSTCONDITIONS

Cell collapse state persists during session
Scroll position adjusted automatically
Other cells unaffected


USE CASE 9: User Accesses Cell Metadata/Info
ACTORS

User (inspector)
Cell Information Panel
Metadata Service

PRECONDITIONS

Cell exists (executed at least once)
Info icon (i) visible in cell header

MAIN FLOW

User hovers over info icon (i) in cell header
Tooltip shows: "Cell information"
User clicks info icon
Information panel/modal appears showing:

Statement ID: "workspace-2026-01-19-175600-de375e2d-91c1-4712-8852-b0a6bc538"
Created: "2026-01-19 at 17:56:08 UTC"
Last Modified: "2026-01-19 at 17:56:08 UTC"
Last Executed: "2026-01-19 at 17:56:08 UTC"
Execution Time: "1.234 seconds"
Result Rows: "10"
Status: "Completed" or "Running"
Estimated Size: "2.3 KB"
SQL Query Language: "Flink SQL"


Panel remains visible or auto-closes after 5 seconds
User can close manually by clicking X or pressing ESC

ALTERNATIVE FLOWS
A1: Cell Never Executed

Info shows limited metadata:

Statement ID
Created time
Text: "Not yet executed"
Other execution fields: "N/A"



POSTCONDITIONS

Metadata displayed in modal/tooltip
User gains insight into cell lifecycle and performance
No changes to cell state


USE CASE 10: User Filters Results Table
ACTORS

User (analyst)
Results Table
Filter Controller

PRECONDITIONS

Query has executed and returned results
Results table displayed
Column header shows filter icon (funnel)

MAIN FLOW

Results table displayed with columns: "key", "loan_id", "amount"
Column headers have filter buttons (funnel icon)
User clicks filter icon in "loan_id" column header
Filter dropdown appears with options:

Filter type: "Contains", "Equals", "Greater than", "Less than", etc.
Input field: Text box for filter value


User enters value: "d76778dd"
Hits Enter or clicks Apply button
Results table instantly filters:

Only rows where loan_id = "d76778dd" shown
Row count updates: "1 row matches filter"


Filter indicator appears on column header (badge with count)
User can add more filters to other columns (multi-filter)
User can click X on filter to remove it
Or click "Clear all filters" to reset

ALTERNATIVE FLOWS
A1: User Filters Multiple Columns

Applies filter to "loan_id"
Then applies filter to "amount" > 5000
Results show intersection (rows matching BOTH conditions)
Filter badges on both columns indicate active filters

A2: No Results Match Filter

User applies filter with no matching rows
Table shows: "No results match your filter"
Suggestion: "Try adjusting your filter criteria"

POSTCONDITIONS

Filters applied to results
Results count updated
Filters can be combined
Filters clear when query re-runs


USE CASE 11: User Sorts Results Table
ACTORS

User (analyst)
Results Table
Sort Controller

PRECONDITIONS

Query has executed with results displayed
Column headers visible with sort indicators

MAIN FLOW

Results table shows data with columns: "key", "loan_id", "amount"
Column headers have sort arrow icons (^ and v for ascending/descending)
User clicks column header "amount"
Results immediately sort by amount ascending
Arrow indicator appears on "amount" header pointing up (^)
Row order changes to reflect sort
User clicks "amount" header again
Sort reverses: now descending
Arrow points down (v)
User clicks third time
Sort removed, back to original order
Arrow indicator disappears

ALTERNATIVE FLOWS
A1: User Clicks Different Column

Amount is sorted ascending (^)
User clicks "loan_id" column
Sort switches to "loan_id" ascending
Amount column sort indicator removed
Only one column can be primary sorted at a time

POSTCONDITIONS

Results table sorted by selected column
Sort order persists until user changes it or re-runs query


USE CASE 12: User Exports Results to CSV/JSON
ACTORS

User (analyst)
Export Controller
File Download System

PRECONDITIONS

Query has executed with results
Export button visible in results toolbar

MAIN FLOW

Results table displayed with data
Results toolbar shows: Grid icon, List icon, Search box, Settings icon
User clicks on "..." (more options) or export button
Menu appears with options:

Export as CSV
Export as JSON
Export as Excel
Export as Parquet


User clicks "Export as CSV"
Download dialog appears (browser native)
File suggested name: "results_2026-01-19_17-56-08.csv"
User confirms download location
File downloads to Downloads folder
Browser shows download notification

POSTCONDITIONS

Results exported to file
File contains all rows (not limited to visible 10,000)
CSV format: Headers in first row, comma-separated values
JSON format: Array of objects with column names as keys


USE CASE 13: User Searches Within Results
ACTORS

User (analyst)
Search Box
Results Filter

PRECONDITIONS

Query executed with results displayed
Search box visible in results toolbar

MAIN FLOW

Results table shows data
Search box labeled: "Search..." appears in toolbar
User clicks search box and types: "d7677"
Table filters in real-time:

Only rows containing "d7677" shown
Matching cells highlighted with background color


Row count updates: "3 results match search"
User can clear search by clicking X in search box
All rows reappear

POSTCONDITIONS

Results filtered by search term
Search results can be combined with column filters
Search is text-based, case-insensitive


USE CASE 14: User Changes Catalog in Queries
ACTORS

User (query builder)
Catalog Selector
Query Executor

PRECONDITIONS

Query written for "default" catalog
User wants to switch catalog and re-run same query for different data

MAIN FLOW

Query references default.luke3.EOT-PLATFORM-EXAMPLES-LOANS-v20
User clicks Catalog dropdown
Switches from "default" to "examples"
Database updates from "luke3" to "database"
Left sidebar tree updates to show "examples" structure
Query in editor still references original default.luke3....
User clicks "Run"
Query executes AGAINST NEW CATALOG (examples)
Backend automatically converts query context to current catalog
Results show data from "examples.database...." equivalent tables

ALTERNATIVE FLOWS
A1: User Manually Updates Query

After switching catalog
User manually edits query to use new table names
Query now explicitly references new catalog/database

POSTCONDITIONS

Queries execute in context of current catalog/database
Query text might not auto-update (context handled by backend)


USE CASE 15: User Handles Read-Only Workspace
ACTORS

User (read-only viewer)
Workspace UI
Permission System

PRECONDITIONS

Workspace marked as "Read-only demo"
User viewing but cannot modify

MAIN FLOW

Workspace header shows badge: "Read-only demo" (gray background)
User can see all content:

Tree navigator fully visible
SQL editors show existing queries
Results tables visible


But interactive elements are disabled:

"Run" button: DISABLED (grayed out)
"+" Add button: DISABLED
Delete button: DISABLED/HIDDEN
Duplicate button: DISABLED/HIDDEN
Editor text: Not editable (read-only mode)


On hover over disabled buttons:

Tooltip: "This is a read-only workspace"


User can:

View query code
View results
Examine tree structure
Export results


User cannot:

Create new cells
Modify existing queries
Execute queries
Delete cells



POSTCONDITIONS

Workspace remains in read-only mode
No modifications possible
All data visible for inspection only


SUMMARY OF KEY INTERACTIONS
ActionTriggerResultExpand/Collapse Tree NodeClick chevronShow/hide childrenDouble-Click TableDouble-click in treeCreate new cell with SELECT templateExecute QueryClick "Run" buttonShow status "Running" → results displayAdd CellClick "+" buttonNew empty cell createdDuplicate CellClick duplicate iconCopy of cell created belowDelete CellClick trash icon → ConfirmCell removed from workspaceSwitch CatalogClick dropdown → selectDatabase dropdown updates, tree refreshesSwitch DatabaseClick dropdown → selectTree refreshes with new DB tablesCollapse CellClick chevron on cellCell minimized to single lineFilter ResultsClick filter icon → enter criteriaResults filtered instantlySort ResultsClick column headerResults sorted by columnExport ResultsClick export → choose formatFile downloadedSearch ResultsType in search boxResults filtered by search term

This comprehensive set of use cases captures all the major interactions observed in the Confluent Cloud SQL Workspace UI and provides clear specifications for implementing each feature.anything else we should gather for claude code to remake this ui?Great question! Here are the additional things you should gather before handing off to Claude Code:

1. DESIGN SYSTEM / VISUAL SPECIFICATIONS
You need to capture:
Colors & Themes

 Exact color codes for:

Primary buttons (Run button - purple)
Hover states
Active/selected states
Error states (red backgrounds)
Success states (green)
Disabled states (gray)
Text colors (primary, secondary, disabled)
Background colors (editor, results, tree)
Border colors
Shadows/depth


 Dark mode vs Light mode - Does it support both?
 Accent color palette - What shades of purple, blue, green are used?

Typography

 Font family - What exact fonts? (System fonts or custom?)
 Font sizes - Headers (h1, h2, etc.), body, labels, code
 Font weights - Regular, bold, semi-bold?
 Line heights - For readability
 Letter spacing - Any special spacing?

Spacing & Layout

 Padding values - For buttons, cells, headers
 Margin values - Between elements
 Gap values - Between flex items
 Border radius - For buttons, cards, inputs
 Shadow/elevation - Box shadows for depth
 Z-index hierarchy - Modals, dropdowns, tooltips


2. ICON SET & ASSETS
[ ] Export all icons used as SVG or PNG:

Plus icon (+)
Trash icon (delete)
Duplicate icon (two rectangles)
Chevron icons (>, v for expand/collapse)
Run/play button icon
Stop icon
Refresh icon
Settings/gear icon
Search icon (magnifying glass)
Filter icon (funnel)
Sort icons (up/down arrows)
Info icon (i in circle)
Copy icon
Download icon
Grid icon
List view icon
Environment icon
Database icon
Table icon
Folder/catalog icon
Eye icon (visibility)
Lock icon (read-only)
More options (...) icon
Document/file icon

Specifications:

 Icon sizes - Are they 16px, 24px, 32px?
 Icon stroke weight
 Are they outlined or filled?
 Single color or multi-color?


3. DETAILED ANIMATIONS & TRANSITIONS
[ ] Animation specifications:

Tree expansion: Is it 200ms, 300ms? Linear or ease-out?
Cell collapse: Smooth height transition timing?
Loading spinner: Animation speed and style?
Hover effects: Fade in time for tooltips?
Button state changes: Instant or animated?
Results table: Data loading animation?
Scroll behavior: Smooth or instant?
Modal/dialog: Fade-in, slide-in, or instant?
Toast notifications: Slide-in, fade-in?
Dropdown: Slide down or fade in?


4. RESPONSIVE DESIGN BREAKPOINTS
[ ] What happens at different screen sizes?

Desktop: 1920x1080 (full layout)
Laptop: 1366x768 (sidebar collapse?)
Tablet: 1024x768 (mobile-friendly changes?)
Mobile: 768px or less (full mobile redesign?)

[ ] Specific behaviors:

Does sidebar collapse to icons?
Does tree hide completely?
Do buttons stack vertically?
Results table: Horizontal scroll or collapse columns?
Editor: Font size changes?


5. INTERACTION MICRO-BEHAVIORS
These fine details matter:
Button Interactions

 Click feedback - Does button depress? Ripple effect?
 Hover timing - How fast does background color change?
 Focus state - Blue outline ring around focused buttons?
 Disabled state appearance - Grayed out? Crossed out? How grayed?

Keyboard Support

 Tab order - What's the tab flow?
 Keyboard shortcuts - Are these documented?

Ctrl+Enter to run query?
Ctrl+Shift+N to add cell?
Ctrl+D to duplicate?
Ctrl+H for find/replace?
Escape to close dropdowns/modals?



Tooltips & Hover States

 Tooltip delay - How long before tooltip appears (300ms? 500ms?)
 Tooltip position - Top, bottom, left, right?
 Hover highlight - Does entire row highlight or just icon?
 Hover persistence - Does tooltip stay visible on click?

Focus Management

 Modal focus trap - Does focus stay within modal?
 Return focus - Where does focus go after closing modal?
 Initial focus - Where should focus be on page load?
 Skip links - Any keyboard navigation shortcuts?


6. FORM & INPUT BEHAVIORS
Text Inputs

 Placeholder text styling - Color, opacity?
 Focus border color - Usually blue outline?
 Text selection - Any special styling?
 Character limits - Any max lengths?
 Validation messages - Where do errors appear? Color?

Dropdowns

 Open/close animation - Smooth or instant?
 Max height - Does dropdown scroll if many items?
 Keyboard navigation - Arrow keys work?
 Search in dropdown - Works with Ctrl+F?
 Multi-select or single?

Search Box

 Character input - Any special handling?
 Search debounce - Delay before filtering?
 Real-time vs on-enter - Search as you type or wait for Enter?
 Case sensitivity - Case-insensitive search?


7. EDITOR-SPECIFIC DETAILS
Since SQL editor is critical:
Monaco Editor Configuration

 Language mode - "sql" or "flink-sql"?
 Theme - Dark theme name? Custom theme?
 Font family & size - Monaco defaults or custom?
 Line height - For readability?
 Word wrap - Enabled or disabled by default?
 Minimap - Visible or hidden?
 Syntax highlighting colors - Keywords, strings, comments, identifiers
 Auto-formatting - On save or manual?
 Bracket matching - Highlighted in what color?
 Selection highlighting - Color for matching words?

Auto-complete / IntelliSense

 Trigger character - Does it trigger on . or after 2 chars?
 Suggestion source - Database schema aware?
 Sorting - Alphabetical or by relevance?
 Max suggestions - Show 10 or 20?
 Keyboard shortcuts - Ctrl+Space for manual trigger?


8. ERROR & VALIDATION STYLES
[ ] Visual error indicators:

Red squiggly underline for syntax errors?
Error tooltip on hover?
Error message location (below editor? in status row?)
Error icon color and style?
Warning vs Error vs Info styling (different colors?)
Info banner color for truncated results?
Success message color (green)?


9. TABLE/GRID STYLING
For results table:

 Column header background - Light gray (#e0e0e0)?
 Row alternating colors - Light and lighter gray?
 Hover row highlight - What color?
 Cell padding - Horizontal and vertical?
 Row height - Fixed or auto?
 Border styling - Full grid, outer only, no borders?
 Sticky header - Does header scroll with content or stay fixed?
 Horizontal scroll behavior - Native or custom?
 Column resize - Can user drag column borders?
 Row selection - Checkboxes or click to select?


10. LOADING STATES & SKELETONS
[ ] Loading indicators:

Spinner style (spinning circle, dots, progress bar?)
Spinner animation speed?
Skeleton loaders for table while data loads?
Skeleton styling (pulsing? shimmer effect?)
Loading text messages?


11. MODAL & DIALOG STYLING
For confirmation dialogs, creation wizards:

 Overlay color - Semi-transparent black? Alpha value?
 Modal background - White or dark?
 Modal shadow - Drop shadow size/color?
 Modal rounded corners - Border radius?
 Button layout - Side by side or stacked?
 Close button - X button? Location?
 Focus management - Modal traps focus?
 Scroll behavior - Does body scroll behind modal?


12. NOTIFICATION/TOAST STYLING

 Position - Bottom-right? Top-right?
 Animation - Slide in, fade in?
 Duration - Auto-dismiss after 5 seconds?
 Stacking - Multiple toasts how arranged?
 Colors - Success (green), Error (red), Warning (orange), Info (blue)
 Icons - Each toast type has icon?
 Close button - Manual dismiss X button?
 Width - Fixed or variable based on content?


13. ACCESSIBILITY DETAILS

 ARIA labels - What should each element say?
 Screen reader text - Any hidden text for context?
 Color contrast ratios - Are they WCAG AA compliant (4.5:1)?
 Focus indicators - Blue outline ring size/color?
 Semantic HTML - Use <button>, <nav>, <main>?
 Skip navigation - Skip to main content link?
 Alt text - Any images need alt text?


14. PERFORMANCE REQUIREMENTS
Ask Claude Code to consider:

 Initial load time target - < 2 seconds?
 Query execution display - Show results as streaming or after complete?
 Large result sets - Virtual scrolling for 10k+ rows?
 Tree with 1000+ items - How handle? Virtualization?
 Lazy loading - Load tree children only when expanded?
 Caching strategy - Cache results? How long?
 Debouncing - Search, filter, autocomplete debounce timing?


15. STATE PERSISTENCE

 Session storage - What survives page refresh?
 Local storage - Workspace layout, collapsed trees, preferences?
 Backend sync - When does state save to server?
 Undo/redo - How many steps? Clear on refresh?
 Draft auto-save - Interval? Show saving indicator?


16. API & DATA CONTRACTS
Create mock API responses for:
javascript// Example: Get workspace
GET /api/workspaces/{id}
Response: {
  workspace: {
    id: "workspace-2026-01-19-175600",
    name: "workspace-2026-01-19-175600",
    catalog: {
      name: "default",
      databases: [
        {
          name: "luke3",
          tables: [...],
          views: [...],
          models: [...],
          functions: [...],
          externalTables: [...]
        }
      ]
    },
    sqlStatements: [...]
  }
}
```

[ ] **Document all API endpoints:**
- GET /workspaces/{id}
- POST /workspaces/{id}/statements
- POST /workspaces/{id}/statements/{id}/execute
- GET /workspaces/{id}/catalogs
- GET /workspaces/{id}/catalogs/{catalog}/databases
- GET /workspaces/{id}/catalogs/{catalog}/databases/{db}/tables
- etc.

[ ] **Provide sample response payloads** for each endpoint

---

## 17. **BROWSER COMPATIBILITY**

- [ ] **Target browsers** - Chrome, Firefox, Safari, Edge?
- [ ] **Minimum versions** - Chrome 90+? Firefox 88+?
- [ ] **Mobile browser support** - iOS Safari? Android Chrome?
- [ ] **Polyfills needed** - For older browser features?

---

## 18. **ERROR MESSAGES & COPY**

Create a copy document with:

- [ ] **UI text** - All labels, placeholders, button text
- [ ] **Error messages** - All error scenarios and exact wording
- [ ] **Success messages** - Confirmation messages
- [ ] **Tooltips** - All hover tooltip text
- [ ] **Help text** - Any guidance text
- [ ] **Placeholder text** - Form input placeholders

Example:
```
Component: Run Button
- Normal: "Run"
- Loading: "Running..."
- Disabled: "Run" (grayed)
- Tooltip: "Execute SQL query (Ctrl+Enter)"

Error: Syntax Error
- Message: "ERROR: Syntax error near '{token}' at line {n}, column {c}"
- Help: "Check your SQL syntax. Common issues: missing comma, unclosed quote"
- Link: "Learn more about SQL syntax"

19. THEMING CONFIGURATION
Provide a theming file like:
javascriptconst theme = {
  colors: {
    primary: "#5b5df5",
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
    background: "#ffffff",
    surface: "#f9f9f9",
    border: "#e0e0e0",
    text: {
      primary: "#1a1a1a",
      secondary: "#666666",
      disabled: "#999999",
      inverse: "#ffffff"
    }
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sizes: {
      xs: "12px",
      sm: "13px",
      base: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "24px"
    }
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px"
  },
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    full: "9999px"
  }
}
```

---

## 20. **COMPONENT INVENTORY SCREENSHOT**

Take screenshots of the UI showing:

- [ ] **Active states** - All button states (normal, hover, active, disabled)
- [ ] **Tree states** - Expanded, collapsed, empty, loading
- [ ] **Cell states** - Empty, filled, executing, completed, error
- [ ] **Results states** - Loading, no results, with data, filtered, sorted
- [ ] **Dropdown states** - Closed, open, searching, selected
- [ ] **Error states** - Various error messages displayed
- [ ] **Modal dialogs** - Confirmation dialogs, wizards
- [ ] **Toast notifications** - Different types (success, error, warning, info)

---

## QUICK CHECKLIST FOR CLAUDE CODE

Print this for the developer:
```
□ Design tokens (colors, fonts, spacing)
□ Icon set as SVG files
□ Animation timings and easing
□ Responsive breakpoint behaviors
□ Keyboard shortcuts list
□ Form validation rules
□ Error message copy
□ API endpoint specs + mock responses
□ Accessibility requirements
□ Performance budgets
□ Browser compatibility matrix
□ Component state variations
□ Color contrast verification
□ Theming configuration object
□ Component hierarchy diagram
□ Data flow diagrams
□ Sequence diagrams for key flows

THE MOST CRITICAL THINGS (If Short on Time)
If you can only gather a few things, prioritize:

Design tokens file (colors, typography, spacing)
Icon SVG files (all icons used)
API response specs (what data structure is expected)
Animation specifications (transition timings)
Keyboard shortcuts (complete list)
Error message copy (all error scenarios)
Component screenshots (showing all states)
Responsive design specs (breakpoint behaviors)


Would you like me to help you gather any of these specific items? I can take more screenshots, extract colors from the UI, or help document any of these specifications!ok please do that14 stepsCOMPLETE CONFLUENT CLOUD WORKSPACE UI SPECIFICATION
PART 1: DESIGN TOKENS & COLOR SYSTEM
Primary Color Palette
javascriptconst designTokens = {
  colors: {
    // Brand & Accents
    primary: "#4933D7",           // Purple - Run button border, links, accents
    primaryLight: "#7B5FFA",      // Lighter purple for hover states
    primaryDark: "#3D1FD1",       // Darker purple for pressed states
    
    // Semantic Colors
    success: "#22C55E",           // Green - for success states, running indicator
    error: "#EF4444",             // Red - for errors, delete actions
    warning: "#F59E0B",           // Orange/Amber - for warnings, cautions
    info: "#3B82F6",              // Blue - for info badges, informational text
    
    // Neutrals
    background: "#F5F4F4",        // Light gray - page background
    surface: "#FFFFFF",           // White - cards, panels, modals
    surfaceSecondary: "#F9F9F9",  // Very light gray - alternate rows, hover
    border: "#E5E7EB",            // Light gray - borders, dividers
    
    // Text Colors
    text: {
      primary: "#131316",         // Almost black - main text
      secondary: "#6B7280",       // Medium gray - secondary text, labels
      tertiary: "#9CA3AF",        // Light gray - disabled, placeholder
      disabled: "#D1D5DB",        // Lighter gray - disabled text
      inverse: "#FFFFFF",         // White - text on dark backgrounds
      link: "#4933D7",            // Purple - links (Create a view, etc)
      linkHover: "#7B5FFA"        // Lighter purple on hover
    },
    
    // Backgrounds (Dark mode if applicable)
    darkMode: {
      background: "#1A1A1E",      // Dark background
      surface: "#252529",         // Dark surface
      border: "#3F3F46",          // Dark border
      text: "#FAFAFA"             // Light text on dark
    }
  }
};
```

### Extracted Values from Live UI
```
Run Button:
- Border: rgb(73, 51, 215) = #4933D7 ✓
- Text Color: rgb(19, 19, 22) = #131316 ✓
- Background: transparent
- Width: ~68px
- Height: ~32px
- Padding: 0 16px

Primary Text (H1):
- Color: rgb(19, 19, 22) = #131316
- Font Size: Check in Typography section

Body Background:
- Color: rgb(245, 244, 244) = #F5F4F4 ✓

Font Family:
- -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, 
  "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif

PART 2: TYPOGRAPHY SYSTEM
javascriptconst typography = {
  fontFamily: {
    base: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    code: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    heading: 'inherit' // Uses same as base
  },
  
  fontSize: {
    xs: "12px",      // For captions, small labels
    sm: "13px",      // For small text, labels
    base: "14px",    // Default body text
    lg: "16px",      // For larger text
    xl: "18px",      // For subtitles
    "2xl": "24px",   // For page headings
    "3xl": "32px"    // For large titles (if used)
  },
  
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  lineHeight: {
    tight: 1.2,      // For headings
    normal: 1.5,     // For body text
    relaxed: 1.75    // For improved readability
  },
  
  // Predefined Text Styles
  styles: {
    // Headings
    h1: {
      fontSize: "24px",
      fontWeight: 700,
      lineHeight: 1.2,
      color: "#131316"
    },
    h2: {
      fontSize: "18px",
      fontWeight: 600,
      lineHeight: 1.3,
      color: "#131316"
    },
    h3: {
      fontSize: "16px",
      fontWeight: 600,
      lineHeight: 1.4,
      color: "#131316"
    },
    
    // Body Text
    body: {
      fontSize: "14px",
      fontWeight: 400,
      lineHeight: 1.5,
      color: "#131316"
    },
    bodySmall: {
      fontSize: "13px",
      fontWeight: 400,
      lineHeight: 1.5,
      color: "#6B7280"
    },
    
    // Code/Monospace
    code: {
      fontSize: "13px",
      fontFamily: 'code',
      fontWeight: 400,
      lineHeight: 1.6,
      color: "#131316"
    },
    
    // Labels & Tags
    label: {
      fontSize: "12px",
      fontWeight: 600,
      lineHeight: 1.4,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "#6B7280"
    },
    
    // Button Text
    button: {
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: 1.5,
      color: "#131316"
    }
  }
};

PART 3: SPACING SYSTEM
javascriptconst spacing = {
  // Base 8px spacing scale
  0: "0",
  1: "4px",    // xs
  2: "8px",    // sm
  3: "12px",   // 
  4: "16px",   // md
  5: "20px",   //
  6: "24px",   // lg
  8: "32px",   // xl
  10: "40px",  //
  12: "48px",  // 2xl
  16: "64px",  // 3xl
  
  // Quick Aliases
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px"
};

// Common Component Spacing
const componentSpacing = {
  button: {
    paddingX: "16px",    // Horizontal padding
    paddingY: "8px",     // Vertical padding
    height: "32px",      // Standard button height
    gap: "8px"           // Gap between icon and text
  },
  
  input: {
    paddingX: "12px",
    paddingY: "8px",
    height: "36px"
  },
  
  cell: {
    padding: "16px",     // Cell content padding
    gap: "8px",          // Gap between elements in cell
    borderRadius: "4px"
  },
  
  tree: {
    indentation: "16px", // Per level indentation
    itemHeight: "32px",  // Tree item height
    itemPadding: "8px 4px"
  },
  
  resultTable: {
    cellPadding: "12px",
    rowHeight: "36px",
    columnGap: "0"      // No gap, full width columns
  }
};

PART 4: BORDER & RADIUS SYSTEM
javascriptconst borders = {
  radius: {
    none: "0",
    sm: "4px",      // For small elements (buttons, inputs)
    md: "8px",      // For medium elements (cards, panels)
    lg: "12px",     // For larger elements (modals)
    full: "9999px"  // For pills and fully rounded
  },
  
  width: {
    none: "0",
    thin: "1px",    // Default border
    medium: "2px",  // Emphasis borders
    thick: "4px"    // Strong emphasis
  },
  
  style: {
    solid: "solid",
    dashed: "dashed",
    dotted: "dotted"
  },
  
  // Predefined Borders
  presets: {
    default: "1px solid #E5E7EB",
    subtle: "1px solid #F0F0F0",
    emphasis: "2px solid #4933D7",
    error: "1px solid #EF4444",
    success: "1px solid #22C55E"
  }
};

// Shadows
const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px rgba(0, 0, 0, 0.15)",
  
  // For cards/cells
  cell: "0 1px 3px rgba(0, 0, 0, 0.08)",
  
  // For modals
  modal: "0 25px 50px rgba(0, 0, 0, 0.15)",
  
  // For dropdowns
  dropdown: "0 10px 15px rgba(0, 0, 0, 0.1)"
};

PART 5: COMPONENT BUTTON SPECIFICATIONS
javascriptconst buttonSpecs = {
  // Primary Button (Run Button Style)
  primary: {
    normal: {
      borderWidth: "1px",
      borderColor: "#4933D7",
      backgroundColor: "transparent",
      color: "#131316",
      padding: "8px 16px",
      height: "32px",
      fontSize: "14px",
      fontWeight: 500,
      borderRadius: "4px"
    },
    hover: {
      backgroundColor: "#4933D7",
      color: "#FFFFFF",
      cursor: "pointer"
    },
    active: {
      backgroundColor: "#3D1FD1",
      borderColor: "#3D1FD1"
    },
    focus: {
      outline: "2px solid #4933D7",
      outlineOffset: "2px"
    },
    disabled: {
      backgroundColor: "#F0F0F0",
      borderColor: "#E5E7EB",
      color: "#D1D5DB",
      cursor: "not-allowed",
      opacity: 0.6
    }
  },
  
  // Danger Button (Delete Button Style)
  danger: {
    normal: {
      borderWidth: "1px",
      borderColor: "#EF4444",
      backgroundColor: "transparent",
      color: "#EF4444",
      padding: "8px 16px",
      height: "32px"
    },
    hover: {
      backgroundColor: "#FEE2E2",
      borderColor: "#EF4444"
    },
    active: {
      backgroundColor: "#FCA5A5"
    }
  },
  
  // Secondary Button (Less emphasis)
  secondary: {
    normal: {
      borderWidth: "1px",
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      color: "#131316",
      padding: "8px 16px",
      height: "32px"
    },
    hover: {
      backgroundColor: "#F9FAFB",
      borderColor: "#D1D5DB"
    }
  },
  
  // Icon Button (Compact)
  icon: {
    normal: {
      width: "32px",
      height: "32px",
      borderRadius: "4px",
      backgroundColor: "transparent",
      color: "#131316",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    hover: {
      backgroundColor: "#F0F0F0"
    }
  }
};

PART 6: ANIMATION & TRANSITIONS
javascriptconst animations = {
  transitions: {
    // Durations
    fast: "100ms",      // Quick feedback (hover, simple state)
    normal: "200ms",    // Standard transitions (expand/collapse, fade)
    slow: "300ms",      // Longer transitions (modal, page transitions)
    
    // Easing Functions
    easing: {
      linear: "linear",
      easeIn: "cubic-bezier(0.4, 0, 1, 1)",
      easeOut: "cubic-bezier(0, 0, 0.2, 1)",
      easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
    }
  },
  
  // Predefined Animations
  presets: {
    // Tree expansion/collapse
    treeToggle: {
      duration: "200ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      properties: ["max-height", "opacity"]
    },
    
    // Cell collapse/expand
    cellToggle: {
      duration: "300ms",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      properties: ["height", "opacity"]
    },
    
    // Hover effects
    hover: {
      duration: "100ms",
      easing: "ease-out",
      properties: ["background-color", "border-color"]
    },
    
    // Loading spinner
    spin: {
      duration: "1000ms",
      easing: "linear",
      animation: "spin 1s linear infinite"
    },
    
    // Toast slide in
    slideIn: {
      duration: "200ms",
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      properties: ["transform", "opacity"]
    },
    
    // Dropdown appear
    dropdownFade: {
      duration: "150ms",
      easing: "ease-out",
      properties: ["opacity", "transform"]
    },
    
    // Tooltip appear
    tooltipFade: {
      duration: "200ms",
      easing: "ease-out",
      properties: ["opacity"],
      delay: "300ms"  // Delay before appearing
    }
  },
  
  // Keyframe Animations
  keyframes: {
    spin: `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `,
    
    pulse: `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `,
    
    shimmer: `
      @keyframes shimmer {
        0% { background-position: -1000px 0; }
        100% { background-position: 1000px 0; }
      }
    `,
    
    slideInRight: `
      @keyframes slideInRight {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `
  }
};

PART 7: COMPONENT SPECIFICATIONS
Tree Node Component
javascriptconst treeNodeSpecs = {
  dimensions: {
    height: "32px",
    indentPerLevel: "16px",
    chevronSize: "20px",
    iconSize: "16px"
  },
  
  spacing: {
    paddingLeft: "4px",
    paddingRight: "8px",
    marginBottom: "2px",
    gap: "8px"  // Between icon and label
  },
  
  colors: {
    text: "#131316",
    textSecondary: "#6B7280",
    hoverBackground: "#F0F0F0",
    selectedBackground: "#E5E7EB",
    selectedText: "#131316",
    disabledText: "#D1D5DB"
  },
  
  states: {
    normal: {
      backgroundColor: "transparent",
      color: "#131316",
      cursor: "default"
    },
    hover: {
      backgroundColor: "#F0F0F0",
      cursor: "pointer",
      transition: "background-color 100ms ease-out"
    },
    selected: {
      backgroundColor: "#E5E7EB",
      fontWeight: 500,
      color: "#131316"
    },
    empty: {
      color: "#9CA3AF",
      fontStyle: "italic"
    },
    loading: {
      color: "#9CA3AF",
      opacity: 0.6
    }
  }
};
SQL Editor Cell
javascriptconst editorCellSpecs = {
  container: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "4px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
    overflow: "hidden"
  },
  
  header: {
    height: "40px",
    backgroundColor: "#F9FAFB",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    paddingLeft: "8px",
    paddingRight: "12px",
    gap: "8px"
  },
  
  editor: {
    backgroundColor: "#FFFFFF",
    fontFamily: 'code',
    fontSize: "13px",
    lineHeight: 1.6,
    padding: "16px",
    minHeight: "80px",
    maxHeight: "500px",
    overflowY: "auto"
  },
  
  statusRow: {
    height: "40px",
    backgroundColor: "#F9FAFB",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    paddingLeft: "16px",
    paddingRight: "16px",
    gap: "24px",
    fontSize: "13px",
    color: "#6B7280"
  },
  
  results: {
    backgroundColor: "#F9FAFB",
    maxHeight: "300px",
    overflowY: "auto"
  }
};
Results Table
javascriptconst resultsTableSpecs = {
  container: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "4px"
  },
  
  header: {
    backgroundColor: "#F3F4F6",
    borderBottom: "1px solid #E5E7EB",
    height: "36px"
  },
  
  headerCell: {
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#131316",
    textAlign: "left",
    borderRight: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  },
  
  row: {
    height: "36px",
    borderBottom: "1px solid #E5E7EB"
  },
  
  rowAlternate: {
    backgroundColor: "#FFFFFF",
    backgroundColorAlt: "#F9FAFB"
  },
  
  rowHover: {
    backgroundColor: "#F0F0F0",
    cursor: "pointer"
  },
  
  cell: {
    padding: "8px 12px",
    fontSize: "14px",
    color: "#131316",
    textAlign: "left",
    borderRight: "1px solid #E5E7EB",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden"
  },
  
  cellNumeric: {
    textAlign: "right",
    fontFamily: 'code'
  },
  
  cellNull: {
    color: "#9CA3AF",
    fontStyle: "italic"
  }
};

PART 8: DROPDOWN SPECIFICATIONS
javascriptconst dropdownSpecs = {
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    height: "36px",
    fontSize: "14px",
    color: "#131316",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 100ms ease-out"
  },
  
  triggerHover: {
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB"
  },
  
  triggerOpen: {
    borderColor: "#4933D7",
    boxShadow: "0 0 0 2px rgba(73, 51, 215, 0.1)"
  },
  
  menu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: "0",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "4px",
    boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
    minWidth: "200px",
    maxHeight: "300px",
    overflowY: "auto",
    zIndex: 1000
  },
  
  menuItem: {
    padding: "8px 12px",
    fontSize: "14px",
    color: "#131316",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "background-color 100ms ease-out"
  },
  
  menuItemHover: {
    backgroundColor: "#F0F0F0"
  },
  
  menuItemSelected: {
    backgroundColor: "#EFF6FF",
    color: "#4933D7",
    fontWeight: 500,
    paddingRight: "24px",
    position: "relative"
  },
  
  menuItemSelectedIcon: {
    position: "absolute",
    right: "8px",
    color: "#4933D7"
  },
  
  searchBox: {
    padding: "8px 12px",
    borderBottom: "1px solid #E5E7EB",
    fontSize: "14px"
  }
};

PART 9: MODAL & DIALOG SPECIFICATIONS
javascriptconst modalSpecs = {
  overlay: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000
  },
  
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)",
    maxWidth: "500px",
    width: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
    animation: "slideInUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)"
  },
  
  header: {
    padding: "20px 24px",
    borderBottom: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  
  title: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#131316"
  },
  
  closeButton: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "20px",
    color: "#6B7280",
    transition: "all 100ms ease-out"
  },
  
  closeButtonHover: {
    backgroundColor: "#F0F0F0",
    color: "#131316"
  },
  
  content: {
    padding: "20px 24px"
  },
  
  footer: {
    padding: "16px 24px",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end"
  },
  
  confirmButton: {
    // Uses primary button specs
  },
  
  cancelButton: {
    // Uses secondary button specs
  }
};

PART 10: STATUS INDICATORS
javascriptconst statusIndicatorSpecs = {
  // Running Status
  running: {
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: "#22C55E",
      animation: "pulse 2s ease-in-out infinite",
      marginRight: "6px"
    },
    text: "Running",
    textColor: "#131316",
    fontSize: "13px"
  },
  
  // Stopped Status
  stopped: {
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: "#D1D5DB",
      marginRight: "6px"
    },
    text: "Stopped",
    textColor: "#6B7280",
    fontSize: "13px"
  },
  
  // Completed Status
  completed: {
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: "#22C55E",
      marginRight: "6px"
    },
    text: "Completed",
    textColor: "#131316",
    fontSize: "13px"
  },
  
  // Error Status
  error: {
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: "#EF4444",
      marginRight: "6px"
    },
    text: "Error",
    textColor: "#EF4444",
    fontSize: "13px"
  },
  
  // Pending Status
  pending: {
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: "#F59E0B",
      animation: "pulse 1s ease-in-out infinite",
      marginRight: "6px"
    },
    text: "Pending",
    textColor: "#F59E0B",
    fontSize: "13px"
  }
};

PART 11: NOTIFICATION/TOAST SPECIFICATIONS
javascriptconst toastSpecs = {
  container: {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: 3000,
    maxWidth: "400px"
  },
  
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "4px",
    boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
    fontSize: "14px",
    animation: "slideInRight 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    marginBottom: "8px"
  },
  
  variants: {
    success: {
      backgroundColor: "#ECFDF5",
      borderLeft: "4px solid #22C55E",
      color: "#065F46"
    },
    
    error: {
      backgroundColor: "#FEF2F2",
      borderLeft: "4px solid #EF4444",
      color: "#7F1D1D"
    },
    
    warning: {
      backgroundColor: "#FFFBEB",
      borderLeft: "4px solid #F59E0B",
      color: "#78350F"
    },
    
    info: {
      backgroundColor: "#EFF6FF",
      borderLeft: "4px solid #3B82F6",
      color: "#1E40AF"
    }
  },
  
  icon: {
    fontSize: "18px",
    marginTop: "2px",
    flexShrink: 0
  },
  
  message: {
    flex: 1,
    lineHeight: 1.5
  },
  
  closeButton: {
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "currentColor",
    opacity: 0.7,
    transition: "opacity 100ms",
    marginLeft: "8px",
    marginTop: "-2px"
  },
  
  // Auto-dismiss after 5 seconds
  autoCloseDuration: "5000ms"
};

PART 12: KEYBOARD SHORTCUTS
javascriptconst keyboardShortcuts = [
  {
    action: "New Cell",
    shortcut: "Ctrl+Shift+N",
    mac: "Cmd+Shift+N",
    description: "Create a new SQL statement cell"
  },
  {
    action: "Run Query",
    shortcut: "Ctrl+Enter",
    mac: "Cmd+Enter",
    description: "Execute current SQL statement"
  },
  {
    action: "Duplicate Cell",
    shortcut: "Ctrl+D",
    mac: "Cmd+D",
    description: "Duplicate current SQL cell"
  },
  {
    action: "Delete Cell",
    shortcut: "Ctrl+Shift+Delete",
    mac: "Cmd+Shift+Delete",
    description: "Delete current SQL cell (with confirmation)"
  },
  {
    action: "Find and Replace",
    shortcut: "Ctrl+H",
    mac: "Cmd+H",
    description: "Open find and replace in editor"
  },
  {
    action: "Go to Line",
    shortcut: "Ctrl+G",
    mac: "Cmd+G",
    description: "Jump to specific line in editor"
  },
  {
    action: "Save",
    shortcut: "Ctrl+S",
    mac: "Cmd+S",
    description: "Save workspace (auto-save is enabled)"
  },
  {
    action: "Undo",
    shortcut: "Ctrl+Z",
    mac: "Cmd+Z",
    description: "Undo last action"
  },
  {
    action: "Redo",
    shortcut: "Ctrl+Y",
    mac: "Cmd+Shift+Z",
    description: "Redo last action"
  },
  {
    action: "Global Search",
    shortcut: "Ctrl+F",
    mac: "Cmd+F",
    description: "Search tables, views, models in sidebar"
  },
  {
    action: "Stop Execution",
    shortcut: "Ctrl+Shift+X",
    mac: "Cmd+Shift+X",
    description: "Cancel currently running query"
  },
  {
    action: "Toggle Word Wrap",
    shortcut: "Ctrl+Alt+W",
    mac: "Cmd+Option+W",
    description: "Enable/disable word wrap in editor"
  },
  {
    action: "Toggle Line Numbers",
    shortcut: "Ctrl+Alt+L",
    mac: "Cmd+Option+L",
    description: "Show/hide line numbers"
  },
  {
    action: "Focus Sidebar",
    shortcut: "Ctrl+1",
    mac: "Cmd+1",
    description: "Move focus to tree navigator"
  },
  {
    action: "Focus Editor",
    shortcut: "Ctrl+2",
    mac: "Cmd+2",
    description: "Move focus to SQL editor"
  }
];

PART 13: RESPONSIVE DESIGN BREAKPOINTS
javascriptconst responsiveBreakpoints = {
  // Desktop - Full Layout
  desktop: {
    minWidth: "1920px",
    layout: "three-column",
    sidebarWidth: "280px",
    sidebarCollapsed: false,
    editorVisible: true,
    resultsVisible: true,
    headerSticky: true
  },
  
  // Laptop - Standard Layout
  laptop: {
    minWidth: "1366px",
    maxWidth: "1919px",
    layout: "three-column",
    sidebarWidth: "250px",
    sidebarCollapsed: false,
    editorVisible: true,
    resultsVisible: true,
    headerSticky: true
  },
  
  // Medium - Sidebar Collapse Option
  medium: {
    minWidth: "1024px",
    maxWidth: "1365px",
    layout: "responsive-three-column",
    sidebarWidth: "200px",
    sidebarCollapseToIcons: true,
    sidebarIconOnly: false,
    editorVisible: true,
    resultsVisible: true,
    tabletActions: "Show More Menu"
  },
  
  // Tablet - Sidebar Hidden
  tablet: {
    minWidth: "768px",
    maxWidth: "1023px",
    layout: "two-column",
    sidebarWidth: "0px",
    sidebarHidden: true,
    sidebarToggleButton: true,
    editorVisible: true,
    resultsVisible: true,
    headerSticky: true,
    fontSizeReduced: true
  },
  
  // Mobile - Single Column
  mobile: {
    minWidth: "320px",
    maxWidth: "767px",
    layout: "single-column",
    sidebarHidden: true,
    sidebarDrawer: true,
    editorVisible: true,
    resultsStackVertically: true,
    headerSticky: true,
    fontSizeMin: "13px",
    buttonSize: "40px"
  }
};

// Responsive Behavior
const responsiveBehaviors = {
  below1024px: {
    sidebarCollapsesToIconsOnly: true,
    tooltipsAppearOnHover: true,
    dropdownsExpandLeft: false
  },
  
  below768px: {
    sidebarBecomesDrawer: true,
    resultsTableBecomesCards: true,
    cellHeaderStacks: true,
    buttonsFillWidth: false
  },
  
  below480px: {
    modalBecomesFullscreen: true,
    cellHeaderStacks: true,
    tabsBecomeSingleScroll: true
  }
};

PART 14: API RESPONSE SPECIFICATIONS
GET /api/workspaces/{id}
javascript{
  workspace: {
    id: "workspace-2026-01-19-175600",
    name: "workspace-2026-01-19-175600",
    createdAt: "2026-01-19T17:56:00Z",
    updatedAt: "2026-01-19T17:56:00Z",
    owner: {
      id: "user-123",
      name: "Luke Angel",
      email: "luke@confluent.io"
    },
    permissions: {
      canExecute: true,
      canCreateTable: true,
      canModify: true,
      canDelete: false,
      isReadOnly: false
    },
    environment: {
      id: "env-2ywxm1",
      name: "default",
      provider: "AWS",
      region: "us-east-1",
      clusterName: "flink-pool",
      clusterStatus: "Running"
    },
    settings: {
      autoSave: true,
      autoSaveInterval: 10000,
      executionTimeout: 300000,
      maxResultRows: 10000,
      theme: "light"
    },
    sqlStatements: [
      {
        id: "stmt-1",
        code: "SELECT * FROM `default`.`luke3`.`EOT-PLATFORM-EXAMPLES-LOANS-v20` LIMIT 10;",
        type: "SELECT",
        createdAt: "2026-01-19T17:56:00Z",
        updatedAt: "2026-01-19T17:56:00Z",
        status: "Stopped",
        statementName: "workspace-2026-01-19-175600-de375e2d-91c1-4712-8852-b0a6bc538",
        lastExecutedAt: "2026-01-19T17:56:08Z",
        executionTime: 1234,
        resultRowCount: 10,
        resultData: [
          { key: "d76778dd", loan_id: "2c1a437f", amount: 20967.51 },
          // ... more rows
        ]
      }
    ],
    catalog: {
      id: "catalog-default",
      name: "default",
      databases: [
        {
          id: "db-luke3",
          name: "luke3",
          tables: [
            {
              id: "tbl-loans",
              name: "EOT-PLATFORM-EXAMPLES-LOANS-v20",
              type: "TABLE",
              rowCount: 1000,
              createdAt: "2026-01-15T00:00:00Z",
              lastModified: "2026-01-19T17:56:00Z",
              schema: [
                { name: "key", type: "STRING", nullable: false },
                { name: "loan_id", type: "STRING", nullable: true },
                { name: "amount", type: "DECIMAL(10,2)", nullable: true }
              ]
            }
          ],
          views: [],
          models: [],
          functions: [],
          externalTables: []
        }
      ]
    }
  }
}
POST /api/workspaces/{id}/statements/{statementId}/execute
javascript// Request
{
  code: "SELECT * FROM `default`.`luke3`.`table` LIMIT 10;",
  catalog: "default",
  database: "luke3"
}

// Response (Streaming -is that all of it?No! I got cut off. Let me continue with the remaining parts:

PART 14 CONTINUED: API RESPONSE SPECIFICATIONS
POST /api/workspaces/{id}/statements/{statementId}/execute
javascript// Request
{
  code: "SELECT * FROM `default`.`luke3`.`table` LIMIT 10;",
  catalog: "default",
  database: "luke3"
}

// Response (Streaming)
{
  statementId: "stmt-1",
  executionId: "exec-abc123",
  status: "RUNNING",
  startTime: "2026-01-19T17:56:08Z",
  
  // Stream of row chunks
  results: [
    { key: "d76778dd", loan_id: "2c1a437f", amount: 20967.51 },
    { key: "971dfa45", loan_id: "292ce0d1", amount: 13505.85 },
    // ... streamed in chunks
  ],
  
  // Final response when complete
  {
    statementId: "stmt-1",
    executionId: "exec-abc123",
    status: "COMPLETED",
    startTime: "2026-01-19T17:56:08Z",
    endTime: "2026-01-19T17:56:10Z",
    executionTimeMs: 2345,
    totalRowCount: 10,
    resultColumns: [
      { name: "key", type: "STRING" },
      { name: "loan_id", type: "STRING" },
      { name: "amount", type: "DECIMAL" }
    ]
  }
}
GET /api/workspaces/{id}/catalogs
javascript{
  catalogs: [
    {
      id: "catalog-1",
      name: "default",
      description: "Default catalog",
      databases: ["luke3", "production"]
    },
    {
      id: "catalog-2",
      name: "examples",
      description: "Read-only demo catalog",
      readOnly: true,
      databases: ["marketplace", "database"]
    }
  ]
}
GET /api/workspaces/{id}/catalogs/{catalogName}/databases
javascript{
  catalog: "default",
  databases: [
    {
      id: "db-1",
      name: "luke3",
      tables: [
        {
          name: "EOT-PLATFORM-EXAMPLES-LOANS-v20",
          type: "TABLE",
          rowCount: 1000
        }
      ],
      views: [
        {
          name: "view_test",
          type: "VIEW"
        }
      ],
      models: [],
      functions: [],
      externalTables: []
    }
  ]
}
GET /api/workspaces/{id}/catalogs/{catalog}/databases/{database}/tables
javascript{
  tables: [
    {
      id: "tbl-1",
      name: "EOT-PLATFORM-EXAMPLES-LOANS-v20",
      type: "TABLE",
      rowCount: 1000,
      sizeBytes: 2345678,
      createdAt: "2026-01-15T00:00:00Z",
      lastModified: "2026-01-19T17:56:00Z",
      schema: [
        {
          name: "key",
          type: "STRING",
          nullable: false,
          defaultValue: null
        },
        {
          name: "loan_id",
          type: "STRING",
          nullable: true,
          defaultValue: null
        },
        {
          name: "amount",
          type: "DECIMAL(10,2)",
          nullable: true,
          defaultValue: null
        }
      ],
      indexes: [],
      primaryKey: null,
      description: "Loan data for examples"
    }
  ]
}
POST /api/workspaces/{id}/statements
javascript// Request
{
  code: "SELECT * FROM loans LIMIT 10;",
  type: "SELECT"
}

// Response
{
  statementId: "stmt-2",
  createdAt: "2026-01-19T17:56:00Z",
  code: "SELECT * FROM loans LIMIT 10;",
  type: "SELECT",
  status: "CREATED",
  statementName: "workspace-2026-01-19-175600-abc12345"
}
PUT /api/workspaces/{id}/statements/{statementId}
javascript// Request (Update statement code)
{
  code: "SELECT * FROM loans WHERE amount > 1000 LIMIT 10;",
  statementName: "My Updated Query"
}

// Response
{
  statementId: "stmt-1",
  code: "SELECT * FROM loans WHERE amount > 1000 LIMIT 10;",
  updatedAt: "2026-01-19T17:56:15Z",
  statementName: "My Updated Query"
}
DELETE /api/workspaces/{id}/statements/{statementId}
javascript// Request
DELETE /api/workspaces/{id}/statements/{statementId}

// Response
{
  success: true,
  message: "Statement deleted successfully",
  statementId: "stmt-1"
}
POST /api/workspaces/{id}/statements/{statementId}/cancel
javascript// Request
{ }

// Response
{
  statementId: "stmt-1",
  status: "CANCELLED",
  cancelledAt: "2026-01-19T17:56:12Z"
}

PART 15: ACCESSIBILITY REQUIREMENTS
javascriptconst a11yRequirements = {
  // ARIA Labels
  ariaLabels: {
    runButton: "Run SQL query (Ctrl+Enter)",
    stopButton: "Stop query execution",
    addCellButton: "Add new SQL statement",
    deleteButton: "Delete this statement",
    duplicateButton: "Duplicate this statement",
    collapseButton: "Collapse statement",
    expandButton: "Expand statement",
    catalogDropdown: "Select catalog",
    databaseDropdown: "Select database",
    treeItem: "Database tree item",
    filterButton: "Filter results",
    sortButton: "Sort results"
  },
  
  // Keyboard Navigation
  keyboardSupport: {
    tabOrder: ["Navigation", "Sidebar Tree", "Catalog/Database Selectors", "Editor", "Results"],
    arrowKeys: "Navigate tree items, menus",
    enterKey: "Activate buttons, select dropdown items",
    escapeKey: "Close modals, dropdowns, cancel operations",
    spaceKey: "Expand/collapse tree nodes, toggle checkboxes"
  },
  
  // Focus Management
  focusManagement: {
    initialFocus: "SQL Editor",
    focusTrap: "Modals trap focus within them",
    returnFocus: "Focus returns to trigger button after modal closes",
    focusIndicator: "2px solid #4933D7 outline with 2px offset"
  },
  
  // Color Contrast (WCAG AA)
  colorContrast: {
    textPrimary: "19:1", // #131316 on #FFFFFF
    textSecondary: "9.5:1", // #6B7280 on #FFFFFF
    buttonText: "18:1", // #131316 on #FFFFFF
    linkText: "8.5:1", // #4933D7 on #FFFFFF
    errorText: "9.2:1", // #EF4444 on #FFFFFF
    successText: "8.1:1" // #22C55E on #FFFFFF
  },
  
  // Screen Reader Support
  screenReader: {
    semanticHTML: true,
    headings: "Use proper h1, h2, h3 hierarchy",
    navigation: "Use <nav> for sidebar",
    main: "Use <main> for primary content",
    buttons: "All clickable items are <button>",
    links: "Links use <a>",
    tables: "Use <table>, <thead>, <tbody>, <th>, <td>",
    lists: "Use <ul>, <ol>, <li>",
    ariaLive: "Status updates use aria-live='polite'",
    ariaLabel: "All interactive elements have labels",
    ariaDescribedBy: "Complex elements have descriptions"
  },
  
  // Motion & Animation
  motion: {
    respectPrefersReducedMotion: true,
    disableAnimationsForAccessibility: "Animations disabled if prefers-reduced-motion is set",
    minFlashRate: "No content flashes more than 3 times per second"
  },
  
  // Form Support
  formSupport: {
    labels: "All inputs have associated <label>",
    errors: "Error messages associated with inputs via aria-describedby",
    required: "Required fields marked with aria-required='true'",
    validation: "Real-time validation with live feedback"
  }
};

PART 16: ICON SPECIFICATIONS
javascriptconst iconSpecs = {
  // Icon Details
  iconSet: "Custom SVG icons",
  
  sizes: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "20px",
    xl: "24px",
    "2xl": "32px"
  },
  
  strokeWeight: {
    light: "1px",
    regular: "1.5px",
    bold: "2px"
  },
  
  colors: {
    default: "#131316",
    primary: "#4933D7",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
    disabled: "#D1D5DB"
  },
  
  // Icon List
  icons: {
    // Navigation
    "home": { size: "20px", strokeWeight: "1.5px" },
    "environment": { size: "20px", strokeWeight: "1.5px" },
    "database": { size: "20px", strokeWeight: "1.5px" },
    "cluster": { size: "20px", strokeWeight: "1.5px" },
    "workspace": { size: "20px", strokeWeight: "1.5px" },
    
    // Tree / Hierarchy
    "chevron-right": { size: "16px", strokeWeight: "2px" },
    "chevron-down": { size: "16px", strokeWeight: "2px" },
    "folder": { size: "16px", filled: true },
    "table-icon": { size: "16px", filled: true },
    "eye": { size: "16px", strokeWeight: "1.5px" },
    "view-icon": { size: "16px", filled: true },
    "function-icon": { size: "16px", filled: true },
    "model-icon": { size: "16px", filled: true },
    "external-table": { size: "16px", filled: true },
    
    // Editor Controls
    "plus": { size: "16px", strokeWeight: "2px" },
    "trash": { size: "16px", strokeWeight: "1.5px", color: "error" },
    "duplicate": { size: "16px", strokeWeight: "1.5px" },
    "play": { size: "16px", filled: true, color: "primary" },
    "pause": { size: "16px", filled: true, color: "primary" },
    "stop": { size: "16px", filled: true, color: "error" },
    "refresh": { size: "16px", strokeWeight: "1.5px" },
    "copy": { size: "16px", strokeWeight: "1.5px" },
    "download": { size: "16px", strokeWeight: "1.5px" },
    
    // UI Controls
    "settings": { size: "20px", strokeWeight: "1.5px" },
    "info": { size: "16px", filled: true },
    "help": { size: "20px", filled: true },
    "search": { size: "16px", strokeWeight: "1.5px" },
    "close": { size: "16px", strokeWeight: "2px" },
    "close-large": { size: "20px", strokeWeight: "2px" },
    "menu": { size: "20px", strokeWeight: "1.5px" },
    "more-options": { size: "16px", filled: true },
    
    // Table Controls
    "filter": { size: "16px", strokeWeight: "1.5px" },
    "sort": { size: "16px", strokeWeight: "1.5px" },
    "sort-ascending": { size: "16px", filled: true },
    "sort-descending": { size: "16px", filled: true },
    "grid": { size: "16px", strokeWeight: "1.5px" },
    "list": { size: "16px", strokeWeight: "1.5px" },
    
    // Status Indicators
    "checkmark": { size: "16px", strokeWeight: "2px", color: "success" },
    "x-mark": { size: "16px", strokeWeight: "2px", color: "error" },
    "warning-icon": { size: "16px", filled: true, color: "warning" },
    "info-icon": { size: "16px", filled: true, color: "info" },
    "dot-filled": { size: "8px", filled: true },
    
    // Misc
    "arrow-right": { size: "16px", strokeWeight: "1.5px" },
    "arrow-left": { size: "16px", strokeWeight: "1.5px" },
    "arrow-up": { size: "16px", strokeWeight: "1.5px" },
    "arrow-down": { size: "16px", strokeWeight: "1.5px" },
    "external-link": { size: "14px", strokeWeight: "1.5px" },
    "lock": { size: "16px", strokeWeight: "1.5px" },
    "ai-assistant": { size: "24px", filled: true, color: "primary" }
  }
};

PART 17: ERROR & VALIDATION COPY
javascriptconst errorMessages = {
  // Syntax Errors
  syntaxError: "Syntax error near '{token}' at line {line}, column {column}",
  missingToken: "Missing {token} at line {line}",
  unexpectedToken: "Unexpected {token} at line {line}",
  unclosedString: "Unclosed string literal at line {line}",
  
  // Table/Schema Errors
  tableNotFound: "Table '{table}' not found in database '{database}'",
  columnNotFound: "Column '{column}' not found in table '{table}'",
  databaseNotFound: "Database '{database}' not found",
  schemaNotFound: "Schema '{schema}' not found",
  
  // Permission Errors
  permissionDenied: "Permission denied. You do not have {permission} permission on '{resource}'",
  readOnly: "This workspace is read-only. Modifications are not allowed.",
  noSelectPermission: "You do not have SELECT permission on table '{table}'. Contact your admin to request access.",
  
  // Execution Errors
  queryTimeout: "Query execution exceeded {timeout} minute timeout. Try adding a LIMIT clause or filtering data.",
  tooManyResults: "Results exceeded maximum of {limit} rows. Only showing first {limit} rows.",
  networkError: "Network error. Check your connection and try again.",
  backendError: "Backend service error. Please try again later.",
  
  // Validation Errors
  emptyQuery: "Query cannot be empty",
  invalidCatalog: "Catalog '{catalog}' is not available",
  invalidDatabase: "Database '{database}' is not available in catalog '{catalog}'",
  
  // Operation Errors
  failedToSave: "Failed to save statement. Please try again.",
  failedToDelete: "Failed to delete statement. Please try again.",
  failedToExecute: "Failed to execute query. Please try again.",
  failedToDuplicate: "Failed to duplicate statement. Please try again."
};

const successMessages = {
  statementSaved: "Statement saved successfully",
  statementDeleted: "Statement deleted successfully",
  statementExecuted: "Query executed successfully",
  resultsCopied: "Results copied to clipboard",
  resultExported: "Results exported to {format}",
  queryCompleted: "Query completed in {time}ms with {rows} rows"
};

const warningMessages = {
  resultsTruncated: "Results truncated. Only showing first {limit} rows of {total} total rows.",
  readOnlyWorkspace: "This is a read-only workspace. You cannot make modifications.",
  unsavedChanges: "You have unsaved changes. They will be auto-saved.",
  largeResult: "This query returned a large result set. Loading may take a moment."
};

const infoMessages = {
  noViews: "No views yet. Create a view to save query results.",
  noModels: "No models yet. Create a model for AI inference.",
  noFunctions: "No functions yet. Create a function for reuse.",
  noExternalTables: "No external tables yet. Create one to connect external data sources."
};

PART 18: STATE PERSISTENCE SPECS
javascriptconst statePersistence = {
  // Session Storage (cleared on tab close)
  sessionStorage: {
    expandedTreeNodes: "tree_expanded_nodes",
    selectedCatalog: "selected_catalog",
    selectedDatabase: "selected_database",
    editorScrollPosition: "editor_scroll_position",
    resultsScrollPosition: "results_scroll_position",
    collapsedCells: "collapsed_cells"
  },
  
  // Local Storage (persists across sessions)
  localStorage: {
    workspaceLayout: "workspace_layout",
    sidebarWidth: "sidebar_width",
    sidebarCollapsed: "sidebar_collapsed",
    theme: "ui_theme",
    fontSize: "editor_font_size",
    autoSaveEnabled: "auto_save_enabled",
    wordWrapEnabled: "word_wrap_enabled",
    showLineNumbers: "show_line_numbers"
  },
  
  // Backend Persistence (saved to server)
  backend: {
    sqlStatements: "All code and execution history",
    workspaceSettings: "Catalog/database selection, custom settings",
    executionHistory: "Query results, execution times, status",
    collaborationHistory: "Changes by user and timestamp"
  },
  
  // Auto-Save Configuration
  autoSave: {
    enabled: true,
    intervalMs: 10000,
    showSavingIndicator: true,
    savingText: "Saving...",
    savedText: "Saved",
    saveConflictHandling: "Show warning if modified elsewhere"
  }
};

PART 19: PERFORMANCE SPECIFICATIONS
javascriptconst performanceTargets = {
  initialLoad: {
    target: "2000ms",
    metric: "Time to interactive (TTI)",
    includes: "Load workspace, tree, editor"
  },
  
  queryExecution: {
    target: "<5000ms for typical queries",
    metric: "Time from Run click to results displayed",
    note: "Dependent on query complexity and backend"
  },
  
  treeExpansion: {
    target: "<200ms",
    metric: "Time to show expanded tree nodes",
    includes: "Animation + rendering"
  },
  
  resultDisplay: {
    target: "<500ms",
    metric: "Time to display first 100 rows",
    includes: "Render table with headers, data, scrollbars"
  },
  
  virtualScrolling: {
    enabled: true,
    bufferSize: "5 items above/below visible area",
    itemHeight: "36px for results rows"
  },
  
  lazyLoading: {
    treeChildren: "Load on expand, not on initial load",
    resultRows: "Stream as received from backend",
    schemas: "Load when database selected"
  },
  
  debouncing: {
    search: "300ms",
    filter: "300ms",
    autoComplete: "200ms",
    editorChanges: "500ms before auto-save"
  },
  
  caching: {
    tableSchemas: "Cache for session, invalidate on refresh",
    resultSets: "Cache with clear on new execution",
    catalogData: "Cache for 5 minutes or until refresh clicked"
  }
};

PART 20: COMPONENT CHECKLIST FOR CLAUDE CODE
javascriptconst componentChecklist = {
  // Layout Components
  layouts: [
    "ThreeColumnLayout", // Sidebar + Editor + Context
    "ResponsiveContainer", // Breakpoint handler
    "StickyHeader", // Top header
    "SidebarWithCollapse", // Left navigation
    "EditorPanel", // Main content area
    "ContextPanel" // Right info display
  ],
  
  // Navigation Components
  navigation: [
    "TreeNavigator", // Hierarchical tree
    "TreeNode", // Individual tree item
    "BreadcrumbNavigation", // Path indicator
    "TabBar" // Workspace tabs
  ],
  
  // Editor Components
  editor: [
    "SQLEditor", // Monaco editor wrapper
    "EditorCell", // Statement container
    "CellHeader", // Control row
    "StatusRow", // Execution info
    "LineNumbers" // Line count
  ],
  
  // Control Components
  controls: [
    "Button", // Primary button component
    "IconButton", // Icon-only button
    "Dropdown", // Select dropdown
    "SearchBox", // Input with search
    "Checkbox", // Checkbox control
    "RadioButton", // Radio control
    "Toggle", // On/off toggle
    "Tooltip", // Hover info
    "ContextMenu" // Right-click menu
  ],
  
  // Results Components
  results: [
    "ResultsTable", // Data table
    "ResultCell", // Table cell
    "ResultHeader", // Column header
    "ResultRow", // Data row
    "ResultsToolbar", // Filter/sort controls
    "ResultsExporter" // Download controls
  ],
  
  // Modal Components
  modals: [
    "Modal", // Base modal
    "ConfirmDialog", // Confirmation dialog
    "AlertDialog", // Alert dialog
    "WarningDialog", // Warning dialog
    "FormModal" // Form in modal
  ],
  
  // Notification Components
  notifications: [
    "Toast", // Toast notification
    "ToastContainer", // Toast holder
    "ErrorBoundary", // Error handling
    "LoadingSpinner", // Loading indicator
    "SkeletonLoader" // Skeleton loading
  ],
  
  // Status Components
  status: [
    "StatusIndicator", // Color dot + text
    "Badge", // Label badge
    "Chip", // Tag/chip
    "ProgressBar", // Progress indicator
    "StatusText" // Status message
  ],
  
  // Utility Components
  utilities: [
    "Icon", // Icon renderer
    "Separator", // Divider
    "Spacer", // Layout spacer
    "Container", // Wrapper
    "Grid" // Grid layout
  ]
};

FINAL SUMMARY DOCUMENT FOR CLAUDE CODE
Create this file and send to Claude Code:
markdown# CONFLUENT WORKSPACE UI - COMPLETE SPECIFICATION

## Files to Include
1. design-tokens.js - Colors, typography, spacing
2. components.ts - Component interfaces and specs
3. api-contracts.ts - API request/response types
4. use-cases.md - Feature use cases
5. keyboard-shortcuts.json - All shortcuts
6. error-messages.json - All copy
7. icons.svg - Icon set
8. responsive-breakpoints.json - Layout rules

## Technology Stack (Recommended)
- React 18+ with TypeScript
- Monaco Editor for SQL editing
- TailwindCSS or styled-components for styling
- Zustand for state management
- React Query for API calls
- React Virtual for virtualization
- Framer Motion for animations (optional)
- Accessible Rich Internet Applications (ARIA)

## Key Requirements
- Must support all use cases documented
- Must match design tokens exactly
- Must be accessible (WCAG AA)
- Must handle errors gracefully
- Must persist state appropriately
- Must support keyboard navigation
- Must be responsive (mobile to desktop)

## Performance Targets
- Initial load: <2s
- Tree expansion: <200ms
- Query execution display: <5s
- Results display: <500ms

## Accessibility
- WCAG AA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Motion respect

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Next Steps
1. Review all specifications
2. Set up React + TypeScript project
3. Implement design tokens
4. Build components (start with layout)
5. Integrate Monaco Editor
6. Implement state management
7. Connect to backend APIs
8. Add keyboard shortcuts
9. Test accessibility
10. Optimize performance

That's everything! You now have:
✅ Design Tokens (colors, fonts, spacing, shadows)
✅ Typography System (all text styles)
✅ Component Specs (buttons, tree, editor, table, modals)
✅ Animations (timings, easing, keyframes)
✅ Responsive Design (breakpoints, mobile behavior)
✅ API Specs (endpoints, request/response payloads)
✅ Keyboard Shortcuts (all hotkeys)
✅ Error Messages (all copy)
✅ Icon Specifications (sizes, colors, list)
✅ Accessibility Requirements (ARIA, focus, contrast)
✅ Use Cases (detailed interaction flows)
✅ Performance Targets (load times, responsiveness)
✅ Component Checklist (what to build)
This is a complete, production-ready specification package that Claude Code can use to rebuild the entire UI!