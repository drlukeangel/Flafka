# CDC Pipeline: Latest Customer Snapshot

Database changes stream in via CDC. Downstream only wants the latest. This uses the ROW_NUMBER trick with a descending sort order — the opposite of deduplication — to continuously materialize the most recent version of each customer record from a CDC stream.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Pattern |

## Input Schema

### CUSTOMERS (versioned CDC source)

```sql
CREATE TABLE `{name}` (
  customer_id   STRING NOT NULL,
  name          STRING,
  credit_score  INT,
  state         STRING,
  risk_score    INT,
  risk_level    STRING,
  valid_from    STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## Output Schema

### CUSTOMERS-LATEST

```sql
CREATE TABLE `{name}` (
  customer_id   STRING NOT NULL,
  name          STRING,
  credit_score  INT,
  state         STRING,
  risk_score    INT,
  risk_level    STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
)
```

## SQL

```sql
INSERT INTO `{rid}-CUSTOMERS-LATEST`
SELECT
  CAST(customer_id AS BYTES) AS `key`,
  customer_id,
  name,
  credit_score,
  state,
  risk_score,
  risk_level
FROM (
  SELECT
    customer_id,
    name,
    credit_score,
    state,
    risk_score,
    risk_level,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY $rowtime DESC) AS rownum
  FROM `{rid}-CUSTOMERS`
)
WHERE rownum = 1
```

## Example Input

Five CDC events showing customer profile changes over time. Notice C-001 appears three times as their risk profile evolves.

```json
{"customer_id":"C-001","name":"Alice Smith","credit_score":720,"state":"CA","risk_score":35,"risk_level":"LOW","valid_from":"2025-01-10T00:00:00Z"}
{"customer_id":"C-002","name":"Bob Jones","credit_score":680,"state":"TX","risk_score":55,"risk_level":"MEDIUM","valid_from":"2025-02-01T00:00:00Z"}
{"customer_id":"C-001","name":"Alice Smith","credit_score":695,"state":"CA","risk_score":50,"risk_level":"MEDIUM","valid_from":"2025-02-15T00:00:00Z"}
{"customer_id":"C-003","name":"Carol Davis","credit_score":790,"state":"NY","risk_score":15,"risk_level":"LOW","valid_from":"2025-01-20T00:00:00Z"}
{"customer_id":"C-001","name":"Alice Smith","credit_score":710,"state":"CA","risk_score":42,"risk_level":"MEDIUM","valid_from":"2025-03-01T00:00:00Z"}
```

## Expected Output

Only the latest version of each customer is emitted. C-001 resolves to their most recent update.

```json
{"customer_id":"C-001","name":"Alice Smith","credit_score":710,"state":"CA","risk_score":42,"risk_level":"MEDIUM"}
{"customer_id":"C-002","name":"Bob Jones","credit_score":680,"state":"TX","risk_score":55,"risk_level":"MEDIUM"}
{"customer_id":"C-003","name":"Carol Davis","credit_score":790,"state":"NY","risk_score":15,"risk_level":"LOW"}
```

## Steps to Run

1. Create the Kafka topics: `CUSTOMERS` (compacted) and `CUSTOMERS-LATEST` (compacted).
2. Register the input DDL for `CUSTOMERS` with upsert/changelog mode enabled.
3. Register the output DDL for `CUSTOMERS-LATEST` with its primary key.
4. Produce the five example CDC events in order.
5. Submit the `INSERT INTO` SQL statement to start the Flink job.
6. Consume from `CUSTOMERS-LATEST` and verify that only three records appear — one per customer — each reflecting the most recent version.
