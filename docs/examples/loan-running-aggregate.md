# Running Aggregate: Per-Customer Loan Scoreboard

Every loan gets its own running scoreboard — total count, total dollars, running average. This example uses an OVER window with unbounded preceding rows to compute cumulative statistics per customer as each new loan event arrives, without waiting for a window to close.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Stateful, Aggregation, OVER Window |

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

## Output Schema

### RUNNING-STATS

```sql
CREATE TABLE `{name}` (
  `key`           BYTES,
  customer_id     STRING,
  txn_id          STRING,
  amount          DOUBLE,
  status          STRING,
  running_count   BIGINT,
  running_total   DOUBLE,
  running_avg     DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-RUNNING-STATS`
SELECT
  CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS `key`,
  customer_id,
  txn_id,
  amount,
  status,
  COUNT(*) OVER w AS running_count,
  SUM(amount) OVER w AS running_total,
  CAST(AVG(amount) OVER w AS DOUBLE) AS running_avg
FROM `{rid}-LOANS`
WINDOW w AS (
  PARTITION BY customer_id
  ORDER BY $rowtime
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
```

## Example Input

Five loan events across two customers. Customer C-001 has three loans, C-002 has two.

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:05:00Z"}
{"loan_id":"LN-00003","amount":18000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0003","created_at":"2025-03-15T10:10:00Z"}
{"loan_id":"LN-00004","amount":31000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0004","created_at":"2025-03-15T10:15:00Z"}
{"loan_id":"LN-00005","amount":55000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0005","created_at":"2025-03-15T10:20:00Z"}
```

## Expected Output

Each output record carries the cumulative stats for that customer up to and including the current event.

```json
{"customer_id":"C-001","txn_id":"TXN-0001","amount":25000.00,"status":"APPROVED","running_count":1,"running_total":25000.00,"running_avg":25000.00}
{"customer_id":"C-002","txn_id":"TXN-0002","amount":42000.00,"status":"PENDING","running_count":1,"running_total":42000.00,"running_avg":42000.00}
{"customer_id":"C-001","txn_id":"TXN-0003","amount":18000.00,"status":"APPROVED","running_count":2,"running_total":43000.00,"running_avg":21500.00}
{"customer_id":"C-001","txn_id":"TXN-0004","amount":31000.00,"status":"APPROVED","running_count":3,"running_total":74000.00,"running_avg":24666.67}
{"customer_id":"C-002","txn_id":"TXN-0005","amount":55000.00,"status":"PENDING","running_count":2,"running_total":97000.00,"running_avg":48500.00}
```

## Steps to Run

1. Create the Kafka topics: `LOANS` and `RUNNING-STATS`.
2. Register the input DDL for `LOANS` in your Flink SQL environment.
3. Register the output DDL for `RUNNING-STATS`.
4. Produce the five example loan records in chronological order.
5. Submit the `INSERT INTO` SQL statement to start the Flink job.
6. Consume from `RUNNING-STATS` and verify that each record includes correct cumulative count, total, and average for its customer.
