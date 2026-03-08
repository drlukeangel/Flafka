# Golden Record -- Latest Loan State

Multiple updates per loan_id? Materialize the latest state -- one row per loan with LAST_VALUE and GROUP BY. This example creates a materialized view that continuously compacts a stream of loan update events into a single "golden record" per loan, then queries it for distressed loans.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Views |
| **Tags** | Quick Start, Materialized View, Aggregation |

## Input Schema

```sql
CREATE TABLE `LOAN-UPDATES` (
  loan_id STRING,
  status STRING,
  appraisal_value DOUBLE,
  credit_score INT,
  updated_at STRING
)
```

## Output Schema

```sql
CREATE TABLE `LOAN-GOLDEN-RECORD` (
  loan_id STRING NOT NULL,
  latest_status STRING,
  latest_appraisal DOUBLE,
  latest_credit_score INT,
  last_update STRING,
  PRIMARY KEY (loan_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## SQL

### Cell 1 -- Materialize the golden record

```sql
INSERT INTO `LOAN-GOLDEN-RECORD`
SELECT
  loan_id,
  LAST_VALUE(status) AS latest_status,
  LAST_VALUE(appraisal_value) AS latest_appraisal,
  LAST_VALUE(credit_score) AS latest_credit_score,
  MAX(updated_at) AS last_update
FROM `LOAN-UPDATES`
GROUP BY loan_id
```

### Cell 2 -- Query distressed loans

```sql
SELECT * FROM `LOAN-GOLDEN-RECORD`
WHERE latest_status = 'DELINQUENT' AND latest_credit_score < 650
LIMIT 50
```

## Example Input

Records on the `LOAN-UPDATES` topic (note: LN-00001 has two updates):

```json
{"loan_id": "LN-00001", "status": "CURRENT", "appraisal_value": 350000.0, "credit_score": 720, "updated_at": "2025-01-15T10:00:00Z"}
{"loan_id": "LN-00001", "status": "DELINQUENT", "appraisal_value": 340000.0, "credit_score": 640, "updated_at": "2025-02-15T10:00:00Z"}
{"loan_id": "LN-00002", "status": "CURRENT", "appraisal_value": 500000.0, "credit_score": 780, "updated_at": "2025-01-20T10:00:00Z"}
```

## Expected Output

### Golden record (Cell 1 output on `LOAN-GOLDEN-RECORD`)

Each loan_id appears exactly once with the most recent values:

```json
{"loan_id": "LN-00001", "latest_status": "DELINQUENT", "latest_appraisal": 340000.0, "latest_credit_score": 640, "last_update": "2025-02-15T10:00:00Z"}
{"loan_id": "LN-00002", "latest_status": "CURRENT", "latest_appraisal": 500000.0, "latest_credit_score": 780, "last_update": "2025-01-20T10:00:00Z"}
```

### Distressed query (Cell 2 output)

Only LN-00001 matches the filter (status = DELINQUENT and credit_score 640 < 650):

```json
{"loan_id": "LN-00001", "latest_status": "DELINQUENT", "latest_appraisal": 340000.0, "latest_credit_score": 640, "last_update": "2025-02-15T10:00:00Z"}
```

## Steps to Run

1. **Create the input topic** `LOAN-UPDATES` with the input schema DDL above.
2. **Create the output topic** `LOAN-GOLDEN-RECORD` with the output schema DDL above. Note the `upsert` changelog mode and primary key on `loan_id`.
3. **Deploy the materialization** by executing SQL Cell 1. The INSERT statement will begin consuming loan updates and maintaining the latest state per loan_id.
4. **Produce sample records** to `LOAN-UPDATES` using the example input JSON above. Send the LN-00001 records in order so the second update overwrites the first.
5. **Query the golden record** by executing SQL Cell 2 to find distressed loans (DELINQUENT status with credit score below 650).
6. **Verify** that LN-00001 shows its latest state (DELINQUENT, 340000.0, 640) and that LN-00002 is excluded from the distressed query.
