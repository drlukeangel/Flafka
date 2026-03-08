# Interval Join: Time-Bounded Stream Correlation

A loan and a customer event within 5 minutes of each other? That is a match. Interval joins correlate two streams by time proximity. Unlike temporal joins that look up versioned state, interval joins match events from two append-only streams when their timestamps fall within a defined window — perfect for correlating independently produced events.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Stateful, Join, Streaming |

## Input Schema

### LOANS

```sql
CREATE TABLE `{name}` (
  `key`         BYTES,
  loan_id       STRING,
  amount        DOUBLE,
  status        STRING,
  created_at    STRING,
  txn_id        STRING,
  customer_id   STRING
)
```

### CUSTOMERS-STREAM

```sql
CREATE TABLE `{name}` (
  `key`           BYTES,
  customer_id     STRING,
  name            STRING,
  credit_score    INT,
  state           STRING
)
```

## Output Schema

### INTERVAL-JOINED

```sql
CREATE TABLE `{name}` (
  `key`             BYTES,
  customer_id       STRING,
  txn_id            STRING,
  loan_id           STRING,
  amount            DOUBLE,
  status            STRING,
  customer_name     STRING,
  credit_score      INT
)
```

## SQL

```sql
INSERT INTO `{rid}-INTERVAL-JOINED`
SELECT
  CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS `key`,
  l.customer_id,
  l.txn_id,
  l.loan_id,
  l.amount,
  l.status,
  c.name AS customer_name,
  c.credit_score
FROM `{rid}-LOANS` l
JOIN `{rid}-CUSTOMERS-STREAM` c
  ON l.customer_id = c.customer_id
  AND c.$rowtime BETWEEN l.$rowtime - INTERVAL '5' MINUTE
                      AND l.$rowtime + INTERVAL '5' MINUTE
```

## Example Input

### Loans (3 records)

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:10:00Z"}
{"loan_id":"LN-00003","amount":18000.00,"status":"APPROVED","customer_id":"C-003","txn_id":"TXN-0003","created_at":"2025-03-15T10:20:00Z"}
```

### Customers-Stream (4 records)

```json
{"customer_id":"C-001","name":"Alice Smith","credit_score":720,"state":"CA"}
{"customer_id":"C-002","name":"Bob Jones","credit_score":680,"state":"TX"}
{"customer_id":"C-003","name":"Carol Davis","credit_score":790,"state":"NY"}
{"customer_id":"C-004","name":"Dan Wilson","credit_score":650,"state":"FL"}
```

Assume the customer events for C-001, C-002, and C-003 arrive within 5 minutes of their corresponding loan events. C-004 has no matching loan.

## Expected Output

Only pairs where both the customer_id matches and the timestamps fall within the 5-minute interval are joined. C-004 has no matching loan, so no output is produced for that customer.

```json
{"customer_id":"C-001","txn_id":"TXN-0001","loan_id":"LN-00001","amount":25000.00,"status":"PENDING","customer_name":"Alice Smith","credit_score":720}
{"customer_id":"C-002","txn_id":"TXN-0002","loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_name":"Bob Jones","credit_score":680}
{"customer_id":"C-003","txn_id":"TXN-0003","loan_id":"LN-00003","amount":18000.00,"status":"APPROVED","customer_name":"Carol Davis","credit_score":790}
```

## Steps to Run

1. Create the Kafka topics: `LOANS`, `CUSTOMERS-STREAM`, and `INTERVAL-JOINED`.
2. Register the input DDL for `LOANS` and `CUSTOMERS-STREAM` in your Flink SQL environment.
3. Register the output DDL for `INTERVAL-JOINED`.
4. Submit the `INSERT INTO` SQL statement to start the Flink job.
5. Produce loan records and customer records within 5 minutes of each other for the same customer_id to trigger matches.
6. Consume from `INTERVAL-JOINED` and verify that only time-correlated pairs appear in the output.
