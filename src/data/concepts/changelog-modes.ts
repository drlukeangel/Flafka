import type { ConceptContent } from '../../types/learn';

export const changelogModesContent: ConceptContent = {
  animation: 'changelog-modes',
  sections: [
    {
      heading: 'Two Ways to Interpret the Same Data',
      body: 'Every Kafka topic is an append-only log at the storage level. But Flink SQL can interpret that log in two fundamentally different ways: as an ever-growing sequence of immutable events (append mode), or as a continuously-updating state table where each key has exactly one current value (upsert mode). The choice between these two modes determines the shape, size, and semantics of your output. Same input data, completely different results.',
    },
    {
      heading: 'Append Mode: The Event Log',
      body: 'In append mode, every record is a new, permanent fact. Send 5 events with the same key and your table has 5 rows. The table grows monotonically — nothing is ever updated or retracted. This is the natural model for event sourcing, audit trails, and raw event capture. The downside: unbounded growth. A busy topic can produce millions of rows per hour, and every single one stays in your result table forever.',
    },
    {
      heading: 'Upsert Mode: The State Table',
      body: 'In upsert mode, the primary key determines whether a record is an INSERT or an UPDATE. First time we see key "A"? That is an insert. Second time? That is an update — the previous row for key "A" is replaced. The result is always a compact table with at most one row per unique key. This is the natural model for materialized views, entity state tracking, and aggregation results. The downside: you lose the history of individual changes.',
    },
    {
      heading: 'The Changelog Under the Hood',
      body: 'Flink internally represents all data changes as a changelog stream with four message types: +I (insert), -U (update before), +U (update after), and -D (delete). Append mode only ever emits +I messages. Upsert mode emits +I for new keys, then -U/+U pairs for updates, and -D for deletions (tombstones). Understanding this internal representation is the key to debugging unexpected results when your downstream consumers see retraction messages they did not expect.',
    },
    {
      heading: 'When to Use Which',
      body: 'Use append when you need a complete, immutable record of everything that happened — audit trails, event sourcing, raw data capture, compliance logs. Use upsert when you need the current state of each entity — customer profiles, account balances, aggregation dashboards, materialized views. Many pipelines use both: append for the raw capture layer, then upsert for the derived state layer downstream.',
    },
  ],
};
