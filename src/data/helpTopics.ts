/**
 * @help-system @faq-content-flink-sql @faq-content-troubleshooting @faq-content-keyboard-shortcuts
 * Static FAQ/Help topics for the Help Panel
 * Phase 10.1 ship-critical content
 */

import type { HelpTopic } from '../components/HelpPanel/types';

export const helpTopics: HelpTopic[] = [
  // ============================================================================
  // Flink SQL Concepts (5 entries)
  // ============================================================================
  {
    id: 'flink-cardinality-explosion',
    title: 'Why is my JOIN producing millions of rows or running out of memory?',
    category: 'flink-sql',
    sortOrder: 1,
    keywords: ['join', 'cardinality', 'memory', 'unbounded', 'window', 'explosion', 'rows'],
    relatedTopicIds: ['flink-streaming-select'],
    content: [
      {
        type: 'heading',
        text: 'Understanding Cardinality Explosion',
      },
      {
        type: 'paragraph',
        text: 'In streaming SQL, unwindowed JOINs on unbounded data streams can produce exponential row growth. Each new event from one stream is joined against ALL events in the other stream, creating a Cartesian product. This is called cardinality explosion.',
      },
      {
        type: 'paragraph',
        text: 'Example of a problematic query (BAD):',
      },
      {
        type: 'code-block',
        text: 'SELECT left.*, right.*\nFROM left_stream\nJOIN right_stream ON left.id = right.id;',
      },
      {
        type: 'paragraph',
        text: 'Solution: Use a windowing function to bound the join key scope. TUMBLE creates fixed-size time windows, ensuring each key is joined only within that window.',
      },
      {
        type: 'paragraph',
        text: 'Example with TUMBLE window (GOOD):',
      },
      {
        type: 'code-block',
        text: 'SELECT left.*, right.*\nFROM left_stream\nJOIN right_stream ON\n  left.id = right.id AND\n  TUMBLE_START(left.rowtime, INTERVAL \'1\' MINUTE) =\n  TUMBLE_START(right.rowtime, INTERVAL \'1\' MINUTE);',
      },
    ],
  },
  {
    id: 'flink-watermark-delays',
    title: 'Why do my event-time aggregation results appear delayed?',
    category: 'flink-sql',
    sortOrder: 2,
    keywords: ['watermark', 'delay', 'aggregation', 'event-time', 'lag', 'late-arriving', 'window'],
    relatedTopicIds: ['flink-proctime-rowtime'],
    content: [
      {
        type: 'heading',
        text: 'Understanding Watermark Delays',
      },
      {
        type: 'paragraph',
        text: 'Watermarks are progress indicators in event-time processing. A watermark value W means all events with timestamps ≤ W have been received. Event-time aggregations (GROUP BY with time windows) must wait for the watermark to advance past the window end before closing and emitting results. This lag is normal behavior, not a bug.',
      },
      {
        type: 'paragraph',
        text: 'Watermark delay causes include: (1) Slow producers—not enough data arriving to advance the watermark, (2) Partitioned topics—each partition has its own watermark; the global watermark is the minimum, and (3) Network latency—data in transit has not yet arrived at the Flink compute pool.',
      },
      {
        type: 'paragraph',
        text: 'To diagnose watermark lag, use CURRENT_WATERMARK() in a SELECT or check the compute pool logs for per-partition watermark progress.',
      },
    ],
  },
  {
    id: 'flink-streaming-select',
    title: 'Why does `SELECT *` never finish?',
    category: 'flink-sql',
    sortOrder: 3,
    keywords: ['select', 'limit', 'streaming', 'batch', 'terminate', 'never-ending', 'infinite'],
    relatedTopicIds: [],
    content: [
      {
        type: 'heading',
        text: 'Streaming vs Batch Mode',
      },
      {
        type: 'paragraph',
        text: 'This workspace runs in streaming mode (default for Confluent Cloud Flink). In streaming mode, SELECT without a LIMIT waits indefinitely for new events to arrive. The query never terminates because unbounded streams, by definition, have no end.',
      },
      {
        type: 'paragraph',
        text: 'Batch mode (used for historical queries) reads a finite dataset and stops. Streaming mode reads events as they arrive, one by one, forever. To see results immediately in this workspace, you must add a LIMIT clause.',
      },
      {
        type: 'paragraph',
        text: 'Examples:',
      },
      {
        type: 'code-block',
        text: 'SELECT * FROM my_topic LIMIT 10;  -- Returns first 10 events\nSELECT * FROM my_topic LIMIT 1;   -- Returns first event only\nSELECT COUNT(*) FROM my_topic;    -- Aggregations will run forever',
      },
    ],
  },
  {
    id: 'flink-proctime-rowtime',
    title: 'What\'s the difference between ROWTIME and PROCTIME?',
    category: 'flink-sql',
    sortOrder: 4,
    keywords: ['proctime', 'rowtime', 'time', 'event-time', 'processing-time', 'temporal', 'timestamp'],
    relatedTopicIds: ['flink-watermark-delays'],
    content: [
      {
        type: 'heading',
        text: 'PROCTIME vs ROWTIME: When to Use Each',
      },
      {
        type: 'paragraph',
        text: 'PROCTIME (Processing Time): The wall-clock timestamp when the Flink compute pool processes the row. PROCTIME is always advancing, never goes backward, and is never delayed. Use PROCTIME for monitoring, alerting, and low-latency queries.',
      },
      {
        type: 'paragraph',
        text: 'ROWTIME (Event Time): The event\'s original timestamp, embedded in the Kafka message (or assigned at ingestion). ROWTIME reflects when the event actually occurred, not when it was processed. Use ROWTIME for historical correctness, analytics on past events, and when event order matters.',
      },
      {
        type: 'paragraph',
        text: 'Example: Window a stream by event time (ROWTIME) for analytics, or by processing time (PROCTIME) for real-time dashboards.',
      },
      {
        type: 'code-block',
        text: 'SELECT TUMBLE_START(rowtime, INTERVAL \'1\' MINUTE) as window_start, COUNT(*)\nFROM events\nGROUP BY TUMBLE(rowtime, INTERVAL \'1\' MINUTE);  -- Event-time windowing\n\nSELECT TUMBLE_START(PROCTIME(), INTERVAL \'1\' MINUTE) as window_start, COUNT(*)\nFROM events\nGROUP BY TUMBLE(PROCTIME(), INTERVAL \'1\' MINUTE);  -- Processing-time windowing',
      },
    ],
  },
  {
    id: 'flink-changelog-semantics',
    title: 'Why do my aggregation results show duplicate rows with different values?',
    category: 'flink-sql',
    sortOrder: 5,
    keywords: ['changelog', 'retract', 'upsert', 'aggregation', 'duplicate', 'rows', 'semantics', 'streaming'],
    relatedTopicIds: [],
    content: [
      {
        type: 'heading',
        text: 'Understanding Changelog Rows',
      },
      {
        type: 'paragraph',
        text: 'Streaming aggregations output changelog rows: for each update to an aggregation result, Flink emits a retract (delete) of the old result and an insert (add) of the new result. This is how streaming SQL communicates incremental changes over time.',
      },
      {
        type: 'paragraph',
        text: 'This is NOT a bug or duplicate—it is the correct behavior for streaming mode. Each row you see represents a state change in the aggregation. If a GROUP BY has aggregated 5 events for key="user1", and then a 6th event arrives, you will see two rows: one deleting the old count, one inserting the new count.',
      },
      {
        type: 'paragraph',
        text: 'Example:',
      },
      {
        type: 'code-block',
        text: 'SELECT user_id, COUNT(*) as events_count\nFROM user_events\nGROUP BY user_id;\n\n-- As events arrive, you see:\n-- user1, 1\n-- user1, 2  (retract 1, insert 2)\n-- user1, 3  (retract 2, insert 3)\n-- ... and so on',
      },
    ],
  },

  // ============================================================================
  // Troubleshooting (2 entries)
  // ============================================================================
  {
    id: 'troubleshoot-results-buffer',
    title: 'Why do my results stop updating or older rows disappear?',
    category: 'troubleshooting',
    sortOrder: 1,
    keywords: ['results', 'buffer', 'stop', 'disappear', 'update', 'limit', '5000', 'cap', 'rows'],
    relatedTopicIds: [],
    content: [
      {
        type: 'heading',
        text: 'Results Buffer Capacity',
      },
      {
        type: 'paragraph',
        text: 'This workspace maintains a rolling buffer of the most recent 5,000 result rows. When new rows exceed this limit, the oldest rows are removed to free memory. This is intentional to prevent memory exhaustion from long-running queries.',
      },
      {
        type: 'paragraph',
        text: 'Solution: Add a LIMIT clause to your query to reduce result set size, or use filtering (WHERE clauses) to narrow the output. This also improves query performance.',
      },
    ],
  },
  {
    id: 'troubleshoot-autocomplete-limitation',
    title: 'Why are my column suggestions wrong or missing?',
    category: 'troubleshooting',
    sortOrder: 2,
    keywords: ['autocomplete', 'column', 'suggestions', 'sidebar', 'missing', 'wrong', 'limitation'],
    relatedTopicIds: [],
    content: [
      {
        type: 'heading',
        text: 'Autocomplete Limitation',
      },
      {
        type: 'paragraph',
        text: 'To get accurate column suggestions in the SQL editor, you must click on the table in the left sidebar. Clicking a table sends the TABLE schema to the autocomplete engine. Without this step, column suggestions are based on Flink\'s built-in keywords only.',
      },
      {
        type: 'paragraph',
        text: 'This is a known limitation of the current implementation. Full schema introspection during typing is planned for a future release.',
      },
    ],
  },
  {
    id: 'faq-rerun-statements',
    title: 'How do I rerun previous statements from history?',
    category: 'tips',
    sortOrder: 3,
    keywords: ['history', 'rerun', 'previous', 'statements', 'execute', 'load'],
    relatedTopicIds: ['keyboard-shortcuts'],
    content: [
      {
        type: 'heading',
        text: 'Rerunning Statements from History',
      },
      {
        type: 'paragraph',
        text: 'The History panel shows all your previous SQL statements. You can quickly rerun any of them without retyping.',
      },
      {
        type: 'paragraph',
        text: 'Steps:',
      },
      {
        type: 'list-item',
        text: 'Open the History panel (icon in sidebar or right panel)',
      },
      {
        type: 'list-item',
        text: 'Browse your previous statements or use the status tabs to filter (Completed, Running, Stopped, Failed)',
      },
      {
        type: 'list-item',
        text: 'Click any statement to load it into the editor',
      },
      {
        type: 'list-item',
        text: 'Press Ctrl+Enter to run it immediately',
      },
      {
        type: 'paragraph',
        text: 'Tip: History is persisted in your browser, so statements from previous sessions are available.',
      },
      {
        type: 'paragraph',
        text: 'Tip: You can also view result history for completed statements by clicking the "Load" button.',
      },
    ],
  },

  // ============================================================================
  // Phase 13.1 — Streams Help Topics (3 entries)
  // ============================================================================
  {
    id: 'stream-monitor',
    title: 'How do I monitor topic messages in real time?',
    category: 'sidebar',
    sortOrder: 4,
    keywords: ['stream', 'streams', 'monitor', 'topic', 'messages', 'browse', 'real-time', 'streams panel'],
    relatedTopicIds: ['stream-producer', 'stream-card-table'],
    content: [
      { type: 'heading', text: 'Streams' },
      { type: 'paragraph', text: 'The Streams panel lets you browse topic messages and monitor up to 5 topics simultaneously, without leaving the workspace.' },
      { type: 'list', text: 'Getting started:' },
      { type: 'list-item', text: 'Click the Activity icon in the Tools section of the navigation rail' },
      { type: 'list-item', text: 'Search and select topics using the checkboxes (max 5)' },
      { type: 'list-item', text: 'Click the Fetch icon on a stream card to load messages' },
      { type: 'list-item', text: 'Use the partition filter to narrow results' },
      { type: 'list-item', text: 'Use the \u22ee menu for actions like Duplicate, View Topic, View Schema, and Remove' },
      { type: 'paragraph', text: 'The Streams panel opens on the right side of the screen, independent of the left navigation panel. You can have Topics or Schemas open on the left while monitoring streams on the right.' },
      { type: 'list', text: 'Key features:' },
      { type: 'list-item', text: 'Background Flink SQL queries fetch messages with metadata (timestamp, partition, offset, key)' },
      { type: 'list-item', text: 'Client-side partition filtering' },
      { type: 'list-item', text: 'Closing the panel cancels all background queries automatically' },
      { type: 'list-item', text: 'Click the Reset button to clear output and stop auto-refresh' },
      { type: 'list-item', text: 'Collapsed cards show message count and LIVE status badges in the header' },
    ],
  },
  {
    id: 'stream-producer',
    title: 'How do I produce synthetic test data to a topic?',
    category: 'sidebar',
    sortOrder: 5,
    keywords: ['produce', 'synthetic', 'test data', 'generate', 'schema', 'avro', 'json schema', 'producer'],
    relatedTopicIds: ['stream-monitor', 'stream-card-table'],
    content: [
      { type: 'heading', text: 'Synthetic Data Producer' },
      { type: 'paragraph', text: 'Each stream card has a built-in synthetic data producer that generates and sends test messages based on the topic schema.' },
      { type: 'list', text: 'How to use:' },
      { type: 'list-item', text: 'Open the Streams panel and select a topic' },
      { type: 'list-item', text: 'Switch to Produce mode using the toggle in the card header, then click Start' },
      { type: 'list-item', text: 'The producer looks up the topic schema from the Schema Registry' },
      { type: 'list-item', text: 'Messages are produced at 1 per second with unique keys' },
      { type: 'list-item', text: 'Click the Stop button to halt production' },
      { type: 'list-item', text: 'Switch data source to Dataset to produce from pre-built test datasets' },
      { type: 'list-item', text: 'The data source dropdown next to Start lets you choose between Synthetic and Dataset modes' },
      { type: 'paragraph', text: 'The producer supports Avro and JSON Schema types. It uses field name heuristics to generate realistic data: ID fields get UUIDs, name fields get fake names, email fields get fake emails, and date fields get ISO timestamps.' },
      { type: 'list', text: 'Important notes:' },
      { type: 'list-item', text: 'A schema must exist for the topic (subject: {topicName}-value) or you will see "No schema found"' },
      { type: 'list-item', text: 'Protobuf schemas are not yet supported' },
      { type: 'list-item', text: 'The producer auto-stops if an error occurs or the card is removed' },
    ],
  },
  {
    id: 'stream-card-table',
    title: 'Understanding the stream card message table',
    category: 'sidebar',
    sortOrder: 6,
    keywords: ['stream', 'card', 'table', 'messages', 'partition', 'offset', 'timestamp', 'json', 'expand'],
    relatedTopicIds: ['stream-monitor', 'stream-producer'],
    content: [
      { type: 'heading', text: 'Stream Card Table' },
      { type: 'paragraph', text: 'Each stream card displays messages in a compact table with metadata columns and expandable JSON values.' },
      { type: 'list', text: 'Column descriptions:' },
      { type: 'list-item', text: '_ts — Message timestamp (HH:MM:SS format, full ISO in tooltip)' },
      { type: 'list-item', text: '_partition — Kafka partition number' },
      { type: 'list-item', text: '_offset — Message offset within the partition' },
      { type: 'list-item', text: '_key — Message key (truncated to 8 characters)' },
      { type: 'list-item', text: 'Value columns — Remaining fields from the message, with JSON values expandable' },
      { type: 'paragraph', text: 'Messages are sorted newest-first by timestamp. Click the expand button on any JSON value to open the JSON viewer with copy support.' },
      { type: 'list', text: 'Results bar:' },
      { type: 'list-item', text: 'Columns button — toggle column visibility with Show All / Hide All' },
      { type: 'list-item', text: 'Export button — download as CSV or JSON, or copy as Markdown' },
    ],
  },

  // ============================================================================
  // Jobs Page Help Topics (2 entries)
  // ============================================================================
  {
    id: 'stream-card-controls',
    title: 'What do the stream card controls do?',
    category: 'sidebar',
    sortOrder: 7,
    keywords: ['stream', 'card', 'reset', 'export', 'columns', 'live', 'start', 'stop', 'collapse', 'menu', 'ellipsis', 'actions', 'produce', 'consume', 'mode'],
    relatedTopicIds: ['stream-monitor', 'stream-producer', 'stream-card-table'],
    content: [
      { type: 'heading', text: 'Stream Card Controls' },
      { type: 'paragraph', text: 'Each stream card has controls for consuming, producing, and managing message output.' },
      { type: 'list', text: 'Consumer controls:' },
      { type: 'list-item', text: 'Fetch (icon) — One-shot message fetch using background Flink SQL' },
      { type: 'list-item', text: 'Live / Stop (icon) — Continuous auto-refresh every 3 seconds' },
      { type: 'list-item', text: 'Clear (eraser icon) — Clears all output, stops auto-refresh, cancels the server-side statement' },
      { type: 'list-item', text: 'Earliest / Latest — Controls the scan startup mode for message fetch' },
      { type: 'list', text: 'Producer controls:' },
      { type: 'list-item', text: 'Start / Stop — Produces synthetic or dataset records at 1 per second' },
      { type: 'list-item', text: 'Synthetic / Dataset — Choose data source for producing' },
      { type: 'list-item', text: 'Burst — Send all dataset records at once' },
      { type: 'list-item', text: 'Loop — Continuously repeat dataset records' },
      { type: 'list', text: 'Results bar:' },
      { type: 'list-item', text: 'Results toggle — Show/hide the message table' },
      { type: 'list-item', text: 'Columns — Toggle column visibility (Show All / Hide All)' },
      { type: 'list-item', text: 'Export — Download as CSV or JSON, or copy as Markdown' },
      { type: 'list', text: 'Card controls:' },
      { type: 'list-item', text: '\u22ee Menu — Opens card actions dropdown' },
      { type: 'list-item', text: 'Consume / Produce — Mode toggle in the card header' },
      { type: 'list-item', text: 'Collapse — Minimizes the card. Shows message count and LIVE badge when collapsed' },
      { type: 'list-item', text: 'Duplicate — Creates a copy of the stream card (in \u22ee menu)' },
      { type: 'list-item', text: 'View Topic — Navigate to topic detail panel (in \u22ee menu)' },
      { type: 'list-item', text: 'View Schema — Navigate to schema detail panel (in \u22ee menu)' },
      { type: 'list-item', text: 'Remove — Stops all activity and removes the card (in \u22ee menu)' },
    ],
  },
  {
    id: 'jobs-managing-statements',
    title: 'How do I manage running Flink statements?',
    category: 'sidebar',
    sortOrder: 8,
    keywords: ['jobs', 'statements', 'manage', 'running', 'stop', 'cancel', 'list', 'flink'],
    relatedTopicIds: ['jobs-load-workspace', 'faq-rerun-statements'],
    content: [
      { type: 'heading', text: 'Jobs Page — Statement Manager' },
      { type: 'paragraph', text: 'The Jobs page shows all Flink SQL statements running on your compute pool, including statements started outside this workspace. Use it to monitor, inspect, and stop jobs.' },
      { type: 'list', text: 'Getting started:' },
      { type: 'list-item', text: 'Click "Jobs" in the navigation rail (under Workspace)' },
      { type: 'list-item', text: 'Browse all statements in the full-width table' },
      { type: 'list-item', text: 'Use the search bar to filter by statement name or SQL content' },
      { type: 'list-item', text: 'Use the filter tabs (All, Running, Completed, Stopped, Failed) to narrow results' },
      { type: 'list-item', text: 'Click the Stop button on any running or pending statement to cancel it' },
      { type: 'list-item', text: 'Click a row to see full statement details, SQL code, and properties' },
      { type: 'paragraph', text: 'The Jobs page caches statement data for fast navigation. Click the Refresh button to check for updates. Running statements auto-refresh every 5 seconds when viewing their detail page. You can configure the cache interval in Settings > Performance.' },
    ],
  },
  {
    id: 'jobs-load-workspace',
    title: 'How do I load a job\'s SQL into the workspace?',
    category: 'sidebar',
    sortOrder: 9,
    keywords: ['jobs', 'load', 'workspace', 'sql', 'reuse', 'copy', 'editor'],
    relatedTopicIds: ['jobs-managing-statements', 'faq-rerun-statements'],
    content: [
      { type: 'heading', text: 'Loading SQL from Jobs' },
      { type: 'paragraph', text: 'You can take any statement from the Jobs page and load its SQL into a new editor cell in your workspace.' },
      { type: 'list', text: 'Steps:' },
      { type: 'list-item', text: 'Open the Jobs page and click on a statement row' },
      { type: 'list-item', text: 'In the detail view, find the SQL Statement section' },
      { type: 'list-item', text: 'Click the "Load in Workspace" button' },
      { type: 'list-item', text: 'A new editor cell is created with the SQL, and you are returned to the workspace' },
      { type: 'paragraph', text: 'This is useful for rerunning past queries, debugging failed statements, or building on existing SQL.' },
    ],
  },

  // ============================================================================
  // Artifacts Panel Help Topics (3 entries)
  // ============================================================================
  {
    id: 'artifacts-browse',
    title: 'How do I browse and manage Flink artifacts?',
    category: 'sidebar',
    sortOrder: 9,
    keywords: ['artifacts', 'browse', 'manage', 'jar', 'udf', 'functions', 'flink', 'package'],
    relatedTopicIds: ['artifacts-create-function', 'artifacts-upload'],
    content: [
      { type: 'heading', text: 'Artifacts Panel' },
      { type: 'paragraph', text: 'The Artifacts panel lets you browse, upload, and delete Flink JAR artifacts (UDFs) deployed to Confluent Cloud without leaving the workspace.' },
      { type: 'list', text: 'Getting started:' },
      { type: 'list-item', text: 'Click the Package icon in the Data section of the navigation rail' },
      { type: 'list-item', text: 'Browse your artifacts or use the search bar to filter by name or class' },
      { type: 'list-item', text: 'Click an artifact to view its metadata, versions, and SQL snippet' },
      { type: 'list-item', text: 'Use the Refresh button to reload the artifact list' },
      { type: 'paragraph', text: 'The panel requires Flink API keys (VITE_FLINK_API_KEY / VITE_FLINK_API_SECRET) to be configured. If not set, you will see a configuration warning.' },
    ],
  },
  {
    id: 'artifacts-create-function',
    title: 'How do I create a Flink SQL function from an artifact?',
    category: 'sidebar',
    sortOrder: 10,
    keywords: ['artifacts', 'create function', 'sql', 'udf', 'jar', 'python', 'zip', 'using jar', 'confluent-artifact', 'snippet'],
    relatedTopicIds: ['artifacts-browse', 'artifacts-upload', 'artifacts-python-udf'],
    content: [
      { type: 'heading', text: 'Creating Functions from Artifacts' },
      { type: 'paragraph', text: 'Each artifact detail view includes a ready-to-use CREATE FUNCTION SQL template. The syntax uses USING JAR for both Java and Python artifacts — Flink resolves the format from the artifact ID.' },
      { type: 'list', text: 'Steps:' },
      { type: 'list-item', text: 'Open the Artifacts panel and click on an artifact' },
      { type: 'list-item', text: 'Find the SQL section at the top of the detail view' },
      { type: 'list-item', text: 'If the artifact has multiple versions, select the desired version from the dropdown' },
      { type: 'list-item', text: 'Click "Copy" to copy the SQL to your clipboard, or "Insert at cursor" to insert it directly into the focused editor cell' },
      { type: 'list-item', text: 'Replace <function_name> with your desired function name' },
      { type: 'paragraph', text: 'Example generated SQL:' },
      { type: 'code-block', text: 'CREATE FUNCTION my_udf\n  AS \'com.example.MyUdf\'\n  USING JAR \'confluent-artifact://cfa-abc123/ver-1\';' },
      { type: 'paragraph', text: 'Note: The USING JAR syntax works for both Java JAR and Python ZIP artifacts. Flink determines the runtime from the artifact metadata.' },
    ],
  },
  {
    id: 'artifacts-upload',
    title: 'How do I upload a JAR or ZIP artifact?',
    category: 'sidebar',
    sortOrder: 11,
    keywords: ['artifacts', 'upload', 'jar', 'zip', 'python', 'deploy', 'udf', 'create artifact', 'package'],
    relatedTopicIds: ['artifacts-browse', 'artifacts-create-function', 'artifacts-python-udf'],
    content: [
      { type: 'heading', text: 'Uploading Artifacts' },
      { type: 'paragraph', text: 'You can upload Java JAR or Python ZIP files directly from the Artifacts panel to deploy UDFs to Confluent Cloud.' },
      { type: 'list', text: 'Steps:' },
      { type: 'list-item', text: 'Open the Artifacts panel and click the "Upload" button' },
      { type: 'list-item', text: 'Select the content format: JAR (Java) or ZIP (Python)' },
      { type: 'list-item', text: 'Fill in the Display Name and Entry Class' },
      { type: 'list-item', text: 'For Java: fully-qualified class name (e.g. com.example.MyUdf)' },
      { type: 'list-item', text: 'For Python: simple identifier (e.g. sentiment_score)' },
      { type: 'list-item', text: 'Optionally add a description and documentation link' },
      { type: 'list-item', text: 'Select your file (max 256MB)' },
      { type: 'list-item', text: 'Click Upload and wait for the 3-step process to complete' },
      { type: 'paragraph', text: 'The upload process has three steps: requesting an upload URL, uploading the file (with progress bar), and creating the artifact record. You can cancel the upload at any time.' },
    ],
  },
  {
    id: 'artifacts-python-udf',
    title: 'Using Python UDFs with Flink',
    category: 'sidebar',
    sortOrder: 12,
    keywords: ['python', 'udf', 'zip', 'artifact', 'function', 'pyflink'],
    relatedTopicIds: ['artifacts-upload', 'artifacts-create-function', 'artifacts-examples'],
    content: [
      { type: 'heading', text: 'Python UDFs' },
      { type: 'paragraph', text: 'Confluent Cloud Flink supports Python UDFs packaged as ZIP files. The ZIP should contain a Python module with the UDF function.' },
      { type: 'list', text: 'Key differences from Java UDFs:' },
      { type: 'list-item', text: 'Content format is ZIP (not JAR)' },
      { type: 'list-item', text: 'Runtime language is PYTHON (not JAVA)' },
      { type: 'list-item', text: 'Entry class is a simple Python identifier (e.g. sentiment_score), not a dotted Java package' },
      { type: 'list-item', text: 'The SQL syntax uses USING JAR regardless — Flink resolves the runtime from artifact metadata' },
      { type: 'paragraph', text: 'Example:' },
      { type: 'code-block', text: 'CREATE FUNCTION sentiment_score\n  AS \'sentiment_score\'\n  USING JAR \'confluent-artifact://cfa-abc123/ver-1\';' },
    ],
  },
  {
    id: 'artifacts-examples',
    title: 'UDF Examples: Java & Python',
    category: 'sidebar',
    sortOrder: 13,
    keywords: ['examples', 'udf', 'java', 'python', 'mask email', 'sentiment', 'tutorial', 'sample'],
    relatedTopicIds: ['artifacts-create-function', 'artifacts-python-udf'],
    content: [
      { type: 'heading', text: 'UDF Examples' },
      { type: 'paragraph', text: 'The Examples panel (Book icon in the Tools section) provides ready-to-use SQL examples including UDF creation, querying, and windowed aggregations.' },
      { type: 'list', text: 'Available examples:' },
      { type: 'list-item', text: 'Hello World — SELECT 1 sanity check' },
      { type: 'list-item', text: 'Java UDF — Create and query a MaskEmail function' },
      { type: 'list-item', text: 'Python UDF — Create and query a SentimentScore function' },
      { type: 'list-item', text: 'Show Functions — List all registered functions' },
      { type: 'list-item', text: 'Create Example Table — DDL with watermark' },
      { type: 'list-item', text: 'Windowed Aggregation — TVF tumbling window' },
      { type: 'paragraph', text: 'Click "Import" on any example to create a new editor cell with the SQL pre-filled.' },
    ],
  },

  // ============================================================================
  // Compute Pool Dashboard (1 entry)
  // ============================================================================
  {
    id: 'compute-pool-dashboard',
    title: 'How do I monitor compute pool usage and running statements?',
    category: 'sidebar',
    sortOrder: 14,
    keywords: ['compute pool', 'cfu', 'dashboard', 'running', 'statements', 'telemetry', 'stop', 'metrics'],
    relatedTopicIds: ['jobs-managing-statements'],
    content: [
      { type: 'heading', text: 'Compute Pool Dashboard' },
      { type: 'paragraph', text: 'Click the compute pool status badge in the header to open the dashboard panel. It shows all running statements on your compute pool with real-time metrics.' },
      { type: 'list', text: 'Available metrics:' },
      { type: 'list-item', text: 'CFU \u2014 Confluent Flink Units consumed by each statement' },
      { type: 'list-item', text: 'Records In/Out \u2014 Message throughput' },
      { type: 'list-item', text: 'Pending \u2014 Buffered records waiting to be processed' },
      { type: 'list-item', text: 'State Size \u2014 Operator state backend size (MB/GB)' },
      { type: 'list', text: 'Actions:' },
      { type: 'list-item', text: 'Click Refresh to reload metrics (auto-refreshes every 60 seconds)' },
      { type: 'list-item', text: 'Click Stop to cancel a running statement' },
      { type: 'list-item', text: 'Hover over a statement name to see its SQL' },
      { type: 'paragraph', text: 'The badge shows current/max CFU (e.g. "4/10 CFU"). Statements from your workspace are highlighted; external statements appear muted.' },
      { type: 'paragraph', text: 'Drag the bottom edge of the panel to resize it. Click "View all jobs" to open the full Jobs page.' },
    ],
  },

  // ============================================================================
  // Performance / Caching (1 entry)
  // ============================================================================
  {
    id: 'performance-caching',
    title: 'How does data caching work for Jobs and History?',
    category: 'sidebar',
    sortOrder: 15,
    keywords: ['cache', 'caching', 'performance', 'refresh', 'interval', 'ttl', 'clear', 'data', 'stale'],
    relatedTopicIds: ['jobs-managing-statements', 'faq-rerun-statements'],
    content: [
      { type: 'heading', text: 'Data Caching' },
      { type: 'paragraph', text: 'The Jobs and History pages cache their data after the first load. Subsequent visits use a fast refresh that checks for new statements and status changes without re-fetching everything.' },
      { type: 'list', text: 'How it works:' },
      { type: 'list-item', text: 'First visit: Full data load from the server' },
      { type: 'list-item', text: 'Return visits: Quick refresh picks up new and changed statements' },
      { type: 'list-item', text: 'Running/Pending jobs have their status refreshed individually' },
      { type: 'list-item', text: 'After the refresh interval expires, the next visit does a full reload' },
      { type: 'list', text: 'Settings:' },
      { type: 'list-item', text: 'Open Settings and find the Performance section' },
      { type: 'list-item', text: 'Data refresh interval \u2014 how long cached data is kept before a full reload (default: 10 minutes)' },
      { type: 'list-item', text: 'Clear Cached Data \u2014 removes all cached Jobs and History data; pages will fully reload on next visit' },
      { type: 'paragraph', text: 'The refresh button on Jobs and History pages always checks for updates. Changing the resource filter (My Statements vs All) automatically refreshes the data.' },
    ],
  },

  // ============================================================================
  // Keyboard Shortcuts (1 entry)
  // ============================================================================
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    category: 'keyboard-shortcuts',
    sortOrder: 1,
    keywords: ['keyboard', 'shortcut', 'ctrl', 'escape', 'enter', 'alt', 'navigation', 'help'],
    relatedTopicIds: [],
    content: [
      {
        type: 'heading',
        text: 'Essential Keyboard Shortcuts',
      },
      {
        type: 'list',
        text: 'Run current cell',
      },
      {
        type: 'list-item',
        text: 'Ctrl+Enter: Execute the SQL in the focused editor cell',
      },
      {
        type: 'list-item',
        text: 'Escape: Stop a running query',
      },
      {
        type: 'list-item',
        text: 'Ctrl+S: Save current workspace',
      },
      {
        type: 'list-item',
        text: 'Ctrl+Alt+Up: Navigate to previous cell',
      },
      {
        type: 'list-item',
        text: 'Ctrl+Alt+Down: Navigate to next cell (or create new cell if at end)',
      },
      {
        type: 'list-item',
        text: '?: Open this Help panel',
      },
      {
        type: 'paragraph',
        text: 'Note: In the SQL editor, use the browser\'s native shortcuts for undo (Ctrl+Z) and redo (Ctrl+Y or Ctrl+Shift+Z).',
      },
    ],
  },
  {
    id: 'saved-workspaces',
    title: 'How do I save and restore a workspace?',
    category: 'sidebar',
    sortOrder: 15,
    keywords: ['workspace', 'save', 'open', 'restore', 'stream', 'cards', 'sql', 'snapshot'],
    relatedTopicIds: ['snippets', 'jobs-managing-statements'],
    content: [
      { type: 'heading', text: 'Saved Workspaces' },
      { type: 'paragraph', text: 'Saved Workspaces let you snapshot your entire workspace — SQL cells and stream card configs — and restore it in one click.' },
      { type: 'list', text: 'How to save:' },
      { type: 'list-item', text: 'Click the save icon on the active tab in the tab bar, press Ctrl+S, or open the Workspaces panel and click Save Current' },
      { type: 'list-item', text: 'The workspace saves with the current tab name. Double-click a tab to rename it before saving.' },
      { type: 'list', text: 'How to restore:' },
      { type: 'list-item', text: 'Open the Workspaces panel from the left nav rail' },
      { type: 'list-item', text: 'Click the folder icon on any saved workspace to open it' },
      { type: 'list-item', text: 'Running statements in the current workspace are cancelled before restoring' },
      { type: 'list', text: 'Stream card fidelity:' },
      { type: 'list-item', text: 'Produce mode cards are restored with their dataset pre-selected' },
      { type: 'list-item', text: 'Consume mode cards restore with their scan mode (earliest/latest)' },
      { type: 'list', text: 'Notes:' },
      { type: 'list-item', text: 'A dot indicator appears on tabs that have workspace notes attached' },
      { type: 'list-item', text: 'Click the notes icon on the active tab to open or close the notes panel' },
      { type: 'paragraph', text: 'If a SQL statement was RUNNING when you saved, the workspace will automatically reconnect to it on open — if the job is still active on the Confluent Flink compute pool.' },
    ],
  },
  {
    id: 'split-buttons',
    title: 'What do the split buttons (Stop/Delete/Run) do?',
    category: 'editor',
    sortOrder: 52,
    keywords: ['stop', 'delete', 'run', 'all', 'split', 'button', 'streams', 'workspace'],
    relatedTopicIds: ['jobs-managing-statements', 'saved-workspaces'],
    content: [
      { type: 'heading', text: 'Split Buttons' },
      { type: 'paragraph', text: 'The header has three split buttons — Stop All, Delete All, and Run All. Click the left side for the default action, or click the chevron on the right for scoped options.' },
      { type: 'list', text: 'Stop All:' },
      { type: 'list-item', text: 'Default — Stops all running SQL statements and streams' },
      { type: 'list-item', text: 'Stop Queries — Stops only SQL statements (keeps streams running)' },
      { type: 'list-item', text: 'Stop Streams — Stops only stream cards (keeps SQL statements running)' },
      { type: 'list', text: 'Delete All:' },
      { type: 'list-item', text: 'Default — Removes all SQL cells and stream cards from the workspace' },
      { type: 'list-item', text: 'Delete Queries — Removes only SQL cells (keeps stream cards)' },
      { type: 'list-item', text: 'Delete Streams — Removes only stream cards (keeps SQL cells)' },
      { type: 'list', text: 'Run All:' },
      { type: 'list-item', text: 'Default — Runs all idle/errored SQL statements and starts all idle stream cards' },
      { type: 'list-item', text: 'Run Queries — Runs only idle/errored SQL statements' },
      { type: 'list-item', text: 'Run Streams — Starts only idle stream cards' },
    ],
  },

  // ============================================================================
  // Education Center (1 entry)
  // ============================================================================
  {
    id: 'learn-center',
    title: 'How do I use the Learning Center?',
    category: 'sidebar',
    sortOrder: 60,
    keywords: ['learn', 'education', 'tracks', 'examples', 'progress', 'badges', 'challenges', 'concepts'],
    relatedTopicIds: ['flink-streaming-select', 'flink-cardinality-explosion'],
    content: [
      { type: 'heading', text: 'Education Center Overview' },
      { type: 'paragraph', text: 'The Learning Center (Learn tab in the navigation rail) is a full-page education hub covering Flink SQL, Kafka, and Confluent Cloud. It replaces the old Examples panel with a richer learning experience including guided tracks, concept explainers, challenges, and progress tracking.' },
      { type: 'heading', text: 'Tabs' },
      { type: 'paragraph', text: 'The Learn page has two tabs: Tracks and Examples.' },
      { type: 'list', text: 'Tracks tab:' },
      { type: 'list-item', text: 'Browse 7 learning tracks organized by topic and difficulty' },
      { type: 'list-item', text: 'Each track contains a mix of concept lessons and hands-on examples' },
      { type: 'list-item', text: 'Progress bars show your completion percentage per track' },
      { type: 'list-item', text: 'Some tracks have prerequisites — look for the "Skip ahead" link if you want to jump in' },
      { type: 'list', text: 'Examples tab:' },
      { type: 'list-item', text: 'All 46 example cards in a responsive grid — same Set Up flow as before' },
      { type: 'list-item', text: 'Completed examples show a green checkmark overlay' },
      { type: 'list-item', text: 'Search and filter by group, skill level, and tags' },
      { type: 'heading', text: 'Progress Tracking' },
      { type: 'paragraph', text: 'Your learning progress is automatically saved to your browser (localStorage). Complete examples by clicking "Mark Complete" after working through them. Earn badges for milestones like completing tracks, finishing challenges, or mastering all examples.' },
      { type: 'heading', text: 'Concept Lessons' },
      { type: 'paragraph', text: 'Concept lessons explain theory with animated diagrams — covering topics like watermarks, join types, state management, and Kafka fundamentals. These are embedded within tracks alongside hands-on examples.' },
      { type: 'heading', text: 'Challenges' },
      { type: 'paragraph', text: 'Each example has "Try It Yourself" challenges at the bottom of its detail page. Challenges prompt you to modify the SQL or explore edge cases. Hints are available if you get stuck.' },
      { type: 'heading', text: 'Role Tags' },
      { type: 'paragraph', text: 'Tracks show recommended role tags (Data Engineer, Analytics Engineer, Platform Engineer) to help you prioritize which tracks are most relevant to your work. These are soft suggestions — all tracks are available to everyone.' },
    ],
  },

  // ============================================================================
  // ksqlDB (5 entries)
  // ============================================================================
  {
    id: 'ksqldb-vs-flink',
    title: "What's the difference between Flink SQL and ksqlDB?",
    category: 'ksqldb',
    sortOrder: 1,
    keywords: ['ksqldb', 'flink', 'engine', 'difference', 'compare', 'selector', 'toggle'],
    relatedTopicIds: ['ksqldb-query-types', 'ksqldb-scan-modes'],
    content: [
      { type: 'heading', text: 'Two Engines, Same Kafka Topics' },
      { type: 'paragraph', text: 'This workspace supports two SQL engines. Each cell has an engine selector dropdown in its header — choose between Flink SQL and ksqlDB per statement. Both engines read from and write to the same Kafka topics, so stream cards work identically regardless of engine.' },
      { type: 'heading', text: 'Flink SQL' },
      { type: 'paragraph', text: 'Full SQL standard dialect. Supports windowed aggregations (TUMBLE, HOP, CUMULATE), MATCH_RECOGNIZE, temporal joins, and async statement polling. Runs on a dedicated Confluent Cloud compute pool.' },
      { type: 'heading', text: 'ksqlDB' },
      { type: 'paragraph', text: 'KSQL dialect with push queries (EMIT CHANGES), pull queries, and persistent queries (CREATE STREAM/TABLE AS SELECT). Uses a shared ksqlDB cluster. Simpler syntax, real-time streaming by default.' },
      { type: 'heading', text: 'When to Use Which' },
      { type: 'paragraph', text: 'Use Flink for complex windowed aggregations, batch-style queries, and advanced SQL features. Use ksqlDB for simple stream transformations, fan-out routing, and when you want instant push-query results.' },
    ],
  },
  {
    id: 'ksqldb-query-types',
    title: 'Understanding ksqlDB query types',
    category: 'ksqldb',
    sortOrder: 2,
    keywords: ['ksqldb', 'push', 'pull', 'persistent', 'emit', 'changes', 'query', 'type'],
    relatedTopicIds: ['ksqldb-vs-flink', 'ksqldb-scan-modes'],
    content: [
      { type: 'heading', text: 'Four Types of ksqlDB Statements' },
      { type: 'paragraph', text: 'ksqlDB classifies SQL into four categories, each handled differently:' },
      { type: 'heading', text: 'Pull Queries' },
      { type: 'paragraph', text: 'A regular SELECT without EMIT CHANGES. Returns an immediate result set (like a batch query) and completes. Example:' },
      { type: 'code-block', text: "SELECT * FROM my_table WHERE id = 'abc';" },
      { type: 'heading', text: 'Push Queries' },
      { type: 'paragraph', text: 'A SELECT with EMIT CHANGES. Streams rows continuously until you cancel. Results appear in real time.' },
      { type: 'code-block', text: 'SELECT * FROM my_stream EMIT CHANGES;' },
      { type: 'heading', text: 'Persistent Queries' },
      { type: 'paragraph', text: 'CREATE STREAM/TABLE AS SELECT or INSERT INTO ... SELECT. These create server-side continuous queries that run until you TERMINATE them. They show as RUNNING in the cell.' },
      { type: 'code-block', text: 'CREATE STREAM filtered AS\n  SELECT * FROM orders WHERE amount > 100\n  EMIT CHANGES;' },
      { type: 'heading', text: 'DDL Statements' },
      { type: 'paragraph', text: 'CREATE STREAM/TABLE, DROP, SHOW, DESCRIBE, EXPLAIN. These execute synchronously and complete immediately.' },
    ],
  },
  {
    id: 'ksqldb-scan-modes',
    title: 'Why does my ksqlDB query show different scan modes?',
    category: 'ksqldb',
    sortOrder: 3,
    keywords: ['ksqldb', 'scan', 'mode', 'offset', 'earliest', 'latest', 'auto.offset.reset'],
    relatedTopicIds: ['ksqldb-vs-flink', 'ksqldb-query-types'],
    content: [
      { type: 'heading', text: 'ksqlDB Scan Modes' },
      { type: 'paragraph', text: 'When using the ksqlDB engine, the scan mode dropdown shows only two options: Earliest and Latest. This maps to ksqlDB\'s ksql.streams.auto.offset.reset property.' },
      { type: 'heading', text: 'Why Only Two?' },
      { type: 'paragraph', text: 'Flink SQL supports 5 scan modes (earliest, latest, group offsets, timestamp, specific offsets) because its consumer can be configured at a granular level. ksqlDB only supports auto.offset.reset with values "earliest" or "latest" — the other modes are Flink-specific features.' },
      { type: 'heading', text: 'Behavior' },
      { type: 'list', text: 'Earliest — reads from the beginning of the topic (auto.offset.reset=earliest)' },
      { type: 'list', text: 'Latest — reads only new messages arriving after the query starts (auto.offset.reset=latest)' },
    ],
  },

  // ============================================================================
  // ksqlDB (2 entries)
  // ============================================================================
  {
    id: 'ksqldb-manage-queries',
    title: 'How do I manage ksqlDB persistent queries?',
    category: 'ksqldb',
    sortOrder: 1,
    keywords: ['ksqldb', 'queries', 'persistent', 'manage', 'terminate', 'CSAS', 'CTAS', 'list'],
    relatedTopicIds: ['ksqldb-dashboard'],
    content: [
      {
        type: 'heading',
        text: 'ksqlDB Queries Page',
      },
      {
        type: 'paragraph',
        text: 'Navigate to the ksqlDB Queries page using the "ksqlDB Queries" item in the left navigation rail. This page shows all persistent queries running on your ksqlDB cluster.',
      },
      {
        type: 'heading',
        text: 'Features',
      },
      {
        type: 'list',
        text: 'Available actions:',
      },
      {
        type: 'list-item',
        text: 'Search — filter queries by ID or SQL content',
      },
      {
        type: 'list-item',
        text: 'Status filter — show only RUNNING, PAUSED, or ERROR queries',
      },
      {
        type: 'list-item',
        text: 'Terminate — stop a running persistent query',
      },
      {
        type: 'list-item',
        text: 'Bulk terminate — select multiple queries and terminate them at once',
      },
      {
        type: 'list-item',
        text: 'Load in Workspace — copy a query\'s SQL into a new ksqlDB editor cell',
      },
      {
        type: 'heading',
        text: 'Deep Linking',
      },
      {
        type: 'paragraph',
        text: 'You can link directly to a specific query using the URL pattern /ksql-queries/{queryId}. The query ID is the identifier shown in the list (e.g., CSAS_MY_STREAM_0).',
      },
    ],
  },
  {
    id: 'ksqldb-dashboard',
    title: 'What is the ksqlDB dashboard?',
    category: 'ksqldb',
    sortOrder: 2,
    keywords: ['ksqldb', 'dashboard', 'badge', 'panel', 'monitor', 'running'],
    relatedTopicIds: ['ksqldb-manage-queries'],
    content: [
      {
        type: 'heading',
        text: 'ksqlDB Dashboard',
      },
      {
        type: 'paragraph',
        text: 'The ksqlDB dashboard is a push-down panel that shows your persistent queries at a glance. Click the "ksqlDB" badge in the header bar to toggle it open.',
      },
      {
        type: 'heading',
        text: 'What it shows',
      },
      {
        type: 'list',
        text: 'The dashboard displays:',
      },
      {
        type: 'list-item',
        text: 'Query ID and current status (RUNNING, PAUSED, ERROR)',
      },
      {
        type: 'list-item',
        text: 'Query type (CREATE STREAM AS, CREATE TABLE AS, INSERT INTO)',
      },
      {
        type: 'list-item',
        text: 'SQL preview and output sink topic',
      },
      {
        type: 'paragraph',
        text: 'The dashboard auto-refreshes every 30 seconds while open. You can also click the refresh button for an immediate update.',
      },
      {
        type: 'heading',
        text: 'Mutual Exclusion',
      },
      {
        type: 'paragraph',
        text: 'Only one dashboard can be open at a time. Opening the ksqlDB dashboard will automatically close the Compute Pool dashboard, and vice versa.',
      },
    ],
  },
];
