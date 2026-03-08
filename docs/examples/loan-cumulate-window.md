# CUMULATE Window

Expanding intraday dashboards need windows that grow over time. CUMULATE windows start small and widen at fixed steps until they reach a maximum size, giving you progressive aggregation snapshots throughout the day. This example tracks loan commitment volume with windows that expand every 15 minutes up to a 1-hour ceiling.

## Metadata

- **Group:** Windows
- **Skill Level:** Intermediate
- **Tags:** CUMULATE, Windowed, Dashboard, Streaming

## Input Schema

**Table: LOAN-COMMITMENTS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  commitment_id STRING,
  loan_id STRING,
  amount DOUBLE,
  region STRING,
  committed_at STRING,
  officer_id STRING
)
```

## Output Schema

**Table: DAILY-COMMITMENT-STATS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  window_start STRING,
  window_end STRING,
  region STRING,
  commitment_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-DAILY-COMMITMENT-STATS`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', region) AS BYTES) AS `key`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  region,
  COUNT(*) AS commitment_count,
  SUM(amount) AS total_amount,
  CAST(AVG(amount) AS DOUBLE) AS avg_amount
FROM TABLE(
  CUMULATE(TABLE `{rid}-LOAN-COMMITMENTS`, DESCRIPTOR($rowtime), INTERVAL '15' MINUTE, INTERVAL '1' HOUR)
)
GROUP BY window_start, window_end, region
```

## Completion Steps

1. Create the `LOAN-COMMITMENTS` input topic and `DAILY-COMMITMENT-STATS` output topic with the schemas above.
2. Submit the `INSERT INTO` statement to start the CUMULATE window aggregation job.
3. Produce commitment records and verify that output windows expand at 15-minute steps up to the 1-hour maximum.
