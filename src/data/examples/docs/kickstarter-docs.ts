import type { ExampleDocumentation } from '../../../types';

export const kickstarterDocs: Record<string, ExampleDocumentation> = {
  'hello-flink': {
    subtitle: 'Your very first Flink SQL job — stream jokes into a Kafka topic and read them back in real time.',
    businessContext: 'This example validates that your Flink compute pool is running and connected to Kafka. It creates a single topic, produces 20 joke records via the stream card, and reads them with a simple SELECT query.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'jokes', label: 'JOKES Topic', type: 'source' },
        { id: 'flink', label: 'SELECT *', type: 'processor' },
        { id: 'output', label: 'Query Results', type: 'sink' },
      ],
      edges: [
        { from: 'jokes', to: 'flink', animated: true },
        { from: 'flink', to: 'output', animated: true },
      ],
    },
    concepts: [
      { term: 'Compute Pool', explanation: 'Think of it like a cloud server where Flink (your data processor) lives. You send SQL queries to it, and it streams back results. No need to manage servers — Confluent handles that for you.' },
      { term: 'Stream Card', explanation: 'A testing tool in the workspace. Click its play button to send sample data into a Kafka topic. Great for practicing Flink without needing real data sources.' },
      { term: 'Kafka Topic', explanation: 'A named bucket where streaming data lives. Topics are like channels — events flow in one end and flow out the other. Flink reads from topics and writes to topics.' },
      { term: 'SELECT *', explanation: 'SQL shorthand for "give me all columns from the data." In streaming, this query runs continuously, printing each new event as it arrives.' },
    ],
    useCases: ['Connectivity test', 'First Flink job', 'Learning'],
    exampleInput: [
      '{ joke: "Why do programmers prefer dark mode?", rating: "LOL" }',
      '{ joke: "There are 10 types of people...", rating: "GROAN" }',
      '{ joke: "I told my wife she was drawing...", rating: "MEH" }',
    ],
    expectedOutput: [
      '{ joke: "Why do programmers prefer dark mode?", rating: "LOL" }',
      '{ joke: "There are 10 types of people...", rating: "GROAN" }',
      '{ joke: "SELECT * FROM fridge WHERE beer > 0", rating: "ROFL" }',
    ],
  },

  'good-jokes': {
    subtitle: 'Filter a streaming jokes topic — keep only the best jokes (LOL, ROFL, DEAD) and drop the rest.',
    businessContext: 'A classic stream filtering pattern. The source topic contains jokes with various ratings. This job filters out low-quality jokes (GROAN, MEH) and writes only the good ones to a dedicated output topic.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'jokes', label: 'JOKES Topic', type: 'source' },
        { id: 'filter', label: 'WHERE rating IN (...)', type: 'processor' },
        { id: 'good', label: 'GOOD-JOKES Topic', type: 'sink' },
      ],
      edges: [
        { from: 'jokes', to: 'filter', animated: true },
        { from: 'filter', to: 'good', animated: true, filterLabel: "LOL, ROFL, DEAD" },
      ],
    },
    sqlBlocks: [
      {
        label: 'Filter Query',
        sql: "INSERT INTO `GOOD-JOKES`\nSELECT * FROM `JOKES`\nWHERE rating IN ('LOL', 'ROFL', 'DEAD')",
      },
    ],
    concepts: [
      { term: 'INSERT INTO ... SELECT', explanation: 'This means: "Take data from the SELECT query and continuously push it into the destination topic." It\'s a loop that never stops — whenever a new event arrives in the source topic, your WHERE filter runs immediately and decides whether to send it downstream.' },
      { term: 'WHERE clause', explanation: 'Your gatekeeper rule. Think of it as a bouncer: "only jokes with rating = LOL, ROFL, or DEAD get in." All others are dropped (not sent to the output topic).' },
      { term: 'Topics (input vs output)', explanation: 'Input topic = source (where data comes FROM). Output topic = sink (where filtered data goes TO). Your query bridges them — reading from input and writing to output.' },
    ],
    useCases: ['Content filtering', 'Quality gates', 'Stream routing'],
    exampleInput: [
      '{ joke: "Why do programmers prefer dark mode?", rating: "LOL" }',
      '{ joke: "I told my wife she was drawing...", rating: "GROAN" }',
      '{ joke: "SELECT * FROM fridge WHERE beer > 0", rating: "ROFL" }',
      '{ joke: "Another day, another bug", rating: "MEH" }',
    ],
    expectedOutput: [
      '{ joke: "Why do programmers prefer dark mode?", rating: "LOL" }',
      '{ joke: "SELECT * FROM fridge WHERE beer > 0", rating: "ROFL" }',
    ],
  },

  'loan-filter': {
    subtitle: 'Filter streaming loan applications — only approved loans flow through to the output topic.',
    businessContext: 'In loan processing pipelines, only approved applications should trigger downstream workflows like disbursement or notification. This example demonstrates real-time filtering of a streaming loans topic.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'loans', label: 'LOANS Topic', type: 'source' },
        { id: 'filter', label: "WHERE status = 'APPROVED'", type: 'processor' },
        { id: 'filtered', label: 'LOANS-FILTERED Topic', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'filter', animated: true },
        { from: 'filter', to: 'filtered', animated: true, filterLabel: "APPROVED only", dropColor: '#EF4444' },
      ],
    },
    ddlBlocks: [
      {
        label: 'Source Table (LOANS)',
        sql: "CREATE TABLE `LOANS` (\n  `key` BYTES,\n  loan_id STRING,\n  amount DOUBLE,\n  status STRING,\n  created_at TIMESTAMP(3),\n  txn_id STRING,\n  customer_id STRING\n) WITH ('kafka.key.format' = 'raw');",
      },
      {
        label: 'Sink Table (LOANS-FILTERED)',
        sql: "CREATE TABLE `LOANS-FILTERED` (\n  `key` BYTES,\n  loan_id STRING,\n  amount DOUBLE,\n  status STRING,\n  created_at TIMESTAMP(3),\n  txn_id STRING,\n  customer_id STRING\n) WITH ('kafka.key.format' = 'raw');",
      },
    ],
    sqlBlocks: [
      {
        label: 'Filter Query',
        sql: "INSERT INTO `LOANS-FILTERED`\nSELECT CAST(loan_id AS BYTES) AS `key`,\n  loan_id, amount, status, created_at, txn_id, customer_id\nFROM `LOANS`\nWHERE status = 'APPROVED'",
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with all loan applications (200 records)' },
      { name: 'LOANS-FILTERED', type: 'output', description: 'Output topic receiving only approved loans' },
    ],
    concepts: [
      { term: 'CAST(... AS BYTES) AS key', explanation: 'Kafka organizes messages into partitions using a "key" — think of it like a filing cabinet. We convert the loan_id (a string like "L-001") to binary bytes so Kafka can use it as a key. This groups related loans in the same partition.' },
      { term: 'INSERT INTO ... SELECT ... WHERE', explanation: 'The complete pattern: Read from source topic → Apply filter rule (WHERE status = APPROVED) → Write to output topic. This job runs 24/7, processing each new loan instantly as it arrives.' },
      { term: 'Real-time filtering', explanation: 'Unlike batch processing (waiting for all data, then filtering), Flink filters each event immediately as it streams in. No delays, no batching — just instant decisions.' },
    ],
    useCases: ['Loan approval routing', 'Compliance filtering', 'Event-driven workflows'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", customer_id: "C-042" }',
      '{ loan_id: "L-002", amount: 5000.00, status: "DENIED", customer_id: "C-011" }',
      '{ loan_id: "L-003", amount: 32000.00, status: "PENDING", customer_id: "C-078" }',
      '{ loan_id: "L-004", amount: 8500.00, status: "APPROVED", customer_id: "C-019" }',
    ],
    whatHappensIf: [
      { question: 'The LOANS topic gets no new records?', answer: 'The Flink job stays running but idle — no output is produced until new records arrive.' },
      { question: 'A record arrives with status = null?', answer: 'The WHERE clause filters it out. NULL != \'APPROVED\', so it is silently dropped.' },
    ],
    expectedOutput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED", customer_id: "C-042" }',
      '{ loan_id: "L-007", amount: 8500.00, status: "APPROVED", customer_id: "C-019" }',
      '{ loan_id: "L-013", amount: 22000.00, status: "APPROVED", customer_id: "C-055" }',
    ],
  },

  'loan-aggregate': {
    subtitle: 'Tumbling window aggregation — count loans and sum amounts by status every 20 seconds.',
    businessContext: 'Real-time loan portfolio monitoring. Every 20 seconds, this job emits a summary of how many loans were received per status (APPROVED, DENIED, PENDING) and their total amounts. This powers dashboards and alerting.',
    dataFlow: {
      layout: 'windowed',
      nodes: [
        { id: 'loans', label: 'LOANS Topic', type: 'source' },
        { id: 'window', label: '20s Tumbling Window', type: 'processor' },
        { id: 'stats', label: 'LOANS-STATS Topic', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'window', animated: true },
        { from: 'window', to: 'stats', animated: true },
      ],
    },
    ddlBlocks: [
      {
        label: 'Output Table (LOANS-STATS)',
        sql: "CREATE TABLE `LOANS-STATS` (\n  status STRING,\n  loan_count BIGINT,\n  total_amount DOUBLE\n);",
      },
    ],
    sqlBlocks: [
      {
        label: 'Aggregation Query',
        sql: "INSERT INTO `LOANS-STATS`\nSELECT status, COUNT(*) AS loan_count, SUM(amount) AS total_amount\nFROM TABLE(\n  TUMBLE(TABLE `LOANS`, DESCRIPTOR($rowtime), INTERVAL '20' SECOND)\n)\nGROUP BY window_start, window_end, status",
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Source topic with streaming loan applications' },
      { name: 'LOANS-STATS', type: 'output', description: 'Aggregated statistics per 20-second window' },
    ],
    concepts: [
      { term: 'TUMBLE() Window', explanation: 'Divides the stream into fixed 20-second chunks. Imagine a tape recorder: every 20 seconds, you eject the tape and start a fresh one. Each chunk (window) is processed separately. Tumbling = no overlap.' },
      { term: '$rowtime', explanation: 'A special column Flink adds automatically — it records when each message arrived (event time or ingestion time). Used to decide which window a record belongs to.' },
      { term: 'GROUP BY window_start, window_end, status', explanation: 'Creates separate buckets for each combination of window + status. For example: all APPROVED loans in window 1, all DENIED loans in window 1, etc. Then COUNT() and SUM() happen within each bucket.' },
      { term: 'COUNT(*) and SUM(amount)', explanation: 'Aggregation functions that crunch data: COUNT counts how many records exist in each bucket, SUM adds up all the amounts. Every time a 20-second window closes, these numbers are emitted as output.' },
    ],
    useCases: ['Real-time dashboards', 'Portfolio monitoring', 'SLA tracking'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000.00, status: "APPROVED" }',
      '{ loan_id: "L-002", amount: 5000.00, status: "DENIED" }',
      '{ loan_id: "L-003", amount: 12000.00, status: "APPROVED" }',
      '{ loan_id: "L-004", amount: 8000.00, status: "PENDING" }',
    ],
    whatHappensIf: [
      { question: 'No records arrive during a 20-second window?', answer: 'No output is emitted for that window — Flink only produces results when there is data to aggregate.' },
      { question: 'Records arrive out of order?', answer: 'Flink handles out-of-order data using watermarks. Records within the allowed lateness are included; very late records may be dropped.' },
    ],
    expectedOutput: [
      '{ status: "APPROVED", loan_count: 12, total_amount: 156000.00 }',
      '{ status: "DENIED", loan_count: 5, total_amount: 42000.00 }',
      '{ status: "PENDING", loan_count: 8, total_amount: 89000.00 }',
    ],
  },

  'loan-join': {
    subtitle: 'Streaming join — flag high-risk loans by joining the loans stream with a customers table.',
    businessContext: 'Fraud detection in real time. As loan applications arrive, each is joined against the customer database to check risk levels. Loans from CRITICAL-risk customers are immediately flagged as fraud alerts.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'loans', label: 'LOANS Topic', type: 'source' },
        { id: 'customers', label: 'CUSTOMERS Topic', type: 'source' },
        { id: 'join', label: 'JOIN ON customer_id', type: 'processor' },
        { id: 'alerts', label: 'FRAUD-ALERTS Topic', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'join', animated: true },
        { from: 'customers', to: 'join', animated: true },
        { from: 'join', to: 'alerts', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Join Query',
        sql: "INSERT INTO `FRAUD-ALERTS`\nSELECT l.loan_id, c.name AS customer_name, c.risk_level,\n  CASE WHEN c.risk_level = 'CRITICAL'\n    THEN 'CRITICAL_RISK_CUSTOMER'\n    ELSE 'LOW_RISK'\n  END AS alert_reason\nFROM `LOANS` l\nJOIN `CUSTOMERS` c ON l.customer_id = c.customer_id",
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Streaming loan applications' },
      { name: 'CUSTOMERS', type: 'input', description: 'Customer reference data with risk levels' },
      { name: 'FRAUD-ALERTS', type: 'output', description: 'Enriched loan records with fraud alert flags' },
    ],
    concepts: [
      { term: 'Regular Join (Stream-Stream)', explanation: 'Imagine a lookup table: when a new loan arrives, Flink says "Do I have a matching customer record?" and joins them together. Both streams flow continuously, and Flink remembers recent records from each to find matches.' },
      { term: 'ON clause', explanation: 'The join condition: ON l.customer_id = c.customer_id means "only join records that have the same customer_id." It\'s the glue that sticks loan + customer together.' },
      { term: 'Enrichment', explanation: 'The goal: take a simple loan record (just loan_id, amount) and enrich it with customer info (name, risk_level). The output has both pieces of info in one record.' },
      { term: 'State Memory', explanation: 'Flink holds recent records in memory waiting for their join partner. If a LOANS record arrives but there\'s no matching CUSTOMER yet, Flink stores it temporarily. When the CUSTOMER finally arrives, they match!' },
    ],
    useCases: ['Fraud detection', 'Real-time enrichment', 'Risk scoring'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000, customer_id: "C-042" }',
      '{ customer_id: "C-042", name: "Alice Chen", risk_level: "LOW" }',
      '{ loan_id: "L-005", amount: 50000, customer_id: "C-099" }',
      '{ customer_id: "C-099", name: "Bob Martinez", risk_level: "CRITICAL" }',
    ],
    whatHappensIf: [
      { question: 'A loan arrives for a customer not yet in the CUSTOMERS topic?', answer: 'The loan waits in Flink state until a matching customer record arrives. If state TTL expires first, the loan is dropped without producing output.' },
      { question: 'State grows too large?', answer: 'Set table.exec.state.ttl (e.g., 1 hour) to automatically expire old join state. Without TTL, state grows unbounded.' },
    ],
    expectedOutput: [
      '{ loan_id: "L-001", customer_name: "Alice Chen", risk_level: "LOW", alert_reason: "LOW_RISK" }',
      '{ loan_id: "L-005", customer_name: "Bob Martinez", risk_level: "CRITICAL", alert_reason: "CRITICAL_RISK_CUSTOMER" }',
    ],
    crossReference: {
      cardId: 'loan-temporal-join',
      label: 'Compare with Temporal Join',
      description: 'Temporal joins look up the customer record as it existed when the loan arrived — useful when customer data changes over time.',
    },
  },

  'loan-temporal-join': {
    subtitle: 'Temporal join — enrich loans with the customer credit score at the time the loan was created.',
    businessContext: 'Customer attributes change over time (credit scores, addresses, risk levels). A temporal join looks up the customer record as it existed at the moment the loan arrived — not the latest version. This is critical for accurate historical analysis and audit compliance.',
    dataFlow: {
      layout: 'fan-in',
      nodes: [
        { id: 'loans', label: 'LOANS Topic', type: 'source' },
        { id: 'customers', label: 'CUSTOMERS (Versioned)', type: 'source' },
        { id: 'join', label: 'FOR SYSTEM_TIME AS OF', type: 'processor' },
        { id: 'enriched', label: 'LOANS-ENRICHED Topic', type: 'sink' },
      ],
      edges: [
        { from: 'loans', to: 'join', animated: true },
        { from: 'customers', to: 'join', animated: true },
        { from: 'join', to: 'enriched', animated: true },
      ],
    },
    ddlBlocks: [
      {
        label: 'Versioned Table (CUSTOMERS)',
        sql: "CREATE TABLE `CUSTOMERS` (\n  customer_id STRING,\n  name STRING,\n  credit_score INT,\n  state STRING,\n  PRIMARY KEY (customer_id) NOT ENFORCED\n) WITH (\n  'changelog.mode' = 'upsert'\n);",
      },
    ],
    sqlBlocks: [
      {
        label: 'Temporal Join Query',
        sql: "INSERT INTO `LOANS-ENRICHED`\nSELECT l.loan_id, c.name AS customer_name,\n  c.credit_score, c.state\nFROM `LOANS` l\nJOIN `CUSTOMERS` FOR SYSTEM_TIME AS OF l.`$rowtime` AS c\n  ON l.customer_id = c.customer_id",
      },
    ],
    topics: [
      { name: 'LOANS', type: 'input', description: 'Streaming loan applications with $rowtime' },
      { name: 'CUSTOMERS', type: 'input', description: 'Versioned customer table (upsert changelog)' },
      { name: 'LOANS-ENRICHED', type: 'output', description: 'Loans enriched with point-in-time customer data' },
    ],
    concepts: [
      { term: 'FOR SYSTEM_TIME AS OF', explanation: 'Temporal join syntax — looks up the version of the customer record that was current at the loan\'s $rowtime timestamp.' },
      { term: 'PRIMARY KEY ... NOT ENFORCED', explanation: 'Declares the key column for the versioned table. Flink uses this to maintain a keyed state of the latest version per key.' },
      { term: 'changelog.mode = upsert', explanation: 'Tells Flink this topic contains upsert records — new records with the same key replace old ones, creating a versioned history.' },
    ],
    useCases: ['Point-in-time enrichment', 'Audit compliance', 'Historical analysis'],
    exampleInput: [
      '{ loan_id: "L-001", amount: 15000, customer_id: "C-042" }',
      '{ customer_id: "C-042", name: "Alice Chen", credit_score: 720, state: "CA" }',
      '{ customer_id: "C-042", name: "Alice Chen", credit_score: 750, state: "CA" }',
    ],
    whatHappensIf: [
      { question: 'A customer updates their credit score after a loan was created?', answer: 'The temporal join uses the credit score at loan creation time — later updates do not affect previously emitted results.' },
      { question: 'No customer record exists at the loan\'s timestamp?', answer: 'The join produces no output for that loan. The record is silently dropped since there is no matching temporal version.' },
    ],
    expectedOutput: [
      '{ loan_id: "L-001", customer_name: "Alice Chen", credit_score: 720, state: "CA" }',
      '{ loan_id: "L-007", customer_name: "Bob Martinez", credit_score: 680, state: "TX" }',
    ],
    crossReference: {
      cardId: 'loan-join',
      label: 'Compare with Regular Join',
      description: 'Regular joins match against the latest customer record — not point-in-time. Use regular joins when you always want current data.',
    },
  },

  'loan-scalar-extract': {
    subtitle: 'Java scalar UDF — extract flat fields from deeply nested JSON loan applications.',
    businessContext: 'Loan applications often arrive as deeply nested JSON (applicant.name.first, application.loan.type). Built-in Flink functions struggle with arbitrary nesting. A custom Java UDF provides clean field extraction with a simple path syntax.',
    dataFlow: {
      layout: 'linear',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'udf', label: 'LoanDetailExtract() UDF', type: 'processor' },
        { id: 'details', label: 'LOAN-DETAILS', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'udf', animated: true },
        { from: 'udf', to: 'details', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Extract Query',
        sql: "INSERT INTO `LOAN-DETAILS`\nSELECT loan_id,\n  LoanDetailExtract(json_payload, 'application.applicant.name.first') || ' ' ||\n    LoanDetailExtract(json_payload, 'application.applicant.name.last') AS applicant_name,\n  LoanDetailExtract(json_payload, 'application.loan.type') AS loan_type\nFROM `LOAN-APPLICATIONS`",
      },
    ],
    concepts: [
      { term: 'Scalar UDF', explanation: 'A user-defined function that takes one row and returns one value. Called once per row in the SELECT clause.' },
      { term: "USING JAR 'confluent-artifact://...'", explanation: 'Confluent Cloud-specific syntax for loading UDF JARs from the Artifact Registry. Not standard Flink SQL.' },
      { term: 'CREATE FUNCTION ... AS ...', explanation: 'Registers the UDF so Flink can call it by name. The class must implement ScalarFunction.' },
    ],
    useCases: ['Nested JSON extraction', 'Custom transformations', 'Data normalization'],
    exampleInput: [
      '{ loan_id: "L-001", json_payload: "{ application: { applicant: { name: { first: \\"Alice\\", last: \\"Chen\\" } }, loan: { type: \\"PERSONAL\\" } } }" }',
      '{ loan_id: "L-002", json_payload: "{ application: { applicant: { name: { first: \\"Bob\\", last: \\"Martinez\\" } }, loan: { type: \\"MORTGAGE\\" } } }" }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", applicant_name: "Alice Chen", loan_type: "PERSONAL" }',
      '{ loan_id: "L-002", applicant_name: "Bob Martinez", loan_type: "MORTGAGE" }',
    ],
  },

  'loan-tradeline-java': {
    subtitle: 'Java table UDF — explode nested tradeline arrays into individual rows using LATERAL TABLE.',
    businessContext: 'Each loan application contains an array of credit tradelines (credit cards, mortgages, auto loans). This UDF explodes the array so each tradeline becomes its own row — enabling per-tradeline analysis, aggregation, and filtering.',
    dataFlow: {
      layout: 'fan-out',
      nodes: [
        { id: 'apps', label: 'LOAN-APPLICATIONS', type: 'source' },
        { id: 'udf', label: 'LoanDetailExplode() UDF', type: 'processor' },
        { id: 'tradelines', label: 'LOAN-TRADELINES', type: 'sink' },
      ],
      edges: [
        { from: 'apps', to: 'udf', animated: true },
        { from: 'udf', to: 'tradelines', animated: true },
      ],
    },
    sqlBlocks: [
      {
        label: 'Explode Query',
        sql: "INSERT INTO `LOAN-TRADELINES`\nSELECT\n  CAST(CONCAT(loan_id, '-', CAST(t.array_index AS STRING)) AS BYTES) AS `key`,\n  loan_id, t.array_index AS tradeline_index,\n  LoanDetailExtract(t.element_json, 'account_type') AS account_type\nFROM `LOAN-APPLICATIONS`,\n  LATERAL TABLE(LoanDetailExplode(json_payload, '...')) AS t",
      },
    ],
    concepts: [
      { term: 'Table UDF (UDTF)', explanation: 'A user-defined function that takes one row and returns zero or more rows. Used with LATERAL TABLE to "explode" arrays.' },
      { term: 'LATERAL TABLE(...) AS t', explanation: 'Correlates the UDF output with the source row. The alias t exposes columns from the exploded rows (array_index, element_json).' },
      { term: 'Composite Key', explanation: 'loan_id + array_index creates a unique key per tradeline row. CONCAT + CAST ensures proper Kafka key partitioning.' },
    ],
    useCases: ['Array explosion', 'Nested data normalization', 'Per-element analysis'],
    exampleInput: [
      '{ loan_id: "L-001", json_payload: "{ tradelines: [{ account_type: \\"CREDIT_CARD\\" }, { account_type: \\"MORTGAGE\\" }, { account_type: \\"AUTO_LOAN\\" }] }" }',
    ],
    expectedOutput: [
      '{ loan_id: "L-001", tradeline_index: 0, account_type: "CREDIT_CARD" }',
      '{ loan_id: "L-001", tradeline_index: 1, account_type: "MORTGAGE" }',
      '{ loan_id: "L-001", tradeline_index: 2, account_type: "AUTO_LOAN" }',
    ],
  },
};
