# OVER RANGE Window

Velocity detection requires looking back over a time range rather than a fixed row count. An OVER window with RANGE BETWEEN computes rolling statistics across the last 5 minutes of events per customer, enabling real-time detection of rapid-fire loan submissions.

## Metadata

- **Group:** Stateful
- **Skill Level:** Advanced
- **Tags:** OVER Window, RANGE, Velocity, Stateful, Streaming

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

**Table: LOAN-VELOCITY-STATS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  customer_id STRING,
  loan_id STRING,
  amount DOUBLE,
  apps_last_5min BIGINT,
  total_last_5min DOUBLE,
  avg_last_5min DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-LOAN-VELOCITY-STATS`
SELECT
  CAST(CONCAT(customer_id, '-', loan_id) AS BYTES) AS `key`,
  customer_id,
  loan_id,
  amount,
  COUNT(*) OVER w AS apps_last_5min,
  SUM(amount) OVER w AS total_last_5min,
  CAST(AVG(amount) OVER w AS DOUBLE) AS avg_last_5min
FROM `{rid}-LOANS`
WINDOW w AS (
  PARTITION BY customer_id
  ORDER BY $rowtime
  RANGE BETWEEN INTERVAL '5' MINUTE PRECEDING AND CURRENT ROW
)
```

## Completion Steps

1. Create the `LOANS` input topic and `LOAN-VELOCITY-STATS` output topic with the schemas above.
2. Submit the `INSERT INTO` statement to start the OVER RANGE window job.
3. Produce multiple loan records for the same customer within a 5-minute window and verify the rolling count, total, and average reflect only events in that range.
