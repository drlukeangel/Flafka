# Loan Top-N

What are the 3 biggest loans right now? Real-time leaderboards that update every 30 seconds. This example combines Flink's TUMBLE window with the ROW_NUMBER() function to compute a ranked top-3 of loans by amount within each window, partitioned by status.

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

**Table: LOANS-TOP3**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  window_start STRING,
  window_end STRING,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_id STRING,
  rank_num BIGINT
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-TOP3`
SELECT `key`, window_start, window_end, loan_id, amount, status, txn_id, customer_id, rank_num
FROM (
  SELECT
    CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status, '-', CAST(rownum AS STRING)) AS BYTES) as `key`,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
    loan_id,
    amount,
    status,
    txn_id,
    customer_id,
    rownum as rank_num
  FROM (
    SELECT
      window_start,
      window_end,
      loan_id,
      amount,
      status,
      txn_id,
      customer_id,
      ROW_NUMBER() OVER (
        PARTITION BY window_start, window_end, status
        ORDER BY amount DESC
      ) AS rownum
    FROM TABLE(
      TUMBLE(TABLE `{rid}-LOANS`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
    )
  )
  WHERE rownum <= 3
)
```

## Example Input

Ten loans arriving within a single 30-second window, with varying amounts and statuses.

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:02Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 150000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:04Z", "txn_id": "TXN-0002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 75000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:06Z", "txn_id": "TXN-0003", "customer_id": "C-003"}
{"loan_id": "LN-2024-00004", "amount": 90000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:08Z", "txn_id": "TXN-0004", "customer_id": "C-004"}
{"loan_id": "LN-2024-00005", "amount": 50000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:10Z", "txn_id": "TXN-0005", "customer_id": "C-005"}
{"loan_id": "LN-2024-00006", "amount": 200000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:12Z", "txn_id": "TXN-0006", "customer_id": "C-006"}
{"loan_id": "LN-2024-00007", "amount": 30000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:14Z", "txn_id": "TXN-0007", "customer_id": "C-007"}
{"loan_id": "LN-2024-00008", "amount": 120000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:16Z", "txn_id": "TXN-0008", "customer_id": "C-008"}
{"loan_id": "LN-2024-00009", "amount": 45000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:18Z", "txn_id": "TXN-0009", "customer_id": "C-009"}
{"loan_id": "LN-2024-00010", "amount": 10000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:20Z", "txn_id": "TXN-0010", "customer_id": "C-010"}
```

## Expected Output

Top 3 loans by amount per status within the 30-second window. Ranked with `rank_num` 1, 2, and 3.

```json
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00002", "amount": 150000.0, "status": "APPROVED", "txn_id": "TXN-0002", "customer_id": "C-002", "rank_num": 1}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00004", "amount": 90000.0, "status": "APPROVED", "txn_id": "TXN-0004", "customer_id": "C-004", "rank_num": 2}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00003", "amount": 75000.0, "status": "APPROVED", "txn_id": "TXN-0003", "customer_id": "C-003", "rank_num": 3}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00006", "amount": 200000.0, "status": "PENDING", "txn_id": "TXN-0006", "customer_id": "C-006", "rank_num": 1}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00008", "amount": 120000.0, "status": "PENDING", "txn_id": "TXN-0008", "customer_id": "C-008", "rank_num": 2}
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_id": "LN-2024-00009", "amount": 45000.0, "status": "PENDING", "txn_id": "TXN-0009", "customer_id": "C-009", "rank_num": 3}
```

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Top-N** example from the Windows group.
3. Ensure the `LOANS` topic has sufficient data flowing within 30-second windows.
4. Click **Run** to start the Top-N ranking job.
5. Open the `LOANS-TOP3` output topic to inspect the results.
6. Verify that each 30-second window contains at most 3 rows per status, ranked by amount descending.
