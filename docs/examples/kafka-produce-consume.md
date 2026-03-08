# Kafka Produce & Consume

Demonstrates how to produce messages into a Kafka topic with explicit keys and then consume them back. This example highlights Kafka key semantics, partitioning behavior, and how message ordering is guaranteed per key.

## Metadata

- **Group:** Kafka
- **Tags:** Quick Start, Kafka, Keys, Partitioning

## Input Schema

**Table: MESSAGES**

```sql
CREATE TABLE `{name}` (
  user_id STRING NOT NULL,
  message STRING,
  category STRING,
  ts STRING,
  PRIMARY KEY (user_id) NOT ENFORCED
)
```

## Output Schema

**Table: MESSAGES-BY-KEY**

```sql
CREATE TABLE `{name}` (
  user_id STRING NOT NULL,
  message STRING,
  category STRING,
  ts STRING,
  PRIMARY KEY (user_id) NOT ENFORCED
)
```

## SQL

### Cell 1 — Produce messages with explicit keys

```sql
INSERT INTO `MESSAGES-BY-KEY`
SELECT
  user_id,
  message,
  category,
  ts
FROM `MESSAGES`;
```

### Cell 2 — Consume messages back by key

```sql
SELECT
  user_id,
  message,
  category,
  ts
FROM `MESSAGES-BY-KEY`;
```

## Example Input

```json
{"user_id": "user-001", "message": "Hello from user 1", "category": "greeting", "ts": "2026-03-07T10:00:00Z"}
{"user_id": "user-002", "message": "Hello from user 2", "category": "greeting", "ts": "2026-03-07T10:00:01Z"}
{"user_id": "user-001", "message": "Second message from user 1", "category": "update", "ts": "2026-03-07T10:00:02Z"}
```

## Expected Output

Messages in the output topic are keyed by `user_id`. All messages for the same key land in the same partition, preserving ordering per key. The second message from `user-001` is guaranteed to appear after the first.

```json
{"user_id": "user-001", "message": "Hello from user 1", "category": "greeting", "ts": "2026-03-07T10:00:00Z"}
{"user_id": "user-002", "message": "Hello from user 2", "category": "greeting", "ts": "2026-03-07T10:00:01Z"}
{"user_id": "user-001", "message": "Second message from user 1", "category": "update", "ts": "2026-03-07T10:00:02Z"}
```

## Steps to Run

1. Create the `MESSAGES` source table with the schema above.
2. Create the `MESSAGES-BY-KEY` sink table with matching schema and a defined PRIMARY KEY.
3. Run Cell 1 to start the INSERT pipeline that produces keyed messages.
4. Run Cell 2 to consume from `MESSAGES-BY-KEY` and verify messages arrive ordered per key.
5. Produce additional records to `MESSAGES` and observe that same-key messages always land in the same partition.
