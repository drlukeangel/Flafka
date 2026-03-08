import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanIntervalJoinDef: KickstarterExampleDef = {
  id: 'loan-interval-join',
  tables: [
    // CUSTOMERS-STREAM first — must be in Kafka before loans
    {
      name: 'CUSTOMERS-STREAM',
      schema: 'customers-stream',
      role: 'input',
      dataset: { generator: 'customers-stream', count: 20 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'INTERVAL-JOINED',
      schema: 'interval-joined',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'interval-join-job',
      sql: `INSERT INTO \`{INTERVAL-JOINED}\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`{LOANS}\` l
JOIN \`{CUSTOMERS-STREAM}\` c ON l.customer_id = c.customer_id
  AND c.$rowtime BETWEEN l.$rowtime - INTERVAL '5' MINUTE AND l.$rowtime + INTERVAL '5' MINUTE

-- ============================================================
-- WHAT: Interval join — matches each loan with customer events within +/- 5 minutes.
-- HOW: BETWEEN clause creates a 10-minute window centered on each loan's $rowtime. State is bounded by interval width.
-- WHY INTERVAL JOIN: Both sides are event streams. Regular JOIN = infinite state/OOM. Temporal JOIN = needs versioned table.
-- WHY CAST(CONCAT(...) AS BYTES): Composite Kafka key for downstream deduplication and compaction.
-- GOTCHA: Both streams MUST have event-time attributes ($rowtime or WATERMARK). Without them, Flink can't reason about time.
-- GOTCHA: Produce CUSTOMERS-STREAM FIRST, then start job, then produce LOANS. Inner join silently drops unmatched rows.
-- GOTCHA: Wide intervals (e.g., INTERVAL '1' DAY) mean Flink holds a full day of state per key. Start small.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{INTERVAL-JOINED}\` LIMIT 50

-- ============================================================
-- WHAT: View interval join results — each row = one loan matched with a nearby customer event.
-- COLUMNS: customer_id, txn_id, loan_id, amount, status, customer_name, credit_score.
-- GOTCHA: Fewer rows than expected is normal — inner join silently drops loans with no matching customer event.
-- GOTCHA: Zero rows? Check that you produced CUSTOMERS-STREAM data BEFORE LOANS data.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce customer events', detail: 'Click \u25b6 on the CUSTOMERS-STREAM stream card first to send 20 customer records as an append-only stream.' },
      { label: 'Run interval join job', detail: 'Run the INSERT INTO cell; the job joins loans with customer events within a 5-minute time window.' },
      { label: 'Produce loan transactions', detail: 'Click \u25b6 on the LOANS stream card; each loan matches customer events within \u00b15 minutes.' },
      { label: 'View joined results', detail: 'Run the SELECT * LIMIT 50 cell to see loans enriched with customer name and credit score.' },
    ],
  },
};
