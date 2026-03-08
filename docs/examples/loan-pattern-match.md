# Pattern Match: Burst Application Detection with CEP

3 loan apps from the same customer in rapid succession? MATCH_RECOGNIZE spots burst patterns. This example uses Flink's Complex Event Processing (CEP) via MATCH_RECOGNIZE to detect when a customer submits three or more loan applications in a short time window — a potential fraud signal or sign of application farming.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Stateful, Pattern, CEP |

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

### PATTERN-ALERTS

```sql
CREATE TABLE `{name}` (
  `key`           BYTES,
  customer_id     STRING,
  first_txn       STRING,
  last_txn        STRING,
  app_count       BIGINT,
  total_amount    DOUBLE,
  avg_amount      DOUBLE,
  first_time      STRING,
  last_time       STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-PATTERN-ALERTS`
SELECT
  CAST(customer_id AS BYTES) AS `key`,
  customer_id,
  first_txn,
  last_txn,
  app_count,
  total_amount,
  CAST(avg_amount AS DOUBLE) AS avg_amount,
  first_time,
  last_time
FROM `{rid}-LOANS`
MATCH_RECOGNIZE (
  PARTITION BY customer_id
  ORDER BY $rowtime
  MEASURES
    FIRST(A.txn_id)    AS first_txn,
    LAST(A.txn_id)     AS last_txn,
    COUNT(A.txn_id)    AS app_count,
    SUM(A.amount)      AS total_amount,
    AVG(A.amount)      AS avg_amount,
    FIRST(A.$rowtime)  AS first_time,
    LAST(A.$rowtime)   AS last_time
  ONE ROW PER MATCH
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (A{3,})
  DEFINE A AS TRUE
)
```

## Example Input

Seven loan events. Customer C-001 submits four applications in rapid succession. Customer C-002 submits three. These bursts will each trigger an alert.

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:01Z"}
{"loan_id":"LN-00002","amount":30000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0002","created_at":"2025-03-15T10:00:03Z"}
{"loan_id":"LN-00003","amount":15000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0003","created_at":"2025-03-15T10:00:04Z"}
{"loan_id":"LN-00004","amount":28000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0004","created_at":"2025-03-15T10:00:05Z"}
{"loan_id":"LN-00005","amount":22000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0005","created_at":"2025-03-15T10:00:06Z"}
{"loan_id":"LN-00006","amount":19000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0006","created_at":"2025-03-15T10:00:08Z"}
{"loan_id":"LN-00007","amount":35000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0007","created_at":"2025-03-15T10:00:09Z"}
```

## Expected Output

Two alerts fire — one for each customer whose burst of applications matches the `A{3,}` pattern.

```json
{"customer_id":"C-001","first_txn":"TXN-0001","last_txn":"TXN-0006","app_count":4,"total_amount":103000.00,"avg_amount":25750.00,"first_time":"2025-03-15T10:00:01Z","last_time":"2025-03-15T10:00:08Z"}
{"customer_id":"C-002","first_txn":"TXN-0003","last_txn":"TXN-0007","app_count":3,"total_amount":72000.00,"avg_amount":24000.00,"first_time":"2025-03-15T10:00:04Z","last_time":"2025-03-15T10:00:09Z"}
```

## Steps to Run

1. Create the Kafka topics: `LOANS` and `PATTERN-ALERTS`.
2. Register the input DDL for `LOANS` in your Flink SQL environment.
3. Register the output DDL for `PATTERN-ALERTS`.
4. Produce the seven example loan records in rapid succession to simulate burst behavior.
5. Submit the `INSERT INTO` SQL statement to start the Flink job.
6. Consume from `PATTERN-ALERTS` and verify that two alert records appear — one for C-001 (4 apps) and one for C-002 (3 apps), each with correct aggregate measures.
