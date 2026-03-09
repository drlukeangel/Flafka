import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanRoutingAvroDef: KickstarterExampleDef = {
  id: 'loan-routing-avro',
  tables: [
    {
      name: 'ROUTING-RULES',
      schema: 'routing-rules-array',
      role: 'input',
      datasets: [
        { label: '1. Seed Rules', generator: 'routing-rules-three', count: 3 },
        { label: '2. Add Refinance', generator: 'routing-rules-add-refinance', count: 1 },
        { label: '3. Add Finance', generator: 'routing-rules-add-finance', count: 2 },
        { label: '4. Remove Subscriber', generator: 'routing-rules-remove-subscriber', count: 1 },
      ],
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-EVENTS',
      schema: 'loan-events-dept',
      role: 'input',
      datasets: [
        { label: '1. Initial Events', generator: 'loan-events-dept', count: 150 },
        { label: '2. Refinance Wave', generator: 'loan-events-refinance', count: 50 },
        { label: '3. Terminations', generator: 'loan-events-termination', count: 10 },
        { label: '4. Foreclosures', generator: 'loan-events-foreclosure', count: 10 },
      ],
      stream: 'produce-consume',
    },
    {
      name: 'ROUTED-EVENTS',
      schema: 'routed-events-sink',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'UNDERWRITING',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'COLLECTIONS',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'FINANCE',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'routing-engine',
      sql: `INSERT INTO \`{ROUTED-EVENTS}\`
SELECT
  CAST(e.event_id AS BYTES) AS \`key\`,
  t.target_topic,
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department
FROM \`{LOAN-EVENTS}\` e
JOIN \`{ROUTING-RULES}\` FOR SYSTEM_TIME AS OF e.\`$rowtime\` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)

-- ============================================================
-- ROUTING ENGINE: Temporal join resolves the active routing
-- rule for each event_type at event rowtime, then CROSS JOIN
-- UNNEST explodes target_topics into one row per destination.
--
-- Events with no matching rule are silently dropped.
-- REFINANCE has no rule yet \u2014 those events disappear here.
-- ============================================================`,
    },
    {
      label: 'start-consumers',
      sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`{UNDERWRITING}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{UNDERWRITING}';
  INSERT INTO \`{COLLECTIONS}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{COLLECTIONS}';
END;

-- ============================================================
-- STATEMENT SET: Both consumers run as ONE Flink job.
-- UNDERWRITING sees NEW_LOAN (1 event type).
-- COLLECTIONS sees FORECLOSURE + TERMINATION (2 event types).
-- FINANCE is empty \u2014 no rule routes to it yet.
--
-- NOTE: When you reach Use Case 2, STOP this job before
-- running use-case-2-add-consumer. That cell relaunches all
-- three consumers \u2014 including FINANCE \u2014 as a single job,
-- keeping fan-out to one CFU instead of two.
-- ============================================================`,
    },
    {
      label: 'verify-routing',
      sql: `SELECT target_topic, event_type, COUNT(*) AS event_count
FROM \`{ROUTED-EVENTS}\`
GROUP BY target_topic, event_type

-- ============================================================
-- VERIFY: UNDERWRITING = 1 event type, COLLECTIONS = 2.
-- REFINANCE shows 0 rows \u2014 no routing rule exists yet.
-- ============================================================`,
    },
    {
      label: 'use-case-1-add-refinance-rule',
      sql: `INSERT INTO \`{ROUTING-RULES}\` (event_type, target_topics, updated_at)
VALUES ('REFINANCE', ARRAY['{UNDERWRITING}'], CAST(NOW() AS STRING))

-- ============================================================
-- USE CASE 1: ADD A NEW EVENT TYPE WITH ZERO DOWNTIME
--
-- Upserts one new rule: REFINANCE \u2192 [UNDERWRITING].
-- The routing engine never stops \u2014 events arriving AFTER
-- this upsert with event_type = REFINANCE will now fan out
-- to UNDERWRITING.
--
-- After running: produce LOAN-EVENTS "2. Refinance Wave"
-- and run verify-routing \u2014 UNDERWRITING jumps from 1 to
-- 2 event types.
-- ============================================================`,
    },
    {
      label: 'use-case-2-add-finance-rules',
      sql: `INSERT INTO \`{ROUTING-RULES}\` (event_type, target_topics, updated_at)
VALUES
  ('TERMINATION', ARRAY['{COLLECTIONS}', '{FINANCE}'], CAST(NOW() AS STRING)),
  ('NEW_LOAN',    ARRAY['{UNDERWRITING}', '{FINANCE}'], CAST(NOW() AS STRING))

-- ============================================================
-- USE CASE 2 (step 1): EXPAND RULES TO ADD FINANCE
--
-- Upserts two rules to add FINANCE as a new subscriber:
--   TERMINATION \u2192 [COLLECTIONS, FINANCE]
--   NEW_LOAN    \u2192 [UNDERWRITING, FINANCE]
--
-- After running: STOP start-consumers, then run
-- use-case-2-add-consumer to relaunch all three consumers
-- as a single STATEMENT SET (one Flink job, one CFU).
-- ============================================================`,
    },
    {
      label: 'use-case-2-add-consumer',
      sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`{UNDERWRITING}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{UNDERWRITING}';
  INSERT INTO \`{COLLECTIONS}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{COLLECTIONS}';
  INSERT INTO \`{FINANCE}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{FINANCE}';
END;

-- ============================================================
-- USE CASE 2 (step 2): ALL THREE CONSUMERS AS ONE JOB
--
-- Replaces start-consumers with a single STATEMENT SET
-- covering all three sinks \u2014 one Flink job, one CFU.
-- After it starts, produce LOAN-EVENTS (dataset 1) again
-- \u2014 only events arriving AFTER the Finance rule upsert
-- will route to FINANCE.
-- ============================================================`,
    },
    {
      label: 'use-case-3a-remove-subscriber',
      sql: `INSERT INTO \`{ROUTING-RULES}\` (event_type, target_topics, updated_at)
VALUES ('TERMINATION', ARRAY['{COLLECTIONS}'], CAST(NOW() AS STRING))

-- ============================================================
-- USE CASE 3A: REMOVE A SUBSCRIBER WITH ZERO DOWNTIME
--
-- Upserts TERMINATION with FINANCE removed from the fan-out.
-- TERMINATION now routes only to COLLECTIONS.
--
-- Tip: set COLLECTIONS and FINANCE to "Latest" offset before
-- producing LOAN-EVENTS \u2014 FINANCE receives no new TERMINATION
-- rows (only NEW_LOAN), while COLLECTIONS still grows.
-- ============================================================`,
    },
    {
      label: 'use-case-3b-remove-rule',
      sql: `INSERT INTO \`{ROUTING-RULES}\` (event_type, target_topics, updated_at)
VALUES ('FORECLOSURE', CAST(NULL AS ARRAY<STRING>), CAST(NOW() AS STRING))

-- ============================================================
-- USE CASE 3B: REMOVE A RULE ENTIRELY WITH ZERO DOWNTIME
--
-- Upserts FORECLOSURE with NULL target_topics (ARRAY[] is not
-- valid in Confluent Cloud \u2014 NULL is equivalent for UNNEST).
-- CROSS JOIN UNNEST(NULL) produces ZERO rows \u2014 FORECLOSURE
-- events are silently swallowed. Zero downtime.
--
-- Tip: set COLLECTIONS to "Latest" offset, produce LOAN-EVENTS,
-- then run verify-routing \u2014 FORECLOSURE disappears instantly.
-- ============================================================`,
    },
    {
      label: 'verify-foreclosure-removed',
      sql: `SELECT event_type, target_topics, updated_at
FROM \`{ROUTING-RULES}\`
WHERE event_type = 'FORECLOSURE'

-- ============================================================
-- VERIFY: target_topics should be null \u2014 no active routing
-- destinations for FORECLOSURE. CROSS JOIN UNNEST(NULL)
-- produces zero rows, so events are silently dropped.
-- Returns 1 row with null target_topics (null field, not a
-- Kafka tombstone \u2014 the key still exists in the compacted log).
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your Avro routing workspace is ready. Follow these steps:',
    steps: [
      { label: 'Start the routing engine', detail: 'Run the routing-engine cell \u2014 temporal join + CROSS JOIN UNNEST fans each event to all its target topics.' },
      { label: 'Start both consumers', detail: 'Run the start-consumers STATEMENT SET \u2014 UNDERWRITING and COLLECTIONS start as ONE Flink job. FINANCE stays empty for now.' },
      { label: 'Seed the routing rules', detail: 'On the ROUTING-RULES card, select "1. Seed Rules" and click produce. Seeds 3 rules: FORECLOSURE+TERMINATION\u2192COLLECTIONS, NEW_LOAN\u2192UNDERWRITING.' },
      { label: 'Produce loan events', detail: 'On the LOAN-EVENTS card, select "1. Initial Events" and click produce. COLLECTIONS fills with 2 event types, UNDERWRITING with 1.' },
      { label: 'Verify initial routing', detail: 'Run verify-routing \u2014 confirm REFINANCE shows 0 rows. It has no rule yet.' },
      { label: 'Use Case 1: add REFINANCE rule', detail: 'Run use-case-1-add-refinance-rule \u2014 upserts REFINANCE \u2192 UNDERWRITING inline. No stream card needed. Then produce LOAN-EVENTS "2. Refinance Wave" and run verify-routing \u2014 UNDERWRITING jumps from 1 to 2 event types. Zero downtime.' },
      { label: 'Use Case 2: add FINANCE consumer', detail: 'Run use-case-2-add-finance-rules \u2014 upserts TERMINATION and NEW_LOAN with FINANCE added inline. Then stop the start-consumers job and run use-case-2-add-consumer to relaunch all three consumers as one STATEMENT SET. Produce LOAN-EVENTS (dataset 1) again \u2014 FINANCE receives TERMINATION and NEW_LOAN. One job, one CFU.' },
      { label: 'Use Case 3a: remove a subscriber', detail: 'Run use-case-3a-remove-subscriber \u2014 upserts TERMINATION with FINANCE removed from the fan-out inline. Tip: set COLLECTIONS and FINANCE to "Latest" offset before producing LOAN-EVENTS \u2014 FINANCE receives no new TERMINATION rows (only NEW_LOAN), while COLLECTIONS still grows. Zero downtime.' },
      { label: 'Use Case 3b: remove the rule entirely', detail: 'Run use-case-3b-remove-rule \u2014 upserts FORECLOSURE with NULL target_topics inline. CROSS JOIN UNNEST(NULL) produces zero rows \u2014 FORECLOSURE events are silently swallowed. Run verify-foreclosure-removed to confirm: target_topics = null means no active routing. Set COLLECTIONS to "Latest" and produce LOAN-EVENTS \u2014 FORECLOSURE disappears from the results.' },
    ],
  },
};
