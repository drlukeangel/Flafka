import type { KickstarterExampleDef } from '../../services/example-runner';

export const viewEarlyWarningDef: KickstarterExampleDef = {
  id: 'view-early-warning',
  tables: [
    {
      name: 'PAYMENT-EVENTS',
      schema: 'payment-events',
      role: 'input',
      dataset: { generator: 'payment-events', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'SERVICER-HEALTH',
      schema: 'servicer-health',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'early-warning-job',
      sql: `INSERT INTO \`{SERVICER-HEALTH}\`
SELECT servicer_id, window_start, window_end, total_payments, delinquent_payments,
       CAST(delinquent_payments AS DOUBLE) / total_payments * 100 AS delinquency_rate
FROM (
  SELECT
    servicer_id,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
    COUNT(*) AS total_payments,
    COUNT(*) FILTER (WHERE status = 'DELINQUENT') AS delinquent_payments
  FROM TABLE(
    TUMBLE(TABLE \`{PAYMENT-EVENTS}\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
  )
  GROUP BY servicer_id, window_start, window_end
)

-- ============================================================
-- WHAT: Computes delinquency rate per servicer in 30-second windows.
-- WHY: Freddie Mac monitors servicer performance. A spike in delinquency
--      rate signals a servicer may need intervention or replacement.
-- HOW: Inner query counts total and delinquent payments per servicer per window.
--      Outer query computes percentage. Subquery avoids alias-reference bug.
-- WINDOW: 30 seconds for demo responsiveness (production would use 24h).
-- GOTCHA: TUMBLE uses $rowtime (Kafka event time), not wall clock.
-- GOTCHA: Subquery pattern required — Flink SQL cannot reference
--         column aliases in computed expressions in the same SELECT.
-- ============================================================`,
    },
    {
      label: 'servicer-red-flags',
      sql: `SELECT * FROM \`{SERVICER-HEALTH}\`
WHERE delinquency_rate > 10.0
LIMIT 50

-- ============================================================
-- WHAT: Finds servicers with >10% delinquency rate.
-- WHY: A delinquency rate above 10% is a red flag — investigate
--      whether the servicer is properly managing collections.
-- ACTION: Alert risk management team for servicer review.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your early warning workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce payment events', detail: 'Click play on the PAYMENT-EVENTS stream card to send 200 payment records.' },
      { label: 'Run the early warning job', detail: 'Run the INSERT INTO cell to start computing delinquency rates per servicer.' },
      { label: 'Wait ~30 seconds', detail: 'Tumbling windows emit on a 30-second cadence; wait for the first window to close.' },
      { label: 'Find servicer red flags', detail: 'Run the SELECT query to find servicers with >10% delinquency rate.' },
    ],
  },
};
