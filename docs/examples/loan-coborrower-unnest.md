# Co-Borrower UNNEST

Loan applications often carry an array of co-borrowers packed into a single record. CROSS JOIN UNNEST explodes that array so each co-borrower gets its own row, making downstream processing and reporting straightforward.

## Metadata

- **Group:** Basics
- **Skill Level:** Beginner
- **Tags:** UNNEST, CROSS JOIN, Array, Streaming

## Input Schema

**Table: LOAN-COBORROWERS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  primary_borrower STRING,
  coborrowers ARRAY<STRING>,
  amount DOUBLE,
  status STRING
)
```

## Output Schema

**Table: BORROWER-DETAILS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  primary_borrower STRING,
  coborrower_name STRING,
  amount DOUBLE,
  status STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-BORROWER-DETAILS`
SELECT
  CAST(CONCAT(l.loan_id, '-', b.coborrower_name) AS BYTES) AS `key`,
  l.loan_id,
  l.primary_borrower,
  b.coborrower_name,
  l.amount,
  l.status
FROM `{rid}-LOAN-COBORROWERS` l
CROSS JOIN UNNEST(l.coborrowers) AS b(coborrower_name)
```

## Completion Steps

1. Create the `LOAN-COBORROWERS` input topic with an array-typed `coborrowers` column and the `BORROWER-DETAILS` output topic.
2. Submit the `INSERT INTO` statement to start the UNNEST job.
3. Produce records with multiple co-borrowers and verify one output row per co-borrower per loan.
