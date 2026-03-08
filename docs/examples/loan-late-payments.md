# Late Data & Watermarks

Payment reports often arrive late. By overriding the table schema with a WATERMARK clause, Flink can tolerate up to 30 seconds of out-of-order data while still producing correct tumble-window aggregations. Late records within the watermark threshold are included; those beyond it are dropped.

## Metadata

- **Group:** Windows
- **Skill Level:** Advanced
- **Tags:** Watermark, Late Data, Event-Time, Tumble, Streaming

## Input Schema

**Table: LATE-PAYMENT-REPORTS**

```sql
CREATE TABLE `{name}` (
  `key` VARBINARY(2147483647),
  payment_id VARCHAR(2147483647) NOT NULL,
  loan_id VARCHAR(2147483647) NOT NULL,
  amount DOUBLE NOT NULL,
  reported_at BIGINT NOT NULL,
  branch_id VARCHAR(2147483647) NOT NULL,
  `event_time` AS TO_TIMESTAMP_LTZ(`reported_at`, 3),
  WATERMARK FOR `event_time` AS `event_time` - INTERVAL '30' SECOND
) WITH (
  'connector' = 'confluent',
  'value.format' = 'avro-registry'
)
```

## Output Schema

**Table: ONTIME-PAYMENT-STATS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  window_start STRING,
  window_end STRING,
  branch_id STRING,
  payment_count BIGINT,
  total_amount DOUBLE
)
```

## SQL

```sql
INSERT INTO `{rid}-ONTIME-PAYMENT-STATS`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', branch_id) AS BYTES) AS `key`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  branch_id,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_amount
FROM TABLE(
  TUMBLE(TABLE `{rid}-LATE-PAYMENT-REPORTS`, DESCRIPTOR(`event_time`), INTERVAL '1' MINUTE)
)
GROUP BY window_start, window_end, branch_id
```

## Completion Steps

1. Drop and recreate the `LATE-PAYMENT-REPORTS` table with the watermark-enabled DDL above and create the `ONTIME-PAYMENT-STATS` output topic.
2. Submit the `INSERT INTO` statement to start the tumble window aggregation.
3. Produce payment records including some with timestamps up to 30 seconds in the past and verify they are included in the correct window output.
