import type { ConceptContent } from '../../types/learn';

export const stateManagementContent: ConceptContent = {
  animation: 'state-accumulate',
  sections: [
    {
      heading: 'What Even Is State?',
      body: 'Lots of streaming operations need a memory. A running count needs to remember its total. A join needs to remember records from both sides. A deduplication query needs to remember which keys it has already seen. That memory is called state, and in Flink SQL the runtime manages it for you automatically. When you write a GROUP BY, Flink creates keyed state behind the scenes to store intermediate aggregate values for each group. When you write a join, both sides get stashed in state so matches can happen when new records arrive. You never declare state explicitly -- the SQL planner figures out what is needed from your query.',
    },
    {
      heading: 'Keyed State: Divide and Conquer',
      body: 'State in Flink is keyed, meaning it is partitioned by whatever key your query uses -- GROUP BY keys, join keys, or deduplication keys. Each unique key gets its own isolated chunk of state. This is what lets Flink distribute work across the compute pool and process different keys in parallel. On Confluent Cloud, keyed state lives in a managed, durable storage layer that the platform maintains. You do not need to worry about where it lives or how it is replicated. You do need to worry about how much of it you are accumulating, which brings us to the next section.',
    },
    {
      heading: 'State TTL: Your Best Friend',
      body: 'Streaming queries run forever, and state grows forever with them unless you intervene. New users keep appearing in your COUNT(*) GROUP BY user_id, and old users who stopped generating events still occupy resources. The fix is table.exec.state.ttl, which tells Flink to expire state entries that have not been accessed or updated within the specified duration. Set it to \'1h\' and any state entry untouched for an hour gets cleaned up. Choosing the right TTL is a balancing act: too short and Flink forgets things it still needs (counts reset, joins miss matches), too long and you hoard state you will never use again. Analyze your data patterns, pick a reasonable duration, and add a safety margin.',
    },
    {
      heading: 'Which Operators Are Stateful?',
      body: 'Understanding which SQL patterns create state helps you reason about resource usage. Aggregations (GROUP BY) are stateful -- Flink maintains current aggregate values per key. Windowed aggregations are a special case where state is bounded by the window and cleaned up when it closes. Joins are stateful: regular joins keep both sides, temporal joins keep versioned records, interval joins keep records within the time range. Deduplication with ROW_NUMBER and MATCH_RECOGNIZE patterns also maintain state per partition key. Only simple filters (WHERE), projections (SELECT), and stateless transformations are truly state-free. If your query remembers anything across events, it is stateful.',
    },
    {
      heading: 'Keeping State Under Control',
      body: 'Rule one: always set table.exec.state.ttl for long-running queries. The default behavior keeps state forever, which is almost never what you want. Rule two: minimize state by design. Use windowed aggregations instead of unbounded GROUP BY when time-bounded results are sufficient. Use interval joins instead of regular joins when you know the temporal correlation. Choose lookup joins over regular joins for slowly-changing dimensions. Rule three: monitor state size through Confluent Cloud metrics. Steadily growing state means accumulation is outpacing cleanup -- time to adjust your TTL or rethink your query design. A well-tuned pipeline should show state that grows, plateaus, and periodically trims as TTL kicks in.',
    },
  ],
};
