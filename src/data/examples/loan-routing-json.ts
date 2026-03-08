import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanRoutingJsonDef: KickstarterExampleDef = {
  id: 'loan-routing-json',
  tables: [
    {
      name: 'LOAN-EVENTS',
      schema: 'loan-events-dept-json',
      role: 'input',
      dataset: { generator: 'loan-events-dept', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'ROUTING-RULES',
      schema: 'routing-rules-array-json',
      role: 'input',
      dataset: { generator: 'routing-rules-array-dynamic', count: 5 },
      stream: 'produce-consume',
    },
    {
      name: 'ROUTED-EVENTS',
      schema: 'routed-events-sink-json',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'UNDERWRITING',
      schema: 'routed-events-dept-json',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'FINANCE',
      schema: 'routed-events-dept-json',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'COLLECTIONS',
      schema: 'routed-events-dept-json',
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
-- ROUTING ENGINE: Temporal join resolves the latest routing
-- rule for each event_type, then CROSS JOIN UNNEST explodes the
-- target_topics array into one row per destination.
--
-- NEW_LOAN has targets [underwriting, finance] \u2192 fans to 2 rows.
-- FORECLOSURE has target [collections] \u2192 stays as 1 row.
--
-- DYNAMIC: Upsert a routing rule to add/remove targets \u2014
-- events start flowing differently immediately.
-- ============================================================`,
    },
    {
      label: 'statement-set-consumers',
      sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`{UNDERWRITING}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{UNDERWRITING}';
  INSERT INTO \`{FINANCE}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{FINANCE}';
  INSERT INTO \`{COLLECTIONS}\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{ROUTED-EVENTS}\` WHERE target_topic = '{COLLECTIONS}';
END;

-- ============================================================
-- STATEMENT SET: All three consumer INSERTs bundled into ONE
-- Flink job. Without STATEMENT SET, each INSERT would spin up
-- its own job \u2014 3 departments = 3 jobs. With STATEMENT SET,
-- Flink optimizes them into a single execution graph.
--
-- Each INSERT filters routed-events by target_topic to claim
-- only the rows destined for that department.
-- ============================================================`,
    },
    {
      label: 'verify-routing',
      sql: `SELECT target_topic, event_type, COUNT(*) AS event_count
FROM \`{ROUTED-EVENTS}\`
GROUP BY target_topic, event_type

-- ============================================================
-- PROOF: Total output rows > input rows = fan-out is working.
-- NEW_LOAN appears under both 'underwriting' and 'finance'.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your dynamic routing workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce routing rules', detail: 'Click play on ROUTING-RULES FIRST \u2014 seeds event-type-to-topics mappings with actual resolved topic names.' },
      { label: 'Produce events', detail: 'Click play on LOAN-EVENTS to send 200 lifecycle events.' },
      { label: 'Run the routing engine', detail: 'Run the first INSERT \u2014 temporal join + CROSS JOIN UNNEST fans each event to all its target topics.' },
      { label: 'Run the STATEMENT SET', detail: 'Run the EXECUTE STATEMENT SET cell \u2014 all three department consumers start as ONE Flink job.' },
      { label: 'Watch consumer cards', detail: 'UNDERWRITING, FINANCE, and COLLECTIONS stream cards fill up with correctly filtered events.' },
      { label: 'Verify fan-out', detail: 'Run the verification query \u2014 NEW_LOAN events appear in both underwriting and finance.' },
    ],
  },
};
