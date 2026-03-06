import type { ExampleDocumentation } from '../../../types';

export const advancedKickstarterDocs: Record<string, ExampleDocumentation> = {
  'loan-dedup': {
    subtitle: 'Remove duplicate events from a stream — essential for exactly-once semantics.',
    businessContext: 'Kafka guarantees at-least-once delivery. Network retries, producer retries, and consumer rebalances produce duplicate messages. Downstream systems (billing, fulfillment, reporting) need exactly-once. ROW_NUMBER() keeps only the first event per key.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'dedup', label: 'DEDUP (ROW_NUMBER=1)', type: 'processor' },
        { id: 'deduped', label: 'LOANS-DEDUPED', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'dedup', animated: true },
        { from: 'dedup', to: 'deduped', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Dedup Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-DEDUPED\`
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM (
  SELECT
    CAST(loan_id AS BYTES) as \`key\`,
    loan_id, amount, status, created_at, txn_id, customer_id,
    ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY $rowtime ASC) AS rownum
  FROM \`EOT-PLATFORM-EXAMPLES-LOANS\`
)
WHERE rownum = 1;`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with all loan events (may contain duplicates from retries)' },
      { name: 'LOANS-DEDUPED', type: 'output', description: 'Output topic with only the first occurrence of each loan_id' },
    ],
    concepts: [
      { term: 'ROW_NUMBER()', explanation: 'A ranking function: "Label each row in my partition as row #1, #2, #3, etc." We use it to mark: 1st occurrence = keep, 2nd occurrence = duplicate, 3rd = duplicate, etc.' },
      { term: 'PARTITION BY loan_id', explanation: 'Groups duplicates together: "Find all records with the same loan_id, keep them as a group, and number them separately from other groups." So if loan L-001 appears 3 times, they get numbered 1, 2, 3 within that group.' },
      { term: 'ORDER BY $rowtime ASC', explanation: 'Determines ranking order: "Sort each group by arrival time (earliest first). Earliest = #1, next = #2, etc." ASC = ascending = oldest to newest. We keep #1 (the original) and drop the rest (duplicates).' },
      { term: 'WHERE rownum = 1', explanation: 'The dedup rule: "Only output rows labeled as #1." Duplicates (#2, #3, etc.) never make it to the output topic — they\'re filtered out and discarded.' },
      { term: 'Exactly-Once Semantics', explanation: 'In streaming, networks are unreliable and messages sometimes get resent. Without dedup, you\'d process the same loan twice and double-bill the customer. This pattern ensures: one input = one output.' },
    ],
    useCases: ['Exactly-once processing', 'CDC deduplication', 'Idempotent event processing', 'Cleaning replay/retry duplicates'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", txn_id: "TXN-A1" }',
      '{ loan_id: "L-002", amount: 8500.00, status: "PENDING", txn_id: "TXN-B1" }',
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", txn_id: "TXN-A1" }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", txn_id: "TXN-A1" }',
      '{ loan_id: "L-002", amount: 8500.00, status: "PENDING", txn_id: "TXN-B1" }',
    ],
    whatHappensIf: [
      { question: 'What if duplicates arrive hours apart?', answer: 'Flink maintains state indefinitely (configure TTL for cleanup). The first event wins regardless of gap.' },
      { question: 'What if the duplicate has slightly different data?', answer: 'ROW_NUMBER still keeps only the first by $rowtime. If you need merge logic, use a different pattern.' },
    ],
  },

  'loan-top-n': {
    subtitle: 'Rank events within time windows — find the largest, smallest, or most recent N items.',
    businessContext: 'Risk management needs a real-time leaderboard: the 3 largest loan applications per status in the last 30 seconds. Combines windowing with ranking — used in dashboards, alerting, and anomaly detection.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'window', label: 'TUMBLE(30s)', type: 'processor' },
        { id: 'rank', label: 'TOP-3 RANK', type: 'processor' },
        { id: 'top3', label: 'LOANS-TOP3', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'window', animated: true },
        { from: 'window', to: 'rank', animated: true },
        { from: 'rank', to: 'top3', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Top-N Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-TOP3\`
SELECT \`key\`, window_start, window_end, loan_id, amount, status, txn_id, customer_id, rank_num
FROM (
  SELECT
    CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status, '-', CAST(rownum AS STRING)) AS BYTES) as \`key\`,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
    loan_id, amount, status, txn_id, customer_id,
    rownum as rank_num
  FROM (
    SELECT window_start, window_end, loan_id, amount, status, txn_id, customer_id,
      ROW_NUMBER() OVER (PARTITION BY window_start, window_end, status ORDER BY amount DESC) AS rownum
    FROM TABLE(
      TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
    )
  )
  WHERE rownum <= 3
);`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'LOANS-TOP3', type: 'output', description: 'Top 3 largest loans per status per 30-second window' },
    ],
    concepts: [
      { term: 'Top-N Ranking', explanation: 'Find the "Top 3" of something — like a sports leaderboard. Combine windowing (split by time) + ranking (sort by value) to get: in each 30-second window, show the 3 largest loans per status.' },
      { term: 'TUMBLE Window', explanation: 'Every 30 seconds, a new window starts. Events arriving during that window are grouped together. When 30 seconds end, rankings are calculated and emitted.' },
      { term: 'PARTITION BY window + status', explanation: 'Two groupings: First by window (events from second 0-30 vs 30-60), then by status (APPROVED, DENIED, PENDING separately). Each combination gets its own leaderboard.' },
      { term: 'ORDER BY amount DESC', explanation: 'Sort highest amount first. Row 1 = biggest loan, Row 2 = second biggest, Row 3 = third biggest. Change to ASC for Bottom-3 (smallest loans).' },
      { term: 'WHERE rownum <= 3', explanation: 'The "keep top 3" filter: discard rank 4 and beyond. Output has exactly 3 rows per window/status combo (or fewer if not enough loans arrived).' },
    ],
    useCases: ['Real-time leaderboards', 'Anomaly detection', 'Dashboard widgets', 'Alerting on outliers'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 50000.00, status: "APPROVED" }',
      '{ loan_id: "L-002", amount: 12000.00, status: "APPROVED" }',
      '{ loan_id: "L-003", amount: 75000.00, status: "APPROVED" }',
      '{ loan_id: "L-004", amount: 30000.00, status: "PENDING" }',
      '{ loan_id: "L-005", amount: 8000.00, status: "APPROVED" }',
    ],
    expectedOutput: [
      '{ window_start: "2025-01-01 00:00:00", status: "APPROVED", loan_id: "L-003", amount: 75000.00, rank_num: 1 }',
      '{ window_start: "2025-01-01 00:00:00", status: "APPROVED", loan_id: "L-001", amount: 50000.00, rank_num: 2 }',
      '{ window_start: "2025-01-01 00:00:00", status: "APPROVED", loan_id: "L-002", amount: 12000.00, rank_num: 3 }',
    ],
    whatHappensIf: [
      { question: 'What if I want top-1 only?', answer: 'Change WHERE rownum <= 3 to WHERE rownum = 1 — gives you the MAX per group.' },
      { question: 'What if fewer than 3 events arrive in a window?', answer: 'Flink emits only the events that exist. A window with 2 events produces rank 1 and 2 only.' },
    ],
  },

  'loan-aggregate-udf': {
    subtitle: 'Compute portfolio-level statistics using a custom AggregateFunction.',
    businessContext: 'Risk management needs weighted-average credit scores — weighted by loan amount, not equal. Flink\'s built-in AVG treats all rows equally. A custom AggregateFunction handles the weighting.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'window', label: 'TUMBLE(30s)', type: 'processor' },
        { id: 'agg', label: 'WeightedAvg()', type: 'processor' },
        { id: 'stats', label: 'PORTFOLIO-STATS', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'window', animated: true },
        { from: 'window', to: 'agg', animated: true },
        { from: 'agg', to: 'stats', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Aggregate UDF Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-PORTFOLIO-STATS\` (
  \`key\`, window_start, window_end, loan_count, total_amount,
  avg_credit_score, weighted_avg_credit_score
)
SELECT
  CAST('portfolio' AS BYTES) as \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  COUNT(*) as loan_count,
  SUM(CAST(LoanDetailExtract(json_payload, 'loan_details.amount_requested') AS BIGINT)) as total_amount,
  AVG(CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT)) as avg_credit_score,
  WeightedAvg(
    CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT),
    CAST(LoanDetailExtract(json_payload, 'loan_details.amount_requested') AS INT)
  ) as weighted_avg_credit_score
FROM TABLE(
  TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end`,
      },
    ],
    topics: [
      { name: 'LOAN-APPLICATIONS', type: 'input', description: 'Source topic with nested JSON loan applications' },
      { name: 'LOAN-PORTFOLIO-STATS', type: 'output', description: 'One aggregated row per 30-second window with portfolio statistics' },
    ],
    concepts: [
      { term: 'AggregateFunction', explanation: 'A custom UDF that reduces N input rows to 1 output value. Unlike scalar UDFs (1:1), aggregate UDFs accumulate state across rows.' },
      { term: 'WeightedAvg vs AVG', explanation: 'AVG treats all rows equally. WeightedAvg multiplies each score by its loan amount, giving larger loans more influence on the average.' },
      { term: 'Tumbling Windows (30s)', explanation: 'Fixed, non-overlapping 30-second windows. Each window produces exactly one portfolio stats row.' },
      { term: 'Chaining UDFs', explanation: 'LoanDetailExtract (scalar) extracts fields, then WeightedAvg (aggregate) computes the weighted average. Multiple UDF types in one query.' },
      { term: 'Accumulator pattern', explanation: 'The AggregateFunction maintains an accumulator (running sum of weighted values and total weight) that merges partial results.' },
    ],
    useCases: ['Portfolio risk monitoring', 'Weighted metrics', 'Real-time reporting', 'Executive dashboards'],
    exampleInput: [
      '{ loan_id: "L-001", credit_score: 720, amount: 50000 }',
      '{ loan_id: "L-002", credit_score: 680, amount: 10000 }',
      '{ loan_id: "L-003", credit_score: 780, amount: 40000 }',
    ],
    expectedOutput: [
      '{ window_start: "2025-01-01 00:00:00", loan_count: 3, total_amount: 100000, avg_credit_score: 726, weighted_avg_credit_score: 738 }',
    ],
  },

  'loan-validation': {
    subtitle: 'Route invalid loans to a dead-letter queue — the Dead-Letter Pattern.',
    businessContext: 'Regulatory compliance requires every loan to pass business rules. Failed validations must not be silently dropped — they land in a dead-letter topic for audit and reprocessing. Two parallel Flink jobs: one routes valid, one routes invalid.',
    dataFlow: {
      layout: 'fan-out',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'validator', label: 'LoanValidator()', type: 'processor' },
        { id: 'valid', label: 'LOANS-VALIDATED', type: 'sink' },
        { id: 'dlq', label: 'LOANS-DEAD-LETTER', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'validator', animated: true },
        { from: 'validator', to: 'valid', animated: true, filterLabel: 'valid' },
        { from: 'validator', to: 'dlq', animated: true, filterLabel: 'invalid' },
      ],
    },
    sqlBlocks: [
      {
        label: 'Valid Loans',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-VALIDATED\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'applicant.personal.name.first') as first_name,
  LoanDetailExtract(json_payload, 'applicant.personal.name.last') as last_name,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanValidator(json_payload) as validation_result
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`
WHERE LoanValidator(json_payload) = 'VALID';`,
      },
      {
        label: 'Dead Letter',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-DEAD-LETTER\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'applicant.personal.name.first') as first_name,
  LoanDetailExtract(json_payload, 'applicant.personal.name.last') as last_name,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanValidator(json_payload) as rejection_reasons
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`
WHERE LoanValidator(json_payload) <> 'VALID';`,
      },
    ],
    topics: [
      { name: 'LOAN-APPLICATIONS', type: 'input', description: 'Source topic with nested JSON loan applications' },
      { name: 'LOANS-VALIDATED', type: 'output', description: 'Loans that passed all business validation rules' },
      { name: 'LOANS-DEAD-LETTER', type: 'output', description: 'Loans that failed validation with rejection reasons for audit' },
    ],
    concepts: [
      { term: 'Dead-Letter Pattern', explanation: 'Invalid records route to a separate topic instead of being dropped. Enables audit trails and reprocessing pipelines.' },
      { term: 'Multi-Job Routing', explanation: 'Two parallel Flink jobs with complementary WHERE clauses — one for valid, one for invalid. Together they process 100% of input.' },
      { term: 'Validation UDF', explanation: 'LoanValidator() encapsulates business rules: credit score >= 580, DTI <= 0.43, amount > 0, name present, fraud != FAIL.' },
      { term: 'WHERE clause routing', explanation: 'WHERE LoanValidator() = "VALID" routes clean records; WHERE <> "VALID" routes rejects with reasons.' },
    ],
    useCases: ['Compliance gating', 'Data quality enforcement', 'Audit trails', 'Reprocessing pipelines'],
    exampleInput: [
      '{ loan_id: "L-001", credit_score: 720, dti: 0.35, amount: 50000, name: "Alice Chen", fraud: "PASS" }',
      '{ loan_id: "L-002", credit_score: 540, dti: 0.55, amount: 25000, name: "Bob Martinez", fraud: "PASS" }',
    ],
    expectedOutput: [
      '{ topic: "LOANS-VALIDATED", loan_id: "L-001", validation_result: "VALID" }',
      '{ topic: "LOANS-DEAD-LETTER", loan_id: "L-002", rejection_reasons: "CREDIT_SCORE_LOW;DTI_TOO_HIGH" }',
    ],
    whatHappensIf: [
      { question: 'What if a loan fails multiple rules?', answer: 'LoanValidator() returns all failure reasons concatenated (e.g., "CREDIT_SCORE_LOW;DTI_TOO_HIGH"). Nothing is lost.' },
      { question: 'What if validation rules change?', answer: 'Deploy a new UDF JAR version. Both Flink jobs restart with updated rules. Dead-letter records can be replayed through the new version.' },
    ],
  },

  'loan-hop-window': {
    subtitle: 'Overlapping time windows for smoothed, real-time metrics — like a moving average.',
    businessContext: 'Operations dashboard needs updates every 10 seconds showing the last 60 seconds of activity. Tumbling windows show choppy snapshots. Hop windows slide smoothly: each event lands in up to 6 overlapping windows.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'window', label: 'HOP(10s/60s)', type: 'processor' },
        { id: 'agg', label: 'AGGREGATE', type: 'processor' },
        { id: 'stats', label: 'LOANS-HOP-STATS', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'window', animated: true },
        { from: 'window', to: 'agg', animated: true },
        { from: 'agg', to: 'stats', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Hop Window Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-HOP-STATS\`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) as \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  status,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM TABLE(
  HOP(TABLE \`EOT-PLATFORM-EXAMPLES-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '60' SECOND)
)
GROUP BY window_start, window_end, status;`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'LOANS-HOP-STATS', type: 'output', description: 'Aggregated statistics per 60-second window, sliding every 10 seconds' },
    ],
    concepts: [
      { term: 'HOP() TVF', explanation: 'Sliding window function. Unlike TUMBLE (non-overlapping), HOP windows overlap — each event can appear in multiple windows.' },
      { term: 'Slide interval (10s)', explanation: 'A new window starts every 10 seconds, producing fresh output 6x more often than a 60s tumble.' },
      { term: 'Window size (60s)', explanation: 'Each window covers 60 seconds of data, providing a smoothed view of recent activity.' },
      { term: 'Overlap factor', explanation: 'Window size / slide = 60/10 = 6. Each event lands in up to 6 concurrent windows.' },
      { term: 'Moving average', explanation: 'The overlapping windows create a moving average effect — smoother than tumbling window snapshots.' },
    ],
    useCases: ['Real-time monitoring dashboards', 'Moving averages', 'Trend detection', 'SLA monitoring'],
    crossReference: {
      cardId: 'loan-session-window',
      label: 'Compare: Session Windows',
      description: 'Session windows adapt to activity gaps instead of fixed intervals.',
    },
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", $rowtime: "00:05" }',
      '{ loan_id: "L-002", amount: 8500.00, status: "APPROVED", $rowtime: "00:12" }',
      '{ loan_id: "L-003", amount: 22000.00, status: "DENIED", $rowtime: "00:18" }',
      '{ loan_id: "L-004", amount: 30000.00, status: "APPROVED", $rowtime: "00:25" }',
    ],
    expectedOutput: [
      '{ window_start: "00:00:00", window_end: "00:01:00", status: "APPROVED", loan_count: 3, total_amount: 53500.00, avg_amount: 17833.33 }',
      '{ window_start: "00:00:00", window_end: "00:01:00", status: "DENIED", loan_count: 1, total_amount: 22000.00, avg_amount: 22000.00 }',
      '{ window_start: "00:00:10", window_end: "00:01:10", status: "APPROVED", loan_count: 2, total_amount: 38500.00, avg_amount: 19250.00 }',
    ],
    whatHappensIf: [
      { question: 'What if I change the slide to equal the window size?', answer: 'HOP(60s, 60s) behaves identically to TUMBLE(60s) — no overlap.' },
      { question: 'What if events arrive late?', answer: 'Flink watermarks determine when windows close. Late events may be dropped or included depending on allowed lateness configuration.' },
    ],
  },

  'loan-session-window': {
    subtitle: 'Dynamic windows based on activity gaps — sessions adapt to customer behavior.',
    businessContext: 'A customer submits 3 loans in quick succession, then goes quiet. That\'s one session. 40 seconds later, 2 more — new session. Fixed windows can\'t capture this. Session windows close after a 30-second inactivity gap.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'session', label: 'SESSION(30s gap)', type: 'processor' },
        { id: 'agg', label: 'AGGREGATE', type: 'processor' },
        { id: 'sessions', label: 'LOANS-SESSIONS', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'session', animated: true },
        { from: 'session', to: 'agg', animated: true },
        { from: 'agg', to: 'sessions', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Session Window Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-SESSIONS\`
SELECT
  CAST(CONCAT(customer_id, '-', DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss')) AS BYTES) as \`key\`,
  customer_id,
  DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss') as session_start,
  DATE_FORMAT(session_end, 'yyyy-MM-dd HH:mm:ss') as session_end,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM \`EOT-PLATFORM-EXAMPLES-LOANS\`
GROUP BY customer_id, SESSION($rowtime, INTERVAL '30' SECOND);`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'LOANS-SESSIONS', type: 'output', description: 'Per-customer session aggregates based on 30-second activity gaps' },
    ],
    concepts: [
      { term: 'SESSION()', explanation: 'Gap-based window that groups events by proximity. A new event within the gap extends the session; silence closes it.' },
      { term: 'Gap timeout (30s)', explanation: '30 seconds of inactivity per customer triggers session closure and output emission.' },
      { term: 'Per-customer grouping', explanation: 'GROUP BY customer_id creates independent sessions per customer. One customer\'s silence doesn\'t affect another.' },
      { term: 'Dynamic size', explanation: 'Unlike tumble/hop, session windows have variable length — they adapt to actual activity patterns.' },
    ],
    useCases: ['Customer session analysis', 'Clickstream analytics', 'Burst detection', 'IoT device activity'],
    crossReference: {
      cardId: 'loan-hop-window',
      label: 'Compare: Hop Windows',
      description: 'Hop windows use fixed intervals. Session windows adapt to activity gaps.',
    },
    exampleInput: [
      '{ loan_id: "L-001", customer_id: "CUST-001", amount: 10000.00, $rowtime: "00:00" }',
      '{ loan_id: "L-002", customer_id: "CUST-001", amount: 15000.00, $rowtime: "00:10" }',
      '{ loan_id: "L-003", customer_id: "CUST-001", amount: 8000.00, $rowtime: "00:15" }',
      '{ loan_id: "L-004", customer_id: "CUST-001", amount: 20000.00, $rowtime: "00:55" }',
      '{ loan_id: "L-005", customer_id: "CUST-001", amount: 12000.00, $rowtime: "01:05" }',
    ],
    expectedOutput: [
      '{ customer_id: "CUST-001", session_start: "00:00:00", session_end: "00:00:45", loan_count: 3, total_amount: 33000.00, avg_amount: 11000.00 }',
      '{ customer_id: "CUST-001", session_start: "00:00:55", session_end: "00:01:35", loan_count: 2, total_amount: 32000.00, avg_amount: 16000.00 }',
    ],
    whatHappensIf: [
      { question: 'What if a customer never stops sending events?', answer: 'The session never closes. Flink keeps accumulating. Set a maximum session duration in production to bound state.' },
      { question: 'What if the gap is exactly 30 seconds?', answer: 'The session closes at the gap boundary. An event arriving at exactly 30s starts a new session.' },
    ],
  },

  'loan-pii-masking': {
    subtitle: 'Mask personally identifiable information in real-time for GDPR/CCPA compliance.',
    businessContext: 'Sharing data with analytics teams or third parties requires PII protection. A PiiMask UDF applies field-specific masking inline — names show first/last char only, emails hide the local part, SSNs show last 4 digits.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'mask', label: 'PiiMask()', type: 'processor' },
        { id: 'masked', label: 'LOANS-MASKED', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'mask', animated: true },
        { from: 'mask', to: 'masked', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'PII Masking Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-MASKED\` (
  \`key\`, loan_id, applicant_name, applicant_email, applicant_phone,
  applicant_ssn, loan_type, amount_requested, credit_score, risk_level
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.personal.name.first'), 'name') as applicant_name,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.contact.email'), 'email') as applicant_email,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.contact.phone'), 'phone') as applicant_phone,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.personal.ssn_last_four'), 'ssn') as applicant_ssn,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      },
    ],
    topics: [
      { name: 'LOAN-APPLICATIONS', type: 'input', description: 'Source topic with raw PII in nested JSON loan applications' },
      { name: 'LOANS-MASKED', type: 'output', description: 'Loan records with all PII fields redacted for safe downstream use' },
    ],
    concepts: [
      { term: 'PII Masking', explanation: 'Field-specific redaction: name (M***a), email (m*****@email.com), phone (***-**47), ssn (***-**-4729), full (********).' },
      { term: 'UDF Chaining', explanation: 'LoanDetailExtract pulls the raw value, then PiiMask redacts it. Two UDFs composed in a single SELECT column.' },
      { term: 'Mask Types', explanation: 'The second argument to PiiMask selects the masking strategy: name, email, phone, ssn, or full.' },
      { term: 'GDPR/CCPA Compliance', explanation: 'Masking PII at the stream level ensures downstream consumers never see raw personal data.' },
    ],
    useCases: ['Analytics data sharing', 'Third-party feeds', 'Regulatory compliance', 'Audit-safe logging'],
    exampleInput: [
      '{ loan_id: "L-001", name: "Maria Santos", email: "maria@email.com", phone: "555-123-4567", ssn: "123-45-6789" }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", applicant_name: "M***a", applicant_email: "m*****@email.com", applicant_phone: "***-**67", applicant_ssn: "***-**-6789" }',
    ],
    whatHappensIf: [
      { question: 'What if a field is null or empty?', answer: 'PiiMask returns null for null input. Empty strings return empty strings. No exceptions thrown.' },
      { question: 'What if I need to unmask for an audit?', answer: 'Masking is one-way. Retain the original LOAN-APPLICATIONS topic with proper ACLs for authorized audit access.' },
    ],
  },

  'loan-async-enrichment': {
    subtitle: 'Enrich loans with credit bureau scoring using 3-level UDF chaining.',
    businessContext: 'Real-time lending decisions require enriching raw applications with external scoring: pre-qualify applicants, compute instant rate quotes, classify into risk tiers. Three levels of UDF calls in a single SQL statement.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'enrich', label: 'Extract + Enrich', type: 'processor' },
        { id: 'enriched', label: 'LOANS-ENRICHED-V2', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'enrich', animated: true },
        { from: 'enrich', to: 'enriched', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Enrichment Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-ENRICHED-V2\` (
  \`key\`, loan_id, applicant_name, loan_type, amount_requested,
  credit_score, dti_ratio, score_band, approval_likelihood,
  base_rate, rate_adjustment, final_rate, risk_tier
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'applicant.personal.name.first') || ' ' ||
    LoanDetailExtract(json_payload, 'applicant.personal.name.last') as applicant_name,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.dti_ratio') as dti_ratio,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'score_band'
  ) as score_band,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'approval_likelihood'
  ) as approval_likelihood,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'base_rate'
  ) as base_rate,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'rate_adjustment'
  ) as rate_adjustment,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'final_rate'
  ) as final_rate,
  LoanDetailExtract(
    CreditBureauEnrich(json_payload), 'risk_tier'
  ) as risk_tier
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      },
    ],
    topics: [
      { name: 'LOAN-APPLICATIONS', type: 'input', description: 'Source topic with raw nested JSON loan applications' },
      { name: 'LOANS-ENRICHED-V2', type: 'output', description: 'Enriched loans with score bands, rates, and risk tiers' },
    ],
    concepts: [
      { term: '3-Level UDF Chaining', explanation: 'LoanDetailExtract extracts raw fields, CreditBureauEnrich computes scoring, then LoanDetailExtract pulls individual scores from the enriched result.' },
      { term: 'Score Bands', explanation: 'EXCELLENT (800+, 95% approval, 5.5%), GOOD (740+, 85%, 6.25%), FAIR (670+, 65%, 7%), POOR (580+, 35%, 8.5%), VERY_POOR (<580, 10%, 10%).' },
      { term: 'DTI Adjustment', explanation: 'If debt-to-income ratio exceeds 0.36, the base rate increases by +0.50%.' },
      { term: 'Risk Tiers', explanation: 'TIER_1 (lowest risk) through TIER_5 (highest risk), determined by the combination of credit score and DTI.' },
    ],
    useCases: ['Pre-qualification', 'Rate quoting', 'Risk tier routing', 'Automated underwriting'],
    exampleInput: [
      '{ loan_id: "L-001", credit_score: 750, dti_ratio: 0.35, amount: 200000 }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", credit_score: 750, score_band: "GOOD", approval_likelihood: "85%", base_rate: "6.25%", rate_adjustment: "0.00%", final_rate: "6.25%", risk_tier: "TIER_2" }',
    ],
    whatHappensIf: [
      { question: 'What if the credit score is missing?', answer: 'CreditBureauEnrich returns VERY_POOR defaults (10% approval, 10% rate). Missing data is treated as highest risk.' },
      { question: 'What if DTI exceeds 0.36?', answer: 'The base rate gets a +0.50% adjustment. A GOOD band loan at 6.25% becomes 6.75%.' },
    ],
  },

  'loan-cdc-pipeline': {
    subtitle: 'Materialize the latest state from a Change Data Capture stream.',
    businessContext: 'Customer database pushes changes to Kafka via CDC. Each update produces a new event. Downstream consumers need the latest version of each customer, not the full change history. ROW_NUMBER with DESC order keeps only the most recent.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'customers', label: 'CUSTOMERS (CDC)', type: 'source' },
        { id: 'latest', label: 'LATEST (ROW_NUMBER DESC)', type: 'processor' },
        { id: 'materialized', label: 'CUSTOMERS-LATEST', type: 'sink' },
      ],
      edges: [
        { from: 'customers', to: 'latest', animated: true },
        { from: 'latest', to: 'materialized', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'CDC Materialize Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-CUSTOMERS-LATEST\`
SELECT
  CAST(customer_id AS BYTES) as \`key\`,
  customer_id, name, credit_score, state, risk_score, risk_level
FROM (
  SELECT customer_id, name, credit_score, state, risk_score, risk_level,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY $rowtime DESC) AS rownum
  FROM \`EOT-PLATFORM-EXAMPLES-CUSTOMERS\`
)
WHERE rownum = 1;`,
      },
    ],
    topics: [
      { name: 'CUSTOMERS', type: 'input', description: 'CDC event stream from customer database — every update produces a new event' },
      { name: 'CUSTOMERS-LATEST', type: 'output', description: 'Materialized view with only the latest version of each customer' },
    ],
    concepts: [
      { term: 'CDC (Change Data Capture)', explanation: 'Database changes (inserts, updates, deletes) captured as events in Kafka. Each row change becomes a message.' },
      { term: 'ORDER BY $rowtime DESC', explanation: 'Keeps the latest event (highest timestamp). DESC = most recent wins. Compare with dedup ASC = first wins.' },
      { term: 'Materialized view', explanation: 'The output topic is a continuously updated snapshot of current customer state — not an append log.' },
      { term: 'Upsert semantics', explanation: 'With a Kafka key on customer_id, new records overwrite old ones. Downstream consumers always see the latest.' },
    ],
    crossReference: {
      cardId: 'loan-dedup',
      label: 'Compare: Deduplication',
      description: 'Dedup keeps the FIRST event (ASC). CDC keeps the LATEST (DESC). Same ROW_NUMBER pattern, opposite sort order.',
    },
    useCases: ['Database materialization from CDC', 'Search index building', 'Current-state caches', 'Microservice sync', 'Data warehouse loading'],
    exampleInput: [
      '{ customer_id: "C-001", name: "Alice Chen", credit_score: 720, state: "CA", risk_level: "LOW" }',
      '{ customer_id: "C-002", name: "Bob Martinez", credit_score: 680, state: "TX", risk_level: "MEDIUM" }',
      '{ customer_id: "C-001", name: "Alice Chen", credit_score: 750, state: "CA", risk_level: "LOW" }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", name: "Alice Chen", credit_score: 750, state: "CA", risk_level: "LOW" }',
      '{ customer_id: "C-002", name: "Bob Martinez", credit_score: 680, state: "TX", risk_level: "MEDIUM" }',
    ],
    whatHappensIf: [
      { question: 'What if a customer is deleted in the source database?', answer: 'CDC systems typically emit a tombstone (null value) for deletes. Flink does not natively handle tombstones in this pattern — you need additional logic or a DELETE-aware connector.' },
      { question: 'How is this different from dedup?', answer: 'Dedup uses ORDER BY $rowtime ASC (first event wins). CDC uses DESC (latest event wins). Same ROW_NUMBER() pattern, opposite sort order.' },
    ],
  },

  'loan-pattern-match': {
    subtitle: 'Detect burst patterns in streams using complex event processing.',
    businessContext: 'Three loan applications from the same customer in rapid succession? That\'s either fraud or a broken retry loop. MATCH_RECOGNIZE finds sequential patterns across events — the SQL equivalent of a regex on your data stream.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'match', label: 'MATCH_RECOGNIZE', type: 'processor' },
        { id: 'alerts', label: 'PATTERN-ALERTS', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'match', animated: true },
        { from: 'match', to: 'alerts', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Pattern Match Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-PATTERN-ALERTS\`
SELECT CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, first_txn, last_txn, app_count, total_amount,
  CAST(avg_amount AS DOUBLE) AS avg_amount, first_time, last_time
FROM \`EOT-PLATFORM-EXAMPLES-LOANS\`
MATCH_RECOGNIZE (
  PARTITION BY customer_id ORDER BY $rowtime
  MEASURES
    FIRST(A.txn_id) AS first_txn, LAST(A.txn_id) AS last_txn,
    COUNT(A.txn_id) AS app_count, SUM(A.amount) AS total_amount,
    AVG(A.amount) AS avg_amount,
    FIRST(A.$rowtime) AS first_time, LAST(A.$rowtime) AS last_time
  ONE ROW PER MATCH
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (A{3,})
  DEFINE A AS TRUE
)`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'PATTERN-ALERTS', type: 'output', description: 'Burst pattern alerts — one row per detected pattern with first/last txn and totals' },
    ],
    concepts: [
      { term: 'MATCH_RECOGNIZE', explanation: 'SQL pattern matching on ordered event streams. Define patterns with DEFINE, match with PATTERN, extract with MEASURES.' },
      { term: 'PARTITION BY customer_id', explanation: 'Patterns are detected independently per customer. One customer\'s burst doesn\'t affect another\'s detection.' },
      { term: 'PATTERN (A{3,})', explanation: 'Matches 3 or more consecutive events. A is defined as TRUE (any event matches), so this detects bursts of 3+ events from one customer.' },
      { term: 'ONE ROW PER MATCH', explanation: 'Emits a single summary row per detected pattern, not one row per event in the pattern.' },
      { term: 'AFTER MATCH SKIP PAST LAST ROW', explanation: 'After a match, resume scanning from the next event after the match ends. Prevents overlapping matches.' },
    ],
    useCases: ['Fraud detection', 'Retry storm detection', 'Customer behavior analysis', 'Anomaly alerting'],
    exampleInput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", amount: 5000.00 }',
      '{ customer_id: "C-001", txn_id: "TXN-002", amount: 12000.00 }',
      '{ customer_id: "C-001", txn_id: "TXN-003", amount: 8000.00 }',
      '{ customer_id: "C-002", txn_id: "TXN-004", amount: 20000.00 }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", first_txn: "TXN-001", last_txn: "TXN-003", app_count: 3, total_amount: 25000.00, avg_amount: 8333.33 }',
    ],
    whatHappensIf: [
      { question: 'What if I want to match specific conditions, not just any event?', answer: 'Change DEFINE A AS TRUE to a condition like DEFINE A AS amount > 10000 to only match high-value applications.' },
      { question: 'What if a customer sends exactly 2 events?', answer: 'No match — PATTERN (A{3,}) requires at least 3. Change to A{2,} to detect pairs.' },
    ],
  },

  'loan-running-aggregate': {
    subtitle: 'Per-row running totals without grouping — every event gets cumulative context.',
    businessContext: 'Every loan application needs context: how many has this customer submitted? What\'s their running total? OVER windows compute cumulative metrics per row without collapsing data — each event retains its identity while gaining aggregate context.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'over', label: 'OVER WINDOW', type: 'processor' },
        { id: 'stats', label: 'RUNNING-STATS', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'over', animated: true },
        { from: 'over', to: 'stats', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Running Aggregate Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-RUNNING-STATS\`
SELECT CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, amount, status,
  COUNT(*) OVER w AS running_count,
  SUM(amount) OVER w AS running_total,
  CAST(AVG(amount) OVER w AS DOUBLE) AS running_avg
FROM \`EOT-PLATFORM-EXAMPLES-LOANS\`
WINDOW w AS (
  PARTITION BY customer_id ORDER BY $rowtime
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'RUNNING-STATS', type: 'output', description: 'Each loan enriched with running count, total, and average per customer' },
    ],
    concepts: [
      { term: 'OVER window', explanation: 'Computes aggregates across a set of rows related to the current row. Unlike GROUP BY, the output has the same number of rows as the input.' },
      { term: 'ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', explanation: 'Includes all rows from the partition start up to the current row — a running/cumulative computation.' },
      { term: 'Named window (WINDOW w AS)', explanation: 'Defines the window once and reuses it across multiple aggregates. Cleaner than repeating OVER(...) on every column.' },
      { term: 'Per-customer partitioning', explanation: 'PARTITION BY customer_id ensures each customer gets independent running totals.' },
    ],
    useCases: ['Running totals', 'Cumulative metrics', 'Per-row context enrichment', 'Real-time scoring'],
    exampleInput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", amount: 5000.00, status: "APPROVED" }',
      '{ customer_id: "C-001", txn_id: "TXN-002", amount: 12000.00, status: "PENDING" }',
      '{ customer_id: "C-002", txn_id: "TXN-003", amount: 8000.00, status: "APPROVED" }',
      '{ customer_id: "C-001", txn_id: "TXN-004", amount: 3000.00, status: "APPROVED" }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", amount: 5000.00, running_count: 1, running_total: 5000.00, running_avg: 5000.00 }',
      '{ customer_id: "C-001", txn_id: "TXN-002", amount: 12000.00, running_count: 2, running_total: 17000.00, running_avg: 8500.00 }',
      '{ customer_id: "C-002", txn_id: "TXN-003", amount: 8000.00, running_count: 1, running_total: 8000.00, running_avg: 8000.00 }',
      '{ customer_id: "C-001", txn_id: "TXN-004", amount: 3000.00, running_count: 3, running_total: 20000.00, running_avg: 6666.67 }',
    ],
    whatHappensIf: [
      { question: 'What if I want a sliding window instead of cumulative?', answer: 'Change UNBOUNDED PRECEDING to something like ROWS BETWEEN 5 PRECEDING AND CURRENT ROW to compute over the last 5 events.' },
      { question: 'Does state grow unbounded?', answer: 'Yes — UNBOUNDED PRECEDING keeps all history. In production, use a bounded window (e.g. ROWS BETWEEN 100 PRECEDING) or configure state TTL.' },
    ],
  },

  'loan-change-detection': {
    subtitle: 'Compare each event to its predecessor — catch every status flip in real-time.',
    businessContext: 'SUBMITTED \u2192 PENDING \u2192 APPROVED is the happy path. But what about PENDING \u2192 DECLINED, or APPROVED \u2192 CANCELLED? LAG() lets you compare the current event to the previous one per customer, catching every state transition as it happens.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'lag', label: 'LAG() COMPARE', type: 'processor' },
        { id: 'changes', label: 'STATUS-CHANGES', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'lag', animated: true },
        { from: 'lag', to: 'changes', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Change Detection Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-STATUS-CHANGES\`
SELECT CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, loan_id, amount, prev_status, status AS current_status,
  prev_amount, amount - prev_amount AS amount_change
FROM (
  SELECT customer_id, txn_id, loan_id, amount, status,
    LAG(status) OVER w AS prev_status, LAG(amount) OVER w AS prev_amount
  FROM \`EOT-PLATFORM-EXAMPLES-LOANS\`
  WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
)
WHERE prev_status IS NOT NULL AND prev_status <> status`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'STATUS-CHANGES', type: 'output', description: 'Only events where status changed from the previous event for that customer' },
    ],
    concepts: [
      { term: 'LAG()', explanation: 'Window function that accesses the previous row in the partition. LAG(status) returns the status of the preceding event.' },
      { term: 'WHERE prev_status <> status', explanation: 'Filters to only emit rows where the status actually changed. No-change events are silently dropped.' },
      { term: 'amount_change', explanation: 'amount - prev_amount shows the delta between consecutive events, useful for detecting unusual jumps.' },
      { term: 'Subquery pattern', explanation: 'LAG() runs in a subquery; the outer query filters on the computed prev_status. Flink optimizes this into a single operator.' },
    ],
    useCases: ['Status change tracking', 'Anomaly detection', 'Audit trails', 'State machine validation'],
    exampleInput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", loan_id: "L-001", amount: 5000.00, status: "SUBMITTED" }',
      '{ customer_id: "C-001", txn_id: "TXN-002", loan_id: "L-001", amount: 5000.00, status: "PENDING" }',
      '{ customer_id: "C-001", txn_id: "TXN-003", loan_id: "L-001", amount: 5000.00, status: "PENDING" }',
      '{ customer_id: "C-001", txn_id: "TXN-004", loan_id: "L-001", amount: 8000.00, status: "APPROVED" }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", txn_id: "TXN-002", prev_status: "SUBMITTED", current_status: "PENDING", amount_change: 0.00 }',
      '{ customer_id: "C-001", txn_id: "TXN-004", prev_status: "PENDING", current_status: "APPROVED", amount_change: 3000.00 }',
    ],
    whatHappensIf: [
      { question: 'What if I want to detect changes in ANY field, not just status?', answer: 'Add more LAG() columns (e.g. LAG(amount)) and adjust the WHERE clause to OR the conditions together.' },
      { question: 'What about the first event per customer?', answer: 'LAG() returns NULL for the first event. The WHERE prev_status IS NOT NULL filter ensures it\'s excluded.' },
    ],
  },

  'loan-interval-join': {
    subtitle: 'Correlate two streams by time proximity — no shared state table needed.',
    businessContext: 'A loan application and a customer profile update within 5 minutes of each other? That\'s a match. Interval joins correlate two append-only streams based on time proximity — each event in stream A is matched with events in stream B that fall within a specified time range.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'customers', label: 'CUSTOMERS-STREAM', type: 'source' },
        { id: 'join', label: 'INTERVAL JOIN (\u00b15min)', type: 'processor' },
        { id: 'joined', label: 'INTERVAL-JOINED', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'join', animated: true },
        { from: 'customers', to: 'join', animated: true },
        { from: 'join', to: 'joined', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Interval Join Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-INTERVAL-JOINED\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`EOT-PLATFORM-EXAMPLES-LOANS\` l
JOIN \`EOT-PLATFORM-EXAMPLES-CUSTOMERS-STREAM\` c ON l.customer_id = c.customer_id
  AND c.$rowtime BETWEEN l.$rowtime - INTERVAL '5' MINUTE AND l.$rowtime + INTERVAL '5' MINUTE`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'CUSTOMERS-STREAM', type: 'input', description: 'Append-only customer events stream' },
      { name: 'INTERVAL-JOINED', type: 'output', description: 'Loans matched with customer events within \u00b15 minute window' },
    ],
    concepts: [
      { term: 'Interval join', explanation: 'Joins two streams where events must fall within a time range of each other. Unlike regular joins, interval joins bound the state and don\'t wait forever.' },
      { term: 'Time bounds (BETWEEN ... AND)', explanation: 'c.$rowtime BETWEEN l.$rowtime - 5min AND l.$rowtime + 5min creates a symmetric window. Events outside this range are never matched.' },
      { term: 'Append-only streams', explanation: 'Both sides must be append-only (no changelog/upsert). This is the key difference from temporal joins.' },
      { term: 'Bounded state', explanation: 'Flink only keeps events within the time range in state. Old events are garbage collected automatically.' },
    ],
    useCases: ['Stream-to-stream correlation', 'Activity matching', 'Cross-system event linking', 'Time-based enrichment'],
    exampleInput: [
      '{ stream: "LOANS", customer_id: "C-001", txn_id: "TXN-001", amount: 15000.00, $rowtime: "10:00:00" }',
      '{ stream: "CUSTOMERS", customer_id: "C-001", name: "Alice Chen", credit_score: 720, $rowtime: "10:03:00" }',
      '{ stream: "CUSTOMERS", customer_id: "C-002", name: "Bob Martinez", credit_score: 680, $rowtime: "09:50:00" }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", amount: 15000.00, customer_name: "Alice Chen", credit_score: 720 }',
    ],
    whatHappensIf: [
      { question: 'What if no customer event falls within the 5-minute window?', answer: 'No output is produced for that loan. Interval joins are inner joins by default — unmatched events are silently dropped.' },
      { question: 'How is this different from a temporal join?', answer: 'Temporal joins use a versioned table (changelog/upsert) and always find the latest version. Interval joins use two append-only streams and match by time proximity.' },
    ],
    crossReference: {
      cardId: 'loan-stream-enrichment',
      label: 'Compare: Stream Enrichment (Temporal Join)',
      description: 'Temporal joins look up the latest version from a dimension table. Interval joins match two streams by time proximity.',
    },
  },

  'loan-stream-enrichment': {
    subtitle: 'Look up the latest dimension data for every streaming event — zero staleness.',
    businessContext: 'Every loan arrives with just a customer_id. The temporal join looks up the LATEST customer profile (name, credit score) from a continuously updated dimension table. Unlike a regular join, FOR SYSTEM_TIME AS OF ensures you always get the version that was current at the time of the loan event.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'loans', label: 'LOANS', type: 'source' },
        { id: 'customers', label: 'CUSTOMERS-LATEST', type: 'source' },
        { id: 'join', label: 'FOR SYSTEM_TIME AS OF', type: 'processor' },
        { id: 'enriched', label: 'STREAM-ENRICHED', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'join', animated: true },
        { from: 'customers', to: 'join', animated: true },
        { from: 'join', to: 'enriched', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Stream Enrichment Query',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-STREAM-ENRICHED\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`EOT-PLATFORM-EXAMPLES-LOANS\` l
JOIN \`EOT-PLATFORM-EXAMPLES-CUSTOMERS-LATEST\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id`,
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'CUSTOMERS-LATEST', type: 'input', description: 'Versioned customer dimension table (upsert/changelog with PRIMARY KEY)' },
      { name: 'STREAM-ENRICHED', type: 'output', description: 'Loans enriched with the latest customer name and credit score' },
    ],
    concepts: [
      { term: 'FOR SYSTEM_TIME AS OF', explanation: 'Temporal join syntax — looks up the version of the dimension table that was current at the event\'s timestamp.' },
      { term: 'Versioned table', explanation: 'CUSTOMERS-LATEST has PRIMARY KEY and changelog.mode=upsert. Flink maintains a versioned snapshot internally.' },
      { term: 'Point-in-time accuracy', explanation: 'Each loan gets the customer profile that was valid at the loan\'s arrival time, not the current profile. Critical for audits.' },
      { term: 'Stream \u00d7 Table', explanation: 'One side is a stream (LOANS), the other is a versioned table (CUSTOMERS-LATEST). Fundamentally different from stream \u00d7 stream joins.' },
    ],
    useCases: ['Real-time enrichment', 'Dimension table lookups', 'Feature engineering for ML', 'Audit-compliant joins'],
    exampleInput: [
      '{ stream: "CUSTOMERS", customer_id: "C-001", name: "Alice Chen", credit_score: 720, valid_from: "09:00" }',
      '{ stream: "CUSTOMERS", customer_id: "C-001", name: "Alice Chen", credit_score: 750, valid_from: "10:00" }',
      '{ stream: "LOANS", customer_id: "C-001", txn_id: "TXN-001", amount: 15000.00, $rowtime: "09:30" }',
      '{ stream: "LOANS", customer_id: "C-001", txn_id: "TXN-002", amount: 20000.00, $rowtime: "10:30" }',
    ],
    expectedOutput: [
      '{ customer_id: "C-001", txn_id: "TXN-001", amount: 15000.00, customer_name: "Alice Chen", credit_score: 720 }',
      '{ customer_id: "C-001", txn_id: "TXN-002", amount: 20000.00, customer_name: "Alice Chen", credit_score: 750 }',
    ],
    whatHappensIf: [
      { question: 'What if no customer record exists yet when a loan arrives?', answer: 'The loan is silently dropped (inner join). To handle missing dimensions, consider a LEFT temporal join if supported by your Flink version.' },
      { question: 'How is this different from an interval join?', answer: 'Interval joins match two append-only streams by time proximity. Temporal joins look up the latest version of a dimension table — one side must have PRIMARY KEY and changelog semantics.' },
    ],
    crossReference: {
      cardId: 'loan-interval-join',
      label: 'Compare: Interval Join',
      description: 'Interval joins match two append-only streams by time proximity. Temporal joins look up the latest version of a dimension table.',
    },
  },
};
