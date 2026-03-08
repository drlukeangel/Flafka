# Payment Enrichment

Bare payment records carry only a borrower ID. A temporal join against a versioned borrower reference table enriches each payment with the borrower's name, credit score, and state that were current at payment time, giving downstream systems a complete picture without additional lookups.

## Metadata

- **Group:** Joins
- **Skill Level:** Intermediate
- **Tags:** Temporal Join, Enrichment, Payments, Streaming

## Input Schema

**Table: PAYMENT-STREAM**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  payment_id STRING,
  loan_id STRING,
  borrower_id STRING,
  amount DOUBLE,
  payment_date STRING,
  payment_type STRING
)
```

**Table: BORROWER-REFERENCE**

```sql
CREATE TABLE `{name}` (
  borrower_id STRING NOT NULL,
  name STRING,
  credit_score INT,
  state STRING,
  updated_at STRING,
  PRIMARY KEY (borrower_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## Output Schema

**Table: ENRICHED-PAYMENTS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  payment_id STRING,
  loan_id STRING,
  borrower_id STRING,
  amount DOUBLE,
  payment_type STRING,
  borrower_name STRING,
  credit_score INT,
  borrower_state STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-ENRICHED-PAYMENTS`
SELECT
  CAST(p.payment_id AS BYTES) AS `key`,
  p.payment_id,
  p.loan_id,
  p.borrower_id,
  p.amount,
  p.payment_type,
  b.name AS borrower_name,
  b.credit_score,
  b.state AS borrower_state
FROM `{rid}-PAYMENT-STREAM` p
JOIN `{rid}-BORROWER-REFERENCE` FOR SYSTEM_TIME AS OF p.`$rowtime` AS b
  ON p.borrower_id = b.borrower_id
```

## Completion Steps

1. Create the `PAYMENT-STREAM` stream topic, the `BORROWER-REFERENCE` upsert table, and the `ENRICHED-PAYMENTS` output topic.
2. Populate borrower reference data first, then submit the `INSERT INTO` statement.
3. Produce payment records and verify each is enriched with the correct borrower name, credit score, and state.
