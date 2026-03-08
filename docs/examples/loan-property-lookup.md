# Property Lookup Join

When a loan references a property, you need the appraisal value that was current at origination time. A temporal join against a versioned property reference table gives point-in-time accuracy, ensuring each loan gets the appraisal that was valid when the loan event occurred.

## Metadata

- **Group:** Joins
- **Skill Level:** Intermediate
- **Tags:** Temporal Join, Property, Enrichment, Streaming

## Input Schema

**Table: LOANS-WITH-PROPERTY**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  property_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  customer_id STRING
)
```

**Table: PROPERTY-REFERENCE**

```sql
CREATE TABLE `{name}` (
  property_id STRING NOT NULL,
  address STRING,
  appraisal_value DOUBLE,
  property_type STRING,
  last_updated STRING,
  PRIMARY KEY (property_id) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
)
```

## Output Schema

**Table: LOANS-APPRAISED**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  property_id STRING,
  amount DOUBLE,
  status STRING,
  customer_id STRING,
  address STRING,
  appraisal_value DOUBLE,
  property_type STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-APPRAISED`
SELECT
  CAST(l.loan_id AS BYTES) AS `key`,
  l.loan_id,
  l.property_id,
  l.amount,
  l.status,
  l.customer_id,
  p.address,
  p.appraisal_value,
  p.property_type
FROM `{rid}-LOANS-WITH-PROPERTY` l
JOIN `{rid}-PROPERTY-REFERENCE` FOR SYSTEM_TIME AS OF l.`$rowtime` AS p
  ON l.property_id = p.property_id
```

## Completion Steps

1. Create the `LOANS-WITH-PROPERTY` stream topic, the `PROPERTY-REFERENCE` upsert topic, and the `LOANS-APPRAISED` output topic.
2. Populate the property reference table first, then submit the `INSERT INTO` statement.
3. Produce loan records and verify each is enriched with the correct point-in-time appraisal data.
