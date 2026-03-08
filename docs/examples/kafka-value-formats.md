# Kafka Value Formats

Demonstrates how different value format settings affect the way data is serialized and deserialized in Kafka-backed Flink SQL tables. This example compares Avro with Schema Registry, JSON with Schema Registry, and raw byte formats.

## Metadata

- **Group:** Kafka
- **Tags:** Quick Start, Kafka, Avro, JSON, Schema Registry

## Input Schema

**Table: SENSOR-AVRO**

```sql
CREATE TABLE `{name}` (
  sensor_id STRING,
  temperature DOUBLE,
  humidity DOUBLE,
  reading_time STRING
) WITH (
  'value.format' = 'avro-registry'
)
```

**Table: SENSOR-JSON**

```sql
CREATE TABLE `{name}` (
  sensor_id STRING,
  temperature DOUBLE,
  humidity DOUBLE,
  reading_time STRING
) WITH (
  'value.format' = 'json-registry'
)
```

**Table: SENSOR-RAW**

```sql
CREATE TABLE `{name}` (
  raw_value BYTES
) WITH (
  'value.format' = 'raw'
)
```

## SQL

### Cell 1 — Read from Avro-encoded topic

```sql
SELECT
  sensor_id,
  temperature,
  humidity,
  reading_time
FROM `SENSOR-AVRO`;
```

### Cell 2 — Read from JSON-encoded topic

```sql
SELECT
  sensor_id,
  temperature,
  humidity,
  reading_time
FROM `SENSOR-JSON`;
```

### Cell 3 — Read raw bytes from a topic

```sql
SELECT
  CAST(raw_value AS STRING) AS decoded_value
FROM `SENSOR-RAW`;
```

## Example Input

```json
{"sensor_id": "sensor-01", "temperature": 22.5, "humidity": 45.0, "reading_time": "2026-03-07T10:00:00Z"}
{"sensor_id": "sensor-02", "temperature": 19.8, "humidity": 62.3, "reading_time": "2026-03-07T10:00:01Z"}
```

## Expected Output

All three formats ultimately represent the same data, but differ in how they store and retrieve it.

**Avro (avro-registry)** — Flink resolves the schema from Schema Registry and deserializes compact binary Avro:

```json
{"sensor_id": "sensor-01", "temperature": 22.5, "humidity": 45.0, "reading_time": "2026-03-07T10:00:00Z"}
{"sensor_id": "sensor-02", "temperature": 19.8, "humidity": 62.3, "reading_time": "2026-03-07T10:00:01Z"}
```

**JSON (json-registry)** — Flink resolves the schema from Schema Registry and deserializes JSON with schema validation:

```json
{"sensor_id": "sensor-01", "temperature": 22.5, "humidity": 45.0, "reading_time": "2026-03-07T10:00:00Z"}
{"sensor_id": "sensor-02", "temperature": 19.8, "humidity": 62.3, "reading_time": "2026-03-07T10:00:01Z"}
```

**Raw** — Flink returns the raw byte payload as a single BYTES column. Casting to STRING shows the underlying serialized form:

```json
{"decoded_value": "{\"sensor_id\":\"sensor-01\",\"temperature\":22.5,\"humidity\":45.0,\"reading_time\":\"2026-03-07T10:00:00Z\"}"}
```

## Steps to Run

1. Create the `SENSOR-AVRO` table with `value.format` set to `avro-registry`.
2. Create the `SENSOR-JSON` table with `value.format` set to `json-registry`.
3. Create the `SENSOR-RAW` table with `value.format` set to `raw`.
4. Produce the example input messages to each topic in the appropriate format.
5. Run Cell 1 and observe structured output from the Avro-encoded topic.
6. Run Cell 2 and observe structured output from the JSON-encoded topic.
7. Run Cell 3 and observe raw byte output that must be cast to STRING for readability.
8. Compare the three results to understand the trade-offs between format choices.
