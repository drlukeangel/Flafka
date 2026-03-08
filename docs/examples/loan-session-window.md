# Loan Session Window

3 loans in a burst, then silence, then 2 more — that's two sessions. Session windows group by activity gaps. This example uses Flink's SESSION window to detect bursts of loan activity per customer, closing a session after 30 seconds of inactivity.

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

**Table: LOANS-SESSIONS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  customer_id STRING,
  session_start STRING,
  session_end STRING,
  loan_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-SESSIONS`
SELECT
  CAST(CONCAT(customer_id, '-', DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss')) AS BYTES) as `key`,
  customer_id,
  DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss') as session_start,
  DATE_FORMAT(session_end, 'yyyy-MM-dd HH:mm:ss') as session_end,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM `{rid}-LOANS`
GROUP BY customer_id, SESSION($rowtime, INTERVAL '30' SECOND)
```

## Example Input

Customer C-001 submits 3 loans in quick succession, goes silent for over 30 seconds, then submits 2 more.

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:00Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 50000.0, "status": "PENDING", "created_at": "2025-01-15T10:00:10Z", "txn_id": "TXN-0002", "customer_id": "C-001"}
{"loan_id": "LN-2024-00003", "amount": 15000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:20Z", "txn_id": "TXN-0003", "customer_id": "C-001"}
{"loan_id": "LN-2024-00004", "amount": 60000.0, "status": "APPROVED", "created_at": "2025-01-15T10:01:30Z", "txn_id": "TXN-0004", "customer_id": "C-001"}
{"loan_id": "LN-2024-00005", "amount": 35000.0, "status": "PENDING", "created_at": "2025-01-15T10:01:40Z", "txn_id": "TXN-0005", "customer_id": "C-001"}
```

## Expected Output

Two sessions are detected for customer C-001. The first session contains 3 loans (the burst from 10:00:00 to 10:00:20). After the 30-second gap, a second session starts with 2 more loans.

```json
{"customer_id": "C-001", "session_start": "2025-01-15 10:00:00", "session_end": "2025-01-15 10:00:50", "loan_count": 3, "total_amount": 90000.0, "avg_amount": 30000.0}
{"customer_id": "C-001", "session_start": "2025-01-15 10:01:30", "session_end": "2025-01-15 10:02:10", "loan_count": 2, "total_amount": 95000.0, "avg_amount": 47500.0}
```

Note: The session end time extends 30 seconds beyond the last event in each session (the gap timeout).

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Session Window** example from the Windows group.
3. Ensure the `LOANS` topic has data with realistic gaps between bursts of activity.
4. Click **Run** to start the session window aggregation job.
5. Open the `LOANS-SESSIONS` output topic to inspect the results.
6. Verify that activity bursts within 30 seconds are grouped into a single session.
7. Confirm that gaps longer than 30 seconds create separate session rows.
