import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanDedupDef: KickstarterExampleDef = {
  id: 'loan-dedup',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-DEDUPED',
      schema: 'loans-deduped',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'dedup-job',
      sql: `INSERT INTO \`{LOANS-DEDUPED}\`
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM (
  SELECT
    CAST(loan_id AS BYTES) AS \`key\`,
    loan_id, amount, status, created_at, txn_id, customer_id,
    ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY $rowtime ASC) AS rownum
  FROM \`{LOANS}\`
)
WHERE rownum = 1

-- ============================================================
-- WHAT: Removes duplicate loan events, keeping only the FIRST event per loan_id.
-- HOW: ROW_NUMBER() partitioned by loan_id, ordered by $rowtime ASC; outer WHERE rownum = 1 keeps the earliest.
-- WHY ROW_NUMBER not DISTINCT: DISTINCT compares all columns; ROW_NUMBER controls which column defines "duplicate" and which copy to keep.
-- WHY subquery: SQL forbids WHERE on window functions directly; subquery computes rownum, outer query filters.
-- WHY $rowtime: Flink metadata column for Kafka ingestion timestamp; ASC = "earliest arrival wins."
-- GOTCHA: Flink keeps state per loan_id forever; in production, configure state TTL to bound memory.
-- GOTCHA: Runs continuously — new duplicates are suppressed as they arrive.
-- EXPECT: At most one record per loan_id in the output topic.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-DEDUPED}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect deduplicated loans; each loan_id appears at most once.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records (some duplicates included).' },
      { label: 'Run the dedup job', detail: 'Run the INSERT INTO cell; ROW_NUMBER keeps only the first event per loan_id.' },
      { label: 'View output', detail: 'Run the SELECT * LIMIT 50 cell to see deduplicated results.' },
    ],
  },
};
