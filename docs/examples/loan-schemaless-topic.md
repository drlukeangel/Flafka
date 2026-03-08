# Schemaless Topic Parsing

Legacy systems produce raw JSON with no Schema Registry. This example shows how to read and parse schemaless topics using `value.format='raw'` and `JSON_VALUE()` to extract structured fields from raw byte payloads.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Schema |
| **Tags** | Quick Start, Schema Handling, Streaming |

## Input Schema

**Topic:** `{rid}-RAW-EVENTS`

```sql
CREATE TABLE `{name}` (
  `val` VARBINARY
)
```

> The table uses `value.format='raw'` so each Kafka message arrives as a single binary column.

## Output Schema

**Topic:** `{rid}-RAW-EVENTS-PARSED`

```sql
CREATE TABLE `{name}` (
  `key`        BYTES,
  event_id     STRING,
  event_type   STRING,
  user_id      STRING,
  amount       DOUBLE,
  currency     STRING,
  event_ts     BIGINT
)
```

## SQL

```sql
INSERT INTO `{rid}-RAW-EVENTS-PARSED`
SELECT
  CAST(JSON_VALUE(CAST(`val` AS STRING), '$.event_id') AS BYTES) AS `key`,
  JSON_VALUE(CAST(`val` AS STRING), '$.event_id')        AS event_id,
  JSON_VALUE(CAST(`val` AS STRING), '$.event_type')      AS event_type,
  JSON_VALUE(CAST(`val` AS STRING), '$.user_id')         AS user_id,
  CAST(JSON_VALUE(CAST(`val` AS STRING), '$.amount') AS DOUBLE) AS amount,
  JSON_VALUE(CAST(`val` AS STRING), '$.currency')        AS currency,
  CAST(JSON_VALUE(CAST(`val` AS STRING), '$.timestamp') AS BIGINT) AS event_ts
FROM `{rid}-RAW-EVENTS`
WHERE JSON_VALUE(CAST(`val` AS STRING), '$.event_type') IS NOT NULL
```

## Example Input

Raw bytes representing JSON records on the `RAW-EVENTS` topic:

```json
{"event_id": "EVT-001", "event_type": "PAYMENT", "user_id": "U-100", "amount": 1500.00, "currency": "USD", "timestamp": 1706140800000}
{"event_id": "EVT-002", "event_type": "DISBURSEMENT", "user_id": "U-101", "amount": 32000.00, "currency": "USD", "timestamp": 1706140860000}
{"event_id": "EVT-003", "event_type": "FEE", "user_id": "U-100", "amount": 75.00, "currency": "EUR", "timestamp": 1706140920000}
{"event_id": "EVT-004", "event_type": null, "user_id": "U-102", "amount": 200.00, "currency": "USD", "timestamp": 1706140980000}
{"event_id": "EVT-005", "event_type": "REFUND", "user_id": "U-103", "amount": 500.00, "currency": "GBP", "timestamp": 1706141040000}
```

## Expected Output

Records written to `RAW-EVENTS-PARSED` (EVT-004 is filtered out because `event_type` is null):

```json
{"event_id": "EVT-001", "event_type": "PAYMENT", "user_id": "U-100", "amount": 1500.0, "currency": "USD", "event_ts": 1706140800000}
{"event_id": "EVT-002", "event_type": "DISBURSEMENT", "user_id": "U-101", "amount": 32000.0, "currency": "USD", "event_ts": 1706140860000}
{"event_id": "EVT-003", "event_type": "FEE", "user_id": "U-100", "amount": 75.0, "currency": "EUR", "event_ts": 1706140920000}
{"event_id": "EVT-005", "event_type": "REFUND", "user_id": "U-103", "amount": 500.0, "currency": "GBP", "event_ts": 1706141040000}
```

## Steps to Run

1. Create the input topic `{rid}-RAW-EVENTS` in Confluent Cloud (no schema required).
2. Create the output topic `{rid}-RAW-EVENTS-PARSED` with the output DDL above.
3. Produce the example JSON records to `RAW-EVENTS` as raw bytes.
4. Deploy the SQL statement above as a Flink job.
5. Consume from `RAW-EVENTS-PARSED` to verify parsed, typed output.
