# Stream Enrichment: Latest Customer Profile Lookup

Every loan arrives with just a customer_id. The temporal join looks up the LATEST customer profile. Unlike the point-in-time temporal join, this pattern joins against a continuously updated table that always reflects the most recent customer state — ideal when you want current data rather than historical accuracy.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Stateful |
| **Tags** | Quick Start, Stateful, Temporal Join, Streaming |

## Input Schema

### LOANS

```sql
CREATE TABLE `{name}` (
  `key`         BYTES,
  loan_id       STRING,
  amount        DOUBLE,
  status        STRING,
  created_at    STRING,
  txn_id        STRING,
  customer_id   STRING
)
```

### CUSTOMERS-LATEST (versioned table)

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

## Output Schema

### STREAM-ENRICHED

```sql
CREATE TABLE `{name}` (
  `key`             BYTES,
  customer_id       STRING,
  txn_id            STRING,
  loan_id           STRING,
  amount            DOUBLE,
  status            STRING,
  customer_name     STRING,
  credit_score      INT
)
```

## SQL

```sql
INSERT INTO `{rid}-STREAM-ENRICHED`
SELECT
  CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS `key`,
  l.customer_id,
  l.txn_id,
  l.loan_id,
  l.amount,
  l.status,
  c.name AS customer_name,
  c.credit_score
FROM `{rid}-LOANS` l
JOIN `{rid}-CUSTOMERS-LATEST` FOR SYSTEM_TIME AS OF l.`$rowtime` AS c
  ON l.customer_id = c.customer_id
```

## Example Input

### Customers-Latest (pre-loaded reference data)

```json
{"customer_id":"C-001","name":"Alice Smith","credit_score":755,"state":"CA","risk_score":30,"risk_level":"LOW"}
{"customer_id":"C-002","name":"Bob Jones","credit_score":690,"state":"TX","risk_score":48,"risk_level":"MEDIUM"}
{"customer_id":"C-003","name":"Carol Davis","credit_score":790,"state":"NY","risk_score":12,"risk_level":"LOW"}
```

### Loans (4 records arriving after customer state is established)

```json
{"loan_id":"LN-00010","amount":35000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0010","created_at":"2025-03-15T12:00:00Z"}
{"loan_id":"LN-00011","amount":62000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0011","created_at":"2025-03-15T12:05:00Z"}
{"loan_id":"LN-00012","amount":15000.00,"status":"APPROVED","customer_id":"C-003","txn_id":"TXN-0012","created_at":"2025-03-15T12:10:00Z"}
{"loan_id":"LN-00013","amount":28000.00,"status":"PENDING","customer_id":"C-001","txn_id":"TXN-0013","created_at":"2025-03-15T12:15:00Z"}
```

## Expected Output

Each loan is enriched with the latest customer profile at the time of the loan event. Both C-001 loans get the same current profile.

```json
{"customer_id":"C-001","txn_id":"TXN-0010","loan_id":"LN-00010","amount":35000.00,"status":"PENDING","customer_name":"Alice Smith","credit_score":755}
{"customer_id":"C-002","txn_id":"TXN-0011","loan_id":"LN-00011","amount":62000.00,"status":"PENDING","customer_name":"Bob Jones","credit_score":690}
{"customer_id":"C-003","txn_id":"TXN-0012","loan_id":"LN-00012","amount":15000.00,"status":"APPROVED","customer_name":"Carol Davis","credit_score":790}
{"customer_id":"C-001","txn_id":"TXN-0013","loan_id":"LN-00013","amount":28000.00,"status":"PENDING","customer_name":"Alice Smith","credit_score":755}
```

## Steps to Run

1. Create the Kafka topics: `LOANS`, `CUSTOMERS-LATEST` (compacted), and `STREAM-ENRICHED`.
2. Register the input DDL for `LOANS` in your Flink SQL environment.
3. Register the input DDL for `CUSTOMERS-LATEST` with its primary key (this table must be backed by a compacted topic or upsert source).
4. Register the output DDL for `STREAM-ENRICHED`.
5. Produce the customer reference records first so the versioned table has state.
6. Produce the loan records.
7. Submit the `INSERT INTO` SQL statement to start the Flink job.
8. Consume from `STREAM-ENRICHED` and verify each loan is enriched with the current customer name and credit score.
