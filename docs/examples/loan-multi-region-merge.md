# Multi-Region Merge

Three regional loan feeds need to land in one unified topic for enterprise reporting. UNION ALL merges the streams without deduplication, preserving every record from every region in arrival order.

## Metadata

- **Group:** Basics
- **Skill Level:** Beginner
- **Tags:** UNION ALL, Merge, Multi-Region, Streaming

## Input Schema

**Table: LOANS-NORTHEAST**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  region STRING,
  customer_id STRING
)
```

**Table: LOANS-SOUTHEAST**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  region STRING,
  customer_id STRING
)
```

**Table: LOANS-WEST**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  region STRING,
  customer_id STRING
)
```

## Output Schema

**Table: LOANS-UNIFIED**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  region STRING,
  customer_id STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-LOANS-UNIFIED`
SELECT `key`, loan_id, amount, status, created_at, region, customer_id
FROM `{rid}-LOANS-NORTHEAST`
UNION ALL
SELECT `key`, loan_id, amount, status, created_at, region, customer_id
FROM `{rid}-LOANS-SOUTHEAST`
UNION ALL
SELECT `key`, loan_id, amount, status, created_at, region, customer_id
FROM `{rid}-LOANS-WEST`
```

## Completion Steps

1. Create the three regional input topics and the `LOANS-UNIFIED` output topic with matching schemas.
2. Submit the `INSERT INTO` statement to start the UNION ALL merge job.
3. Produce records to each regional topic and verify all appear in `LOANS-UNIFIED` with their original region tags.
