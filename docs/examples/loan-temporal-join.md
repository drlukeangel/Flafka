# Temporal Join: Point-in-Time Loan Enrichment

What was the customer's credit score when they applied — not now, but then? Temporal joins give point-in-time accuracy. This example enriches each loan application with the customer profile that was valid at the exact moment the loan was created, ensuring historical correctness even as customer data changes over time.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Joins |
| **Tags** | Quick Start, Temporal Join, Streaming |

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

### CUSTOMERS (versioned)

```sql
CREATE TABLE `{name}` (
  customer_id   STRING NOT NULL,
  name          STRING,
  credit_score  INT,
  state         STRING,
  valid_from    STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## Output Schema

### LOANS-ENRICHED

```sql
CREATE TABLE `{name}` (
  `key`           BYTES,
  loan_id         STRING,
  customer_id     STRING,
  amount          DOUBLE,
  status          STRING,
  txn_id          STRING,
  customer_name   STRING,
  credit_score    INT,
  state           STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-ENRICHED`
SELECT
  l.loan_id,
  c.name AS customer_name,
  c.credit_score,
  c.state
FROM `{rid}-LOANS` l
JOIN `{rid}-CUSTOMERS` FOR SYSTEM_TIME AS OF l.`$rowtime` AS c
  ON l.customer_id = c.customer_id
```

## Example Input

### Loans (3 records)

```json
{"loan_id":"LN-00001","amount":25000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0001","created_at":"2025-03-15T10:00:00Z"}
{"loan_id":"LN-00002","amount":42000.00,"status":"PENDING","customer_id":"C-002","txn_id":"TXN-0002","created_at":"2025-03-15T10:05:00Z"}
{"loan_id":"LN-00003","amount":18000.00,"status":"APPROVED","customer_id":"C-001","txn_id":"TXN-0003","created_at":"2025-03-15T11:30:00Z"}
```

### Customers (4 records — note C-001 has two versions)

```json
{"customer_id":"C-001","name":"Alice Smith","credit_score":720,"state":"CA","valid_from":"2025-01-10T00:00:00Z"}
{"customer_id":"C-002","name":"Bob Jones","credit_score":680,"state":"TX","valid_from":"2025-02-01T00:00:00Z"}
{"customer_id":"C-001","name":"Alice Smith","credit_score":755,"state":"CA","valid_from":"2025-03-15T11:00:00Z"}
{"customer_id":"C-003","name":"Carol Davis","credit_score":790,"state":"NY","valid_from":"2025-01-20T00:00:00Z"}
```

## Expected Output

LN-00001 and LN-00003 both belong to C-001, but they get different credit scores because the temporal join matches the version valid at each loan's event time.

```json
{"loan_id":"LN-00001","customer_name":"Alice Smith","credit_score":720,"state":"CA"}
{"loan_id":"LN-00002","customer_name":"Bob Jones","credit_score":680,"state":"TX"}
{"loan_id":"LN-00003","customer_name":"Alice Smith","credit_score":755,"state":"CA"}
```

## Steps to Run

1. Create the three Kafka topics: `LOANS`, `CUSTOMERS`, and `LOANS-ENRICHED`.
2. Register the input DDL for `LOANS` and `CUSTOMERS` (versioned/upsert) in your Flink SQL environment.
3. Register the output DDL for `LOANS-ENRICHED`.
4. Produce the example customer records first so that versioned state is available.
5. Produce the example loan records.
6. Submit the `INSERT INTO` SQL statement to start the Flink job.
7. Consume from `LOANS-ENRICHED` to verify each loan is enriched with the correct point-in-time customer profile.
