# Loan Aggregate

How many loans per status? How much money? Get live dashboard metrics every 20 seconds with tumbling windows. This example uses Flink's TUMBLE window function to compute aggregated loan statistics grouped by status over fixed 20-second intervals.

## Metadata

- **Group:** Windows
- **Tags:** Quick Start, Aggregation, Window

## Input Schema

**Table: LOANS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  txn_id STRING,
  customer_id STRING
)
```

## Output Schema

**Table: LOANS-STATS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  window_start STRING,
  window_end STRING,
  status STRING,
  loan_count BIGINT,
  total_amount DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-STATS`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) as `key`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  status,
  COUNT(*) AS loan_count,
  SUM(amount) AS total_amount
FROM TABLE(
  TUMBLE(TABLE `{rid}-LOANS`, DESCRIPTOR($rowtime), INTERVAL '20' SECOND)
)
GROUP BY window_start, window_end, status
```

## Example Input

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:05Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 50000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:10Z", "txn_id": "TXN-0002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 15000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:15Z", "txn_id": "TXN-0003", "customer_id": "C-003"}
{"loan_id": "LN-2024-00004", "amount": 35000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:25Z", "txn_id": "TXN-0004", "customer_id": "C-004"}
{"loan_id": "LN-2024-00005", "amount": 20000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:30Z", "txn_id": "TXN-0005", "customer_id": "C-005"}
```

## Expected Output

Each 20-second tumbling window emits one row per status with the count and total amount.

```json
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:20", "status": "APPROVED", "loan_count": 2, "total_amount": 75000.0}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:20", "status": "PENDING", "loan_count": 1, "total_amount": 15000.0}
{"window_start": "2025-01-15 10:00:20", "window_end": "2025-01-15 10:00:40", "status": "APPROVED", "loan_count": 1, "total_amount": 35000.0}
{"window_start": "2025-01-15 10:00:20", "window_end": "2025-01-15 10:00:40", "status": "PENDING", "loan_count": 1, "total_amount": 20000.0}
```

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Aggregate** example from the Windows group.
3. Ensure the `LOANS` topic has data flowing with valid event timestamps.
4. Click **Run** to start the tumbling window aggregation job.
5. Open the `LOANS-STATS` output topic to inspect the windowed results.
6. Verify that each 20-second window contains the correct count and sum per status.
