# Loan Async Enrichment

Instant pre-qualification: extract credit data, score it, and get approval probability plus rate quotes -- all in one SQL statement. This example shows how to combine a JSON extraction UDF with an async enrichment UDF that calls an external credit bureau service to produce a fully enriched loan record.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, UDF |

## Input Schema

```sql
CREATE TABLE `LOAN-APPLICATIONS` (
  loan_id STRING,
  json_payload STRING
)
```

## Output Schema

```sql
CREATE TABLE `LOANS-ENRICHED-V2` (
  `key` BYTES,
  loan_id STRING,
  applicant_name STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING,
  dti_ratio STRING,
  score_band STRING,
  approval_probability STRING,
  recommended_rate STRING,
  max_approved_amount STRING,
  risk_tier STRING
)
```

## SQL

### Cell 1 -- Register LoanDetailExtract UDF

```sql
CREATE FUNCTION `{extractFn}` AS 'com.example.udf.LoanDetailExtract';
```

### Cell 2 -- Register CreditBureauEnrich UDF

```sql
CREATE FUNCTION `{enrichFn}` AS 'com.example.udf.CreditBureauEnrich';
```

### Cell 3 -- Extract, enrich, and insert

```sql
INSERT INTO `{output}` (
  `key`, loan_id, applicant_name, loan_type, amount_requested,
  credit_score, risk_level, dti_ratio, score_band,
  approval_probability, recommended_rate, max_approved_amount, risk_tier
)
SELECT
  CAST(loan_id AS BYTES) as `key`,
  loan_id,
  `{extractFn}`(json_payload, 'application.applicant.name.first') as applicant_name,
  `{extractFn}`(json_payload, 'application.loan.type') as loan_type,
  `{extractFn}`(json_payload, 'application.loan.amount_requested') as amount_requested,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio') as dti_ratio,
  `{extractFn}`(`{enrichFn}`(
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
    `{extractFn}`(json_payload, 'application.loan.amount_requested')
  ), 'score_band') as score_band,
  `{extractFn}`(`{enrichFn}`(
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
    `{extractFn}`(json_payload, 'application.loan.amount_requested')
  ), 'approval_probability') as approval_probability,
  `{extractFn}`(`{enrichFn}`(
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
    `{extractFn}`(json_payload, 'application.loan.amount_requested')
  ), 'recommended_rate') as recommended_rate,
  `{extractFn}`(`{enrichFn}`(
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
    `{extractFn}`(json_payload, 'application.loan.amount_requested')
  ), 'max_approved_amount') as max_approved_amount,
  `{extractFn}`(`{enrichFn}`(
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
    `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
    `{extractFn}`(json_payload, 'application.loan.amount_requested')
  ), 'risk_tier') as risk_tier
FROM `{input}`
```

## Example Input

Records on the `LOAN-APPLICATIONS` topic:

```json
{"loan_id": "LN-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\"},\"dti_ratio\":\"0.32\"},\"overall_risk\":\"LOW\"}}}"}
{"loan_id": "LN-00002", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Maria\"}},\"loan\":{\"type\":\"FHA\",\"amount_requested\":\"275000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"685\"},\"dti_ratio\":\"0.41\"},\"overall_risk\":\"MEDIUM\"}}}"}
{"loan_id": "LN-00003", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Robert\"}},\"loan\":{\"type\":\"VA\",\"amount_requested\":\"420000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"798\"},\"dti_ratio\":\"0.25\"},\"overall_risk\":\"LOW\"}}}"}
```

## Expected Output

Records on the `LOANS-ENRICHED-V2` topic:

```json
{"loan_id": "LN-00001", "applicant_name": "James", "loan_type": "CONVENTIONAL", "amount_requested": "350000", "credit_score": "742", "risk_level": "LOW", "dti_ratio": "0.32", "score_band": "PRIME", "approval_probability": "0.92", "recommended_rate": "3.75", "max_approved_amount": "500000", "risk_tier": "TIER_1"}
{"loan_id": "LN-00002", "applicant_name": "Maria", "loan_type": "FHA", "amount_requested": "275000", "credit_score": "685", "risk_level": "MEDIUM", "dti_ratio": "0.41", "score_band": "NEAR_PRIME", "approval_probability": "0.68", "recommended_rate": "5.25", "max_approved_amount": "300000", "risk_tier": "TIER_2"}
{"loan_id": "LN-00003", "applicant_name": "Robert", "loan_type": "VA", "amount_requested": "420000", "credit_score": "798", "risk_level": "LOW", "dti_ratio": "0.25", "score_band": "SUPER_PRIME", "approval_probability": "0.97", "recommended_rate": "3.25", "max_approved_amount": "650000", "risk_tier": "TIER_1"}
```

## Steps to Run

1. **Create the input topic** `LOAN-APPLICATIONS` with the input schema DDL above.
2. **Register the UDFs** by executing SQL Cell 1 and Cell 2 to make `LoanDetailExtract` and `CreditBureauEnrich` available.
3. **Create the output topic** `LOANS-ENRICHED-V2` with the output schema DDL above.
4. **Deploy the pipeline** by executing SQL Cell 3. The INSERT statement will consume loan applications, extract fields, call the credit bureau enrichment service asynchronously, and write enriched records to the output topic.
5. **Produce sample records** to `LOAN-APPLICATIONS` using the example input JSON above.
6. **Verify output** by consuming from `LOANS-ENRICHED-V2` and confirming that each record contains the original extracted fields plus the enrichment columns (score_band, approval_probability, recommended_rate, max_approved_amount, risk_tier).
