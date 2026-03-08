# Deduplication: Keep the First, Kill the Rest

Kafka says "at least once." ROW_NUMBER keeps the first, kills the rest. This pattern uses a windowed ROW_NUMBER partitioned by a business key to guarantee exactly-once semantics downstream, even when upstream producers retry and create duplicates.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Pattern |

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

### LOANS-DEDUPED

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

## SQL

```sql
INSERT INTO `{rid}-LOANS-DEDUPED`
SELECT
  `key`, loan_id, amount, status, created_at, txn_id, customer_id
FROM (
  SELECT
    CAST(loan_id AS BYTES) AS `key`,
    loan_id,
    amount,
    status,
    created_at,
    txn_id,
    customer_id,
    ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY $rowtime ASC) AS rownum
  FROM `{rid}-LOANS`
)
WHERE rownum = 1
```

## Example Input

Five records where `LN-00001` appears three times (simulating Kafka retries) and `LN-00002` appears twice.

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:05:00Z"}
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:05:00Z"}
```

## Expected Output

Only the first occurrence of each `loan_id` passes through. Duplicates are silently dropped.

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:05:00Z"}
```

## Steps to Run

1. Create the Kafka topics: `LOANS` and `LOANS-DEDUPED`.
2. Register the input DDL for `LOANS` in your Flink SQL environment.
3. Register the output DDL for `LOANS-DEDUPED`.
4. Produce the five example loan records (including the intentional duplicates).
5. Submit the `INSERT INTO` SQL statement to start the Flink job.
6. Consume from `LOANS-DEDUPED` and verify that only two distinct records appear — one for `LN-00001` and one for `LN-00002`.
