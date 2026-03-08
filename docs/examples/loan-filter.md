# Loan Filter

Only care about approved loans? One WHERE clause and Flink drops everything else in real-time. This example demonstrates basic stream filtering on a loans topic, forwarding only records with a status of APPROVED to the output.

## Metadata

- **Group:** Basics
- **Tags:** Quick Start, Filter, Streaming

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

**Table: LOANS-FILTERED** (same schema as LOANS)

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

## SQL

```sql
INSERT INTO `{rid}-LOANS-FILTERED`
SELECT
  CAST(loan_id AS BYTES) AS `key`,
  loan_id,
  amount,
  status,
  created_at,
  txn_id,
  customer_id
FROM `{rid}-LOANS`
WHERE status = 'APPROVED'
```

## Example Input

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:00Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 50000.0, "status": "PENDING", "created_at": "2025-01-15T10:05:00Z", "txn_id": "TXN-0002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 15000.0, "status": "REJECTED", "created_at": "2025-01-15T10:10:00Z", "txn_id": "TXN-0003", "customer_id": "C-003"}
{"loan_id": "LN-2024-00004", "amount": 75000.0, "status": "APPROVED", "created_at": "2025-01-15T10:15:00Z", "txn_id": "TXN-0004", "customer_id": "C-004"}
{"loan_id": "LN-2024-00005", "amount": 30000.0, "status": "DENIED", "created_at": "2025-01-15T10:20:00Z", "txn_id": "TXN-0005", "customer_id": "C-005"}
```

## Expected Output

Only APPROVED loans pass through. PENDING, REJECTED, and DENIED records are dropped.

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:00Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00004", "amount": 75000.0, "status": "APPROVED", "created_at": "2025-01-15T10:15:00Z", "txn_id": "TXN-0004", "customer_id": "C-004"}
```

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Filter** example from the Basics group.
3. Ensure the `LOANS` topic has data flowing (use the built-in loan data generator if needed).
4. Click **Run** to start the filter job.
5. Open the `LOANS-FILTERED` output topic to inspect the results.
6. Verify that only records with `status = 'APPROVED'` appear in the output.
