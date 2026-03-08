# Kafka Changelog Modes

Demonstrates the difference between append and upsert changelog semantics in Kafka-backed Flink SQL tables. This example shows how an append-only log grows indefinitely while an upsert log maintains only the latest value per key.

## Metadata

- **Group:** Kafka
- **Tags:** Quick Start, Kafka, Changelog, Upsert

## Input Schema

**Table: APPEND-LOG**

```sql
CREATE TABLE `{name}` (
  item_id STRING,
  status STRING,
  updated_at STRING
)
```

**Table: UPSERT-LOG**

```sql
CREATE TABLE `{name}` (
  item_id STRING NOT NULL,
  status STRING,
  updated_at STRING,
  PRIMARY KEY (item_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## SQL

### Cell 1 — Insert into append-only log

```sql
INSERT INTO `APPEND-LOG`
VALUES
  ('item-1', 'created', '2026-03-07T10:00:00Z'),
  ('item-1', 'shipped', '2026-03-07T11:00:00Z'),
  ('item-1', 'delivered', '2026-03-07T12:00:00Z');
```

### Cell 2 — Insert into upsert log

```sql
INSERT INTO `UPSERT-LOG`
VALUES
  ('item-1', 'created', '2026-03-07T10:00:00Z'),
  ('item-1', 'shipped', '2026-03-07T11:00:00Z'),
  ('item-1', 'delivered', '2026-03-07T12:00:00Z');
```

### Cell 3 — Read from append-only log

```sql
SELECT
  item_id,
  status,
  updated_at
FROM `APPEND-LOG`;
```

### Cell 4 — Read from upsert log

```sql
SELECT
  item_id,
  status,
  updated_at
FROM `UPSERT-LOG`;
```

## Example Input

```json
{"item_id": "item-1", "status": "created", "updated_at": "2026-03-07T10:00:00Z"}
{"item_id": "item-1", "status": "shipped", "updated_at": "2026-03-07T11:00:00Z"}
{"item_id": "item-1", "status": "delivered", "updated_at": "2026-03-07T12:00:00Z"}
```

## Expected Output

The append-only log retains all three rows because every insert is an independent record:

```json
{"item_id": "item-1", "status": "created", "updated_at": "2026-03-07T10:00:00Z"}
{"item_id": "item-1", "status": "shipped", "updated_at": "2026-03-07T11:00:00Z"}
{"item_id": "item-1", "status": "delivered", "updated_at": "2026-03-07T12:00:00Z"}
```

The upsert log keeps only the latest value per key, so only one row remains for `item-1`:

```json
{"item_id": "item-1", "status": "delivered", "updated_at": "2026-03-07T12:00:00Z"}
```

## Steps to Run

1. Create the `APPEND-LOG` table with the append schema above.
2. Create the `UPSERT-LOG` table with the upsert schema and `changelog.mode` property.
3. Run Cell 1 to insert three status updates into the append-only log.
4. Run Cell 2 to insert the same three status updates into the upsert log.
5. Run Cell 3 and observe all three rows appear in the append-only log.
6. Run Cell 4 and observe only the latest status (`delivered`) appears in the upsert log.
7. Compare the two results to understand why append logs grow while upsert logs stay stable.
