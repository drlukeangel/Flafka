# AI Drift Monitor

Is your AI model drifting? A virtual view classifies every prediction as ALIGNED, DISCREPANCY, or LOW_CONFIDENCE_REVIEW. This example creates a lightweight virtual view (no materialized output topic) that labels each audit record based on whether the model's prediction matched the human outcome and whether confidence was sufficient.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Views |
| **Tags** | Quick Start, Virtual View, Compliance |

## Input Schema

```sql
CREATE TABLE `AI-AUDIT-LOG` (
  audit_id STRING,
  model_id STRING,
  prediction STRING,
  human_outcome STRING,
  confidence DOUBLE,
  reviewed_at STRING
)
```

## Output Schema

This example uses a virtual view -- no output DDL or topic is needed. The view is defined inline via `CREATE VIEW`.

## SQL

### Cell 1 -- Create the drift monitor view

```sql
CREATE VIEW `AI-DRIFT-MONITOR` AS
SELECT
  audit_id,
  model_id,
  prediction,
  human_outcome,
  confidence,
  reviewed_at,
  CASE
    WHEN prediction <> human_outcome AND confidence >= 0.5 THEN 'DISCREPANCY'
    WHEN confidence < 0.5 THEN 'LOW_CONFIDENCE_REVIEW'
    ELSE 'ALIGNED'
  END AS audit_status
FROM `AI-AUDIT-LOG`
```

### Cell 2 -- Query flagged predictions

```sql
SELECT * FROM `AI-DRIFT-MONITOR`
WHERE audit_status IN ('DISCREPANCY', 'LOW_CONFIDENCE_REVIEW')
LIMIT 50
```

## Example Input

Records on the `AI-AUDIT-LOG` topic:

```json
{"audit_id": "AUD-000001", "model_id": "MDL-001", "prediction": "APPROVE", "human_outcome": "APPROVE", "confidence": 0.92, "reviewed_at": "2025-02-01T00:00:00Z"}
{"audit_id": "AUD-000002", "model_id": "MDL-001", "prediction": "APPROVE", "human_outcome": "DENY", "confidence": 0.85, "reviewed_at": "2025-02-01T00:07:00Z"}
{"audit_id": "AUD-000003", "model_id": "MDL-002", "prediction": "DENY", "human_outcome": "DENY", "confidence": 0.42, "reviewed_at": "2025-02-01T00:14:00Z"}
```

## Expected Output

### Classification logic

| audit_id | prediction | human_outcome | confidence | audit_status |
|----------|-----------|---------------|------------|--------------|
| AUD-000001 | APPROVE | APPROVE | 0.92 | ALIGNED |
| AUD-000002 | APPROVE | DENY | 0.85 | DISCREPANCY |
| AUD-000003 | DENY | DENY | 0.42 | LOW_CONFIDENCE_REVIEW |

### Flagged query (Cell 2 output)

Only records with DISCREPANCY or LOW_CONFIDENCE_REVIEW status are returned:

```json
{"audit_id": "AUD-000002", "model_id": "MDL-001", "prediction": "APPROVE", "human_outcome": "DENY", "confidence": 0.85, "reviewed_at": "2025-02-01T00:07:00Z", "audit_status": "DISCREPANCY"}
{"audit_id": "AUD-000003", "model_id": "MDL-002", "prediction": "DENY", "human_outcome": "DENY", "confidence": 0.42, "reviewed_at": "2025-02-01T00:14:00Z", "audit_status": "LOW_CONFIDENCE_REVIEW"}
```

## Steps to Run

1. **Create the input topic** `AI-AUDIT-LOG` with the input schema DDL above.
2. **Create the virtual view** by executing SQL Cell 1. This registers `AI-DRIFT-MONITOR` as a virtual view -- no output topic is created.
3. **Produce sample records** to `AI-AUDIT-LOG` using the example input JSON above.
4. **Query flagged predictions** by executing SQL Cell 2. The view computes `audit_status` on the fly for each record.
5. **Verify** that AUD-000001 is classified as ALIGNED (prediction matches outcome, confidence >= 0.5), AUD-000002 as DISCREPANCY (prediction differs from outcome, confidence >= 0.5), and AUD-000003 as LOW_CONFIDENCE_REVIEW (confidence < 0.5 regardless of match).
