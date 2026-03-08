import type { ConceptContent } from '../../types/learn';

export const joinTypesContent: ConceptContent = {
  animation: 'join-match',
  sections: [
    {
      heading: 'Regular Joins: The Brute-Force Matchmaker',
      body: 'A regular join in Flink SQL works like a classic SQL join, except both sides are streams that never stop. Every time a new record lands on either side, Flink checks the other side for matches and emits results. The catch? Flink has to keep every record from both sides in state indefinitely, because a future event might match something from the distant past. That means unbounded state growth unless you set table.exec.state.ttl to a sane duration. Regular joins support INNER, LEFT, RIGHT, and FULL OUTER variants, but treat them as the heavy artillery -- powerful and flexible, but expensive if you are not careful with TTL.',
    },
    {
      heading: 'Temporal Joins: Time-Travel Lookups',
      body: 'Temporal joins let you look up a versioned table as it existed at a specific point in time. The syntax uses FOR SYSTEM_TIME AS OF to tell Flink: "give me the row that was current when this event happened, not whatever the value is now." This is essential for things like currency conversion or interest-rate lookups -- if a loan was submitted when the rate was 4.5%, you want 4.5%, not today\'s 5.0%. The right side must be a versioned table backed by a changelog topic with a primary key. Temporal joins are more efficient than regular joins because Flink only keeps relevant versions rather than the entire history of both streams.',
    },
    {
      heading: 'Interval Joins: Bounded by Time',
      body: 'Interval joins match records from two streams only when their event times fall within a specified range of each other. You express the constraint in the WHERE clause, something like WHERE a.event_time BETWEEN b.event_time - INTERVAL \'30\' MINUTE AND b.event_time + INTERVAL \'30\' MINUTE. Because the join window is finite, Flink can aggressively clean up state once records age out of the interval. This makes interval joins far cheaper than regular joins for correlated event streams. The tradeoff is strict: events outside the interval never match, even if their keys align perfectly.',
    },
    {
      heading: 'Lookup Joins: Quick Enrichment',
      body: 'A lookup join enriches a stream with current values from a reference table, one record at a time. It uses FOR SYSTEM_TIME AS OF with the processing time of the stream side, which tells Flink to fetch the latest value for each key as the record is processed. Think product catalogs, customer profiles, or configuration tables -- data that changes slowly and where historical accuracy is less important than having something current. Lookup joins are lightweight because Flink does not maintain full history of the right side. The main caveat is that results depend on when processing happens, not when the event occurred.',
    },
    {
      heading: 'Picking the Right Join (Please Pick the Right Join)',
      body: 'Here is the decision tree every streaming squirrel should internalize. Need to correlate two event streams with no strong time constraint? Regular join, but set your TTL or face the state-growth monster. Know the events arrive within a predictable window of each other? Interval join -- same power, bounded state, better sleep at night. One side is a versioned dimension and you need historically accurate lookups? Temporal join is the gold standard. Just need to tack on current reference data? Lookup join, quick and clean. The classic anti-pattern is defaulting to regular joins when a temporal or interval join would do the job with less state, more correctness, and fewer 3 AM alerts.',
    },
  ],
};
