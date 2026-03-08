# Data Masking with Pure SQL

No UDFs needed -- mask loan IDs with SHA-256 and redact customer IDs using built-in SQL functions. This is pure SQL data protection suitable for producing sanitized streams for downstream consumers who should not see PII.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Data Masking |
| **Tags** | Quick Start, Pattern, Security |

## Input Schema

**Topic:** `{rid}-LOANS` (standard loans schema)

```sql
CREATE TABLE `{name}` (
  `key`          BYTES,
  `loan_id`      STRING,
  `amount`       DOUBLE,
  `status`       STRING,
  `customer_id`  STRING,
  `created_at`   STRING
)
```

## Output Schema

**Topic:** `{rid}-LOANS-MASKED-SQL`

```sql
CREATE TABLE `{name}` (
  `key`                BYTES,
  hashed_loan_id       STRING,
  amount               DOUBLE,
  status               STRING,
  masked_customer_id   STRING,
  created_at           STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-MASKED-SQL`
SELECT
  CAST(SHA2(CAST(loan_id AS BYTES), 256) AS BYTES) AS `key`,
  SHA2(CAST(loan_id AS BYTES), 256) AS hashed_loan_id,
  amount,
  status,
  REGEXP_REPLACE(customer_id, '.', '*') AS masked_customer_id,
  created_at
FROM `{rid}-LOANS`
```

## Example Input

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "customer_id": "C-001", "created_at": "2025-01-15T10:00:00Z"}
{"loan_id": "LN-2024-00002", "amount": 5000.0, "status": "PENDING", "customer_id": "C-002", "created_at": "2025-01-15T10:01:00Z"}
{"loan_id": "LN-2024-00003", "amount": 150000.0, "status": "APPROVED", "customer_id": "C-003", "created_at": "2025-01-15T10:02:00Z"}
{"loan_id": "LN-2024-00004", "amount": 8000.0, "status": "REJECTED", "customer_id": "C-004", "created_at": "2025-01-15T10:03:00Z"}
```

## Expected Output

Loan IDs are SHA-256 hashed and customer IDs are fully redacted:

```json
{"hashed_loan_id": "a3f2...b8c1", "amount": 25000.0, "status": "APPROVED", "masked_customer_id": "*****", "created_at": "2025-01-15T10:00:00Z"}
{"hashed_loan_id": "7d1e...f4a2", "amount": 5000.0, "status": "PENDING", "masked_customer_id": "*****", "created_at": "2025-01-15T10:01:00Z"}
{"hashed_loan_id": "c9b3...e5d7", "amount": 150000.0, "status": "APPROVED", "masked_customer_id": "*****", "created_at": "2025-01-15T10:02:00Z"}
{"hashed_loan_id": "2f8a...d1c6", "amount": 8000.0, "status": "REJECTED", "masked_customer_id": "*****", "created_at": "2025-01-15T10:03:00Z"}
```

> The `hashed_loan_id` values shown above are truncated for readability. Actual values are 64-character hex strings.

## Steps to Run

1. Ensure the `{rid}-LOANS` topic and table exist with the standard loans schema.
2. Create the `{rid}-LOANS-MASKED-SQL` output topic with the output DDL above.
3. Deploy the SQL statement as a Flink job.
4. Produce loan records to the input topic.
5. Consume from `LOANS-MASKED-SQL` to verify that loan IDs are hashed and customer IDs are fully masked.
