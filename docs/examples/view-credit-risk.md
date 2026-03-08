# Credit Risk by ZIP Code

How exposed is your portfolio to one ZIP code? Aggregate by geography to understand concentration risk. This example builds a materialized view that continuously computes loan count, total exposure, and average loan size per ZIP code from a stream of securitized loan records.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Views |
| **Tags** | Quick Start, Materialized View, Risk |

## Input Schema

```sql
CREATE TABLE `SECURITIZED-LOANS` (
  loan_id STRING,
  zip_code STRING,
  upb DOUBLE,
  origination_date STRING,
  ltv DOUBLE
)
```

## Output Schema

```sql
CREATE TABLE `RISK-BY-ZIP` (
  zip_code STRING NOT NULL,
  loan_count BIGINT,
  total_exposure DOUBLE,
  avg_loan_size DOUBLE,
  PRIMARY KEY (zip_code) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## SQL

### Cell 1 -- Aggregate exposure by ZIP code

```sql
INSERT INTO `RISK-BY-ZIP`
SELECT
  zip_code,
  COUNT(*) AS loan_count,
  SUM(upb) AS total_exposure,
  CAST(AVG(upb) AS DOUBLE) AS avg_loan_size
FROM `SECURITIZED-LOANS`
GROUP BY zip_code
```

### Cell 2 -- Query high-exposure ZIP codes

```sql
SELECT * FROM `RISK-BY-ZIP`
WHERE total_exposure > 1000000
ORDER BY total_exposure DESC
LIMIT 20
```

## Example Input

Records on the `SECURITIZED-LOANS` topic:

```json
{"loan_id": "SL-000001", "zip_code": "90210", "upb": 450000.0, "origination_date": "2022-03-15", "ltv": 0.80}
{"loan_id": "SL-000002", "zip_code": "90210", "upb": 380000.0, "origination_date": "2023-01-10", "ltv": 0.75}
{"loan_id": "SL-000003", "zip_code": "10001", "upb": 275000.0, "origination_date": "2021-06-20", "ltv": 0.85}
{"loan_id": "SL-000004", "zip_code": "90210", "upb": 520000.0, "origination_date": "2024-02-28", "ltv": 0.70}
```

## Expected Output

### Materialized view (Cell 1 output on `RISK-BY-ZIP`)

```json
{"zip_code": "90210", "loan_count": 3, "total_exposure": 1350000.0, "avg_loan_size": 450000.0}
{"zip_code": "10001", "loan_count": 1, "total_exposure": 275000.0, "avg_loan_size": 275000.0}
```

### High-exposure query (Cell 2 output)

Only ZIP code 90210 exceeds the 1,000,000 threshold:

```json
{"zip_code": "90210", "loan_count": 3, "total_exposure": 1350000.0, "avg_loan_size": 450000.0}
```

## Steps to Run

1. **Create the input topic** `SECURITIZED-LOANS` with the input schema DDL above.
2. **Create the output topic** `RISK-BY-ZIP` with the output schema DDL above. Note the `upsert` changelog mode and primary key on `zip_code`.
3. **Deploy the aggregation** by executing SQL Cell 1. The INSERT statement will begin consuming securitized loan records and maintaining running aggregates per ZIP code.
4. **Produce sample records** to `SECURITIZED-LOANS` using the example input JSON above.
5. **Query high-exposure areas** by executing SQL Cell 2 to find ZIP codes where total unpaid principal balance exceeds 1,000,000.
6. **Verify** that ZIP 90210 shows 3 loans with 1,350,000 total exposure, and that ZIP 10001 is excluded from the high-exposure query since its 275,000 total is below the threshold.
