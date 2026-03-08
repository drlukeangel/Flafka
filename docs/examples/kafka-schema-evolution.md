# Kafka Schema Evolution

Demonstrates how to handle schema evolution in Kafka-backed Flink SQL tables. This example walks through adding a new column to an existing table by dropping and recreating it, and shows how Schema Registry compatibility settings govern the process.

## Metadata

- **Group:** Kafka
- **Tags:** Quick Start, Kafka, Schema Registry, Evolution

## Input Schema

**Table: EVOLVING-DATA (original)**

```sql
CREATE TABLE `{name}` (
  record_id STRING NOT NULL,
  name STRING,
  value DOUBLE,
  PRIMARY KEY (record_id) NOT ENFORCED
)
```

**Table: EVOLVING-DATA (evolved)**

```sql
CREATE TABLE `{name}` (
  record_id STRING NOT NULL,
  name STRING,
  value DOUBLE,
  category STRING,
  PRIMARY KEY (record_id) NOT ENFORCED
)
```

## SQL

### Cell 1 — Query the original schema

```sql
SELECT
  record_id,
  name,
  value
FROM `EVOLVING-DATA`;
```

### Cell 2 — Drop the table to prepare for schema change

```sql
DROP TABLE `EVOLVING-DATA`;
```

### Cell 3 — Recreate the table with an additional column

```sql
CREATE TABLE `EVOLVING-DATA` (
  record_id STRING NOT NULL,
  name STRING,
  value DOUBLE,
  category STRING,
  PRIMARY KEY (record_id) NOT ENFORCED
);
```

### Cell 4 — Query the evolved schema

```sql
SELECT
  record_id,
  name,
  value,
  category
FROM `EVOLVING-DATA`;
```

## Example Input

**Before evolution:**

```json
{"record_id": "rec-001", "name": "alpha", "value": 10.5}
{"record_id": "rec-002", "name": "beta", "value": 20.3}
```

**After evolution:**

```json
{"record_id": "rec-003", "name": "gamma", "value": 30.1, "category": "premium"}
{"record_id": "rec-004", "name": "delta", "value": 40.7, "category": "standard"}
```

## Expected Output

Before evolution, only the original three columns are available:

```json
{"record_id": "rec-001", "name": "alpha", "value": 10.5}
{"record_id": "rec-002", "name": "beta", "value": 20.3}
```

After evolution, the new `category` column is present. Historical records that predate the schema change will have `null` for the new field:

```json
{"record_id": "rec-001", "name": "alpha", "value": 10.5, "category": null}
{"record_id": "rec-002", "name": "beta", "value": 20.3, "category": null}
{"record_id": "rec-003", "name": "gamma", "value": 30.1, "category": "premium"}
{"record_id": "rec-004", "name": "delta", "value": 40.7, "category": "standard"}
```

## Steps to Run

1. Create the `EVOLVING-DATA` table with the original schema (three columns).
2. Produce the initial example input messages.
3. Run Cell 1 to verify the original schema returns data correctly.
4. Run Cell 2 to drop the existing table definition.
5. Run Cell 3 to recreate the table with the new `category` column.
6. Produce additional messages that include the `category` field.
7. Run Cell 4 to query the evolved schema and observe that old records show `null` for `category` while new records include it.
8. Verify that Schema Registry compatibility settings (e.g., BACKWARD) permit the change.
