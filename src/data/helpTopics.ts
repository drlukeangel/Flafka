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
];
