# Change Detection: Catch Every Status Flip

LAG() compares each event to its predecessor and catches every status flip. This pattern detects when a loan's status changes between consecutive events for the same customer, computing both the previous status and the dollar amount delta — useful for audit trails, notifications, and compliance monitoring.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Stateful, Pattern, LAG |

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

### STATUS-CHANGES

```sql
CREATE TABLE `{name}` (
  `key`             BYTES,
  customer_id       STRING,
  txn_id            STRING,
  loan_id           STRING,
  amount            DOUBLE,
  prev_status       STRING,
  current_status    STRING,
  prev_amount       DOUBLE,
  amount_change     DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-STATUS-CHANGES`
SELECT
  CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS `key`,
  customer_id,
  txn_id,
  loan_id,
  amount,
  prev_status,
  status AS current_status,
  prev_amount,
  amount - prev_amount AS amount_change
FROM (
  SELECT
    customer_id,
    txn_id,
    loan_id,
    amount,
    status,
    LAG(status) OVER w AS prev_status,
    LAG(amount) OVER w AS prev_amount
  FROM `{rid}-LOANS`
  WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime)
)
WHERE prev_status IS NOT NULL AND prev_status <> status
```

## Example Input

Five loan events for customer C-001 showing status transitions over time.

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0002","created_at":"2025-03-15T10:10:00Z"}
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0003","created_at":"2025-03-15T10:20:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"FUNDED","customer_id":"C-001","txn_id":"TXN-0004","created_at":"2025-03-15T10:30:00Z"}
{"loan_id":"LN-00002","amount":38000.00,"status":"ADJUSTED","customer_id":"C-001","txn_id":"TXN-0005","created_at":"2025-03-15T10:40:00Z"}
```

## Expected Output

Only rows where the status actually changed are emitted. TXN-0003 is filtered out because the status stayed `APPROVED`.

```json
{"customer_id":"C-001","txn_id":"TXN-0002","loan_id":"LN-00001","amount":25000.00,"prev_status":"PENDING","current_status":"APPROVED","prev_amount":25000.00,"amount_change":0.00}
{"customer_id":"C-001","txn_id":"TXN-0004","loan_id":"LN-00002","amount":42000.00,"prev_status":"APPROVED","current_status":"FUNDED","prev_amount":25000.00,"amount_change":17000.00}
{"customer_id":"C-001","txn_id":"TXN-0005","loan_id":"LN-00002","amount":38000.00,"prev_status":"FUNDED","current_status":"ADJUSTED","prev_amount":42000.00,"amount_change":-4000.00}
```

## Steps to Run

1. Create the Kafka topics: `LOANS` and `STATUS-CHANGES`.
2. Register the input DDL for `LOANS` in your Flink SQL environment.
3. Register the output DDL for `STATUS-CHANGES`.
4. Produce the five example loan records in chronological order.
5. Submit the `INSERT INTO` SQL statement to start the Flink job.
6. Consume from `STATUS-CHANGES` and verify that only the three status-transition records appear, with correct previous values and amount deltas.
