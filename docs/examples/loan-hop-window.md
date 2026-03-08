# Loan Hop Window

Hop windows slide smoothly — "last 60 seconds, updated every 10." This example demonstrates Flink's HOP window function, which creates overlapping windows that slide forward at a fixed interval. Each event can appear in multiple windows, giving you a rolling view of loan activity.

## Metadata

- **Group:** Windows
- **Tags:** Quick Start, Windowed

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

**Table: LOANS-HOP-STATS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  window_start STRING,
  window_end STRING,
  status STRING,
  loan_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-HOP-STATS`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) as `key`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  status,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM TABLE(
  HOP(TABLE `{rid}-LOANS`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '60' SECOND)
)
GROUP BY window_start, window_end, status
```

## Example Input

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:05Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 50000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:10Z", "txn_id": "TXN-0002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 15000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:15Z", "txn_id": "TXN-0003", "customer_id": "C-003"}
```

## Expected Output

Each event appears in multiple overlapping windows. The hop slide is 10 seconds and the window size is 60 seconds, so each event falls into up to 6 windows.

```json
{"window_start": "2025-01-15 09:59:10", "window_end": "2025-01-15 10:00:10", "status": "APPROVED", "loan_count": 1, "total_amount": 25000.0, "avg_amount": 25000.0}
{"window_start": "2025-01-15 09:59:20", "window_end": "2025-01-15 10:00:20", "status": "APPROVED", "loan_count": 2, "total_amount": 75000.0, "avg_amount": 37500.0}
{"window_start": "2025-01-15 09:59:20", "window_end": "2025-01-15 10:00:20", "status": "PENDING", "loan_count": 1, "total_amount": 15000.0, "avg_amount": 15000.0}
{"window_start": "2025-01-15 09:59:30", "window_end": "2025-01-15 10:00:30", "status": "APPROVED", "loan_count": 2, "total_amount": 75000.0, "avg_amount": 37500.0}
{"window_start": "2025-01-15 09:59:30", "window_end": "2025-01-15 10:00:30", "status": "PENDING", "loan_count": 1, "total_amount": 15000.0, "avg_amount": 15000.0}
```

Note: Each event appears in multiple overlapping windows because the hop slide (10s) is smaller than the window size (60s).

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Hop Window** example from the Windows group.
3. Ensure the `LOANS` topic has data flowing with valid event timestamps.
4. Click **Run** to start the hop window aggregation job.
5. Open the `LOANS-HOP-STATS` output topic to inspect the results.
6. Observe that each loan event contributes to multiple overlapping windows.
7. Verify counts, totals, and averages are correct across windows.
