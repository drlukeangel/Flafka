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


  // ─────────────────────────────────────────────────────────────
  //  Kafka Fundamentals
  // ─────────────────────────────────────────────────────────────

  'kafka-produce-consume': {
    subtitle: 'Produce keyed messages into Kafka and consume them with Flink SQL — see exactly how keys control partition placement and message ordering.',
    businessContext: 'Every Kafka message has an optional key. This key determines which partition the message lands in (via hashing), and all messages with the same key arrive at consumers in the exact order they were produced. This is the foundation of Kafka ordering guarantees — and one of the most misunderstood concepts in the entire ecosystem. Get the key wrong and your downstream consumers process events out of order. Get it right and you have a rock-solid event stream.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'produce', label: 'MESSAGES (produce)', type: 'source' },
        { id: 'insert', label: 'INSERT INTO (key = user_id)', type: 'processor' },
        { id: 'consume', label: 'MESSAGES-BY-KEY (consume)', type: 'sink' },
      ],
      edges: [
        { from: 'produce', to: 'insert', animated: true },
        { from: 'insert', to: 'consume', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Produce keyed messages',
        sql: `INSERT INTO \`MESSAGES-BY-KEY\`
SELECT user_id, message_body, category, ts
FROM \`MESSAGES\``,
      },
      {
        label: 'Consume by key',
        sql: `SELECT user_id AS message_key, message_body, category, ts
FROM \`MESSAGES-BY-KEY\``,
      },
    ],
    concepts: [
      { term: 'Kafka Message Key', explanation: 'The key is a byte array attached to every Kafka record. Kafka hashes this key to decide which partition the message goes to. Same key = same partition = guaranteed ordering within that partition. No key = round-robin assignment = no ordering guarantees at all.' },
      { term: 'Partition', explanation: 'A partition is an ordered, immutable sequence of records within a topic. Each partition is an independent log. Messages within a single partition are strictly ordered by offset. Messages across different partitions have no ordering relationship.' },
      { term: 'Ordering Guarantee', explanation: 'Kafka only guarantees ordering within a single partition. If you need all events for user_id "U-001" to arrive in order, they must all go to the same partition — which means they need the same key. This is why choosing the right key is a critical design decision.' },
      { term: 'Key Semantics in Flink SQL', explanation: 'When you INSERT INTO a Kafka-backed table, Flink uses the primary key (or the first column if no key is defined) as the Kafka message key. The key determines partitioning, compaction behavior, and downstream join semantics.' },
    ],
    useCases: ['Understanding Kafka key semantics', 'Partition-aware message routing', 'Ordered event processing per entity', 'Foundation for joins and aggregations'],
    exampleInput: [
      '{ user_id: "U-001", message_body: "Loan application submitted", category: "APPLICATION", ts: "2026-03-07T10:00:00Z" }',
      '{ user_id: "U-002", message_body: "Payment received", category: "PAYMENT", ts: "2026-03-07T10:00:01Z" }',
      '{ user_id: "U-001", message_body: "Documents uploaded", category: "APPLICATION", ts: "2026-03-07T10:00:02Z" }',
    ],
    expectedOutput: [
      '{ message_key: "U-001", message_body: "Loan application submitted", category: "APPLICATION" }',
      '{ message_key: "U-001", message_body: "Documents uploaded", category: "APPLICATION" }',
      '-- Both U-001 messages arrive in order because they share a partition',
    ],
    whatHappensIf: [
      { question: 'What if I produce messages without a key?', answer: 'Kafka distributes them across partitions using round-robin (or sticky partitioning in newer clients). Messages from the same logical entity can end up in different partitions, and you lose ordering guarantees entirely.' },
      { question: 'What if two different users hash to the same partition?', answer: 'Totally normal. Multiple keys can map to the same partition. Within that partition, messages from all keys are interleaved but each key\'s messages maintain their relative order. Consumers see them in partition offset order.' },
      { question: 'What if I change the number of partitions?', answer: 'The key-to-partition mapping changes because the hash modulus changes. Existing messages stay where they are, but new messages with the same key may land in a different partition. This is why you should set partition count upfront and avoid changing it in production.' },
    ],
  },

  'kafka-startup-modes': {
    subtitle: 'Control exactly where Flink starts reading from a Kafka topic — replay from the beginning, jump to the live edge, or pick a precise timestamp.',
    businessContext: 'When a Flink job starts (or restarts), it needs to know where in the Kafka topic to begin reading. The default is earliest-offset, which replays every message ever produced. But for a topic with billions of records, that could take hours. Startup modes let you choose: replay everything for completeness, skip to latest for real-time dashboards, or use a timestamp to start from last Tuesday at 3pm because that is when the bug happened.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'topic', label: 'EVENTS (20 records)', type: 'source' },
        { id: 'mode', label: 'scan.startup.mode', type: 'processor' },
        { id: 'output', label: 'Query Results', type: 'sink' },
      ],
      edges: [
        { from: 'topic', to: 'mode', animated: true },
        { from: 'mode', to: 'output', animated: true },
      ],
    },
    concepts: [
      { term: 'scan.startup.mode', explanation: 'A table property that controls where Flink starts reading. Set it in the WITH clause of your CREATE TABLE statement. Changing it requires dropping and recreating the table — you cannot ALTER it after creation.' },
      { term: 'earliest-offset', explanation: 'Read every record from the very beginning of the topic. This is the default. Use it when you need to reprocess all historical data, backfill a new table, or when the topic is small enough that replaying is fast.' },
      { term: 'latest-offset', explanation: 'Skip all existing data and only process new records that arrive after the query starts. Use it for real-time dashboards, alerting, or when historical data is already processed and you only care about what happens next.' },
      { term: 'timestamp', explanation: 'Start reading from a specific moment in time using scan.startup.timestamp-millis. Kafka finds the first offset in each partition at or after that timestamp. Use it to replay from a known-good point — like reprocessing after a bug fix.' },
      { term: 'specific-offsets', explanation: 'Surgeon-level precision: specify the exact offset per partition. Rarely used in practice, but invaluable when you need to skip a single poison pill record in partition 3 at offset 4,821,003.' },
      { term: 'group-offsets', explanation: 'Resume from the last committed offset of the consumer group. In standard Kafka consumers this is the norm, but in Flink SQL it is less common because Flink manages offsets through its own checkpointing mechanism.' },
    ],
    useCases: ['Historical data replay', 'Real-time dashboard bootstrapping', 'Bug fix reprocessing from a timestamp', 'Selective partition replay'],
    exampleInput: [
      '{ event_id: "E-001", event_type: "LOGIN", user_id: "U-042", ts: "2026-03-07T09:00:00Z" }',
      '... 18 more events ...',
      '{ event_id: "E-020", event_type: "CHECKOUT", user_id: "U-007", ts: "2026-03-07T09:19:00Z" }',
    ],
    expectedOutput: [
      '-- With earliest-offset: all 20 rows returned',
      '-- With latest-offset: 0 rows (no new events after query start)',
      '-- With timestamp at 09:15: only events E-016 through E-020',
    ],
    whatHappensIf: [
      { question: 'What if the timestamp I specify is before the earliest retained record?', answer: 'Kafka returns the earliest available offset in that partition. Records that have been deleted by retention policy are gone forever — the timestamp scan finds the oldest surviving record.' },
      { question: 'What if I use latest-offset and no new data arrives?', answer: 'The query sits idle with zero results. It is not broken — it is waiting. As soon as new records are produced to the topic, they stream through immediately.' },
      { question: 'Can I change startup mode without dropping the table?', answer: 'No. scan.startup.mode is set in the WITH clause at CREATE TABLE time. To change it, you must DROP TABLE and CREATE TABLE again with the new mode. This is a common gotcha.' },
    ],
  },

  'kafka-changelog-modes': {
    subtitle: 'Same data, two completely different outcomes — see how append mode keeps every row while upsert mode consolidates by key.',
    businessContext: 'Kafka topics can represent data in two fundamentally different ways. In append mode, every record is a new, immutable fact — the topic grows forever. In upsert mode, records with the same key replace previous records — the topic represents the latest state per key. This distinction controls whether your downstream table is an ever-growing event log or a compact state table. Choosing wrong means either unbounded storage growth or missing historical detail.',
    dataFlow: {
      layout: 'fan-out',
      nodes: [
        { id: 'source', label: 'Same 15 Events', type: 'source' },
        { id: 'append', label: 'Append Mode', type: 'processor' },
        { id: 'upsert', label: 'Upsert Mode', type: 'processor' },
        { id: 'append-out', label: 'APPEND-RESULT (15 rows)', type: 'sink' },
        { id: 'upsert-out', label: 'UPSERT-RESULT (~5 rows)', type: 'sink' },
      ],
      edges: [
        { from: 'source', to: 'append', animated: true },
        { from: 'source', to: 'upsert', animated: true },
        { from: 'append', to: 'append-out', animated: true },
        { from: 'upsert', to: 'upsert-out', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Append mode (INSERT only)',
        sql: `INSERT INTO \`APPEND-RESULT\`
SELECT * FROM \`APPEND-LOG\`
-- Every row appended. Table grows forever.`,
      },
      {
        label: 'Upsert mode (INSERT + UPDATE by key)',
        sql: `INSERT INTO \`UPSERT-RESULT\`
SELECT event_key, COUNT(*) AS event_count, MAX(event_value) AS latest_value
FROM \`UPSERT-LOG\`
GROUP BY event_key
-- Same key? Previous row is replaced. Table stays compact.`,
      },
      {
        label: 'Compare results side by side',
        sql: `SELECT 'APPEND' AS mode, COUNT(*) AS row_count FROM \`APPEND-RESULT\`
UNION ALL
SELECT 'UPSERT' AS mode, COUNT(*) AS row_count FROM \`UPSERT-RESULT\``,
      },
    ],
    concepts: [
      { term: 'Changelog Mode', explanation: 'Defines how a Kafka-backed Flink table interprets incoming records. Append mode treats every record as a new INSERT. Upsert mode uses the primary key to determine whether a record is an INSERT (new key) or UPDATE (existing key).' },
      { term: 'Append Mode', explanation: 'The default for most Kafka topics. Every record produces a +I (insert) changelog entry. The table grows monotonically. Old records are never updated or retracted. Good for event logs, audit trails, and immutable fact tables.' },
      { term: 'Upsert Mode', explanation: 'Records with the same key overwrite previous records. Internally, Flink emits -U (update before) and +U (update after) changelog entries, or -D (delete) for tombstones. Good for entity state tables, aggregation results, and materialized views.' },
      { term: 'Log Compaction', explanation: 'Kafka can compact topics by keeping only the latest record per key, effectively implementing upsert semantics at the storage layer. When combined with Flink\'s upsert mode, you get end-to-end state table semantics with bounded storage.' },
      { term: 'Retract vs Upsert', explanation: 'Retract mode sends explicit delete markers (-D) for removed rows. Upsert mode uses null values (tombstones) for the same purpose. Both achieve "take back a previous record," but the mechanisms differ. Confluent Cloud Flink primarily uses upsert for changelog topics.' },
    ],
    useCases: ['Understanding changelog semantics', 'Choosing between event sourcing and state tables', 'Designing aggregation output topics', 'Kafka topic compaction strategies'],
    exampleInput: [
      '{ event_key: "K1", event_value: "first", ts: "2026-03-07T10:00:00Z" }',
      '{ event_key: "K1", event_value: "second", ts: "2026-03-07T10:00:05Z" }',
      '{ event_key: "K2", event_value: "only-one", ts: "2026-03-07T10:00:10Z" }',
      '{ event_key: "K1", event_value: "third", ts: "2026-03-07T10:00:15Z" }',
    ],
    expectedOutput: [
      '-- APPEND mode: 4 rows (all records kept)',
      '-- UPSERT mode: 2 rows (K1 -> "third", K2 -> "only-one")',
      '-- Same input, completely different output shapes',
    ],
    whatHappensIf: [
      { question: 'What if I use append mode for an aggregation output?', answer: 'You get a new row for every intermediate result. A GROUP BY with 1000 updates per key produces 1000 rows in append mode but only 1 row (the latest) in upsert mode. Your downstream consumers would need to deduplicate themselves.' },
      { question: 'What if I use upsert mode but my table has no primary key?', answer: 'Flink throws an error at query planning time. Upsert mode requires a primary key to know which records to update. Define one in your CREATE TABLE statement.' },
      { question: 'Can I switch a topic from append to upsert after creation?', answer: 'You can recreate the Flink table with a different changelog.mode, but the existing data in the topic does not change. Old append records will be re-interpreted under upsert semantics, which may produce unexpected results if duplicate keys exist.' },
    ],
  },

  'kafka-value-formats': {
    subtitle: 'Avro with Schema Registry, plain JSON, and raw bytes — three tables, three serialization formats, one comparison to rule them all.',
    businessContext: 'Every byte written to Kafka needs a serialization format. Avro with Schema Registry gives you type safety, schema evolution, and compact binary encoding — but requires Schema Registry infrastructure. JSON is universally readable and needs nothing extra — but has no schema enforcement, so a producer can send "age": "twenty-five" and you will not know until your pipeline explodes. Raw bytes are for legacy systems, log lines, and situations where you have given up on structured data entirely.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'avro', label: 'AVRO-DATA', type: 'source' },
        { id: 'json', label: 'JSON-DATA', type: 'source' },
        { id: 'raw', label: 'RAW-DATA', type: 'source' },
        { id: 'flink', label: 'SELECT * (Flink SQL)', type: 'processor' },
        { id: 'results', label: 'Compare Output', type: 'sink' },
      ],
      edges: [
        { from: 'avro', to: 'flink', animated: true },
        { from: 'json', to: 'flink', animated: true },
        { from: 'raw', to: 'flink', animated: true },
        { from: 'flink', to: 'results', animated: true },
      ],
    },
    concepts: [
      { term: 'value.format', explanation: 'A table property that tells Flink how to deserialize the bytes stored in Kafka. Set it in the WITH clause: \'avro-confluent\' for Schema Registry-backed Avro, \'json\' for self-describing JSON, \'raw\' for unstructured bytes.' },
      { term: 'Avro + Schema Registry', explanation: 'Avro encodes data as compact binary using a schema definition. Schema Registry stores and versions these schemas centrally. Producers and consumers agree on structure without embedding it in every message — saving bandwidth and enforcing contracts. Confluent Cloud includes Schema Registry by default.' },
      { term: 'JSON Format', explanation: 'Human-readable, self-describing, universally supported. Every message carries its own structure inline. No external registry needed. The downside: no enforcement. Field "amount" could be a number in one message and a string in the next. Debugging-friendly, production-risky.' },
      { term: 'Raw Format', explanation: 'The topic contains raw bytes — no schema, no structure, no help. You get a single BYTES or STRING column and must CAST or parse it yourself. Useful for log ingestion, binary protocols, or bridging with systems that predate structured serialization.' },
      { term: 'Schema Evolution', explanation: 'Avro with Schema Registry supports adding, removing, and modifying fields while maintaining backward/forward compatibility. JSON technically supports arbitrary changes, but without enforcement, you discover incompatibilities at query time (usually as NULL values or type errors).' },
    ],
    useCases: ['Choosing a serialization format for new topics', 'Understanding Schema Registry value proposition', 'Working with legacy raw-byte topics', 'Comparing format tradeoffs'],
    exampleInput: [
      '-- AVRO: compact binary, schema-verified (9/10 acorns)',
      '{ sensor_id: "S-001", temperature: 72.5, unit: "F", ts: "2026-03-07T10:00:00Z" }',
      '-- JSON: human-readable, no enforcement (7/10 acorns)',
      '{ "sensor_id": "S-001", "temperature": 72.5, "unit": "F" }',
      '-- RAW: just bytes (3/10 acorns, and that is generous)',
      '"S-001|72.5|F|2026-03-07T10:00:00Z"',
    ],
    expectedOutput: [
      '-- All three queries return the same logical data',
      '-- But Avro auto-resolves column names from Schema Registry',
      '-- JSON requires column definitions in CREATE TABLE',
      '-- Raw requires manual CAST(raw_payload AS STRING) and parsing',
    ],
    whatHappensIf: [
      { question: 'What if a JSON producer sends a field with the wrong type?', answer: 'Flink attempts to coerce it. If coercion fails, the field becomes NULL (or the row is dropped depending on configuration). There is no upfront validation — you find out about type mismatches at query time.' },
      { question: 'What if Schema Registry is unavailable?', answer: 'Avro-formatted tables cannot deserialize messages. Queries fail with a Schema Registry connection error. This is the tradeoff: type safety and evolution support in exchange for a runtime dependency on Schema Registry availability.' },
      { question: 'Can I mix formats within the same pipeline?', answer: 'Absolutely. Read from an Avro source, transform in Flink SQL, write to a JSON sink. Flink handles serialization/deserialization at each boundary independently. This is common when bridging legacy JSON producers with modern Avro consumers.' },
    ],
  },

  'kafka-schema-evolution': {
    subtitle: 'Schemas evolve, producers add fields, and Flink needs to keep up — learn the DROP + CREATE workflow that makes it work.',
    businessContext: 'In the real world, schemas change constantly. A new business requirement adds a "priority" field. A compliance update requires a "consent_timestamp" column. The producer team deploys their change, and suddenly your Flink SQL table is missing columns. Unlike a database that auto-discovers schema changes, Flink SQL tables are statically defined at CREATE TABLE time. When the upstream schema evolves, you must drop and recreate the table definition to pick up new fields. This is not a bug — it is a deliberate design choice that prioritizes query stability over automatic schema discovery.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'producer', label: 'Producer (schema v1)', type: 'source' },
        { id: 'sr', label: 'Schema Registry (v1 -> v2)', type: 'processor' },
        { id: 'flink-old', label: 'Flink Table (v1 cols)', type: 'sink' },
        { id: 'flink-new', label: 'DROP + CREATE (v2 cols)', type: 'sink' },
      ],
      edges: [
        { from: 'producer', to: 'sr', animated: true },
        { from: 'sr', to: 'flink-old', animated: true },
        { from: 'sr', to: 'flink-new', animated: true },
      ],
    },
    concepts: [
      { term: 'Schema Evolution', explanation: 'The process of modifying a data schema over time — adding fields, removing fields, changing types — while maintaining compatibility with existing producers and consumers. Schema Registry enforces compatibility rules (BACKWARD, FORWARD, FULL) to prevent breaking changes.' },
      { term: 'DROP + CREATE Workflow', explanation: 'In Flink SQL, the only way to update a table definition is to DROP TABLE and CREATE TABLE with the new schema. This is because Flink compiles the schema into the query plan at startup. Running queries continue using the old schema until stopped and restarted.' },
      { term: 'Backward Compatibility', explanation: 'New schema can read data written with the old schema. Typically achieved by adding optional fields with default values. This is the most common compatibility mode and the default in Confluent Schema Registry.' },
      { term: 'Forward Compatibility', explanation: 'Old schema can read data written with the new schema. Typically achieved by only removing optional fields. Less common but important when consumers cannot be updated simultaneously with producers.' },
      { term: 'NULL Backfill', explanation: 'When you add a new column to a Flink table, old records that were produced before the field existed will have NULL in that column. Flink does not retroactively fill in missing fields — it reads what is there and NULLs the rest.' },
    ],
    useCases: ['Adding fields to production schemas', 'Handling schema drift gracefully', 'Understanding Schema Registry compatibility modes', 'Managing the Flink table lifecycle'],
    exampleInput: [
      '-- Schema v1: { event_id, event_type, payload, event_time }',
      '{ event_id: "E-001", event_type: "LOGIN", payload: "{}", event_time: "2026-03-07T10:00:00Z" }',
      '-- Schema v2: { event_id, event_type, payload, priority, event_time }',
      '{ event_id: "E-010", event_type: "ALERT", payload: "{}", priority: 1, event_time: "2026-03-07T11:00:00Z" }',
    ],
    expectedOutput: [
      '-- Before evolution: priority column does not exist in query results',
      '-- After DROP + CREATE: old records show priority = NULL',
      '-- New records show priority = 1 (or whatever was produced)',
      '-- Both old and new records coexist in the same table',
    ],
    whatHappensIf: [
      { question: 'What if I skip the DROP TABLE step?', answer: 'CREATE TABLE fails because the table already exists. You must drop the old definition first. There is no ALTER TABLE ... ADD COLUMN in Flink SQL on Confluent Cloud.' },
      { question: 'What if the producer removes a field instead of adding one?', answer: 'Records produced after the removal will have NULL in that column in your Flink table. If the column is referenced in a WHERE clause or JOIN condition, you may get unexpected empty results. Always check compatibility rules before removing fields.' },
      { question: 'What happens to running queries when I DROP TABLE?', answer: 'Any running INSERT INTO or SELECT queries referencing that table will fail. You need to stop them first, drop the table, recreate it with the new schema, and restart the queries. This is the primary operational cost of schema evolution in Flink SQL.' },
    ],
  },

  'confluent-connector-bridge': {
    subtitle: 'Source connectors bring raw data into Kafka, Flink SQL cleans and transforms it, and sink connectors deliver it downstream — the managed pipeline pattern.',
    businessContext: 'Confluent managed connectors handle the plumbing of getting data into and out of Kafka — databases, cloud storage, SaaS APIs, and more. But connectors do not transform data. They dump it raw. Flink SQL sits in the middle: it reads the messy connector output, cleans field values, validates records, normalizes types, and writes clean results to an output topic that a sink connector can deliver anywhere. This is the "connector bridge" pattern and it is the most common real-world Flink SQL architecture on Confluent Cloud.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'external', label: 'External Sources', type: 'source' },
        { id: 'source-conn', label: 'Source Connectors', type: 'processor' },
        { id: 'raw-topic', label: 'RAW-INGEST Topic', type: 'source' },
        { id: 'flink', label: 'Flink SQL Transform', type: 'processor' },
        { id: 'clean-topic', label: 'CLEAN-OUTPUT Topic', type: 'sink' },
        { id: 'sink-conn', label: 'Sink Connector', type: 'sink' },
      ],
      edges: [
        { from: 'external', to: 'source-conn', animated: true },
        { from: 'source-conn', to: 'raw-topic', animated: true },
        { from: 'raw-topic', to: 'flink', animated: true },
        { from: 'flink', to: 'clean-topic', animated: true },
        { from: 'clean-topic', to: 'sink-conn', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Transform and clean raw connector data',
        sql: `INSERT INTO \`CLEAN-OUTPUT\`
SELECT
  UPPER(TRIM(source_system)) AS source_system,
  event_id,
  COALESCE(event_payload, '{}') AS event_payload,
  CASE
    WHEN event_type IS NULL THEN 'UNKNOWN'
    WHEN event_type = '' THEN 'EMPTY'
    ELSE UPPER(event_type)
  END AS event_type,
  ingestion_time
FROM \`RAW-INGEST\`
WHERE event_id IS NOT NULL`,
      },
      {
        label: 'Verify cleaned output',
        sql: `SELECT source_system, event_type, COUNT(*) AS event_count
FROM \`CLEAN-OUTPUT\`
GROUP BY source_system, event_type`,
      },
    ],
    concepts: [
      { term: 'Source Connector', explanation: 'A managed plugin that reads data from an external system (database, S3, Salesforce, etc.) and writes it to a Kafka topic. Confluent Cloud offers 200+ pre-built connectors. The connector handles connection management, schema extraction, and offset tracking.' },
      { term: 'Sink Connector', explanation: 'The reverse: reads from a Kafka topic and writes to an external system. Common sinks include Snowflake, BigQuery, Elasticsearch, S3, and PostgreSQL. Sink connectors expect clean, well-structured data — which is exactly what the Flink SQL transformation provides.' },
      { term: 'Connector Bridge Pattern', explanation: 'Source Connector -> Raw Topic -> Flink SQL Transform -> Clean Topic -> Sink Connector. This three-stage architecture separates concerns: connectors handle I/O, Flink handles logic. You can swap connectors without changing SQL, or update SQL without reconfiguring connectors.' },
      { term: 'Data Quality in the Middle', explanation: 'Raw connector data is messy: NULLs, inconsistent casing, empty strings, missing fields. The Flink SQL layer is where you enforce quality — COALESCE for defaults, TRIM for whitespace, CASE for normalization, WHERE for filtering invalid records.' },
    ],
    useCases: ['ETL pipeline with Confluent connectors', 'Data quality enforcement in streaming', 'Bridging legacy systems to modern data platforms', 'Multi-source data normalization'],
    exampleInput: [
      '{ source_system: " salesforce ", event_id: "E-001", event_type: null, event_payload: null, ingestion_time: "2026-03-07T10:00:00Z" }',
      '{ source_system: "postgres", event_id: "E-002", event_type: "UPDATE", event_payload: "{\\"loan_id\\": \\"L-99\\"}", ingestion_time: "2026-03-07T10:00:01Z" }',
      '{ source_system: "s3  ", event_id: null, event_type: "UPLOAD", event_payload: "...", ingestion_time: "2026-03-07T10:00:02Z" }',
    ],
    expectedOutput: [
      '{ source_system: "SALESFORCE", event_id: "E-001", event_type: "UNKNOWN", event_payload: "{}" }',
      '{ source_system: "POSTGRES", event_id: "E-002", event_type: "UPDATE", event_payload: "{\\"loan_id\\": \\"L-99\\"}" }',
      '-- Third record dropped: event_id IS NULL fails the WHERE filter',
    ],
    whatHappensIf: [
      { question: 'What if a source connector goes down?', answer: 'The raw topic stops receiving new data, but Flink SQL continues running. It processes any buffered records and then idles. When the connector recovers, it picks up where it left off and Flink processes the backlog automatically.' },
      { question: 'What if I need to add a new source system?', answer: 'Deploy a new source connector pointing at the same raw topic. No Flink SQL changes needed — the transform query already handles any source_system value. This is the beauty of the bridge pattern: adding sources is a connector config change, not a code change.' },
      { question: 'Can I skip the Flink layer and connect source directly to sink?', answer: 'Technically yes, using Kafka Connect\'s Single Message Transforms (SMTs). But SMTs are limited to simple field-level operations. Flink SQL gives you JOINs, aggregations, windowing, and full SQL expressiveness. For anything beyond trivial transformations, the Flink bridge is worth it.' },
    ],
  },

  // ─── VIEW EXAMPLES ────────────────────────────────────────────────────────

  'view-ai-drift': {
    subtitle: 'Detect when an ML model\'s live predictions diverge from its training baseline.',
    businessContext: 'You are the head of data science at a lending platform. Your credit-scoring model was trained on last year\'s data. As economic conditions shift, the model\'s predictions drift — it starts approving loans that will default, or rejecting good borrowers. You need to know the moment drift exceeds 5% so the team can retrain before losses mount. Flink computes feature statistics in real-time tumbling windows and alerts within seconds when the drift score crosses threshold.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'predictions', label: 'MODEL-PREDICTIONS', type: 'source' },
        { id: 'baseline', label: 'TRAINING-BASELINE', type: 'source' },
        { id: 'window', label: 'TUMBLE(1h)', type: 'processor' },
        { id: 'drift', label: 'DRIFT-ALERTS', type: 'sink' },
      ],
      edges: [
        { from: 'predictions', to: 'window', animated: true },
        { from: 'baseline', to: 'window', animated: false },
        { from: 'window', to: 'drift', animated: true },
      ],
    },
    concepts: [
      { term: 'Feature Drift', explanation: 'The statistical gap between what your model was trained on and what it sees in production today. Think of it like a recipe written for one climate being cooked in another — the same steps produce different results. If the average loan applicant\'s income has shifted by 20% since training, the model\'s risk scores are systematically wrong.' },
      { term: 'Windowed Feature Statistics', explanation: 'Instead of comparing individual predictions, you compare distributions: mean, standard deviation, min/max of each feature over the last hour vs. the baseline. One outlier is noise; a shifted hourly average is signal.' },
      { term: 'Materialized View', explanation: 'A continuously-updating query result stored as a Kafka topic. Unlike a SQL VIEW (which re-runs on each query), Flink keeps the output current in real-time. The drift alert consumer reads the latest row, not the history.' },
      { term: 'Population Shift vs. Concept Drift', explanation: 'Two flavors: population shift = input data changed (different borrowers than we trained on); concept drift = the relationship between inputs and outcomes changed (income used to predict repayment, now it doesn\'t). Monitoring both requires watching both input features and prediction accuracy.' },
    ],
    useCases: [
      'Credit-scoring model health monitoring in production',
      'Fraud detection model retraining triggers',
      'Any ML pipeline where data distribution changes over time',
      'A/B test monitoring for model comparison',
    ],
    whatHappensIf: [
      { question: 'What if drift spikes temporarily due to a data pipeline issue?', answer: 'A single bad window can trigger false alarms. Use a multi-window threshold: alert only if drift exceeds the limit for 3 consecutive windows. Add a deadman switch on the data volume — if events drop to zero, suppress alerts (the pipeline is down, not the model).' },
      { question: 'What if the model is updated mid-stream?', answer: 'Insert a "model version changed" event into the baseline topic. The Flink query picks up the new baseline immediately. Use a temporal join keyed on model version so each prediction is compared against the right baseline.' },
    ],
  },

  'view-credit-risk': {
    subtitle: 'Maintain a live credit risk score per borrower, updated with every new event.',
    businessContext: 'You are a product manager at a fintech lender. Your credit analysts refresh risk scores nightly from a batch job — but a borrower who misses a payment at 2pm won\'t show as high-risk until tomorrow morning. By then, another $50k loan may have been approved. Flink materializes a risk view that recalculates every borrower\'s score within seconds of a new payment, application, or delinquency event, giving underwriters a live dashboard instead of a 24-hour-old snapshot.',
    sqlBlocks: [
      {
        label: 'Risk Concentration by ZIP',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-RISK-BY-ZIP\`
SELECT
  zip_code,
  COUNT(*) AS loan_count,
  SUM(upb) AS total_exposure,
  CAST(AVG(upb) AS DOUBLE) AS avg_loan_size
FROM \`EOT-PLATFORM-EXAMPLES-SECURITIZED-LOANS\`
GROUP BY zip_code;`,
      },
      {
        label: 'Flag High-Concentration ZIPs',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-RISK-BY-ZIP\`
WHERE total_exposure > 1000000
ORDER BY total_exposure DESC
LIMIT 20;`,
      },
    ],
    exampleInput: [
      '{ loan_id: "L-001", zip_code: "90210", upb: 420000, status: "CURRENT" }',
      '{ loan_id: "L-002", zip_code: "90210", upb: 380000, status: "CURRENT" }',
      '{ loan_id: "L-003", zip_code: "30301", upb: 250000, status: "DELINQUENT" }',
    ],
    expectedOutput: [
      '{ zip_code: "90210", loan_count: 2, total_exposure: 800000, avg_loan_size: 400000.0 }',
      '{ zip_code: "30301", loan_count: 1, total_exposure: 250000, avg_loan_size: 250000.0 }',
      '— View updates live: new loan arrives → ZIP row recomputes instantly.',
    ],
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'payments', label: 'PAYMENTS', type: 'source' },
        { id: 'applications', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'delinquency', label: 'DELINQUENCY-EVENTS', type: 'source' },
        { id: 'risk', label: 'CREDIT-RISK-VIEW', type: 'sink' },
      ],
      edges: [
        { from: 'payments', to: 'risk', animated: true },
        { from: 'applications', to: 'risk', animated: true },
        { from: 'delinquency', to: 'risk', animated: true },
      ],
    },
    concepts: [
      { term: 'Materialized View (Upsert Mode)', explanation: 'Each time a new event arrives for borrower B-001, Flink emits a new row with the updated risk score for that borrower. Downstream, a database configured for upsert writes keeps only the latest row — so queries always see current risk, not history. It\'s like a spreadsheet that recalculates a cell every time one of its inputs changes.' },
      { term: 'Changelog Stream', explanation: 'Flink\'s internal representation when it updates, not just appends. A +U (upsert) record says "replace the previous value for this key." A -D (delete) says "remove it." Downstream Kafka topics and connectors that understand changelogs can reconstruct the current state of any table.' },
      { term: 'Multi-source Aggregation', explanation: 'Risk score draws from three signals: payment history (from PAYMENTS), outstanding obligations (from LOAN-APPLICATIONS), and past-due events (from DELINQUENCY). Flink joins them all in one stateful query — far simpler than orchestrating three batch jobs and merging results.' },
      { term: 'Scoring Function', explanation: 'The SQL computes something like: base_score - (missed_payments * 50) - (delinquency_days * 10) + (on_time_payments * 5), capped between 300–850 (FICO-like range). The formula lives in Flink SQL, not in application code — so business rules change without a deployment.' },
    ],
    useCases: [
      'Real-time underwriting decision support',
      'Live borrower risk dashboards for loan officers',
      'Automated credit limit adjustment triggers',
      'Regulatory capital reserve calculations (Basel III intraday)',
    ],
    whatHappensIf: [
      { question: 'What if a payment event arrives out of order?', answer: 'Flink processes it when it arrives. The materialized view emits a new row with the corrected score. Downstream consumers get the update within milliseconds. If strict ordering matters, add a watermark and buffer late events before finalizing scores.' },
      { question: 'What if the same borrower has 10,000 events?', answer: 'Flink maintains aggregation state per key (borrower_id). It does not reprocess all 10,000 events for each new one — it keeps running totals in RocksDB state. Memory usage is proportional to the number of unique borrowers, not the event volume.' },
    ],
  },

  'view-early-warning': {
    subtitle: 'Fire a time-based alert when no expected event arrives within a deadline.',
    businessContext: 'You are an ops engineer at a payments company. When a payment is initiated, a confirmation event should arrive within 60 seconds. If it doesn\'t, the transaction may be stuck in a legacy system. Today you discover failures only through customer complaints hours later. Flink\'s watermark mechanism lets you detect absence: once the watermark advances past the 60-second deadline without seeing a confirmation, an alert fires automatically, long before any customer picks up the phone.',
    sqlBlocks: [
      {
        label: 'Servicer Health (Delinquency Rate)',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-SERVICER-HEALTH\`
SELECT
  servicer_id,
  window_start,
  window_end,
  total_payments,
  delinquent_payments,
  CAST(delinquent_payments AS DOUBLE) / total_payments * 100 AS delinquency_rate
FROM (
  SELECT
    servicer_id,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
    DATE_FORMAT(window_end,   'yyyy-MM-dd HH:mm:ss') AS window_end,
    COUNT(*) AS total_payments,
    COUNT(*) FILTER (WHERE status = 'DELINQUENT') AS delinquent_payments
  FROM TABLE(
    TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-PAYMENT-EVENTS\`,
      DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
  )
  GROUP BY servicer_id, window_start, window_end
);`,
      },
      {
        label: 'Servicers in the Red (>10% delinquency)',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-SERVICER-HEALTH\`
WHERE delinquency_rate > 10.0
ORDER BY delinquency_rate DESC
LIMIT 20;`,
      },
    ],
    exampleInput: [
      '{ payment_id: "PMT-001", servicer_id: "SVC-A", status: "CURRENT",    amount: 1200 }',
      '{ payment_id: "PMT-002", servicer_id: "SVC-A", status: "DELINQUENT", amount: 980 }',
      '{ payment_id: "PMT-003", servicer_id: "SVC-A", status: "CURRENT",    amount: 1450 }',
    ],
    expectedOutput: [
      '{ servicer_id: "SVC-A", window_start: "2026-03-08 10:00:00", window_end: "2026-03-08 10:00:30", total_payments: 3, delinquent_payments: 1, delinquency_rate: 33.33 }',
      '→ SVC-A flags as red: delinquency_rate 33.33% exceeds 10% threshold.',
    ],
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'initiated', label: 'PAYMENTS-INITIATED', type: 'source' },
        { id: 'confirmed', label: 'PAYMENTS-CONFIRMED', type: 'source' },
        { id: 'detect', label: 'TIMEOUT-DETECTOR', type: 'processor' },
        { id: 'alerts', label: 'EARLY-WARNING-ALERTS', type: 'sink' },
      ],
      edges: [
        { from: 'initiated', to: 'detect', animated: true },
        { from: 'confirmed', to: 'detect', animated: true },
        { from: 'detect', to: 'alerts', animated: true },
      ],
    },
    concepts: [
      { term: 'Watermark', explanation: 'Flink\'s "I promise all earlier events have arrived" signal. When you set a watermark with 5s tolerance, Flink waits 5 seconds past the latest event time before declaring a window complete. This is how it knows the 60-second window has expired: the watermark crossed the deadline timestamp.' },
      { term: 'Detecting Absence with Joins', explanation: 'A LEFT JOIN between INITIATED and CONFIRMED, filtered for NULLs on the right side, finds initiations with no matching confirmation. The trick: do this join inside a time-bounded interval so Flink knows when to emit the NULL (absence) result rather than waiting forever.' },
      { term: 'Event Time vs. Processing Time', explanation: 'Processing time alerts fire based on wall-clock (when Flink processes the message). Event time alerts fire based on the timestamp inside the message. For detecting SLA breaches on real transactions, always use event time — a 30-minute consumer lag shouldn\'t suppress alerts that happened 30 minutes ago.' },
      { term: 'Interval Join', explanation: 'Joins two streams where timestamps must be within a range of each other. Here: confirmation must arrive within 60s of initiation. If no match exists within that window, the LEFT JOIN produces a NULL row — which becomes the alert.' },
    ],
    useCases: [
      'Payment confirmation SLA monitoring',
      'Detecting stuck workflow state machines',
      'Heartbeat / liveness monitoring for upstream systems',
      'Order fulfillment timeout alerts',
    ],
    whatHappensIf: [
      { question: 'What if confirmations arrive very late (after 60s) due to backlog?', answer: 'With proper watermarks, the alert has already fired. You have two choices: retract the alert (use a changelog-mode query that emits a retraction when the late confirmation arrives), or treat late confirmations as a separate event class and handle them downstream.' },
      { question: 'What if the watermark tolerance is set too low?', answer: 'False positives: legitimate confirmations that arrive in 62s get flagged even though the system is healthy. Tune tolerance based on your p99 confirmation latency under normal load, not your average.' },
    ],
  },

  'view-golden-record': {
    subtitle: 'Collapse many partial records about the same entity into one authoritative row.',
    businessContext: 'You are a data engineer at a bank with three source systems: a core banking platform, a CRM, and an online portal. Each writes partial borrower data to Kafka — the CRM has the email, the core has the credit score, the portal has the address. Downstream BI tools need one complete borrower row, not three partial ones. Flink\'s LAST_VALUE with GROUP BY creates a "golden record": a continuously-updated view that always shows the most recent value for each field, from whichever source system last updated it. The result is a single topic that BI connects to with a simple SELECT *.',
    sqlBlocks: [
      {
        label: 'Golden Record Job (LAST_VALUE merge)',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-GOLDEN-RECORD\`
SELECT
  loan_id,
  LAST_VALUE(status)          AS latest_status,
  LAST_VALUE(appraisal_value) AS latest_appraisal,
  LAST_VALUE(credit_score)    AS latest_credit_score,
  MAX(updated_at)             AS last_update
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-UPDATES\`
GROUP BY loan_id;`,
      },
      {
        label: 'Find Distressed Loans',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-LOAN-GOLDEN-RECORD\`
WHERE latest_status = 'DELINQUENT'
  AND latest_credit_score < 650
LIMIT 50;`,
      },
    ],
    exampleInput: [
      '{ loan_id: "L-001", status: "SUBMITTED",  credit_score: null,  appraisal_value: null,   updated_at: 1710000000000 }',
      '{ loan_id: "L-001", status: null,          credit_score: 720,   appraisal_value: null,   updated_at: 1710000001000 }',
      '{ loan_id: "L-001", status: "APPROVED",   credit_score: null,  appraisal_value: 380000, updated_at: 1710000002000 }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", latest_status: "APPROVED", latest_credit_score: 720, latest_appraisal: 380000, last_update: 1710000002000 }',
      '— Three partial updates merged into ONE authoritative row. LAST_VALUE wins per field.',
    ],
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'crm', label: 'CRM-EVENTS', type: 'source' },
        { id: 'core', label: 'CORE-BANKING', type: 'source' },
        { id: 'portal', label: 'PORTAL-UPDATES', type: 'source' },
        { id: 'merge', label: 'LAST_VALUE + GROUP BY', type: 'processor' },
        { id: 'golden', label: 'BORROWER-GOLDEN', type: 'sink' },
      ],
      edges: [
        { from: 'crm', to: 'merge', animated: true },
        { from: 'core', to: 'merge', animated: true },
        { from: 'portal', to: 'merge', animated: true },
        { from: 'merge', to: 'golden', animated: true },
      ],
    },
    concepts: [
      { term: 'LAST_VALUE()', explanation: 'An aggregate function that returns the most recently arrived non-NULL value in a group. Unlike MAX/MIN which compare values, LAST_VALUE compares arrival order. If CRM updates email at t=100 and portal updates email at t=200, LAST_VALUE returns the portal\'s value regardless of alphabetical order.' },
      { term: 'Upsert Key (PRIMARY KEY)', explanation: 'The Flink table is declared with borrower_id as PRIMARY KEY — this tells Flink: "one row per borrower." Downstream, when a new email arrives for borrower B-001, Flink emits an UPDATE retraction (removing the old row) followed by an INSERT (adding the new row). The topic stays compact with one record per borrower.' },
      { term: 'Entity Resolution', explanation: 'The hard part: linking the same borrower across systems. CRM calls them "customer_id", core uses "account_number", portal uses "user_id". The golden record pattern assumes you\'ve already solved this (usually with a mapping table joined upstream). Without clean keys, LAST_VALUE collapses different people\'s data.' },
      { term: 'IGNORE NULLS', explanation: 'LAST_VALUE(email IGNORE NULLS) means: skip NULL values in the sequence. If core banking emits a borrower row without an email field, it won\'t overwrite the CRM\'s email with NULL. Each field gets its latest non-NULL value independently.' },
    ],
    useCases: [
      'Master data management (MDM) for streaming pipelines',
      'Unified customer 360 view for real-time dashboards',
      'Merging CDC events from multiple database tables into one view',
      'Resolving conflicts from multi-region writes',
    ],
    whatHappensIf: [
      { question: 'What if two systems update the same field simultaneously?', answer: 'Flink processes one message at a time per partition. The "winner" is whichever message Flink processes last — which is whichever arrived later in Kafka. For business-rule-based conflict resolution ("CRM always wins for email"), use a CASE statement: LAST_VALUE(CASE WHEN source = \'crm\' THEN email END IGNORE NULLS).' },
      { question: 'What if a source system sends an erroneous NULL to wipe a field?', answer: 'With IGNORE NULLS, the NULL is skipped. Without it, the NULL wins and the field appears blank. Choose based on business semantics: can a NULL mean "delete this field" or is it always a data quality issue to ignore?' },
    ],
  },

  // ─── LOAN ADVANCED PATTERNS ───────────────────────────────────────────────

  'loan-cumulate-window': {
    subtitle: 'Emit partial results at every step interval, each growing from the window start.',
    businessContext: 'You are a product manager at a lending platform. The business wants hourly loan-volume reports — but also wants a 10-minute preview. With a standard tumble window, you get the final number at the end of each hour, nothing before. Cumulate windows solve this: they emit a result every 10 minutes, but each result counts from the start of the hour. So at 10:40 you see "we\'ve issued $1.2M in the last 40 minutes" — an accurate cumulative total, not just the last 10 minutes\' slice.',
    sqlBlocks: [
      {
        label: 'Cumulate Window Job',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-DAILY-COMMITMENT-STATS\`
SELECT
  product_type,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  COUNT(*) AS commitment_count,
  SUM(principal) AS total_principal,
  CAST(AVG(principal) AS DOUBLE) AS avg_principal
FROM TABLE(
  CUMULATE(TABLE \`EOT-PLATFORM-EXAMPLES-LOAN-COMMITMENTS\`,
    DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '1' MINUTE)
)
GROUP BY window_start, window_end, product_type;`,
      },
      {
        label: 'View High-Volume Windows',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-DAILY-COMMITMENT-STATS\`
WHERE total_principal > 500000
LIMIT 50;`,
      },
    ],
    exampleInput: [
      '{ product_type: "FIXED_30", principal: 320000, created_at: 1710000000000 }',
      '{ product_type: "FIXED_30", principal: 180000, created_at: 1710000005000 }',
      '{ product_type: "ARM_5", principal: 450000, created_at: 1710000008000 }',
    ],
    expectedOutput: [
      '{ product_type: "FIXED_30", window_start: "2026-03-08 10:00:00", window_end: "2026-03-08 10:00:10", commitment_count: 2, total_principal: 500000, avg_principal: 250000.0 }',
      '{ product_type: "FIXED_30", window_start: "2026-03-08 10:00:00", window_end: "2026-03-08 10:00:20", commitment_count: 2, total_principal: 500000, avg_principal: 250000.0 }',
      '{ product_type: "ARM_5",    window_start: "2026-03-08 10:00:00", window_end: "2026-03-08 10:00:10", commitment_count: 1, total_principal: 450000, avg_principal: 450000.0 }',
    ],
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'loans', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'cumulate', label: 'CUMULATE(step=10m,max=1h)', type: 'processor' },
        { id: 'output', label: 'LOAN-VOLUME-CUMULATIVE', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'cumulate', animated: true },
        { from: 'cumulate', to: 'output', animated: true },
      ],
    },
    concepts: [
      { term: 'CUMULATE() Window', explanation: 'Three parameters: step (how often to emit), max (when the window resets), and the time column. Emits one result per step, each covering [window_start, current_step_end]. At the max boundary, the window resets. Think of it as a progress bar that updates every 10 minutes and resets to zero every hour.' },
      { term: 'Cumulative vs. Incremental Results', explanation: 'A tumble window at step N shows you "what happened in the last 10 minutes." A cumulate window at step N shows you "what happened in the last N×10 minutes since the hour started." The difference is whether each result is a fresh slice or a growing total. Use cumulate when stakeholders want progress-toward-target, not just rate.' },
      { term: 'Retraction', explanation: 'Each cumulate step emits an UPDATE: it retracts the previous step\'s result and inserts the new one. At 10:10, it emits count=50. At 10:20, it retracts count=50 and emits count=130. If your downstream sink doesn\'t handle retractions, you\'ll see duplicate rows — use an upsert-mode sink.' },
      { term: 'Step vs. Hop', explanation: 'Hop windows slide continuously (e.g., every 10m shows the last 30m). Cumulate windows accumulate within a fixed max window. Hop is for "rolling averages"; cumulate is for "progress toward a period total."' },
    ],
    useCases: [
      'Hourly loan volume progress reports with 10-minute updates',
      'Daily revenue targets with intraday progress',
      'Real-time funnel conversion rates with hourly resets',
      'SLA compliance monitoring: X events in each hour, reported every 5 minutes',
    ],
    whatHappensIf: [
      { question: 'What if I only want the final result at the max boundary?', answer: 'Use a standard TUMBLE window instead. Cumulate is specifically for use cases where you want intermediate results before the window closes.' },
      { question: 'What if events arrive late (after the step boundary)?', answer: 'Late events after the step boundary are dropped from that step\'s result — they\'ll be included in the next step\'s cumulation. Use WATERMARK with an appropriate late-event tolerance to balance timeliness vs. completeness.' },
    ],
  },

  'loan-late-payments': {
    subtitle: 'Process events that arrive after their expected time window without losing data.',
    businessContext: 'You are an infrastructure engineer at a bank. Mobile apps buffer payment confirmations when offline and deliver them in bulk when connectivity restores — sometimes 2 hours late. Without late-event handling, Flink\'s windows close and those payments are silently dropped, causing the bank\'s reconciliation to show $200k in "missing" transactions every day. This example shows how to configure watermark tolerance and late-data side outputs to capture every event regardless of when it arrives.',
    sqlBlocks: [
      {
        label: 'Override Schema (add event_time watermark)',
        sql: `DROP TABLE IF EXISTS \`EOT-PLATFORM-EXAMPLES-LATE-PAYMENT-REPORTS\`;

CREATE TABLE \`EOT-PLATFORM-EXAMPLES-LATE-PAYMENT-REPORTS\` (
  payment_id    STRING,
  servicer_id   STRING,
  loan_id       STRING,
  amount        DOUBLE,
  status        STRING,
  event_ts      BIGINT,
  event_time AS TO_TIMESTAMP_LTZ(event_ts, 3),
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH ('connector' = 'confluent');`,
      },
      {
        label: 'Windowed Aggregation (on-time only)',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-ONTIME-PAYMENT-STATS\`
SELECT
  servicer_id,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end,   'yyyy-MM-dd HH:mm:ss') AS window_end,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_amount
FROM TABLE(
  TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-LATE-PAYMENT-REPORTS\`,
    DESCRIPTOR(event_time), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end, servicer_id;`,
      },
      {
        label: 'View Results',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-ONTIME-PAYMENT-STATS\` LIMIT 50;`,
      },
    ],
    exampleInput: [
      '{ payment_id: "P-001", servicer_id: "SVC-A", amount: 1200.00, status: "CONFIRMED", event_ts: 1710000000000 }',
      '{ payment_id: "P-002", servicer_id: "SVC-A", amount: 800.00,  status: "CONFIRMED", event_ts: 1710000005000 }',
      '{ payment_id: "P-003", servicer_id: "SVC-B", amount: 2500.00, status: "CONFIRMED", event_ts: 1709999940000 }',
    ],
    expectedOutput: [
      '{ servicer_id: "SVC-A", window_start: "2026-03-08 10:00:00", window_end: "2026-03-08 10:00:30", payment_count: 2, total_amount: 2000.00 }',
      '— P-003 (event_ts 60s late) dropped from its target window by watermark.',
    ],
    dataFlow: {
      layout: 'fan-out',
      nodes: [
        { id: 'payments', label: 'PAYMENTS', type: 'source' },
        { id: 'window', label: 'TUMBLE(1h) + Late Tolerance', type: 'processor' },
        { id: 'ontime', label: 'PAYMENTS-ONTIME', type: 'sink' },
        { id: 'late', label: 'PAYMENTS-LATE', type: 'sink' },
      ],
      edges: [
        { from: 'payments', to: 'window', animated: true },
        { from: 'window', to: 'ontime', animated: true },
        { from: 'window', to: 'late', animated: true },
      ],
    },
    concepts: [
      { term: 'Watermark', explanation: 'A timestamp that says "I promise all events before this time have arrived." When the watermark passes a window\'s end time, Flink fires the window. The watermark\'s lateness tolerance is how far behind the maximum event time the watermark lags — a 5-minute tolerance means Flink waits 5 extra minutes before closing each window.' },
      { term: 'Allowed Lateness', explanation: 'Even after a window fires, Flink can hold state open for additional late events. ALLOWED LATENESS = INTERVAL \'2\' HOUR means: for 2 hours after the window closes, any late-arriving events trigger a window re-computation and emit a corrected result. After 2 hours, events for that window are truly late.' },
      { term: 'Side Output', explanation: 'A secondary output stream for events that miss even the allowed lateness window. Instead of dropping them silently, you route them to a separate topic (PAYMENTS-LATE) for manual review or batch reconciliation. Zero data loss — just different routing based on latency.' },
      { term: 'Event Time vs. Processing Time', explanation: 'Flink can window by when a message was produced (event time, from inside the payload) or when it arrived (processing time, wall clock). For mobile payment buffering, event time is correct: a payment made at 2pm should fall in the 2pm window, even if it arrives at 4pm.' },
    ],
    useCases: [
      'Mobile payment reconciliation with intermittent connectivity',
      'IoT sensor data with network delays',
      'Batch import of historical data into streaming pipelines',
      'Multi-hop event routing where downstream latency varies',
    ],
    whatHappensIf: [
      { question: 'What if late events arrive out of order relative to each other?', answer: 'Flink processes them in arrival order. If two late events for the same window arrive 1 minute apart, the window result is emitted (or updated) twice. Downstream consumers using upsert semantics see only the final corrected total.' },
      { question: 'What if the watermark tolerance is set too high?', answer: 'Higher tolerance = longer wait before windows close = higher end-to-end latency. A 2-hour watermark tolerance means no result is emitted until at least 2 hours after the window\'s event-time boundary. Tune based on your p99 mobile client reconnect time.' },
    ],
  },

  'loan-event-fanout': {
    subtitle: 'Route a single input event to multiple output topics simultaneously.',
    businessContext: 'You are an architect at a lending platform. When a loan is approved, 6 different systems need to know: risk (for portfolio exposure), CRM (to trigger onboarding), finance (for ledger entry), compliance (for audit trail), notifications (to send the approval email), and analytics. Today, a batch job runs nightly and fan-outs to each. Flink\'s event fanout pattern routes the approval event to all 6 topics within milliseconds — so the onboarding email arrives before the customer closes their browser tab.',
    dataFlow: {
      layout: 'fan-out',
      nodes: [
        { id: 'approved', label: 'LOANS-APPROVED', type: 'source' },
        { id: 'risk', label: 'RISK-EXPOSURE', type: 'sink' },
        { id: 'crm', label: 'CRM-ONBOARDING', type: 'sink' },
        { id: 'finance', label: 'FINANCE-LEDGER', type: 'sink' },
        { id: 'audit', label: 'AUDIT-TRAIL', type: 'sink' },
      ],
      edges: [
        { from: 'approved', to: 'risk', animated: true },
        { from: 'approved', to: 'crm', animated: true },
        { from: 'approved', to: 'finance', animated: true },
        { from: 'approved', to: 'audit', animated: true },
      ],
    },
    concepts: [
      { term: 'Fan-out Pattern', explanation: 'One source topic, N sink topics, each populated by its own INSERT INTO … SELECT statement. Each INSERT runs as an independent Flink job with its own checkpointing and fault tolerance. Unlike a broadcast, each sink can apply different transformations, filters, or field mappings.' },
      { term: 'Exactly-Once Delivery to Each Sink', explanation: 'Flink coordinates checkpoints across all sinks atomically. If the risk topic write succeeds but the CRM write fails, Flink restores from the last checkpoint and replays both — preventing the "some consumers got it, some didn\'t" split-brain scenario that haunts batch fan-outs.' },
      { term: 'Independent Sink Schemas', explanation: 'Risk might want the full loan JSON. CRM wants only borrower_id + loan_amount + product_type. Finance wants only amount + ledger_code + timestamp. Each INSERT SELECT picks the fields it needs — no need for a canonical "everything" format that satisfies nobody perfectly.' },
      { term: 'Decoupling Producers from Consumers', explanation: 'The loan approval system writes to one topic. It has no knowledge of the 6 downstream consumers. Adding a 7th consumer (say, a new fraud monitoring system) requires only adding a new INSERT INTO SELECT — zero changes to the approval system itself.' },
    ],
    useCases: [
      'Loan approval fan-out to risk, CRM, finance, and compliance',
      'Order placement notification to inventory, shipping, billing, and analytics',
      'CDC event distribution to multiple data warehouse regions',
      'Event-driven microservice choreography without direct API calls',
    ],
    whatHappensIf: [
      { question: 'What if one of the sink topics is down?', answer: 'That particular INSERT job fails and retries with backoff. The other sinks continue processing independently — fan-out gives you blast-radius isolation. When the sink recovers, Flink replays from checkpoint without duplicating data to the healthy sinks.' },
      { question: 'What if I need to fan out conditionally (only approved loans to CRM, not pending)?', answer: 'Add a WHERE clause to each INSERT: INSERT INTO CRM-ONBOARDING SELECT … FROM LOANS WHERE status = \'APPROVED\'. Each sink gets its own filter — this is content-based routing combined with fan-out.' },
    ],
  },

  'loan-coborrower-unnest': {
    subtitle: 'Explode an array field into individual rows — one row per co-borrower.',
    businessContext: 'You are a data engineer at a mortgage company. Each loan application arrives as a single event, but the co_borrowers field is an array: ["Alice", "Bob", "Carlos"]. Risk analytics needs one row per person, not one row per loan. In a batch ETL world, you\'d write a Python script to explode arrays. In Flink SQL, UNNEST() does this inline, continuously, on a streaming topic — producing a real-time feed of individual borrower records the moment each application arrives.',
    sqlBlocks: [
      {
        label: 'UNNEST Job',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-BORROWER-DETAILS\`
SELECT
  l.loan_id,
  t.name  AS borrower_name,
  t.score AS credit_score,
  t.idx   AS borrower_index
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-COBORROWERS\` l
CROSS JOIN UNNEST(l.coborrower_names, l.coborrower_scores)
  WITH ORDINALITY AS t(name, score, idx);`,
      },
      {
        label: 'View Flattened Output',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-BORROWER-DETAILS\` LIMIT 50;`,
      },
    ],
    exampleInput: [
      '{ loan_id: "L-001", coborrower_names: ["Alice Chen", "Bob Smith"], coborrower_scores: [720, 695] }',
      '{ loan_id: "L-002", coborrower_names: ["Carol White", "David Kim", "Eve Park"], coborrower_scores: [760, 740, 785] }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", borrower_name: "Alice Chen", credit_score: 720, borrower_index: 1 }',
      '{ loan_id: "L-001", borrower_name: "Bob Smith",  credit_score: 695, borrower_index: 2 }',
      '{ loan_id: "L-002", borrower_name: "Carol White", credit_score: 760, borrower_index: 1 }',
      '{ loan_id: "L-002", borrower_name: "David Kim",  credit_score: 740, borrower_index: 2 }',
      '{ loan_id: "L-002", borrower_name: "Eve Park",   credit_score: 785, borrower_index: 3 }',
    ],
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'unnest', label: 'UNNEST(co_borrowers)', type: 'processor' },
        { id: 'borrowers', label: 'INDIVIDUAL-BORROWERS', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'unnest', animated: true },
        { from: 'unnest', to: 'borrowers', animated: true },
      ],
    },
    concepts: [
      { term: 'UNNEST()', explanation: 'A table-valued function that takes an array column and produces one row per element. If a loan has 3 co-borrowers, UNNEST produces 3 output rows, each with the same loan_id and the individual borrower name. It\'s the SQL equivalent of Python\'s itertools.chain — flatten nested structures into flat rows.' },
      { term: 'CROSS JOIN UNNEST', explanation: 'The full SQL syntax is: SELECT loan_id, borrower FROM loans CROSS JOIN UNNEST(co_borrowers) AS t(borrower). The CROSS JOIN here isn\'t a Cartesian product — it\'s saying "join each loan row with its own unnested array." The result cardinality equals the sum of all array lengths.' },
      { term: 'WITH ORDINALITY', explanation: 'Add WITH ORDINALITY to get a position index alongside each element: CROSS JOIN UNNEST(co_borrowers) WITH ORDINALITY AS t(borrower, pos). Now you know the primary borrower (pos=1) vs. co-borrowers (pos>1), which matters for risk weighting.' },
      { term: 'Handling NULL Arrays', explanation: 'If co_borrowers is NULL for a solo applicant, UNNEST produces zero rows — the loan record disappears. Use COALESCE(co_borrowers, ARRAY[\'\':::STRING]) to ensure at least one row per loan, then filter empty strings downstream.' },
    ],
    useCases: [
      'Per-borrower risk exposure from joint applications',
      'Credit bureau lookups for each individual on a loan',
      'Exploding line-item arrays from order/invoice events',
      'Graph edge generation from relationship arrays',
    ],
    whatHappensIf: [
      { question: 'What if the array has 100+ elements?', answer: 'UNNEST produces 100+ rows per input event. This can multiply event volume significantly. Monitor the output topic\'s message rate. For very large arrays (e.g., all products in a shopping cart), consider whether UNNEST is the right pattern or if you should aggregate differently.' },
      { question: 'What if I need to UNNEST two arrays from the same row?', answer: 'CROSS JOIN UNNEST each one independently. If the arrays are the same length and index-aligned (co_borrower_names[i] corresponds to co_borrower_ids[i]), use WITH ORDINALITY on both and filter where pos1 = pos2.' },
    ],
  },

  'loan-multi-region-merge': {
    subtitle: 'Merge loan event streams from multiple geographic regions into one unified view.',
    businessContext: 'You are a platform architect at a global bank with operations in the US, EU, and APAC. Each region runs its own Kafka cluster for data sovereignty. Risk management needs a consolidated view of global loan exposure — but fetching data from three regions into a single batch job is slow and creates cross-region latency spikes. Flink reads from all three regional topics simultaneously and merges them into one output topic in real-time, giving risk a live global dashboard with sub-second staleness.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'us', label: 'US-LOANS', type: 'source' },
        { id: 'eu', label: 'EU-LOANS', type: 'source' },
        { id: 'apac', label: 'APAC-LOANS', type: 'source' },
        { id: 'merge', label: 'UNION ALL', type: 'processor' },
        { id: 'global', label: 'GLOBAL-LOANS', type: 'sink' },
      ],
      edges: [
        { from: 'us', to: 'merge', animated: true },
        { from: 'eu', to: 'merge', animated: true },
        { from: 'apac', to: 'merge', animated: true },
        { from: 'merge', to: 'global', animated: true },
      ],
    },
    concepts: [
      { term: 'UNION ALL', explanation: 'Combines the rows from multiple SELECT statements into a single output stream. Unlike JOIN (which matches rows across streams), UNION ALL simply concatenates: every row from US-LOANS, every row from EU-LOANS, every row from APAC-LOANS flows into GLOBAL-LOANS. No joining, no matching — just merging.' },
      { term: 'Schema Alignment', explanation: 'All unioned tables must have the same column types. If US-LOANS stores amount in USD (DECIMAL) but EU-LOANS stores it in EUR (STRING), you need a transformation in each SELECT: CAST(amount AS DECIMAL) * exchange_rate AS amount_usd. The merge happens after each branch normalizes its schema.' },
      { term: 'Region Tag', explanation: 'Add a literal column to identify the source: SELECT \'US\' AS region, loan_id, amount FROM US_LOANS UNION ALL SELECT \'EU\' AS region, … This lets downstream consumers filter or partition by region without maintaining separate topics.' },
      { term: 'Watermark Alignment', explanation: 'When merging streams with different event-time lags (APAC events arrive 30ms behind US due to network), Flink\'s watermark takes the minimum across all input streams. If APAC is 30 seconds behind, windows won\'t fire until APAC catches up. Use Flink\'s idleSource timeout to prevent stale regions from blocking the watermark.' },
    ],
    useCases: [
      'Global loan exposure consolidation for real-time risk dashboards',
      'Multi-datacenter event stream unification',
      'Regional Kafka cluster federation into a global stream',
      'Compliance: aggregating events across jurisdictions for regulatory reporting',
    ],
    whatHappensIf: [
      { question: 'What if one regional Kafka cluster goes down?', answer: 'Flink marks that source as idle after a configurable timeout and advances the watermark based on the remaining active sources. Processing continues for the healthy regions. When the region recovers, Flink replays from the last committed offset and merges the backlog.' },
      { question: 'What if the same loan_id appears in multiple regions (cross-border loan)?', answer: 'UNION ALL will produce duplicate rows — one per region. Add a dedup step downstream (ROW_NUMBER() OVER PARTITION BY loan_id ORDER BY event_time) to keep only the first occurrence, or use a upsert key on loan_id if the business rule is "last write wins."' },
    ],
  },

  'loan-table-explode': {
    subtitle: 'Expand a nested structure into multiple rows using a table-valued function.',
    businessContext: 'You are a backend engineer at a credit bureau. Each credit report arrives as one event with an embedded array of tradelines — up to 30 open credit accounts per person. The risk model needs a separate row for each tradeline for feature extraction. A batch explode script runs nightly and produces tomorrow\'s training data. Flink\'s LATERAL TABLE(explode()) pattern runs the same logic in real-time, producing tradeline rows within milliseconds of each credit report arriving — so the risk model gets fresher features without waiting for the overnight run.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'reports', label: 'CREDIT-REPORTS', type: 'source' },
        { id: 'explode', label: 'LATERAL TABLE explode()', type: 'processor' },
        { id: 'tradelines', label: 'TRADELINE-ROWS', type: 'sink' },
      ],
      edges: [
        { from: 'reports', to: 'explode', animated: true },
        { from: 'explode', to: 'tradelines', animated: true },
      ],
    },
    concepts: [
      { term: 'LATERAL TABLE', explanation: 'A Flink construct that applies a table-valued function to each row and joins the result back. Think of it as a row-level subquery that can return multiple rows. For each credit report row, LATERAL TABLE(explode(tradelines)) runs explode() and appends its output rows to the report\'s columns.' },
      { term: 'Table-Valued Function (TVF)', explanation: 'A function that returns a table (multiple rows) rather than a scalar value. Flink SQL supports built-in TVFs (UNNEST, STRING_SPLIT) and custom Java/Python TVFs. For complex explosion logic (nested JSON arrays, custom delimiters), a custom TVF is more expressive than UNNEST.' },
      { term: 'Cardinality Amplification', explanation: 'If each report has 30 tradelines on average and 10,000 reports arrive per second, the output stream is 300,000 rows per second. Monitor the output topic\'s throughput and partition count to ensure downstream consumers can keep up.' },
      { term: 'Element Metadata', explanation: 'LATERAL TABLE preserves the parent row\'s fields alongside each element. So tradeline_rows contains both report_id (from the parent) and each tradeline\'s fields — enabling you to link back to the original report for any downstream join.' },
    ],
    useCases: [
      'Credit report tradeline explosion for ML feature extraction',
      'Order line-item expansion for inventory and fulfillment',
      'Log parsing: one log line → multiple structured event rows',
      'Time-series expansion: one summary row → one row per time bucket',
    ],
    whatHappensIf: [
      { question: 'What if some reports have zero tradelines (new customers)?', answer: 'The LATERAL TABLE produces zero rows for that report — it disappears from the output. Use a LEFT JOIN LATERAL to keep the report even when the array is empty, with NULL values for tradeline fields.' },
      { question: 'What if I need to reconstruct the original array later?', answer: 'Flink\'s COLLECT_LIST() aggregate function does the reverse: groups rows back into an array. Round-trip: explode → process individual rows → re-aggregate into arrays if needed downstream.' },
    ],
  },

  'loan-time-range-stats': {
    subtitle: 'Aggregate events across a custom time range using BETWEEN on event timestamps.',
    businessContext: 'You are a data analyst at a bank. The risk committee wants a real-time table showing the last 24 hours of loan origination by hour, but they also need the ability to define custom ranges (e.g., "the last 6 hours" or "business hours only, 9am-5pm"). Standard tumble windows produce fixed boundaries; Flink\'s time-range filtering with BETWEEN on event_time lets you define any arbitrary window in SQL — calculated relative to the current watermark — and aggregate within it on-demand.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'filter', label: 'WHERE event_time BETWEEN', type: 'processor' },
        { id: 'stats', label: 'TIME-RANGE-STATS', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'filter', animated: true },
        { from: 'filter', to: 'stats', animated: true },
      ],
    },
    concepts: [
      { term: 'BETWEEN with CURRENT_WATERMARK', explanation: 'WHERE event_time BETWEEN CURRENT_WATERMARK() - INTERVAL \'24\' HOUR AND CURRENT_WATERMARK() filters events within a rolling 24-hour window relative to where Flink\'s watermark currently is. The window slides as the watermark advances — unlike tumble which resets at fixed boundaries.' },
      { term: 'Rolling Window vs. Tumble Window', explanation: 'A tumble window resets at midnight: you see "today\'s" loans. A rolling window always shows "the last 24 hours": at 3pm you see 3pm yesterday to 3pm today. Rolling windows are more intuitive for humans but harder to implement correctly without Flink\'s watermark semantics.' },
      { term: 'Processing Time vs. Event Time Ranges', explanation: 'CURRENT_TIMESTAMP - INTERVAL \'24\' HOUR uses processing time (wall clock). CURRENT_WATERMARK() - INTERVAL \'24\' HOUR uses event time. For audit accuracy, always use event time — a consumer lag of 2 hours shouldn\'t shift the analysis window.' },
      { term: 'Custom Time Zone Handling', explanation: 'Business hours (9am–5pm) vary by time zone. Use CONVERT_TZ(event_time, \'UTC\', \'America/New_York\') to shift timestamps before the BETWEEN comparison. Flink handles DST transitions automatically when using proper TZ identifiers.' },
    ],
    useCases: [
      'Real-time risk dashboards showing the last N hours of originations',
      'SLA monitoring: events in the last 15 minutes',
      'Business-hours-only analytics (filter by time-of-day)',
      'Rolling retention windows for privacy compliance (GDPR 30-day deletion audits)',
    ],
    whatHappensIf: [
      { question: 'What if the watermark is stuck (no events for an hour)?', answer: 'The CURRENT_WATERMARK() stops advancing, and the window appears to freeze. This is correct behavior: without new events, Flink can\'t know what "now" is in event time. Add a dead-man\'s heartbeat: a separate producer that emits a keepalive event every 30s to advance the watermark.' },
      { question: 'What if I need exact calendar boundaries (Monday 00:00 UTC)?', answer: 'Calculate the window boundaries explicitly: WHERE event_time >= TIMESTAMP \'2026-03-04 00:00:00\' AND event_time < TIMESTAMP \'2026-03-11 00:00:00\'. For dynamic calendar-based windows, use a CASE expression to compute the week boundary from event_time.' },
    ],
  },

  'loan-borrower-payments': {
    subtitle: 'Join a live payment stream with a slowly-changing borrower dimension table.',
    businessContext: 'You are a product engineer at a lending platform. Payment events arrive continuously on a Kafka topic. Each payment has a borrower_id but no borrower name or contact details — those live in the borrower dimension table in PostgreSQL. Reporting needs both: "Alice Smith paid $500 on Loan L-001." Today, you join in a nightly batch job and the report is always 24 hours stale. Flink\'s streaming temporal join reads the current borrower record at the time of each payment, enriching the stream in real-time without touching PostgreSQL on every event.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'payments', label: 'PAYMENTS', type: 'source' },
        { id: 'borrowers', label: 'BORROWER-DIM (changelog)', type: 'source' },
        { id: 'join', label: 'FOR SYSTEM_TIME AS OF', type: 'processor' },
        { id: 'enriched', label: 'PAYMENTS-ENRICHED', type: 'sink' },
      ],
      edges: [
        { from: 'payments', to: 'join', animated: true },
        { from: 'borrowers', to: 'join', animated: false },
        { from: 'join', to: 'enriched', animated: true },
      ],
    },
    concepts: [
      { term: 'Temporal Join', explanation: 'A join that looks up the dimension table as of the event\'s timestamp: FOR SYSTEM_TIME AS OF p.payment_time. If a borrower\'s address changed on March 1 and the payment happened Feb 15, the join returns the Feb 14 address — the version that was current at payment time. Critical for audit-accurate enrichment.' },
      { term: 'Versioned Table', explanation: 'The borrower dimension is declared with a PRIMARY KEY and a changelog-mode source (CDC from PostgreSQL). Flink maintains a versioned view of each row, indexed by valid-time intervals. The temporal join uses this index to find the right version for each payment\'s timestamp.' },
      { term: 'Broadcast State vs. Temporal Join', explanation: 'Broadcast state sends the entire dimension to every Flink task. Temporal join uses an indexed lookup per key. For large dimensions (millions of borrowers), temporal join is far more memory-efficient — it only keeps the current version of each row that has appeared in the payment stream.' },
      { term: 'CDC (Change Data Capture)', explanation: 'Kafka topic fed by Debezium or Confluent\'s CDC connector. Every INSERT/UPDATE/DELETE on the PostgreSQL borrowers table produces a Kafka message with the new row value. Flink reads this as a changelog stream, maintaining the current view of each borrower in state.' },
    ],
    useCases: [
      'Payment enrichment with borrower name and contact details',
      'Order enrichment with current product catalog prices',
      'Real-time ETL: event stream + slowly-changing dimension',
      'Audit log: "who held this account when this event occurred?"',
    ],
    crossReference: { cardId: 'loan-temporal-join', label: 'Temporal Join', description: 'See the dedicated Temporal Join example for a deeper dive into the FOR SYSTEM_TIME AS OF syntax.' },
    whatHappensIf: [
      { question: 'What if a payment arrives for a borrower who doesn\'t exist yet in the dimension?', answer: 'The temporal join returns NULL for the dimension fields — the payment is enriched with NULLs rather than dropped. Use a LEFT JOIN syntax to preserve the payment event, then handle NULLs downstream (COALESCE, retry logic, or route to a repair queue).' },
      { question: 'What if the CDC stream falls behind (PostgreSQL lag)?', answer: 'The temporal join will use the last-known version of the borrower record, which may be stale. This is the correct behavior for historical accuracy. For real-time enrichment where staleness is unacceptable, use a regular lookup join with a short cache TTL instead.' },
    ],
  },

  // ─── COMPLETENESS — REMAINING ─────────────────────────────────────────────

  'loan-data-masking': {
    subtitle: 'Obscure sensitive field values before they leave your trusted perimeter.',
    businessContext: 'You are a security architect at a bank. Your analytics team needs loan data for model training, but regulations prohibit using raw SSNs and full account numbers in non-production environments. Today, a manual masking script runs before each data export — creating a bottleneck and a window where unmasked data sits in the export bucket. Flink applies masking inline: data is masked before it reaches the analytics topic, so the unmasked version never exists outside your secure Kafka cluster.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'raw', label: 'LOANS-RAW', type: 'source' },
        { id: 'mask', label: 'MASK / HASH / TRUNCATE', type: 'processor' },
        { id: 'masked', label: 'LOANS-ANALYTICS', type: 'sink' },
      ],
      edges: [
        { from: 'raw', to: 'mask', animated: true },
        { from: 'mask', to: 'masked', animated: true },
      ],
    },
    concepts: [
      { term: 'Static Masking vs. Dynamic Masking', explanation: 'Static masking (this pattern) writes masked data to a separate topic. Dynamic masking filters at query time. Static is safer: no risk of accidentally querying the unmasked version. Dynamic is more flexible but requires every query to pass through the masking layer.' },
      { term: 'Masking Techniques in SQL', explanation: 'SHA-256 hashing (non-reversible, preserves joins via consistent hash of same value), truncation (show last 4 of SSN), replacement (replace with a fake value), format-preserving encryption (FPE — looks like a real SSN but isn\'t). Flink supports all via UDFs or built-in functions.' },
      { term: 'Referential Integrity After Masking', explanation: 'If you hash the SSN in the loans topic AND the borrowers topic with the same salt, downstream joins on hashed_ssn still work — both tables have the same hash for the same person. Always use a consistent, static salt stored in a secure vault.' },
      { term: 'Data Lineage', explanation: 'Track exactly which fields were masked, when, and by which Flink job version. Include a masking_version field in each output row. When masking rules change (new regulation), you can identify which records were masked under the old rules and reprocess them.' },
    ],
    useCases: [
      'PII removal for analytics and ML training datasets',
      'GDPR/CCPA compliant data sharing with third parties',
      'Lower-environment data (dev/staging) without real customer data',
      'Audit log sanitization before archival',
    ],
    whatHappensIf: [
      { question: 'What if we need to reverse the masking for a legitimate audit?', answer: 'If you used a deterministic UDF with a secret key (format-preserving encryption), authorized parties can decrypt with the key. If you used SHA-256 without a salt, it\'s one-way — by design. Choose the technique based on whether reversibility is a requirement.' },
      { question: 'What if a new sensitive field is added to the schema?', answer: 'The new field passes through unmasked until the Flink job is updated. Schema governance (see the schema-evolution example) helps: register a schema that marks the new field as sensitive, and trigger a job update alert automatically.' },
    ],
  },

  'hello-ksqldb': {
    subtitle: 'ksqlDB push queries stream data to you — the server calls you, not the other way around.',
    businessContext: 'REST APIs require constant polling. ksqlDB\'s EMIT CHANGES turns that model upside down: the server pushes every matching row the moment it arrives. For fraud alerts, monitoring dashboards, or live feeds, this eliminates polling overhead entirely and reduces latency to sub-second.',
    concepts: [
      { term: 'Push Query (EMIT CHANGES)', explanation: 'The query runs indefinitely on the server. Each new row that matches is pushed to the client immediately. Unlike a pull query (SELECT COUNT(*)), which returns once and closes, a push query is a long-lived connection.' },
      { term: 'Pull Query', explanation: 'A point-in-time query: SELECT COUNT(*) FROM jokes_stream WHERE ...; Returns immediately with a static result. No streaming, no subscription — just a snapshot.' },
      { term: 'Persistent Query', explanation: 'CREATE STREAM ... AS SELECT ... EMIT CHANGES; This runs as a background ksqlDB job, continuously writing to an output stream. Survives client disconnect — the computation continues even with no consumers.' },
      { term: 'Stream vs. Table in ksqlDB', explanation: 'STREAM: every event is a fact (append-only). TABLE: each key has a current value (upsert). Push queries on streams deliver every new message; push queries on tables deliver every state change.' },
      { term: 'ksqlDB vs Apache Flink — When to Choose', explanation: 'ksqlDB: simple streaming SQL with no cluster to manage, built-in Kafka integration, lower operational overhead. Best for filter/transform/aggregate pipelines directly on Kafka. Flink: full streaming engine with advanced windowing (SESSION, CUMULATE), temporal joins, MATCH_RECOGNIZE, and JAR-based UDFs. Best for complex stateful logic, multi-stream joins, and enterprise-scale pipelines.' },
      { term: 'Operational Difference', explanation: 'ksqlDB runs inside Confluent Cloud as a managed service — zero JARs, zero cluster config. Flink on Confluent Cloud also managed, but exposes more SQL surface area (OVER windows, interval joins, CDC). ksqlDB queries restart automatically; Flink jobs have explicit checkpointing and savepoints.' },
      { term: 'SQL Compatibility', explanation: 'Both support SELECT, WHERE, GROUP BY, JOIN, and aggregates. ksqlDB adds EMIT CHANGES and EXPLODE. Flink adds FOR SYSTEM_TIME AS OF, MATCH_RECOGNIZE, HOP/SESSION/CUMULATE windows, and LATERAL TABLE UDFs. Shared Confluent environment — same topics, same Schema Registry.' },
    ],
    useCases: ['Live fraud alerts', 'Real-time monitoring', 'Notification pipelines', 'Dashboard feeds without polling', 'Lightweight streaming SQL without Flink cluster overhead'],
    whatHappensIf: [
      { question: 'What if I close the push query client?', answer: 'The push query stops on the server. If it\'s a persistent query (CREATE STREAM AS), it keeps running in the background even without a consumer.' },
      { question: 'What\'s the difference from a Flink SELECT?', answer: 'Flink SQL runs as a distributed job in a cluster. ksqlDB push queries run inside ksqlDB\'s server process. Both stream continuously, but ksqlDB has lower operational overhead for simple streaming SQL. Flink wins on complex stateful operations, advanced windows, and UDFs.' },
      { question: 'Can I use ksqlDB and Flink on the same Kafka topics?', answer: 'Yes — both engines read and write Kafka topics. You can have a ksqlDB persistent query filtering one topic while a Flink job aggregates the result. They share the same Schema Registry and topic namespace on Confluent Cloud.' },
    ],
    crossReference: {
      cardId: 'hello-flink',
      label: 'Compare: Hello Flink',
      description: 'Same jokes topic, but with Flink SQL — see the architectural difference side by side.',
    },
  },

  'ksql-dynamic-routing': {
    subtitle: 'Route loan events to department topics using a lookup table — one join, zero hardcoded routes.',
    businessContext: 'Static fan-out requires a code deploy to add a new routing rule. Dynamic routing stores rules in a ksqlDB table: new route = one INSERT, zero restarts. EXPLODE() turns multi-target routing rules into individual output rows automatically.',
    sqlBlocks: [
      {
        label: 'Materialize Routing Rules Table',
        sql: `CREATE TABLE \`ROUTING-RULES-table\` AS
SELECT
  \`key_data\`->event_type AS \`event_type\`,
  LATEST_BY_OFFSET(\`target_topics\`) AS \`target_topics\`
FROM \`ROUTING-RULES\`
GROUP BY \`key_data\`->event_type
EMIT CHANGES;`,
      },
      {
        label: 'Routing Engine: EXPLODE + Stream-Table Join',
        sql: `CREATE STREAM \`ROUTED-EVENTS\`
WITH (KAFKA_TOPIC = 'ROUTED-EVENTS', VALUE_FORMAT = 'AVRO')
AS SELECT
  e.\`event_id\` AS \`event_id\`,
  EXPLODE(r.\`target_topics\`) AS \`target_topic\`,
  e.\`loan_id\` AS \`loan_id\`,
  e.\`event_type\` AS \`event_type\`,
  e.\`amount\` AS \`amount\`,
  e.\`department\` AS \`department\`
FROM \`LOAN-EVENTS\` e
  INNER JOIN \`ROUTING-RULES-table\` r
  ON e.\`event_type\` = r.\`event_type\`
EMIT CHANGES;`,
      },
    ],
    concepts: [
      { term: 'Stream-Table Join in ksqlDB', explanation: 'ksqlDB stream-table joins are temporal by default: when an event arrives on the stream, it looks up the CURRENT value in the table. This is equivalent to Flink\'s FOR SYSTEM_TIME AS OF — automatic point-in-time enrichment.' },
      { term: 'EXPLODE()', explanation: 'ksqlDB\'s EXPLODE() is equivalent to Flink\'s CROSS JOIN UNNEST(). It takes an array column and returns one row per element. A routing rule with target_topics=[\'underwriting\',\'finance\'] becomes 2 rows.' },
      { term: 'Routing Table (Compacted Topic)', explanation: 'A ksqlDB TABLE backed by a compacted Kafka topic. Each event_type maps to a list of target topics. Compaction ensures only the latest routing rule per key is kept — a natural rule store.' },
      { term: 'Dynamic vs. Static Routing', explanation: 'Static: three separate INSERT jobs with WHERE clauses — explicit, observable, zero dependencies. Dynamic: one join + EXPLODE — flexible, centrally managed, but requires a rule store.' },
    ],
    useCases: ['Department event routing', 'Multi-tenant topic fan-out', 'Feature flag routing', 'A/B testing pipelines'],
    whatHappensIf: [
      { question: 'What if a routing rule is deleted?', answer: 'The compacted topic retains a tombstone (null value). New events for that event_type return no join match and are dropped — effectively removing the route without restarting the job.' },
      { question: 'What if the same event should route to 5 topics?', answer: 'Add 5 entries in the target_topics array. EXPLODE generates 5 output rows. Downstream consumers each subscribe to one topic with a WHERE target_topic = \'...\' filter.' },
    ],
  },

  'ksql-dynamic-routing-json': {
    subtitle: 'Same dynamic routing as the Avro variant — JSON format, simpler DDL, no Schema Registry required.',
    businessContext: 'The Avro version requires KEY_FORMAT=\'AVRO\', STRUCT KEY declarations, and Schema Registry enrollment. JSON removes all of that. Trade-off: no schema enforcement, but faster to prototype and simpler to debug. Run both side-by-side to understand the Avro vs JSON decision.',
    sqlBlocks: [
      {
        label: 'Materialize Routing Rules Table',
        sql: `CREATE TABLE \`ROUTING-RULES-table\` AS
SELECT
  \`event_type\`,
  LATEST_BY_OFFSET(\`target_topics\`) AS \`target_topics\`
FROM \`ROUTING-RULES\`
GROUP BY \`event_type\`
EMIT CHANGES;`,
      },
      {
        label: 'Routing Engine: EXPLODE + Stream-Table Join',
        sql: `CREATE STREAM \`ROUTED-EVENTS\`
WITH (KAFKA_TOPIC = 'ROUTED-EVENTS', VALUE_FORMAT = 'JSON')
AS SELECT
  e.\`event_id\` AS \`event_id\`,
  EXPLODE(r.\`target_topics\`) AS \`target_topic\`,
  e.\`loan_id\` AS \`loan_id\`,
  e.\`event_type\` AS \`event_type\`,
  e.\`amount\` AS \`amount\`,
  e.\`department\` AS \`department\`
FROM \`LOAN-EVENTS\` e
  INNER JOIN \`ROUTING-RULES-table\` r
  ON e.\`event_type\` = r.\`event_type\`
EMIT CHANGES;`,
      },
    ],
    concepts: [
      { term: 'VALUE_FORMAT=\'JSON\'', explanation: 'ksqlDB serializes/deserializes events as plain JSON. No Schema Registry needed. Column types are inferred from the CREATE STREAM DDL, not from a registered schema.' },
      { term: 'KEY_FORMAT=\'KAFKA\'', explanation: 'With JSON value format, keys are typically stored as plain Kafka byte strings. No Avro wrapping means simpler key declarations (STRING KEY instead of STRUCT<field> KEY).' },
      { term: 'Avro vs JSON Trade-off', explanation: 'Avro: schema enforcement, smaller payload, compatibility checks. JSON: human-readable, no registry dependency, easier debugging. Avro wins in production; JSON wins in prototyping.' },
      { term: 'Schema Evolution Risk with JSON', explanation: 'Without Schema Registry, a producer can silently add or remove fields. Downstream JSON_VALUE() calls return NULL for missing fields — no deserialization error, just silent data gaps. Monitor NULL rates.' },
    ],
    useCases: ['Prototyping routing pipelines', 'Environments without Schema Registry', 'Third-party JSON feed routing', 'Debug-friendly event pipelines'],
    whatHappensIf: [
      { question: 'What if I switch from JSON to Avro later?', answer: 'DROP and recreate all affected streams and tables. Existing Kafka topic data stays as-is (JSON bytes) — handle the mixed-format transition window carefully.' },
      { question: 'What if a field name changes in the JSON payload?', answer: 'JSON_VALUE() on the old path returns NULL silently. Avro would fail with a deserialization error — more noisy but easier to catch. With JSON, add NULL count monitoring as an early warning.' },
    ],
  },

  'loan-property-lookup': {
    subtitle: 'Enrich every loan with appraisal data as it existed when the loan was processed — not today\'s value.',
    businessContext: 'Property appraisal values change as the market moves. When reviewing a historical loan application, regulators need to see the LTV ratio at origination — not the current appraisal. Temporal joins deliver exactly this: point-in-time accuracy with no extra infrastructure, no snapshot tables, no custom lookup service.',
    sqlBlocks: [
      {
        label: 'Temporal Join (Property Lookup)',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-APPRAISED\`
SELECT
  l.loan_id,
  l.property_id,
  l.amount,
  p.appraisal_value,
  p.flood_zone,
  CAST(l.amount / p.appraisal_value * 100 AS DOUBLE) AS ltv_ratio
FROM \`EOT-PLATFORM-EXAMPLES-LOANS-WITH-PROPERTY\` l
JOIN \`EOT-PLATFORM-EXAMPLES-PROPERTY-REFERENCE\`
  FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS p
  ON l.property_id = p.property_id;`,
      },
      {
        label: 'High-LTV Loans (>80% require insurance)',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-LOANS-APPRAISED\`
WHERE ltv_ratio > 80
LIMIT 50;`,
      },
    ],
    exampleInput: [
      '{ loan_id: "L-001", property_id: "PROP-42", amount: 320000 }',
      '{ loan_id: "L-002", property_id: "PROP-17", amount: 490000 }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", property_id: "PROP-42", amount: 320000, appraisal_value: 380000, flood_zone: "X", ltv_ratio: 84.21 }',
      '{ loan_id: "L-002", property_id: "PROP-17", amount: 490000, appraisal_value: 520000, flood_zone: "AE", ltv_ratio: 94.23 }',
    ],
    concepts: [
      { term: 'FOR SYSTEM_TIME AS OF l.$rowtime', explanation: 'Flink looks up the property reference table as it existed at the loan event\'s timestamp. If appraisal_value was updated after the loan was processed, the join still returns the older value — time travel built directly into SQL.' },
      { term: 'LTV Ratio (Loan-to-Value)', explanation: 'loan_amount / appraisal_value × 100. A key underwriting metric. LTV > 80% typically requires private mortgage insurance. Using current appraisal instead of origination appraisal makes historical LTV calculations wrong.' },
      { term: 'Versioned Reference Table', explanation: 'The PROPERTY-REFERENCE topic uses changelog.mode=\'upsert\'. Each property update creates a new version in Flink\'s state. Temporal lookups use the version that was current at the event\'s timestamp.' },
      { term: 'Temporal Join vs. Regular Join', explanation: 'Regular join: always uses the LATEST property data (staleness risk for historical analysis). Temporal join: uses property data as of the loan\'s event time. Regular is simpler; temporal is audit-grade.' },
    ],
    useCases: ['Mortgage origination audit', 'LTV calculation at origination', 'Regulatory compliance reporting', 'Historical underwriting review'],
    whatHappensIf: [
      { question: 'What if the property has no record at the loan\'s timestamp?', answer: 'The temporal join returns no match for that loan — the row is dropped from output. Ensure property reference data is loaded before loan events start arriving.' },
      { question: 'What if property data is updated retroactively (correction)?', answer: 'The correction creates a new version. Events after the correction timestamp return the corrected value. Events before the correction still return the pre-correction value — temporal integrity is preserved.' },
    ],
  },

  'loan-routing-json': {
    subtitle: 'Fan out one loan event stream to three department topics in a single Flink job using EXECUTE STATEMENT SET.',
    businessContext: 'Running three separate INSERT jobs means three statements, three offset sets, and three monitoring views. EXECUTE STATEMENT SET bundles them: one commit, one job to monitor, one failure domain. The source topic is read once and the events are fanned out internally — reducing network traffic and consumer group overhead by 66%.',
    sqlBlocks: [
      {
        label: 'Routing Rules Table',
        sql: `SELECT event_type, target_topics, updated_at
FROM \`EOT-PLATFORM-EXAMPLES-ROUTING-RULES\`;`,
      },
      {
        label: 'Routing Engine: Temporal Join + CROSS JOIN UNNEST',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
SELECT
  CAST(e.event_id AS BYTES) AS \`key\`,
  t.target_topic,
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-EVENTS\` e
JOIN \`EOT-PLATFORM-EXAMPLES-ROUTING-RULES\`
  FOR SYSTEM_TIME AS OF e.\`$rowtime\` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic);`,
      },
      {
        label: 'Fan-Out: EXECUTE STATEMENT SET',
        sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`EOT-PLATFORM-EXAMPLES-UNDERWRITING\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
    WHERE target_topic = 'EOT-PLATFORM-EXAMPLES-UNDERWRITING';

  INSERT INTO \`EOT-PLATFORM-EXAMPLES-FINANCE\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
    WHERE target_topic = 'EOT-PLATFORM-EXAMPLES-FINANCE';

  INSERT INTO \`EOT-PLATFORM-EXAMPLES-COLLECTIONS\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
    WHERE target_topic = 'EOT-PLATFORM-EXAMPLES-COLLECTIONS';
END;`,
      },
      {
        label: 'Verify Fan-Out',
        sql: `SELECT target_topic, event_type, COUNT(*) AS event_count
FROM \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
GROUP BY target_topic, event_type;`,
      },
    ],
    exampleInput: [
      '{ event_id: "E-001", loan_id: "L-100", event_type: "NEW_LOAN", amount: 150000, department: "underwriting" }',
      '{ event_id: "E-002", loan_id: "L-101", event_type: "PAYMENT_DUE", amount: 1200, department: "collections" }',
    ],
    expectedOutput: [
      'UNDERWRITING topic: { event_id: "E-001", loan_id: "L-100", event_type: "NEW_LOAN", amount: 150000 }',
      'COLLECTIONS topic:  { event_id: "E-002", loan_id: "L-101", event_type: "PAYMENT_DUE", amount: 1200 }',
      '→ One Flink job reads source topic once, fans to 3 sinks internally',
    ],
    concepts: [
      { term: 'EXECUTE STATEMENT SET', explanation: 'A Flink SQL construct that bundles multiple INSERT INTO statements into a single job. All inserts run in the same task manager, sharing the source read. One Kafka consumer reads the topic once, feeding all three sinks.' },
      { term: 'Shared Source Optimization', explanation: 'With EXECUTE STATEMENT SET, Flink reads the source topic once and fans out internally via operator chaining. Three separate jobs read the topic three times — 3x network I/O, 3x consumer group lag to track.' },
      { term: 'Static Fan-Out Pattern', explanation: 'Each INSERT uses a hardcoded WHERE clause: WHERE target_topic = \'underwriting\'. Routes are explicit and observable. Add a new route = add a new INSERT block and redeploy the STATEMENT SET.' },
      { term: 'JSON Fan-Out', explanation: 'JSON format means no Schema Registry dependency. Simpler DDL, easier to inspect messages in the Confluent Console. Production systems typically graduate to Avro for schema enforcement.' },
    ],
    useCases: ['Department-specific topic routing', 'Compliance copy routing', 'Multi-team event distribution', 'Microservice event fan-out'],
    whatHappensIf: [
      { question: 'What if one of the three output topics goes down?', answer: 'Flink will retry and eventually fail the entire STATEMENT SET job — all three sinks are in the same job. For independent failure domains, split into separate INSERT statements.' },
      { question: 'What if I want to add a 4th route?', answer: 'Add a 4th INSERT INTO statement inside the BEGIN...END block and redeploy. Flink restarts the job with the new routing logic. Existing offsets are preserved from the last checkpoint.' },
    ],
  },

  'loan-routing-avro': {
    subtitle: 'Same three-way fan-out as the JSON variant, with Avro serialization and Schema Registry enforcement.',
    businessContext: 'In production, schema drift is a silent killer. A producer adds a field, JSON parsers return NULL without warning, and downstream analytics silently compute wrong metrics for hours before anyone notices. Avro + Schema Registry catches this at the serialization boundary: incompatible schema = immediate, loud failure — not silent data corruption.',
    sqlBlocks: [
      {
        label: 'Routing Rules Table',
        sql: `SELECT event_type, target_topics, updated_at
FROM \`EOT-PLATFORM-EXAMPLES-ROUTING-RULES\`;`,
      },
      {
        label: 'Routing Engine: Temporal Join + CROSS JOIN UNNEST',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-ROUTED-EVENTS\`
SELECT
  CAST(e.event_id AS BYTES) AS \`key\`,
  t.target_topic,
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-EVENTS\` e
JOIN \`EOT-PLATFORM-EXAMPLES-ROUTING-RULES\`
  FOR SYSTEM_TIME AS OF e.\`$rowtime\` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic);`,
      },
    ],
    concepts: [
      { term: 'Avro Schema Registry Enforcement', explanation: 'Every Avro message includes a schema ID. Confluent\'s Schema Registry stores schemas and enforces compatibility rules. Flink uses the schema ID to deserialize efficiently. An incompatible producer change fails at produce time — not silently downstream.' },
      { term: 'Schema Compatibility Rules', explanation: 'BACKWARD: new consumers read old messages (add optional fields with defaults). FORWARD: old consumers read new messages. FULL: both directions. Renaming or removing fields is a breaking change and is rejected by the Registry.' },
      { term: 'Avro Wire Format', explanation: 'Avro binary is ~30-50% smaller than equivalent JSON for structured data. For high-throughput pipelines (millions/day), this meaningfully reduces Kafka storage costs and network overhead.' },
      { term: 'Avro vs JSON Fan-Out', explanation: 'Both support EXECUTE STATEMENT SET equally. Avro adds schema governance; JSON adds debugging simplicity. Run both examples to see the DDL differences — the routing logic is identical.' },
    ],
    useCases: ['Production loan processing pipelines', 'Regulated industries requiring schema governance', 'High-throughput event routing', 'Multi-team data contracts with compatibility enforcement'],
    whatHappensIf: [
      { question: 'What if the Avro schema changes incompatibly?', answer: 'The producer will fail to publish with a schema compatibility error from the Registry. No bad messages enter Kafka — the failure is early and loud, not silent downstream NULL corruption.' },
      { question: 'What if I need to compare Avro vs JSON performance?', answer: 'Run both examples with the same message count. Compare topic sizes in the Confluent Console — Avro topics will be noticeably smaller. Compare DDL complexity — Avro requires more declarations but delivers stronger guarantees.' },
    ],
  },

  'loan-schemaless-topic': {
    subtitle: "No Schema Registry? No problem — value.format='raw' gives you bytes, JSON_VALUE gives you fields.",
    businessContext: 'Legacy systems, third-party vendors, and IoT devices often produce raw JSON with no Confluent Schema Registry. Rather than blocking on schema onboarding, Flink\'s value.format=\'raw\' reads raw bytes and JSON_VALUE() extracts individual fields inline — parsing happens at the SQL layer with no external tooling needed.',
    sqlBlocks: [
      {
        label: 'Parse Raw Bytes → Typed Columns',
        sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-RAW-EVENTS-PARSED\` (
  \`key\`, event_id, event_type, user_id, amount, currency, event_ts
)
SELECT
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id') AS BYTES)    AS \`key\`,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id')                   AS event_id,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type')                 AS event_type,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.user_id')                    AS user_id,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.amount') AS DOUBLE)     AS amount,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.currency')                   AS currency,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.timestamp') AS BIGINT)  AS event_ts
FROM \`EOT-PLATFORM-EXAMPLES-RAW-EVENTS\`
WHERE JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') IS NOT NULL;`,
      },
      {
        label: 'View Parsed Output',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-RAW-EVENTS-PARSED\` LIMIT 50;`,
      },
    ],
    exampleInput: [
      'RAW BYTES: 7B 22 65 76 65 6E 74 5F 69 64 22 3A 22 45 2D 30 30 31 22 2C ...',
      'Decoded: {"event_id":"E-001","event_type":"LOAN_CREATED","user_id":"U-42","amount":15000,"currency":"USD","timestamp":1710000000000}',
    ],
    expectedOutput: [
      '{ event_id: "E-001", event_type: "LOAN_CREATED", user_id: "U-42", amount: 15000.0, currency: "USD", event_ts: 1710000000000 }',
      '— No Schema Registry, no Avro schema — bytes parsed to typed columns at SQL layer.',
    ],
    concepts: [
      { term: "value.format='raw'", explanation: 'Flink reads the Kafka message value as a raw VARBINARY. No schema inference, no deserialization layer. You receive the raw bytes and must parse them yourself in SQL.' },
      { term: 'CAST(val AS STRING)', explanation: 'Converts VARBINARY bytes to a VARCHAR string. For UTF-8 JSON payloads this gives you the full JSON string: \'{"event_id":"E-001","amount":1500}\' — ready for JSON_VALUE() extraction.' },
      { term: "JSON_VALUE(json, '$.path')", explanation: 'Extracts a single field from a JSON string using JSONPath syntax. Returns VARCHAR — use CAST for numerics: CAST(JSON_VALUE(..., \'$.amount\') AS DOUBLE). Nested paths: \'$.application.loan.amount\'.' },
      { term: 'Schema Registry Trade-off', explanation: 'Raw + JSON_VALUE: flexible, no registration needed, but every query must repeat the parsing logic and there are no schema compatibility checks. Schema Registry: one-time registration, automatic deserialization, evolution support.' },
    ],
    useCases: ['Third-party JSON feed ingestion', 'Legacy system integration', 'Prototype pipelines before schema registration', 'IoT device event parsing'],
    whatHappensIf: [
      { question: 'What if the JSON structure changes?', answer: 'JSON_VALUE() on a missing path returns NULL silently. Add WHERE JSON_VALUE(...) IS NOT NULL guards, or route rows with NULL fields to a dead-letter topic to detect schema drift.' },
      { question: 'What if the payload is not valid JSON?', answer: 'JSON_VALUE() returns NULL for malformed JSON. The row passes through with NULL values — no failure. Add a validation step or route malformed payloads to a dead-letter queue.' },
    ],
  },

  'loan-schema-override': {
    subtitle: "Override Confluent's auto-discovered table to add event-time watermarks for windowed queries.",
    businessContext: "Confluent Cloud auto-discovers schemas and creates managed tables automatically. But auto-discovered tables have no watermark column — they can't be used with TUMBLE(), HOP(), or SESSION() windows. This example shows the DROP + CREATE workflow to inject a computed event_time column and WATERMARK FOR clause, enabling windowed aggregations on any existing topic.",
    concepts: [
      { term: 'Auto-Discovered vs. Override Table', explanation: "Confluent creates a managed table from your Schema Registry schema automatically. It's convenient but lacks event-time support. DROP TABLE removes the managed definition; CREATE TABLE with the same topic name installs your custom DDL over the same Kafka data." },
      { term: "WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND", explanation: 'Declares the watermark strategy: events up to 10 seconds late are still included in their window. Events arriving more than 10 seconds after their event_time are considered late and may be dropped from window results.' },
      { term: 'AS TO_TIMESTAMP_LTZ(created_at, 3)', explanation: 'Converts a BIGINT millisecond epoch to TIMESTAMP_LTZ (timestamp with local timezone). Precision 3 = milliseconds. This computed column becomes the event-time basis for all window functions.' },
      { term: 'DROP TABLE Caution', explanation: 'DROP TABLE removes the Flink table definition only — it does NOT delete the underlying Kafka topic or its messages. All data is preserved. The topic continues to exist and receive messages.' },
    ],
    useCases: ['Adding event-time support to legacy topics', 'Custom watermark strategies', 'Windowed aggregations on auto-discovered topics', 'Schema correction without data loss'],
    whatHappensIf: [
      { question: 'What happens to running Flink jobs after DROP TABLE?', answer: 'Existing jobs continue running until cancelled — they hold their own compiled execution plan. DROP TABLE only removes the catalog definition, not the running job.' },
      { question: 'What if the WATERMARK interval is too tight?', answer: 'Late events (arriving after the watermark advances) are dropped from window calculations. Monitor the late-events metric in your Flink job. Loosen the interval if legitimate events are arriving late.' },
    ],
  },

  'view-mbs-pricing': {
    subtitle: 'Point-in-time market rate enrichment for MBS portfolios — pricing accuracy at origination, not today.',
    businessContext: 'Mortgage-backed securities pricing depends on the market rate active at the time of loan commitment, not today\'s rate. A temporal join virtual view enriches each commitment with the exact base_rate and spread that were active at commitment time. Regulators and auditors can verify pricing decisions for any historical commitment without manually reconstructing rate history.',
    sqlBlocks: [
      {
        label: 'Create MBS Pricing View',
        sql: `CREATE VIEW \`EOT-PLATFORM-EXAMPLES-MBS-PRICING-VIEW\` AS
SELECT
  c.commitment_id,
  c.loan_id,
  c.product_type,
  c.principal,
  r.base_rate,
  r.spread,
  c.principal * (r.base_rate + r.spread) / 100 AS estimated_yield
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-COMMITMENTS\` c
JOIN \`EOT-PLATFORM-EXAMPLES-MARKET-RATES\`
  FOR SYSTEM_TIME AS OF c.\`$rowtime\` AS r
  ON c.product_type = r.product_type;`,
      },
      {
        label: 'High-Value Commitments',
        sql: `SELECT * FROM \`EOT-PLATFORM-EXAMPLES-MBS-PRICING-VIEW\`
WHERE estimated_yield > 50000
ORDER BY estimated_yield DESC
LIMIT 20;`,
      },
    ],
    exampleInput: [
      '{ commitment_id: "C-001", loan_id: "L-100", product_type: "FIXED_30", principal: 400000 }  ← at t=100',
      'MARKET-RATES at t=100: { product_type: "FIXED_30", base_rate: 6.5, spread: 0.25 }',
      'MARKET-RATES at t=200: { product_type: "FIXED_30", base_rate: 7.0, spread: 0.30 }  ← rate updated after commitment',
    ],
    expectedOutput: [
      '{ commitment_id: "C-001", loan_id: "L-100", product_type: "FIXED_30", principal: 400000, base_rate: 6.5, spread: 0.25, estimated_yield: 27000.0 }',
      '— Uses rate at t=100 (6.5%), NOT today\'s rate (7.0%). Temporal join = audit-grade accuracy.',
    ],
    concepts: [
      { term: 'CREATE VIEW (Virtual View)', explanation: 'A named query evaluated on-demand. No data is materialized — the view runs fresh each time it\'s queried. Rate history changes are instantly reflected for new queries without a pipeline restart.' },
      { term: 'MARKET-RATES as Versioned Table', explanation: 'The MARKET-RATES topic uses changelog.mode=\'upsert\'. Each rate update creates a new version. Flink stores these versions in state, enabling point-in-time lookups: what rate was active at a given moment.' },
      { term: 'Estimated Yield Calculation', explanation: 'principal × (base_rate + spread) / 100 = annual yield on one commitment. Aggregated across all commitments in a pool, this is the MBS pool yield — a key input to pricing, rating, and regulatory capital calculations.' },
      { term: 'Audit-Grade Accuracy', explanation: 'A regular join would use today\'s market rate for every commitment — wrong for historical analysis. The temporal join returns the rate that was in the table AT commitment time — exactly what the loan officer saw when pricing the commitment.' },
    ],
    useCases: ['MBS pool yield calculation', 'Loan commitment audit trails', 'Rate-lock compliance verification', 'Regulatory capital and risk reporting'],
    whatHappensIf: [
      { question: 'What if market rates are corrected retroactively?', answer: 'The corrected rate applies to new queries for commitments after the correction timestamp. Commitments before the correction still return the pre-correction rate — temporal integrity is preserved by design.' },
      { question: 'What if a commitment has no matching market rate at its timestamp?', answer: 'The temporal join returns no row for that commitment — it\'s excluded from output. Ensure market rate history covers the full range of commitment timestamps before querying the view.' },
    ],
  },

};

