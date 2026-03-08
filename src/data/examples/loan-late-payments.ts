import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanLatePaymentsDef: KickstarterExampleDef = {
  id: 'loan-late-payments',
  tables: [
    {
      name: 'LATE-PAYMENT-REPORTS',
      schema: 'late-payment-reports',
      role: 'input',
      dataset: { generator: 'late-payment-reports', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'ONTIME-PAYMENT-STATS',
      schema: 'ontime-payment-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'override-schema',
      sql: `DROP TABLE IF EXISTS \`{LATE-PAYMENT-REPORTS}\`;

CREATE TABLE \`{LATE-PAYMENT-REPORTS}\` (
  payment_id STRING,
  servicer_id STRING,
  amount DOUBLE,
  event_time_ms BIGINT,
  event_time AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
)

-- ============================================================
-- WHAT: Overrides the auto-discovered schema with a computed event_time column + watermark.
-- WHY: The raw data has epoch millis. Flink needs a proper TIMESTAMP + WATERMARK for windowing.
-- HOW: TO_TIMESTAMP_LTZ converts epoch ms to TIMESTAMP_LTZ. WATERMARK allows 10s of lateness.
-- GOTCHA: Events arriving more than 10s late (by event_time) will be dropped by the window.
-- ============================================================`,
    },
    {
      label: 'windowed-stats',
      sql: `INSERT INTO \`{ONTIME-PAYMENT-STATS}\`
SELECT
  servicer_id,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_amount
FROM TABLE(
  TUMBLE(TABLE \`{LATE-PAYMENT-REPORTS}\`, DESCRIPTOR(event_time), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end, servicer_id

-- ============================================================
-- WHAT: Aggregates payments into 30-second tumbling windows using the event_time watermark.
-- WHY: Only on-time events (within watermark tolerance) are included in each window.
-- HOW: TUMBLE groups events by event_time. Late events beyond the 10s watermark are dropped.
-- GOTCHA: ~20% of test data has deliberately late timestamps — they won't appear in results.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{ONTIME-PAYMENT-STATS}\` LIMIT 50

-- ============================================================
-- WHAT: Reads the windowed payment stats. Only on-time payments are counted.
-- NOTE: Compare the total_amount here with the raw data — the difference is late events.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your late data & watermarks workspace is ready. Follow these steps:',
    steps: [
      { label: 'Run the schema override', detail: 'Run the DROP + CREATE TABLE cell to add event_time and watermark.' },
      { label: 'Produce payment data', detail: 'Click the play button on LATE-PAYMENT-REPORTS to send 200 records (80% on-time, 20% late).' },
      { label: 'Run the windowed aggregation', detail: 'Run the INSERT INTO cell to start processing with watermark semantics.' },
      { label: 'View results', detail: 'Run the SELECT query — notice that late events are excluded from window counts.' },
    ],
  },
};
