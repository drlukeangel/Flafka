# Kafka Startup Modes

Demonstrates the difference between Kafka consumer startup modes in Flink SQL. This example shows how `scan.startup.mode` controls whether a query reads all historical messages or only new ones arriving after the query starts.

## Metadata

- **Group:** Kafka
- **Tags:** Quick Start, Kafka, Consumer, Offsets

## Input Schema

**Table: EVENTS**

```sql
CREATE TABLE `{name}` (
  event_id STRING,
  event_type STRING,
  payload STRING,
  created_at STRING
)
```

## SQL

### Cell 1 — Read from earliest offset

```sql
SELECT
  event_id,
  event_type,
  payload,
  created_at
FROM `EVENTS`
/*+ OPTIONS('scan.startup.mode' = 'earliest-offset') */;
```

### Cell 2 — Read from latest offset

```sql
SELECT
  event_id,
  event_type,
  payload,
  created_at
FROM `EVENTS`
/*+ OPTIONS('scan.startup.mode' = 'latest-offset') */;
```

## Example Input

```json
{"event_id": "evt-001", "event_type": "click", "payload": "{\"page\": \"home\"}", "created_at": "2026-03-07T09:00:00Z"}
{"event_id": "evt-002", "event_type": "view", "payload": "{\"page\": \"products\"}", "created_at": "2026-03-07T09:01:00Z"}
{"event_id": "evt-003", "event_type": "click", "payload": "{\"page\": \"checkout\"}", "created_at": "2026-03-07T09:02:00Z"}
```

## Expected Output

With `earliest-offset`, the query replays all existing messages from the beginning of the topic before streaming new ones. With `latest-offset`, only messages produced after the query starts will appear.

**earliest-offset result** — all three historical events appear immediately:

```json
{"event_id": "evt-001", "event_type": "click", "payload": "{\"page\": \"home\"}", "created_at": "2026-03-07T09:00:00Z"}
{"event_id": "evt-002", "event_type": "view", "payload": "{\"page\": \"products\"}", "created_at": "2026-03-07T09:01:00Z"}
{"event_id": "evt-003", "event_type": "click", "payload": "{\"page\": \"checkout\"}", "created_at": "2026-03-07T09:02:00Z"}
```

**latest-offset result** — no historical events; only new messages appear as they are produced.

## Steps to Run

1. Create the `EVENTS` table with the schema above.
2. Produce the example input messages into the `EVENTS` topic.
3. Run Cell 1 (`earliest-offset`) and observe all historical messages replayed from the start.
4. Stop Cell 1.
5. Run Cell 2 (`latest-offset`) and observe that no historical messages appear.
6. Produce a new message while Cell 2 is running and verify it appears immediately.
