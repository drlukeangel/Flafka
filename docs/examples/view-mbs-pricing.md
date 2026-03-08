# MBS Pricing -- Temporal Join

What was the market rate when each loan committed? A temporal join virtual view gives point-in-time pricing accuracy. This example joins a stream of loan commitments against a versioned table of market rates using Flink's `FOR SYSTEM_TIME AS OF` syntax to look up the rate that was effective at the moment each commitment was made.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Views |
| **Tags** | Quick Start, Virtual View, Temporal Join |

## Input Schema

### Market Rates (versioned / upsert table -- produce FIRST)

```sql
CREATE TABLE `MARKET-RATES` (
  product_type STRING NOT NULL,
  base_rate DOUBLE,
  spread DOUBLE,
  effective_date STRING,
  PRIMARY KEY (product_type) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

### Loan Commitments (append-only stream -- produce AFTER rates)

```sql
CREATE TABLE `LOAN-COMMITMENTS` (
  commitment_id STRING,
  loan_id STRING,
  product_type STRING,
  principal DOUBLE,
  rate_lock_date STRING
)
```

## Output Schema

This example uses a virtual view -- no output DDL or topic is needed. The view is defined inline via `CREATE VIEW`.

## SQL

### Cell 1 -- Create the temporal join view

```sql
CREATE VIEW `MBS-PRICING-VIEW` AS
SELECT
  c.commitment_id,
  c.loan_id,
  c.product_type,
  c.principal,
  r.base_rate,
  r.spread,
  c.principal * (r.base_rate + r.spread) / 100 AS estimated_yield
FROM `LOAN-COMMITMENTS` c
JOIN `MARKET-RATES` FOR SYSTEM_TIME AS OF c.`$rowtime` AS r
  ON c.product_type = r.product_type
```

### Cell 2 -- Query high-yield commitments

```sql
SELECT * FROM `MBS-PRICING-VIEW`
WHERE estimated_yield > 50000
LIMIT 50
```

## Example Input

### Market Rates (produce these FIRST)

Records on the `MARKET-RATES` topic:

```json
{"product_type": "FIXED_30", "base_rate": 6.5, "spread": 0.75, "effective_date": "2025-01-01T09:00:00Z"}
{"product_type": "FIXED_15", "base_rate": 5.8, "spread": 0.50, "effective_date": "2025-01-01T09:00:00Z"}
{"product_type": "ARM_5_1", "base_rate": 5.2, "spread": 1.10, "effective_date": "2025-01-01T09:00:00Z"}
```

### Loan Commitments (produce these AFTER rates)

Records on the `LOAN-COMMITMENTS` topic:

```json
{"commitment_id": "CMT-000001", "loan_id": "LN-00100", "product_type": "FIXED_30", "principal": 750000.0, "rate_lock_date": "2025-03-01T10:00:00Z"}
{"commitment_id": "CMT-000002", "loan_id": "LN-00200", "product_type": "FIXED_15", "principal": 400000.0, "rate_lock_date": "2025-03-01T12:00:00Z"}
{"commitment_id": "CMT-000003", "loan_id": "LN-00300", "product_type": "ARM_5_1", "principal": 600000.0, "rate_lock_date": "2025-03-01T14:00:00Z"}
```

## Expected Output

### Full view output

The temporal join matches each commitment to the market rate that was effective at that point in time:

```json
{"commitment_id": "CMT-000001", "loan_id": "LN-00100", "product_type": "FIXED_30", "principal": 750000.0, "base_rate": 6.5, "spread": 0.75, "estimated_yield": 54375.0}
{"commitment_id": "CMT-000002", "loan_id": "LN-00200", "product_type": "FIXED_15", "principal": 400000.0, "base_rate": 5.8, "spread": 0.50, "estimated_yield": 25200.0}
{"commitment_id": "CMT-000003", "loan_id": "LN-00300", "product_type": "ARM_5_1", "principal": 600000.0, "base_rate": 5.2, "spread": 1.10, "estimated_yield": 37800.0}
```

### High-yield query (Cell 2 output)

Only CMT-000001 has an estimated_yield above 50,000:

```json
{"commitment_id": "CMT-000001", "loan_id": "LN-00100", "product_type": "FIXED_30", "principal": 750000.0, "base_rate": 6.5, "spread": 0.75, "estimated_yield": 54375.0}
```

## Steps to Run

1. **Create the market rates topic** `MARKET-RATES` with the input schema DDL above. Note the `upsert` changelog mode and primary key on `product_type` -- this is required for temporal joins.
2. **Create the commitments topic** `LOAN-COMMITMENTS` with the input schema DDL above.
3. **Produce market rates FIRST** to `MARKET-RATES` using the example rate records. The rates must exist before commitments arrive so the temporal join can find a matching version.
4. **Create the virtual view** by executing SQL Cell 1. This registers `MBS-PRICING-VIEW` as a virtual view with the temporal join logic.
5. **Produce loan commitments** to `LOAN-COMMITMENTS` using the example commitment records. These must arrive after the rates so that `FOR SYSTEM_TIME AS OF` resolves correctly.
6. **Query high-yield commitments** by executing SQL Cell 2 to find commitments where the estimated annual yield exceeds 50,000.
7. **Verify** that CMT-000001 (FIXED_30, 750K principal, 7.25% combined rate) produces a yield of 54,375 and is the only record returned by the high-yield query.
