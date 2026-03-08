# Schema Override with Event-Time Watermarks

Override auto-discovered schemas with custom event-time support for windowing. When the Schema Registry schema lacks event-time semantics, you can drop and recreate the Flink table with computed columns and watermark definitions.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Schema |
| **Tags** | Quick Start, Schema Handling, Event-Time |

## Input Schema

**Topic:** `{rid}-LOANS` (overridden with watermarks)

```sql
CREATE TABLE `{name}` (
  `key`          VARBINARY(2147483647),
  `loan_id`      VARCHAR(2147483647) NOT NULL,
  `amount`       DOUBLE NOT NULL,
  `status`       VARCHAR(2147483647) NOT NULL,
  `created_at`   BIGINT NOT NULL,
  `txn_id`       VARCHAR(2147483647) NOT NULL,
  `customer_id`  VARCHAR(2147483647) NOT NULL,
  `event_time`   AS TO_TIMESTAMP_LTZ(`created_at`, 3),
  WATERMARK FOR `event_time` AS `event_time` - INTERVAL '10' SECOND
) WITH (
  'connector' = 'confluent',
  'value.format' = 'avro-registry'
)
```

> The `event_time` computed column converts the epoch-millis `created_at` field into a proper timestamp, and the watermark allows 10 seconds of late data.

## Output Schema

**Topic:** `{rid}-LOANS-RETYPED`

Same as the standard loans schema (without watermark overrides):

```sql
CREATE TABLE `{name}` (
  `key`          BYTES,
  `loan_id`      STRING,
  `amount`       DOUBLE,
  `status`       STRING,
  `created_at`   BIGINT,
  `txn_id`       STRING,
  `customer_id`  STRING
)
```

## SQL

**Cell 1 -- Drop and recreate the LOANS table with watermarks:**

```sql
DROP TABLE IF EXISTS `{rid}-LOANS`;
-- Recreate with watermarks (use the Input DDL above)
```

**Cell 2 -- Filter and forward high-value loans:**

```sql
INSERT INTO `{rid}-LOANS-RETYPED`
SELECT
  CAST(`loan_id` AS BYTES) AS `key`,
  `loan_id`,
  `amount`,
  `status`,
  `created_at`,
  `txn_id`,
  `customer_id`
FROM `{rid}-LOANS`
WHERE `amount` > 10000
LIMIT 50
```

## Example Input

Records on the `LOANS` topic (Avro-encoded, shown as JSON):

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": 1706140800000, "txn_id": "TXN-5001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 5000.0, "status": "PENDING", "created_at": 1706140860000, "txn_id": "TXN-5002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 150000.0, "status": "APPROVED", "created_at": 1706140920000, "txn_id": "TXN-5003", "customer_id": "C-003"}
{"loan_id": "LN-2024-00004", "amount": 8000.0, "status": "REJECTED", "created_at": 1706140980000, "txn_id": "TXN-5004", "customer_id": "C-004"}
{"loan_id": "LN-2024-00005", "amount": 45000.0, "status": "APPROVED", "created_at": 1706141040000, "txn_id": "TXN-5005", "customer_id": "C-005"}
```

## Expected Output

Only loans with `amount > 10000` pass (LN-00002 and LN-00004 are filtered out):

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": 1706140800000, "txn_id": "TXN-5001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00003", "amount": 150000.0, "status": "APPROVED", "created_at": 1706140920000, "txn_id": "TXN-5003", "customer_id": "C-003"}
{"loan_id": "LN-2024-00005", "amount": 45000.0, "status": "APPROVED", "created_at": 1706141040000, "txn_id": "TXN-5005", "customer_id": "C-005"}
```

## Steps to Run

1. Ensure the `{rid}-LOANS` topic exists with Avro schema in Schema Registry.
2. Create the `{rid}-LOANS-RETYPED` output topic with the output DDL.
3. Run **Cell 1** to drop the existing Flink catalog table and recreate it with watermark definitions.
4. Run **Cell 2** to start the filtering job.
5. Produce sample loan records to the input topic.
6. Consume from `LOANS-RETYPED` to verify only high-value loans appear.
