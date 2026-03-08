# Confluent Connector Bridge

Demonstrates the Source Connector to Flink SQL to Sink Connector pipeline pattern. This example reads raw data from a source connector output topic, applies transformations and data cleaning in Flink SQL, and writes the cleaned results to a sink topic for downstream consumption.

## Metadata

- **Group:** Confluent
- **Tags:** Quick Start, Confluent, Connector, Pipeline

## Input Schema

**Table: RAW-INGEST**

```sql
CREATE TABLE `{name}` (
  raw_id STRING,
  raw_name STRING,
  raw_email STRING,
  raw_amount STRING,
  raw_currency STRING,
  ingest_ts STRING
)
```

## Output Schema

**Table: CLEAN-OUTPUT**

```sql
CREATE TABLE `{name}` (
  customer_id STRING NOT NULL,
  full_name STRING,
  email STRING,
  amount_usd DOUBLE,
  processed_at STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
)
```

## SQL

### Cell 1 — Transform and clean raw connector data

```sql
INSERT INTO `CLEAN-OUTPUT`
SELECT
  raw_id AS customer_id,
  UPPER(TRIM(raw_name)) AS full_name,
  LOWER(TRIM(raw_email)) AS email,
  CASE
    WHEN raw_currency = 'USD' THEN CAST(raw_amount AS DOUBLE)
    WHEN raw_currency = 'EUR' THEN CAST(raw_amount AS DOUBLE) * 1.08
    WHEN raw_currency = 'GBP' THEN CAST(raw_amount AS DOUBLE) * 1.27
    ELSE CAST(raw_amount AS DOUBLE)
  END AS amount_usd,
  ingest_ts AS processed_at
FROM `RAW-INGEST`
WHERE raw_id IS NOT NULL
  AND raw_email IS NOT NULL;
```

### Cell 2 — Verify cleaned output

```sql
SELECT
  customer_id,
  full_name,
  email,
  amount_usd,
  processed_at
FROM `CLEAN-OUTPUT`;
```

## Example Input

```json
{"raw_id": "cust-001", "raw_name": "  Alice Johnson ", "raw_email": " Alice.Johnson@Example.COM ", "raw_amount": "150.00", "raw_currency": "USD", "ingest_ts": "2026-03-07T10:00:00Z"}
{"raw_id": "cust-002", "raw_name": "Bob Smith", "raw_email": "BOB@COMPANY.IO", "raw_amount": "200.00", "raw_currency": "EUR", "ingest_ts": "2026-03-07T10:00:01Z"}
{"raw_id": null, "raw_name": "Bad Record", "raw_email": null, "raw_amount": "0", "raw_currency": "USD", "ingest_ts": "2026-03-07T10:00:02Z"}
{"raw_id": "cust-003", "raw_name": "  Charlie Lee", "raw_email": "charlie@startup.dev", "raw_amount": "100.00", "raw_currency": "GBP", "ingest_ts": "2026-03-07T10:00:03Z"}
```

## Expected Output

The transformation pipeline trims whitespace, normalizes case, converts currencies to USD, and filters out records with null IDs or emails. The third record is dropped because it has null values for required fields.

```json
{"customer_id": "cust-001", "full_name": "ALICE JOHNSON", "email": "alice.johnson@example.com", "amount_usd": 150.00, "processed_at": "2026-03-07T10:00:00Z"}
{"customer_id": "cust-002", "full_name": "BOB SMITH", "email": "bob@company.io", "amount_usd": 216.00, "processed_at": "2026-03-07T10:00:01Z"}
{"customer_id": "cust-003", "full_name": "CHARLIE LEE", "email": "charlie@startup.dev", "amount_usd": 127.00, "processed_at": "2026-03-07T10:00:03Z"}
```

## Steps to Run

1. Set up a source connector (e.g., Debezium, HTTP Source) that writes raw data to the `RAW-INGEST` topic.
2. Create the `RAW-INGEST` table in Flink SQL with the schema above.
3. Create the `CLEAN-OUTPUT` sink table with the cleaned schema.
4. Run Cell 1 to start the transformation pipeline.
5. Verify records flow from the source connector through Flink SQL into the output topic.
6. Run Cell 2 to inspect the cleaned output and confirm transformations applied correctly.
7. Optionally, attach a sink connector to the `CLEAN-OUTPUT` topic to push cleaned data to a downstream system (e.g., database, data warehouse).
